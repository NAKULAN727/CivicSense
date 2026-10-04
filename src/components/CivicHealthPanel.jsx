import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, 
  MapPin, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Clock,
  Layers,
  Building2,
  Trash2,
  Trees,
  Droplets
} from 'lucide-react';
import { calculateCivicHealth } from '../services/civicHealthService.js';
import { STUDY_AREAS } from '../data/mockData.js';
import { fetchWeatherData } from '../services/weatherService.js';
import { fetchElevationData } from '../services/elevationService.js';
import { getHistoricalFloodData } from '../services/historicalFloodService.js';
import { fetchPlanetaryComputerSatelliteData } from '../services/planetaryComputerService.js';
import { calculateFloodRiskIndex } from '../services/floodRiskService.js';

export default function CivicHealthPanel({ 
  currentStudyArea = STUDY_AREAS.pallikaranai_velachery, 
  setCurrentStudyArea,
  riskAssessment: externalRiskAssessment,
  waterAnalysisData: externalWaterData,
  visualDetections = null
}) {
  const [internalRiskAssessment, setInternalRiskAssessment] = useState(externalRiskAssessment || null);
  const [isLoading, setIsLoading] = useState(!externalRiskAssessment);

  const LOCATIONS = [
    STUDY_AREAS.pallikaranai_velachery,
    STUDY_AREAS.mumbai,
    STUDY_AREAS.delhi
  ];

  // Fetch telemetry if external riskAssessment is not passed or when currentStudyArea changes
  useEffect(() => {
    if (externalRiskAssessment && externalRiskAssessment.studyArea === currentStudyArea?.name) {
      setInternalRiskAssessment(externalRiskAssessment);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchTelemetry = async () => {
      setIsLoading(true);
      try {
        const [weather, elevation, historical, satellite] = await Promise.all([
          fetchWeatherData(currentStudyArea),
          fetchElevationData(currentStudyArea),
          getHistoricalFloodData(currentStudyArea),
          fetchPlanetaryComputerSatelliteData(currentStudyArea)
        ]);

        if (!isMounted) return;

        const calculated = calculateFloodRiskIndex({
          weather,
          elevation,
          historical,
          satelliteWater: satellite,
          studyArea: currentStudyArea
        });

        setInternalRiskAssessment(calculated);
      } catch (err) {
        console.warn("CivicHealthPanel telemetry fetch error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTelemetry();

    return () => {
      isMounted = false;
    };
  }, [currentStudyArea, externalRiskAssessment]);

  const civicHealth = calculateCivicHealth({
    studyArea: currentStudyArea,
    riskAssessment: internalRiskAssessment || externalRiskAssessment,
    waterAnalysisData: externalWaterData,
    visualDetections
  });

  const {
    studyAreaName = currentStudyArea?.name || 'Pallikaranai–Velachery',
    studyAreaRegion = currentStudyArea?.region || 'Metropolitan Region',
    overallStatus = 'STABLE',
    overallTitle = 'Civic Infrastructure Health Assessment',
    overallLevel = 'STABLE',
    availableCount = 0,
    unavailableCount = 4,
    dimensions = {},
    evidence = [],
    limitations = [],
    formattedTime = new Date().toLocaleTimeString()
  } = civicHealth || {};

  const handleAreaChange = (area) => {
    if (setCurrentStudyArea) {
      setCurrentStudyArea(area);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header & Study Area Selection Bar */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #00a8ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
          }}>
            <HeartPulse size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              CIVICSENSE CIVIC HEALTH INTELLIGENCE
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Multi-Hazard Civic Infrastructure Health Aggregator •</span>
              <MapPin size={12} style={{ color: 'var(--accent-blue)' }} />
              <strong style={{ color: 'var(--text-primary)' }}>Active Location: {studyAreaName} ({studyAreaRegion})</strong>
            </p>
          </div>
        </div>

        {/* Location Selector Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              className={`btn ${currentStudyArea?.id === loc.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleAreaChange(loc)}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: currentStudyArea?.id === loc.id ? '700' : '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MapPin size={13} />
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Overall Assessment Banner */}
      <div className="glass-card" style={{
        padding: '24px',
        border: '1.5px solid rgba(245, 158, 11, 0.4)',
        backgroundColor: 'rgba(245, 158, 11, 0.03)',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '6px 14px',
              borderRadius: '99px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              color: '#f59e0b',
              fontSize: '12px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertTriangle size={15} />
              {overallLevel}
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-header)' }}>
              {overallTitle}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Available Dimensions: <strong style={{ color: '#10b981' }}>{availableCount} / 4</strong></span>
            <span>•</span>
            <span>Unavailable Dimensions: <strong style={{ color: '#f59e0b' }}>{unavailableCount} / 4</strong></span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          This assessment represents a <strong>{overallStatus.toLowerCase()} civic health evaluation</strong> for <strong>{studyAreaName}</strong>. 
          Verified satellite and sensor telemetry are active for <strong>Drainage & Waterlogging</strong>. 
          {dimensions.road.status === 'AVAILABLE' || dimensions.waste.status === 'AVAILABLE' 
            ? ' Real Phase 8C-1 computer vision inference stream is connected for active visual channels.' 
            : ' Street-level visual channels remain marked UNAVAILABLE until image inference is executed in AIDetectionHub.'}
        </p>
      </div>

      {/* 4 Civic Condition Dimension Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Road Condition */}
        <div className="glass-card" style={{
          padding: '20px',
          border: dimensions.road.status === 'AVAILABLE' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-card)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: 'var(--bg-card-solid)'
        }}>
          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 168, 255, 0.12)',
                border: '1px solid rgba(0, 168, 255, 0.3)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building2 size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🛣️ Road Condition
                </h4>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Potholes & Surface Integrity</div>
              </div>
            </div>

            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '99px',
              backgroundColor: dimensions.road.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: dimensions.road.status === 'AVAILABLE' ? '#10b981' : '#f59e0b',
              border: dimensions.road.status === 'AVAILABLE' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)'
            }}>
              {dimensions.road.status}
            </span>
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: dimensions.road.status === 'AVAILABLE' ? '#10b981' : '#f59e0b',
            backgroundColor: dimensions.road.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: dimensions.road.status === 'AVAILABLE' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px dashed rgba(245, 158, 11, 0.3)',
            padding: '8px 12px',
            borderRadius: '6px'
          }}>
            Source: {dimensions.road.sourceType} ({dimensions.road.sourceLabel})
          </div>

          {dimensions.road.status === 'AVAILABLE' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div><strong>Detection Count:</strong> {dimensions.road.count} object(s)</div>
              <div>
                <strong>Detected Issues:</strong>{' '}
                {dimensions.road.count === 0 
                  ? <span style={{ color: '#10b981', fontWeight: '600' }}>No supported road issue detected</span> 
                  : dimensions.road.detectedClasses.join(', ')}
              </div>
              <div>
                <strong>Model Confidence:</strong>{' '}
                {dimensions.road.confidences.length > 0 
                  ? dimensions.road.confidences.map(c => `${Math.round(c * 100)}%`).join(', ') 
                  : 'N/A'}
              </div>
              <div>
                <strong>Location:</strong>{' '}
                <span style={{ color: dimensions.road.latitude !== null ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                  {dimensions.road.location}
                </span>
              </div>
              <div>
                <strong>Capture Time:</strong>{' '}
                <span style={{ color: dimensions.road.timestamp !== 'CAPTURE TIME UNAVAILABLE' ? '#10b981' : 'var(--text-muted)' }}>
                  {dimensions.road.timestamp}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
                {dimensions.road.severityLabel}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {dimensions.road.description}
            </p>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
            <strong>Status Notice:</strong> {dimensions.road.details}
          </div>
        </div>

        {/* Card 2: Waste Condition */}
        <div className="glass-card" style={{
          padding: '20px',
          border: dimensions.waste.status === 'AVAILABLE' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-card)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: 'var(--bg-card-solid)'
        }}>
          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🗑️ Waste Condition
                </h4>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Garbage & Waste Accumulation</div>
              </div>
            </div>

            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '99px',
              backgroundColor: dimensions.waste.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: dimensions.waste.status === 'AVAILABLE' ? '#10b981' : '#f59e0b',
              border: dimensions.waste.status === 'AVAILABLE' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)'
            }}>
              {dimensions.waste.status}
            </span>
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: dimensions.waste.status === 'AVAILABLE' ? '#10b981' : '#f59e0b',
            backgroundColor: dimensions.waste.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: dimensions.waste.status === 'AVAILABLE' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px dashed rgba(245, 158, 11, 0.3)',
            padding: '8px 12px',
            borderRadius: '6px'
          }}>
            Source: {dimensions.waste.sourceType} ({dimensions.waste.sourceLabel})
          </div>

          {dimensions.waste.status === 'AVAILABLE' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div><strong>Detection Count:</strong> {dimensions.waste.count} object(s)</div>
              <div>
                <strong>Detected Issues:</strong>{' '}
                {dimensions.waste.count === 0 
                  ? <span style={{ color: '#10b981', fontWeight: '600' }}>No supported waste issue detected</span> 
                  : dimensions.waste.detectedClasses.join(', ')}
              </div>
              <div>
                <strong>Model Confidence:</strong>{' '}
                {dimensions.waste.confidences.length > 0 
                  ? dimensions.waste.confidences.map(c => `${Math.round(c * 100)}%`).join(', ') 
                  : 'N/A'}
              </div>
              <div>
                <strong>Location:</strong>{' '}
                <span style={{ color: dimensions.waste.latitude !== null ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                  {dimensions.waste.location}
                </span>
              </div>
              <div>
                <strong>Capture Time:</strong>{' '}
                <span style={{ color: dimensions.waste.timestamp !== 'CAPTURE TIME UNAVAILABLE' ? '#10b981' : 'var(--text-muted)' }}>
                  {dimensions.waste.timestamp}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
                {dimensions.waste.severityLabel}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {dimensions.waste.description}
            </p>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
            <strong>Status Notice:</strong> {dimensions.waste.details}
          </div>
        </div>

        {/* Card 3: Drainage & Waterlogging */}
        <div className="glass-card" style={{
          padding: '20px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: 'var(--bg-card-solid)'
        }}>
          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Droplets size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🚰 Drainage & Waterlogging
                </h4>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Surface Water Inundation & Basin Susceptibility</div>
              </div>
            </div>

            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '99px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.4)'
            }}>
              LIVE / DERIVED
            </span>
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '8px 12px',
            borderRadius: '6px'
          }}>
            Source: {dimensions.drainage.sourceType} ({dimensions.drainage.sourceLabel})
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {dimensions.drainage.description}
          </p>

          <div style={{ fontSize: '11px', color: 'var(--text-primary)', borderTop: '1px solid var(--border-card)', paddingTop: '10px', fontWeight: '600' }}>
            <strong>Telemetry Details:</strong> {dimensions.drainage.details}
          </div>
        </div>

        {/* Card 4: Environmental Condition */}
        <div className="glass-card" style={{
          padding: '20px',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: 'var(--bg-card-solid)'
        }}>
          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(192, 132, 252, 0.12)',
                border: '1px solid rgba(192, 132, 252, 0.3)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trees size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🌳 Environmental Condition
                </h4>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wetland Buffer & Canopy Cover</div>
              </div>
            </div>

            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '99px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.4)'
            }}>
              UNAVAILABLE
            </span>
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            padding: '8px 12px',
            borderRadius: '6px'
          }}>
            Source: {dimensions.environment.sourceType} ({dimensions.environment.sourceLabel})
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {dimensions.environment.description}
          </p>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
            <strong>Status Notice:</strong> {dimensions.environment.details}
          </div>
        </div>

      </div>

      {/* Evidentiary Basis & System Limitations Panel */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed var(--border-card)',
        borderRadius: '12px',
        padding: '20px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={16} style={{ color: 'var(--accent-blue)' }} />
          Evidentiary Basis & System Architecture Transparency
        </div>

        <div>
          <strong style={{ color: '#10b981', display: 'block', marginBottom: '4px' }}>Active Telemetry Feeds ({evidence.length}):</strong>
          {evidence.length > 0 ? (
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              {evidence.map((ev, i) => (
                <li key={i} style={{ marginBottom: '2px' }}>{ev}</li>
              ))}
            </ul>
          ) : (
            <div>No active telemetry streams registered.</div>
          )}
        </div>

        <div>
          <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '4px' }}>System Boundaries & Data Requirements:</strong>
          <ul style={{ paddingLeft: '18px', margin: 0 }}>
            {limitations.map((lim, i) => (
              <li key={i} style={{ marginBottom: '2px' }}>{lim}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Visual Detection Architecture Interface Disclaimer */}
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        borderTop: '1px solid var(--border-card)',
        paddingTop: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Clock size={13} style={{ flexShrink: 0, color: 'var(--accent-blue)' }} />
        <span>
          <strong>Phase 8B — Civic Health Foundation</strong>: Architecture is pre-configured to receive YOLOv8 visual bounding box detections for Road and Waste dimensions. Evaluated deterministically at {formattedTime}.
        </span>
      </div>

    </div>
  );
}
