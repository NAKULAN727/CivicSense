import React, { useState } from 'react';
import { 
  Cpu, 
  Play, 
  RotateCw, 
  CheckCircle2, 
  Layers, 
  CloudRain, 
  Mountain, 
  History, 
  Globe, 
  Sparkles
} from 'lucide-react';
import { INITIAL_AI_RISK_ENGINE_SCORES } from '../data/mockData.js';

export default function AIRiskEngine({ currentStudyArea, onAnalysisComplete }) {
  const [riskScores, setRiskScores] = useState(INITIAL_AI_RISK_ENGINE_SCORES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const processingSteps = [
    "Ingesting Sentinel-2 L2A STAC imagery (Microsoft Planetary Computer)...",
    "Streaming Open-Meteo precipitation & weather telemetry...",
    "Querying Open-Elevation / Copernicus DEM surface terrain model...",
    "Loading historical flood reference archives (IMD / TNSDMA)...",
    "Executing multi-modal data fusion pipeline...",
    "Phase 3 Multi-Modal Input Ingestion Complete!"
  ];

  const handleRunAnalysis = () => {
    setIsProcessing(true);
    setCurrentStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < processingSteps.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
        setIsProcessing(false);

        // Freeze demonstration scores (Phase 4 will calculate live AI risk score)
        const updated = riskScores.map(item => ({ ...item }));

        setRiskScores(updated);
        const newTime = new Date().toLocaleTimeString();
        setLastUpdated(newTime);

        if (onAnalysisComplete) {
          onAnalysisComplete(updated, newTime);
        }
      }
    }, 600);
  };

  const getScoreBadgeColor = (level) => {
    switch (level) {
      case 'HIGH':
      case 'CRITICAL':
        return { bg: 'rgba(244, 63, 94, 0.12)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.3)' };
      case 'MODERATE':
        return { bg: 'rgba(234, 179, 8, 0.12)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* Card Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              AI Community Risk Engine
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Multi-modal spatial risk preview for <strong>{currentStudyArea?.name || 'Selected Area'}</strong> <span style={{ opacity: 0.8, fontSize: '10px', marginLeft: '6px', color: '#facc15' }}>(DEMONSTRATION SCORES - Phase 4 AI Engine)</span>
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          className="btn btn-primary"
          onClick={handleRunAnalysis}
          disabled={isProcessing}
          style={{
            padding: '10px 18px',
            fontSize: '12px',
            fontWeight: '700',
            background: isProcessing
              ? 'rgba(0,168,255,0.3)'
              : 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
            boxShadow: '0 4px 14px rgba(0, 168, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isProcessing ? (
            <>
              <RotateCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
              Ingesting Data Vectors...
            </>
          ) : (
            <>
              <Play size={15} />
              Run Data Ingestion
            </>
          )}
        </button>
      </div>

      {/* Simulated Processing Log Overlay */}
      {isProcessing && (
        <div style={{
          backgroundColor: '#050a14',
          border: '1px solid var(--accent-blue)',
          borderRadius: '10px',
          padding: '14px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#38bdf8',
          boxShadow: '0 0 20px rgba(0, 168, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#fff' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-purple)', animation: 'pulse 1s infinite' }} />
            Phase 3 Environmental Input Ingestion Pipeline
          </div>
          <div style={{ color: '#94a3b8' }}>
            &gt; {processingSteps[currentStep]}
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
            <div style={{ 
              width: `${((currentStep + 1) / processingSteps.length) * 100}%`, 
              height: '100%', 
              backgroundColor: '#00a8ff', 
              transition: 'width 0.4s ease' 
            }} />
          </div>
        </div>
      )}

      {/* Primary Risk Scores Display (Explicitly labeled DEMONSTRATION SCORES) */}
      <div className="grid-2" style={{ gap: '16px', marginBottom: 0 }}>
        {riskScores.map(risk => {
          const style = getScoreBadgeColor(risk.level);
          return (
            <div
              key={risk.id}
              style={{
                backgroundColor: 'var(--bg-card-solid)',
                border: `1px solid ${style.border}`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease, border-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>{risk.icon}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>{risk.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{risk.trend}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: risk.color, fontFamily: 'var(--font-header)' }}>
                  {risk.score}%
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: style.text,
                  backgroundColor: style.bg,
                  border: `1px solid ${style.border}`,
                  padding: '2px 8px',
                  borderRadius: '99px'
                }}>
                  DEMO: {risk.level}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Technical Multi-Modal Fusion Architecture Card */}
      <div style={{
        backgroundColor: 'rgba(0, 168, 255, 0.04)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-blue)', marginBottom: '8px' }}>
          Phase 3 Environmental Data Ingestion Feeds
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
          Connected multi-modal environmental feeds providing live input vectors for the target study area:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <Globe size={14} style={{ color: '#38bdf8' }} /> STAC Imagery (Planetary Computer)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <CloudRain size={14} style={{ color: '#38bdf8' }} /> Weather telemetry (Open-Meteo)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <Mountain size={14} style={{ color: '#c084fc' }} /> Elevation (Open-Elevation DEM)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <History size={14} style={{ color: '#facc15' }} /> Flood Records (IMD Archives)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <Layers size={14} style={{ color: '#f43f5e' }} /> Risk Engine (Phase 4 Target)
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-card)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Pipeline Sync: <strong>{lastUpdated}</strong></span>
          <span style={{ color: '#facc15', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Model Status: DEMONSTRATION MODE (Phase 4 Pending)
          </span>
        </div>
      </div>

    </div>
  );
}
