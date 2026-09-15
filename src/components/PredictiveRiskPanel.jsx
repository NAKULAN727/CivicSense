import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  Clock, 
  Info, 
  CloudRain, 
  Globe, 
  Mountain, 
  History,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { fetchWeatherData } from '../services/weatherService.js';
import { calculatePredictiveRisk } from '../services/predictiveRiskService.js';
import { recordRiskObservation, getStoredRiskHistory } from '../services/riskHistoryService.js';

export default function PredictiveRiskPanel({ currentStudyArea, riskAssessment, weatherData }) {
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadPrediction = async () => {
      if (riskAssessment) {
        let wData = weatherData;
        if (!wData) {
          try {
            wData = await fetchWeatherData(currentStudyArea);
          } catch (e) {
            console.warn("Weather fetch error in PredictiveRiskPanel:", e);
          }
        }

        if (!isMounted) return;

        const pred = calculatePredictiveRisk(riskAssessment, wData);
        setPrediction(pred);

        if (!pred.error) {
          recordRiskObservation(
            currentStudyArea?.name || riskAssessment.studyArea,
            pred.currentScore,
            pred.currentLevel,
            pred.predictedScore48h,
            pred.trend
          );
          const stored = getStoredRiskHistory(currentStudyArea?.name || riskAssessment.studyArea);
          setHistory(stored);
        }
      } else {
        setPrediction(null);
      }
    };

    loadPrediction();
    return () => { isMounted = false; };
  }, [currentStudyArea?.name, riskAssessment, weatherData]);

  if (!prediction) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock size={20} className="spin-icon" style={{ marginBottom: '8px' }} />
        <div>Initializing Short-Term Predictive Risk Engine...</div>
        <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--text-secondary)' }}>
          Awaiting Phase 4 Risk Index & Weather Forecast telemetry...
        </div>
      </div>
    );
  }

  if (prediction.error) {
    return (
      <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontWeight: '700' }}>
          <AlertTriangle size={20} />
          <span>Predictive Risk Engine Notice</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          {prediction.message}
        </p>
      </div>
    );
  }

  const {
    currentScore,
    currentLevel,
    predictedScore24h,
    predictedLevel24h,
    predictedScore48h,
    predictedLevel48h,
    predictedScore72h,
    predictedLevel72h,
    trend,
    trendReason,
    earlyWarning,
    drivers,
    mode,
    formattedTime
  } = prediction;

  const getTrendStyle = (t) => {
    switch (t) {
      case 'INCREASING':
        return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.4)', icon: TrendingUp, label: 'INCREASING RISK' };
      case 'DECREASING':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', icon: TrendingDown, label: 'DECREASING RISK' };
      default:
        return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', icon: Minus, label: 'STABLE RISK' };
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'CRITICAL': return '#f43f5e';
      case 'HIGH': return '#ef4444';
      case 'MODERATE': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const trendStyle = getTrendStyle(trend);
  const TrendIcon = trendStyle.icon;

  // Render responsive SVG Risk Trend Curve
  const chartPoints = [
    { label: 'Now', score: currentScore, level: currentLevel },
    { label: '24h', score: predictedScore24h, level: predictedLevel24h },
    { label: '48h', score: predictedScore48h, level: predictedLevel48h },
    { label: '72h', score: predictedScore72h, level: predictedLevel72h }
  ];

  const svgWidth = 320;
  const svgHeight = 70;
  const paddingX = 35;
  const stepX = (svgWidth - (paddingX * 2)) / 3;

  const getSvgY = (val) => {
    // Map score 0-100 to Y coordinates (paddingTop: 10, paddingBottom: 15)
    return svgHeight - 15 - ((val / 100) * (svgHeight - 25));
  };

  const pathPoints = chartPoints.map((pt, i) => `${paddingX + (i * stepX)},${getSvgY(pt.score)}`).join(' L ');
  const pathD = `M ${pathPoints}`;

  return (
    <div className="glass-card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '20px', 
      padding: '24px',
      border: '1px solid var(--border-card)'
    }}>

      {/* Header & Source Mode Badges */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(192, 132, 252, 0.3)'
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              PREDICTIVE RISK FORECAST & TREND INTELLIGENCE
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Deterministic 24–72 Hour Short-Term Flood Vulnerability Projection
            </p>
          </div>
        </div>

        {/* Mode Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: '800',
            color: trendStyle.color,
            backgroundColor: trendStyle.bg,
            border: `1px solid ${trendStyle.border}`,
            padding: '3px 10px',
            borderRadius: '99px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <TrendIcon size={13} />
            {trendStyle.label}
          </span>

          <span style={{ 
            fontSize: '10px', 
            fontWeight: '800', 
            color: '#c084fc', 
            backgroundColor: 'rgba(192, 132, 252, 0.15)', 
            border: '1px solid rgba(192, 132, 252, 0.4)',
            padding: '3px 9px', 
            borderRadius: '99px' 
          }}>
            {mode} PROTOTYPE
          </span>
        </div>
      </div>

      {/* Early Warning Banner */}
      <div style={{
        backgroundColor: earlyWarning.hasEscalation ? 'rgba(244, 63, 94, 0.12)' : 'rgba(56, 189, 248, 0.08)',
        border: `1px solid ${earlyWarning.hasEscalation ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.25)'}`,
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12px'
      }}>
        {earlyWarning.hasEscalation ? (
          <AlertTriangle size={20} style={{ color: '#f43f5e', flexShrink: 0 }} />
        ) : (
          <Sparkles size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
        )}
        <div style={{ color: 'var(--text-primary)', lineHeight: '1.4' }}>
          <strong style={{ color: earlyWarning.hasEscalation ? '#f43f5e' : '#38bdf8', marginRight: '6px' }}>
            {earlyWarning.hasEscalation ? 'PREDICTIVE EARLY WARNING:' : 'FORECAST ADVISORY:'}
          </strong>
          {earlyWarning.message}
        </div>
      </div>

      {/* Grid: 4 Projection Cards + Trend Curve Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        
        {/* Card 1: Current Score */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Current Risk</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: getLevelColor(currentLevel), fontFamily: 'var(--font-header)', marginTop: '4px' }}>
            {currentScore} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '800', color: getLevelColor(currentLevel), backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '99px', marginTop: '4px' }}>
            {currentLevel}
          </span>
        </div>

        {/* Card 2: 24h Projection */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>24h Projection</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: getLevelColor(predictedLevel24h), fontFamily: 'var(--font-header)', marginTop: '4px' }}>
            {predictedScore24h} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '800', color: getLevelColor(predictedLevel24h), backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '99px', marginTop: '4px' }}>
            {predictedLevel24h}
          </span>
        </div>

        {/* Card 3: 48h Projection */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>48h Projection</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: getLevelColor(predictedLevel48h), fontFamily: 'var(--font-header)', marginTop: '4px' }}>
            {predictedScore48h} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '800', color: getLevelColor(predictedLevel48h), backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '99px', marginTop: '4px' }}>
            {predictedLevel48h}
          </span>
        </div>

        {/* Card 4: 72h Projection */}
        <div style={{
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>72h Projection</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: getLevelColor(predictedLevel72h), fontFamily: 'var(--font-header)', marginTop: '4px' }}>
            {predictedScore72h} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '800', color: getLevelColor(predictedLevel72h), backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '99px', marginTop: '4px' }}>
            {predictedLevel72h}
          </span>
        </div>

      </div>

      {/* SVG Trend Curve Visualization Box */}
      <div style={{
        backgroundColor: 'var(--bg-card-solid)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div className="flex-between">
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={15} /> Short-Term Risk Index Progression Curve
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Rationale: {trendReason}
          </span>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: '10px 0' }}>
          <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
            {/* Grid Line Baseline */}
            <line x1={paddingX} y1={svgHeight - 15} x2={svgWidth - paddingX} y2={svgHeight - 15} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            
            {/* Trend Polyline */}
            <path d={pathD} fill="none" stroke={trendStyle.color} strokeWidth="2.5" strokeLinecap="round" />
            
            {/* Curve Points */}
            {chartPoints.map((pt, idx) => {
              const cx = paddingX + (idx * stepX);
              const cy = getSvgY(pt.score);
              return (
                <g key={idx}>
                  <circle cx={cx} cy={cy} r="5" fill="#0f172a" stroke={getLevelColor(pt.level)} strokeWidth="2.5" />
                  <text x={cx} y={cy - 10} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
                    {pt.score}
                  </text>
                  <text x={cx} y={svgHeight - 2} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                    {pt.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Main Drivers Telemetry Grid */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-card)',
        borderRadius: '10px',
        padding: '16px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          Key Telemetry Forecast Drivers
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '11px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CloudRain size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Rainfall Forecast:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{drivers.rainfallForecast}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Satellite NDWI Change:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{drivers.satelliteWaterChange}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mountain size={16} style={{ color: '#c084fc', flexShrink: 0 }} />
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Terrain Elevation:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{drivers.elevation}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={16} style={{ color: '#facc15', flexShrink: 0 }} />
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Historical Reference:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{drivers.historical}</strong>
            </div>
          </div>

        </div>
      </div>

      {/* Stored Risk History Audit Trail (if available) */}
      {history.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>Stored Session Observations ({history.length}):</span>{' '}
          {history.slice(0, 3).map((item, idx) => (
            <span key={item.id || idx} style={{ marginRight: '12px' }}>
              [{item.formattedTime}] {item.location}: <strong style={{ color: getLevelColor(item.riskLevel) }}>{item.riskScore}/100 ({item.riskLevel})</strong> ➔ 48h Est: {item.predictedScore48h}
            </span>
          ))}
        </div>
      )}

      {/* Transparent System Disclaimer */}
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        borderTop: '1px solid var(--border-card)',
        paddingTop: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Info size={13} style={{ flexShrink: 0, color: 'var(--accent-blue)' }} />
        <span>
          <strong>Phase 6 — Predictive Risk Prototype</strong>: Short-term risk projection is derived from rule-based multi-factor telemetry (Forecast precipitation + Satellite NDWI + Elevation). It is not a trained ML flood probability model. Last evaluated at {formattedTime}.
        </span>
      </div>

    </div>
  );
}
