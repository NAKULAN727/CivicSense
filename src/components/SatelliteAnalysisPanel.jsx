import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Calendar, 
  Sliders,
  Layers,
  RefreshCw,
  Globe,
  Tag,
  AlertTriangle,
  Droplets,
  CheckCircle2
} from 'lucide-react';
import { fetchPlanetaryComputerSatelliteData } from '../services/planetaryComputerService.js';
import { calculateRealSatelliteWaterChange } from '../services/satelliteWaterAnalysisService.js';

export default function SatelliteAnalysisPanel({ currentStudyArea, onWaterAnalysisComplete }) {
  const [sliderPos, setSliderPos] = useState(50);
  const [viewMode, setViewMode] = useState('slider'); // 'slider', 'sideBySide', 'ndwi', 'assets'
  const [satelliteData, setSatelliteData] = useState(null);
  const [waterAnalysis, setWaterAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzingWater, setIsAnalyzingWater] = useState(false);

  // Fetch satellite observation data & compute real NDWI water change
  useEffect(() => {
    let isMounted = true;
    const loadSatelliteData = async () => {
      setIsLoading(true);
      setIsAnalyzingWater(true);
      
      const data = await fetchPlanetaryComputerSatelliteData(currentStudyArea);
      let wAnalysis = null;
      
      if (data && data.isLive) {
        wAnalysis = await calculateRealSatelliteWaterChange(data);
      } else {
        wAnalysis = {
          source: 'Microsoft Planetary Computer',
          dataset: 'Sentinel-2 L2A',
          mode: 'DEMO',
          isLive: false,
          isError: true,
          errorMessage: 'Live STAC satellite imagery unavailable for NDWI analysis.',
          statusLabel: 'DEMO / ANALYSIS UNAVAILABLE'
        };
      }

      if (isMounted) {
        setSatelliteData(data);
        setWaterAnalysis(wAnalysis);
        setIsLoading(false);
        setIsAnalyzingWater(false);

        if (onWaterAnalysisComplete) {
          onWaterAnalysisComplete(wAnalysis);
        }
      }
    };

    loadSatelliteData();
    return () => {
      isMounted = false;
    };
  }, [currentStudyArea?.name]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setIsAnalyzingWater(true);
    const data = await fetchPlanetaryComputerSatelliteData(currentStudyArea);
    const wAnalysis = await calculateRealSatelliteWaterChange(data);
    setSatelliteData(data);
    setWaterAnalysis(wAnalysis);
    setIsLoading(false);
    setIsAnalyzingWater(false);

    if (onWaterAnalysisComplete) {
      onWaterAnalysisComplete(wAnalysis);
    }
  };

  if (isLoading || !satelliteData) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={24} className="spin-icon" style={{ color: 'var(--accent-blue)', marginBottom: '12px' }} />
        <p style={{ fontSize: '13px', fontWeight: '600' }}>Querying Microsoft Planetary Computer STAC API & Computing Live NDWI...</p>
      </div>
    );
  }

  const { 
    source, 
    mode, 
    isLive, 
    isError, 
    errorMessage, 
    recentObservation, 
    previousObservation, 
    bbox 
  } = satelliteData;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* Panel Header, Provider & Mode Badge */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              Satellite Change Detection
            </h3>
            
            {/* LIVE / DEMO DATA MODE BADGE */}
            <span style={{ 
              fontSize: '11px', 
              fontWeight: '800', 
              color: isLive ? '#10b981' : '#f59e0b', 
              backgroundColor: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
              border: `1px solid ${isLive ? '#10b981' : '#f59e0b'}`,
              padding: '4px 10px', 
              borderRadius: '99px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLive ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
              {mode} MODE
            </span>

            {/* DATA SOURCE TAG */}
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
              <Globe size={11} /> Source: {source} Sentinel-2 L2A
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Sentinel-2 L2A STAC multi-temporal observation comparison for <strong>{currentStudyArea?.name || 'Selected Study Area'}</strong>
          </p>
        </div>

        {/* View mode switcher */}
        <div style={{ display: 'flex', gap: '6px', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '2px', backgroundColor: 'var(--bg-card-solid)' }}>
          <button
            className={`btn ${viewMode === 'slider' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '6px' }}
            onClick={() => setViewMode('slider')}
          >
            <Sliders size={12} /> Split Comparison
          </button>
          <button
            className={`btn ${viewMode === 'sideBySide' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '6px' }}
            onClick={() => setViewMode('sideBySide')}
          >
            <Eye size={12} /> Side-by-Side
          </button>
          <button
            className={`btn ${viewMode === 'ndwi' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '6px' }}
            onClick={() => setViewMode('ndwi')}
          >
            <Droplets size={12} /> Real NDWI Analysis
          </button>
          <button
            className={`btn ${viewMode === 'assets' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '6px' }}
            onClick={() => setViewMode('assets')}
          >
            <Layers size={12} /> STAC Assets
          </button>
        </div>
      </div>

      {/* Error Notice Banner if live search fails */}
      {isError && (
        <div style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.3)', 
          borderRadius: '8px', 
          padding: '10px 14px', 
          color: '#f87171', 
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Observation Metadata Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        backgroundColor: 'var(--bg-card-solid)',
        border: '1px solid var(--border-card)',
        borderRadius: '10px',
        padding: '12px 16px',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Calendar size={14} style={{ color: 'var(--accent-blue)', marginTop: '2px' }} />
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Previous Baseline Observation:</div>
            <strong style={{ color: '#a7f3d0', fontSize: '12px' }}>{previousObservation?.date}</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
              Platform: <strong>{previousObservation?.platform}</strong> • Cloud Cover: <strong>{previousObservation?.cloudCoverPercent}%</strong>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px', fontFamily: 'monospace' }}>
              STAC Item: {previousObservation?.id}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Calendar size={14} style={{ color: 'var(--accent-purple)', marginTop: '2px' }} />
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Recent Observation (Timestamp):</div>
            <strong style={{ color: '#38bdf8', fontSize: '12px' }}>{recentObservation?.date}</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
              Platform: <strong>{recentObservation?.platform}</strong> • Cloud Cover: <strong>{recentObservation?.cloudCoverPercent}%</strong>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px', fontFamily: 'monospace' }}>
              STAC Item: {recentObservation?.id}
            </div>
          </div>
        </div>
      </div>

      {/* Primary View Area based on ViewMode */}
      {viewMode === 'slider' && (
        <div style={{ position: 'relative', width: '100%', height: '340px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)', background: '#050a14' }}>
          
          {/* Recent Image Layer (Right Side) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: recentObservation?.previewUrl ? `url(${recentObservation.previewUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {!recentObservation?.previewUrl && (
              <svg width="100%" height="100%" style={{ opacity: 0.85 }}>
                <defs>
                  <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,168,255,0.08)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#38bdf8" fontSize="13" fontWeight="800">
                  RECENT SATELLITE PASS ({recentObservation?.date})
                </text>
              </svg>
            )}

            <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(15, 23, 42, 0.92)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', color: '#38bdf8', fontWeight: '700', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              Recent Pass ({recentObservation?.date})
            </div>
          </div>

          {/* Previous Image Layer (Left Side clipped by slider) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${sliderPos}%`,
            height: '100%',
            overflow: 'hidden',
            borderRight: '2px solid #00a8ff',
            boxShadow: '4px 0 20px rgba(0,168,255,0.6)'
          }}>
            <div style={{ 
              width: '1000px', 
              height: '340px', 
              position: 'relative',
              backgroundImage: previousObservation?.previewUrl ? `url(${previousObservation.previewUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#064e3b'
            }}>
              {!previousObservation?.previewUrl && (
                <svg width="100%" height="100%" style={{ opacity: 0.75 }}>
                  <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                  <text x="30%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#a7f3d0" fontSize="13" fontWeight="800">
                    PREVIOUS BASELINE ({previousObservation?.date})
                  </text>
                </svg>
              )}

              <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'rgba(15, 23, 42, 0.92)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', color: '#a7f3d0', fontWeight: '700', border: '1px solid rgba(167, 243, 208, 0.3)' }}>
                Baseline ({previousObservation?.date})
              </div>
            </div>
          </div>

          {/* Interactive Range Input Overlay */}
          <input 
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={(e) => setSliderPos(e.target.value)}
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              width: '100%',
              transform: 'translateY(-50%)',
              opacity: 0,
              cursor: 'ew-resize',
              zIndex: 30,
              height: '100%'
            }}
          />

          {/* Split Handle */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${sliderPos}%`,
            width: '2px',
            backgroundColor: '#ffffff',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 20
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#00a8ff',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0,168,255,0.8)',
              fontSize: '10px',
              fontWeight: '800'
            }}>
              ◄►
            </div>
          </div>
        </div>
      )}

      {viewMode === 'sideBySide' && (
        <div className="grid-2" style={{ gap: '16px', marginBottom: 0 }}>
          {/* Baseline Frame */}
          <div style={{ 
            position: 'relative', 
            height: '280px', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            border: '1px solid var(--border-card)', 
            backgroundImage: previousObservation?.previewUrl ? `url(${previousObservation.previewUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#064e3b',
            padding: '16px' 
          }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.9)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', display: 'inline-block', fontWeight: '700', color: '#a7f3d0' }}>
              Previous Baseline ({previousObservation?.date})
            </div>
            
            <div style={{ 
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-card)',
              fontSize: '11px',
              color: '#a7f3d0'
            }}>
              <div style={{ fontWeight: '800', fontSize: '13px' }}>{previousObservation?.platform}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                Cloud Cover: <strong>{previousObservation?.cloudCoverPercent}%</strong> • MGRS: <strong>{previousObservation?.mgrsTile}</strong>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', fontFamily: 'monospace' }}>
                Item ID: {previousObservation?.id}
              </div>
            </div>
          </div>

          {/* Recent Frame */}
          <div style={{ 
            position: 'relative', 
            height: '280px', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            border: '1px solid var(--border-card)', 
            backgroundImage: recentObservation?.previewUrl ? `url(${recentObservation.previewUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#0284c7',
            padding: '16px' 
          }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.9)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', display: 'inline-block', fontWeight: '700', color: '#38bdf8' }}>
              Recent Pass ({recentObservation?.date})
            </div>

            <div style={{ 
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-card)',
              fontSize: '11px',
              color: '#38bdf8'
            }}>
              <div style={{ fontWeight: '800', fontSize: '13px' }}>{recentObservation?.platform}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                Cloud Cover: <strong>{recentObservation?.cloudCoverPercent}%</strong> • MGRS: <strong>{recentObservation?.mgrsTile}</strong>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', fontFamily: 'monospace' }}>
                Item ID: {recentObservation?.id}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real NDWI Calculation Formula & Details View */}
      {viewMode === 'ndwi' && (
        <div style={{ 
          backgroundColor: 'var(--bg-card-solid)', 
          border: '1px solid var(--accent-blue)', 
          borderRadius: '12px', 
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent-blue)' }}>
              REAL SATELLITE WATER ANALYSIS (NDWI)
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              NDWI = (B03 - B08) / (B03 + B08)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>Recent Scene Water Extent</div>
              <div>Water Area: <strong>{waterAnalysis?.recentWaterKm2 !== undefined ? `${waterAnalysis.recentWaterKm2} km²` : 'N/A'}</strong></div>
              <div>Valid Unmasked Pixels: <strong>{waterAnalysis?.recentValidPixels || 0}</strong></div>
              <div>Cloud / Shadow Masked: <strong>{waterAnalysis?.recentMaskedPercent || 0}%</strong></div>
              <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Item: {waterAnalysis?.recentItemId}
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontWeight: '700', color: '#a7f3d0', marginBottom: '8px' }}>Baseline Scene Water Extent</div>
              <div>Water Area: <strong>{waterAnalysis?.baselineWaterKm2 !== undefined ? `${waterAnalysis.baselineWaterKm2} km²` : 'N/A'}</strong></div>
              <div>Valid Unmasked Pixels: <strong>{waterAnalysis?.baselineValidPixels || 0}</strong></div>
              <div>Cloud / Shadow Masked: <strong>{waterAnalysis?.baselineMaskedPercent || 0}%</strong></div>
              <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Item: {waterAnalysis?.baselineItemId}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <strong>Spectral Methodology:</strong> NDWI computed using 10m Sentinel-2 Band 3 (Green, 560nm) and Band 8 (NIR, 842nm) Cloud-Optimized GeoTIFFs signed via Microsoft Planetary Computer SAS API. Cloud/shadow pixels filtered via SCL.
          </div>
        </div>
      )}

      {/* STAC Assets & Metadata View */}
      {viewMode === 'assets' && (
        <div style={{ 
          backgroundColor: 'var(--bg-card-solid)', 
          border: '1px solid var(--accent-blue)', 
          borderRadius: '12px', 
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent-blue)' }}>
              Microsoft Planetary Computer STAC Assets & Bounding Box
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              Collection: sentinel-2-l2a
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '6px' }}>Recent STAC Assets ({recentObservation?.assets?.length || 0} bands/files)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                {recentObservation?.assets?.map((assetKey) => (
                  <span key={assetKey} style={{ fontSize: '10px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'monospace' }}>
                    {assetKey}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontWeight: '700', color: '#a7f3d0', marginBottom: '6px' }}>Study Area Spatial Bounding Box (STAC bbox)</div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: '6px' }}>
                [{bbox?.join(', ')}]
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Coordinates: <strong>{currentStudyArea?.name} ({currentStudyArea?.lat}, {currentStudyArea?.lng})</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real Calculated Satellite Water Analysis Cards */}
      <div className="grid-3" style={{ gap: '16px', marginBottom: 0 }}>
        
        {/* Recent Water Area */}
        <div style={{
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Droplets size={14} style={{ color: '#38bdf8' }} /> Recent Water Extent
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#38bdf8', fontFamily: 'var(--font-header)', margin: '8px 0' }}>
              {isAnalyzingWater ? (
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Computing COG...</span>
              ) : (
                `${waterAnalysis?.recentWaterKm2 !== undefined ? waterAnalysis.recentWaterKm2 : '0'} km²`
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '700' }}>
              NDWI Threshold: {waterAnalysis?.ndwiThresholdUsed || 0.10}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3', marginTop: '8px' }}>
            Real water surface area derived from 10m Sentinel-2 B03 & B08 rasters.
          </div>
        </div>

        {/* Baseline Water Area */}
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} style={{ color: '#a7f3d0' }} /> Baseline Water Extent
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#a7f3d0', fontFamily: 'var(--font-header)', margin: '8px 0' }}>
              {isAnalyzingWater ? (
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Computing COG...</span>
              ) : (
                `${waterAnalysis?.baselineWaterKm2 !== undefined ? waterAnalysis.baselineWaterKm2 : '0'} km²`
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '700' }}>
              Baseline Pass ({previousObservation?.date})
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3', marginTop: '8px' }}>
            Previous baseline water surface extent over target study area.
          </div>
        </div>

        {/* Real Calculated Water Area Change Percentage */}
        <div style={{
          backgroundColor: 'rgba(192, 132, 252, 0.08)',
          border: '1px solid rgba(192, 132, 252, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={14} style={{ color: '#c084fc' }} /> Water Area Change %
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#c084fc', fontFamily: 'var(--font-header)', margin: '8px 0' }}>
              {isAnalyzingWater ? (
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Computing NDWI...</span>
              ) : (
                `${waterAnalysis?.waterAreaChangePercent >= 0 ? '+' : ''}${waterAnalysis?.waterAreaChangePercent || 0}%`
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '700' }}>
              Status: {waterAnalysis?.isLive ? 'LIVE NDWI CALCULATION' : 'DEMO / UNAVAILABLE'}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3', marginTop: '8px' }}>
            Multi-temporal NDWI surface inundation change percentage.
          </div>
        </div>

      </div>

      {/* Provider & Source Status Notice Footer */}
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
          <CheckCircle2 size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>
            {waterAnalysis?.statusLabel || 'LIVE SATELLITE NDWI ANALYSIS'} • Source: <strong>Microsoft Planetary Computer Sentinel-2 L2A</strong>
          </span>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={handleRefresh}
          style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <RefreshCw size={12} /> Sync Satellite Feed
        </button>
      </div>

    </div>
  );
}
