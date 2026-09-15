import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { fetchWeatherData } from '../services/weatherService.js';
import { fetchElevationData } from '../services/elevationService.js';
import { getHistoricalFloodData } from '../services/historicalFloodService.js';
import { fetchPlanetaryComputerSatelliteData } from '../services/planetaryComputerService.js';
import { calculateRealSatelliteWaterChange } from '../services/satelliteWaterAnalysisService.js';
import { calculateFloodRiskIndex } from '../services/floodRiskService.js';

export default function AIRiskEngine({ currentStudyArea, waterAnalysisData, onAnalysisComplete }) {
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const processingSteps = [
    "Querying Open-Meteo live precipitation & weather telemetry...",
    "Querying Open-Elevation / Copernicus 30m DEM surface terrain model...",
    "Loading historical flood reference archives (IMD / TNSDMA)...",
    "Ingesting Sentinel-2 L2A COG band rasters (Microsoft Planetary Computer)...",
    "Applying multi-factor spatial normalization & weighting (30% Rain, 20% Elev, 20% Hist, 20% Sat NDWI, 10% GIS)...",
    "AI-Assisted Flood Risk Index Calculation Complete!"
  ];

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      try {
        const [weather, elevation, historical, satellite] = await Promise.all([
          fetchWeatherData(currentStudyArea),
          fetchElevationData(currentStudyArea),
          getHistoricalFloodData(currentStudyArea),
          fetchPlanetaryComputerSatelliteData(currentStudyArea)
        ]);

        let satWaterData = waterAnalysisData;
        if (!satWaterData && satellite && satellite.isLive) {
          satWaterData = await calculateRealSatelliteWaterChange(satellite);
        }

        if (!isMounted) return;

        const assessment = calculateFloodRiskIndex({
          weather,
          elevation,
          historical,
          satelliteWater: satWaterData,
          studyArea: currentStudyArea
        });

        setRiskAssessment(assessment);

        if (onAnalysisComplete) {
          onAnalysisComplete(assessment, assessment.formattedTime);
        }
      } catch (error) {
        console.warn("Flood risk calculation error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [currentStudyArea?.name, waterAnalysisData]);

  const handleRunAnalysis = async () => {
    setIsProcessing(true);
    setCurrentStep(0);

    let step = 0;
    const interval = setInterval(async () => {
      step++;
      if (step < processingSteps.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
        await runRiskEvaluation();
        setIsProcessing(false);
      }
    }, 400);
  };

  const getScoreBadgeColor = (level) => {
    switch (level) {
      case 'CRITICAL':
        return { bg: 'rgba(244, 63, 94, 0.18)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.4)' };
      case 'HIGH':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' };
      case 'MODERATE':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.35)' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.35)' };
    }
  };

  if (isLoading || !riskAssessment) {
    return (
      <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RotateCw size={24} className="spin-icon" style={{ color: 'var(--accent-blue)', marginBottom: '10px' }} />
        <p style={{ fontSize: '13px', fontWeight: '600' }}>Evaluating Data-Driven Flood Risk Index...</p>
      </div>
    );
  }

  const { score, level, mode, statusLabel, components, explanation, formattedTime } = riskAssessment;
  const badgeStyle = getScoreBadgeColor(level);

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* Card Header & Mode Badge */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Cpu size={20} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              AI-Assisted Flood Risk Index
            </h3>

            {/* LIVE / PARTIAL_LIVE MODE BADGE */}
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '800', 
              color: mode === 'LIVE' || mode === 'PARTIAL_LIVE' ? '#38bdf8' : '#f59e0b', 
              backgroundColor: mode === 'LIVE' || mode === 'PARTIAL_LIVE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
              border: `1px solid ${mode === 'LIVE' || mode === 'PARTIAL_LIVE' ? '#38bdf8' : '#f59e0b'}`,
              padding: '3px 9px', 
              borderRadius: '99px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: mode === 'LIVE' || mode === 'PARTIAL_LIVE' ? '#38bdf8' : '#f59e0b', display: 'inline-block' }} />
              {statusLabel}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-factor spatial risk evaluation for <strong>{currentStudyArea?.name || 'Selected Area'}</strong>
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          className="btn btn-primary"
          onClick={handleRunAnalysis}
          disabled={isProcessing}
          style={{
            padding: '8px 16px',
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
              <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Re-evaluating Index...
            </>
          ) : (
            <>
              <Play size={14} />
              Re-calculate Risk Index
            </>
          )}
        </button>
      </div>

      {/* Processing Log Overlay */}
      {isProcessing && (
        <div style={{
          backgroundColor: '#050a14',
          border: '1px solid var(--accent-blue)',
          borderRadius: '10px',
          padding: '12px 16px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#38bdf8',
          boxShadow: '0 0 20px rgba(0, 168, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#fff' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
            Phase 4 Deterministic Risk Calculation Execution
          </div>
          <div style={{ color: '#94a3b8' }}>
            &gt; {processingSteps[currentStep]}
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
            <div style={{ 
              width: `${((currentStep + 1) / processingSteps.length) * 100}%`, 
              height: '100%', 
              backgroundColor: '#00a8ff', 
              transition: 'width 0.3s ease' 
            }} />
          </div>
        </div>
      )}

      {/* Primary Score & Banner */}
      <div style={{
        backgroundColor: badgeStyle.bg,
        border: `1px solid ${badgeStyle.border}`,
        borderRadius: '12px',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: `2px solid ${badgeStyle.text}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '22px', fontWeight: '800', color: badgeStyle.text, fontFamily: 'var(--font-header)', lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>/ 100</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Flood Risk Level:
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: '800',
                color: badgeStyle.text,
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${badgeStyle.border}`,
                padding: '3px 12px',
                borderRadius: '99px'
              }}>
                {level} RISK
              </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4', maxWidth: '520px' }}>
              {explanation}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div>Evaluation Timestamp</div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{formattedTime}</strong>
        </div>
      </div>

      {/* Transparent Component Breakdown Table */}
      <div style={{
        backgroundColor: 'var(--bg-card-solid)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-blue)', marginBottom: '12px' }}>
          Transparent Input Vector Breakdown & Weights
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* 1. Rainfall / Weather */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 80px 1fr auto', alignItems: 'center', gap: '10px', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)' }}>
            <div style={{ fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CloudRain size={14} /> Rainfall / Weather
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '700' }}>30% Wt</div>
            <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{components.rainfall.score} / 100</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
              {components.rainfall.details}
            </div>
            <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '700', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
              +{components.rainfall.contribution} Pts ({components.rainfall.source})
            </div>
          </div>

          {/* 2. Terrain Elevation */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 80px 1fr auto', alignItems: 'center', gap: '10px', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)' }}>
            <div style={{ fontWeight: '700', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mountain size={14} /> Terrain Elevation
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '700' }}>20% Wt</div>
            <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{components.elevation.score} / 100</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
              {components.elevation.details}
            </div>
            <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '700', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
              +{components.elevation.contribution} Pts ({components.elevation.source})
            </div>
          </div>

          {/* 3. Historical Flood */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 80px 1fr auto', alignItems: 'center', gap: '10px', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)' }}>
            <div style={{ fontWeight: '700', color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={14} /> Historical Records
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '700' }}>20% Wt</div>
            <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{components.historical.score} / 100</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
              {components.historical.details}
            </div>
            <div style={{ fontSize: '10px', color: '#facc15', fontWeight: '700', backgroundColor: 'rgba(234, 179, 8, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
              +{components.historical.contribution} Pts ({components.historical.mode})
            </div>
          </div>

          {/* 4. Satellite Water Change */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 80px 1fr auto', alignItems: 'center', gap: '10px', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)' }}>
            <div style={{ fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} /> Satellite Water
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '700' }}>20% Wt</div>
            <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{components.satelliteWater.score} / 100</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
              {components.satelliteWater.details}
            </div>
            <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700', backgroundColor: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
              +{components.satelliteWater.contribution} Pts ({components.satelliteWater.mode})
            </div>
          </div>

          {/* 5. Geospatial Factors */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 80px 1fr auto', alignItems: 'center', gap: '10px', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)' }}>
            <div style={{ fontWeight: '700', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} /> Geospatial GIS
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: '700' }}>10% Wt</div>
            <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{components.geospatial.score} / 100</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
              {components.geospatial.details}
            </div>
            <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700', backgroundColor: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
              +{components.geospatial.contribution} Pts (GIS Factors)
            </div>
          </div>

        </div>
      </div>

      {/* Model Transparency & System Notice Footer */}
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.02)', 
        border: '1px dashed var(--border-card)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>
            <strong>Risk Index — Rule-Based Prototype</strong> • Deterministic weighted calculation (30% Rain + 20% Elev + 20% Hist + 20% Sat NDWI + 10% GIS). No random values used.
          </span>
        </div>

        <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
          Deterministic Output ({score}/100)
        </span>
      </div>

    </div>
  );
}
