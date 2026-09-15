import React, { useState, useEffect, useCallback } from 'react';
import { 
  CloudRain, 
  Thermometer, 
  Droplets, 
  Mountain, 
  History, 
  Globe, 
  RefreshCw, 
  Calendar, 
  AlertTriangle,
  Clock,
  Info
} from 'lucide-react';
import { fetchWeatherData } from '../services/weatherService.js';
import { fetchElevationData } from '../services/elevationService.js';
import { getHistoricalFloodData } from '../services/historicalFloodService.js';

export default function EnvironmentalDataPanel({ currentStudyArea }) {
  const [weatherData, setWeatherData] = useState(null);
  const [elevationData, setElevationData] = useState(null);
  const [historicalData, setHistoricalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEnvironmentalData = useCallback(async (isMountedRef = { current: true }) => {
    setIsLoading(true);
    try {
      const [wData, eData, hData] = await Promise.all([
        fetchWeatherData(currentStudyArea),
        fetchElevationData(currentStudyArea),
        getHistoricalFloodData(currentStudyArea)
      ]);

      if (isMountedRef.current) {
        setWeatherData(wData);
        setElevationData(eData);
        setHistoricalData(hData);
      }
    } catch (err) {
      console.warn("Environmental data fetch error:", err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [currentStudyArea]);

  useEffect(() => {
    const isMountedRef = { current: true };
    loadEnvironmentalData(isMountedRef);

    return () => {
      isMountedRef.current = false;
    };
  }, [currentStudyArea?.name, loadEnvironmentalData]);

  if (isLoading || !weatherData || !elevationData || !historicalData) {
    return (
      <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={24} className="spin-icon" style={{ color: 'var(--accent-blue)', marginBottom: '10px' }} />
        <p style={{ fontSize: '13px', fontWeight: '600' }}>Fetching Live Environmental Data (Open-Meteo & Open-Elevation)...</p>
      </div>
    );
  }

  const forecastList = Array.isArray(weatherData?.forecast) ? weatherData.forecast : [];
  const historicalRecords = Array.isArray(historicalData?.records) ? historicalData.records : [];

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              Supporting Environmental Intelligence
            </h3>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '4px 10px',
              borderRadius: '99px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Globe size={11} /> Phase 3 Live Inputs
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Real-time weather telemetry, terrain elevation, and historical flood records for <strong>{currentStudyArea?.name || 'Selected Area'}</strong>
          </p>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={() => loadEnvironmentalData()}
          style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={12} /> Sync Environmental Feeds
        </button>
      </div>

      {/* 3-Column Grid for Weather, Elevation, Historical Reference */}
      <div className="grid-3" style={{ gap: '20px', marginBottom: 0 }}>
        
        {/* 1. WEATHER CARD */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <CloudRain size={16} style={{ color: '#38bdf8' }} /> Real-Time Weather
              </div>

              {/* LIVE/DEMO/RATE-LIMITED BADGE */}
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: weatherData.isLive ? '#10b981' : weatherData.isRateLimited ? '#f59e0b' : '#f59e0b',
                backgroundColor: weatherData.isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${weatherData.isLive ? '#10b981' : '#f59e0b'}`,
                padding: '2px 8px',
                borderRadius: '99px'
              }}>
                {weatherData.mode || 'LIVE'} MODE
              </span>
            </div>

            {/* Error / Rate Limit Warning if Weather API Notice */}
            {weatherData.isError && (
              <div style={{ fontSize: '11px', color: '#f87171', backgroundColor: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> {weatherData.errorMessage}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Thermometer size={12} style={{ color: '#f87171' }} /> Temperature
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {weatherData.temperature !== undefined ? weatherData.temperature : 'N/A'}{weatherData.tempUnit || '°C'}
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Droplets size={12} style={{ color: '#38bdf8' }} /> Humidity
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                  {weatherData.humidity !== undefined ? weatherData.humidity : 'N/A'}{weatherData.humidityUnit || '%'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Current Rain: <strong>{weatherData.rainfall || 0} {weatherData.rainUnit || 'mm'}</strong></span>
              <span>Rain Prob: <strong>{weatherData.precipitationProbability || 0}%</strong></span>
            </div>

            {/* 3-Day Forecast Strip */}
            <div style={{ backgroundColor: 'rgba(0,168,255,0.04)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-card)', fontSize: '11px' }}>
              <div style={{ fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}>
                Precipitation Forecast
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {forecastList.length > 0 ? (
                  forecastList.map((fc, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>{fc.day}</div>
                      <div style={{ color: '#38bdf8', fontWeight: '800' }}>{fc.rainMm} mm</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Forecast unavailable</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-card)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Source: <strong>{weatherData.source || 'Open-Meteo'}</strong></span>
            <span>Updated: {weatherData.formattedTime || 'N/A'}</span>
          </div>
        </div>

        {/* 2. ELEVATION CARD */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <Mountain size={16} style={{ color: '#c084fc' }} /> Terrain Elevation
              </div>

              {/* LIVE/DEMO BADGE */}
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: elevationData.isLive ? '#10b981' : '#f59e0b',
                backgroundColor: elevationData.isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${elevationData.isLive ? '#10b981' : '#f59e0b'}`,
                padding: '2px 8px',
                borderRadius: '99px'
              }}>
                {elevationData.mode || 'LIVE'} MODE
              </span>
            </div>

            {/* Error Warning if Elevation API Failed */}
            {elevationData.isError && (
              <div style={{ fontSize: '11px', color: '#f87171', backgroundColor: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> {elevationData.errorMessage}
              </div>
            )}

            <div style={{ backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.25)', padding: '14px', borderRadius: '10px', textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                Mean Surface Elevation
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#c084fc', fontFamily: 'var(--font-header)', margin: '4px 0' }}>
                {elevationData.elevation !== undefined ? elevationData.elevation : 'N/A'} {elevationData.unit || 'm ASL'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Coordinates: [{elevationData.latitude || currentStudyArea?.lat}, {elevationData.longitude || currentStudyArea?.lng}]
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>Topographic Assessment:</strong> Ground elevation of {elevationData.elevation}m ASL flags low-lying basin vulnerability for {currentStudyArea?.name || 'study area'}.
            </div>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-card)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Source: <strong>{elevationData.source || 'Open-Elevation'}</strong></span>
            <span>Live DEM Query</span>
          </div>
        </div>

        {/* 3. HISTORICAL FLOOD REFERENCE CARD */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <History size={16} style={{ color: '#facc15' }} /> Historical Flood Records
              </div>

              {/* HISTORICAL REFERENCE BADGE (Explicitly non-live) */}
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: '#facc15',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid #facc15',
                padding: '2px 8px',
                borderRadius: '99px'
              }}>
                HISTORICAL REFERENCE
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
              {historicalRecords.map((rec) => (
                <div key={rec.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-card)', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#facc15' }}>
                    <span>{rec.eventName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{rec.date}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Rainfall: <strong>{rec.rainfallMm}mm ({rec.rainfallPeriod})</strong> • Depth: <strong>{rec.inundationDepth}</strong>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
                    {rec.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-card)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Source: <strong>{historicalData.source || 'Official Archives'}</strong></span>
            <span>Official Archives</span>
          </div>
        </div>

      </div>

    </div>
  );
}
