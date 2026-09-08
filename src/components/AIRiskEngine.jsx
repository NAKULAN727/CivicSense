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
  Sparkles,
  ShieldAlert,
  Flame,
  Droplets,
  Trees
} from 'lucide-react';
import { INITIAL_AI_RISK_ENGINE_SCORES } from '../data/mockData';

export default function AIRiskEngine({ onAnalysisComplete }) {
  const [riskScores, setRiskScores] = useState(INITIAL_AI_RISK_ENGINE_SCORES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const processingSteps = [
    "Ingesting Sentinel-2 Multispectral & Sentinel-1 SAR Radar imagery...",
    "Querying IMD precipitation telemetry (184mm 24h accumulation)...",
    "Fusing SRTM Digital Elevation Model (2.1m ASL low-lying basin)...",
    "Loading 10-year historical flood recurrence raster matrix...",
    "Running multi-modal AI risk inference engine (Random Forest + CNN)...",
    "AI Risk Evaluation Complete!"
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

        // Simulate newly calculated dynamic AI risk values
        const updated = riskScores.map(item => {
          let delta = Math.floor(Math.random() * 5) - 2;
          let newScore = Math.min(98, Math.max(20, item.score + delta));
          let newLevel = newScore > 75 ? 'HIGH' : newScore > 40 ? 'MODERATE' : 'LOW';
          return { ...item, score: newScore, level: newLevel };
        });

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
            Real-time multi-modal spatial risk calculation for <strong>Pallikaranai–Velachery</strong>
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
              Processing AI Engine...
            </>
          ) : (
            <>
              <Play size={15} />
              Run AI Risk Analysis
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
            AI Multi-Modal Data Fusion Pipeline Execution
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

      {/* Primary Risk Scores Display */}
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
                  {risk.level}
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
          How the Real System Fuses Data Inputs
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
          The CivicSense AI risk calculation fuses five disparate multi-modal data vectors into a unified spatial risk score:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <Globe size={14} style={{ color: '#38bdf8' }} /> Satellite imagery
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <CloudRain size={14} style={{ color: '#38bdf8' }} /> Weather data
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <Mountain size={14} style={{ color: '#c084fc' }} /> Elevation data
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <History size={14} style={{ color: '#facc15' }} /> Historical risk
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-card-solid)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <Layers size={14} style={{ color: '#f43f5e' }} /> Geospatial info
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-card)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Last Model Execution: <strong>{lastUpdated}</strong></span>
          <span style={{ color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Model Confidence: 94.2%
          </span>
        </div>
      </div>

    </div>
  );
}
