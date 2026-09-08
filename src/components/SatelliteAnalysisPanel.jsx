import React, { useState } from 'react';
import { 
  Layers, 
  Eye, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Sparkles,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SATELLITE_COMPARISON_DATA } from '../data/mockData';

export default function SatelliteAnalysisPanel() {
  const [sliderPos, setSliderPos] = useState(50); // 0 to 100 for interactive slider
  const [viewMode, setViewMode] = useState('slider'); // 'slider', 'sideBySide', 'ndvi'
  const [activeBand, setActiveBand] = useState('Sentinel-2 Natural Color');

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* Panel Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              Satellite Change Detection
            </h3>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '800', 
              color: 'var(--accent-purple)', 
              backgroundColor: 'rgba(192, 132, 252, 0.12)', 
              border: '1px solid rgba(192, 132, 252, 0.3)',
              padding: '2px 8px', 
              borderRadius: '99px',
              textTransform: 'uppercase'
            }}>
              PROTOTYPE DATA | Sentinel-2 / Landsat
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Multi-temporal satellite imagery comparison for <strong>Pallikaranai–Velachery</strong> wetland basin
          </p>
        </div>

        {/* View mode switcher */}
        <div style={{ display: 'flex', gap: '6px', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '2px', backgroundColor: 'var(--bg-card-solid)' }}>
          <button
            className={`btn ${viewMode === 'slider' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '6px' }}
            onClick={() => setViewMode('slider')}
          >
            <Sliders size={12} /> Split Slider
          </button>
          <button
            className={`btn ${viewMode === 'sideBySide' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px', border: 'none', borderRadius: '6px' }}
            onClick={() => setViewMode('sideBySide')}
          >
            <Eye size={12} /> Side-by-Side
          </button>
        </div>
      </div>

      {/* Primary Satellite Comparison Display */}
      {viewMode === 'slider' ? (
        <div style={{ position: 'relative', width: '100%', height: '360px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)', background: '#050a14' }}>
          
          {/* Recent Image (Right Layer) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 45% 55%, #0284c7 0%, #0369a1 25%, #0f172a 60%, #050814 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Visual simulation of recent flooded imagery */}
            <svg width="100%" height="100%" style={{ opacity: 0.85 }}>
              <defs>
                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,168,255,0.08)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />
              {/* Flooded area polygon simulation */}
              <path d="M 120 80 Q 280 40 380 140 T 520 280 T 310 320 T 140 220 Z" fill="rgba(6, 182, 212, 0.45)" stroke="#38bdf8" strokeWidth="2" />
              <path d="M 320 180 Q 420 120 540 220 T 480 310 Z" fill="rgba(244, 63, 94, 0.35)" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 4" />
              <text x="350" y="240" fill="#ffffff" fontSize="13" fontWeight="800" fontFamily="sans-serif">RECENT INUNDATION ZONE (+27%)</text>
            </svg>

            <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', color: '#38bdf8', fontWeight: '700', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} /> Recent Satellite Image (08 Sep 2026)
            </div>
          </div>

          {/* Previous Image (Left Layer clipped by slider) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${sliderPos}%`,
            height: '100%',
            overflow: 'hidden',
            borderRight: '2px solid #00a8ff',
            boxShadow: '4px 0 20px rgba(0,168,255,0.6)',
            background: 'radial-gradient(circle at 45% 55%, #15803d 0%, #166534 30%, #0f172a 70%)'
          }}>
            <div style={{ width: '1000px', height: '360px', position: 'relative' }}>
              <svg width="100%" height="100%" style={{ opacity: 0.75 }}>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                {/* Historical baseline smaller water body polygon */}
                <path d="M 160 110 Q 240 80 320 160 T 410 240 T 260 270 T 170 200 Z" fill="rgba(2, 132, 199, 0.4)" stroke="#0284c7" strokeWidth="2" />
                <text x="210" y="190" fill="#a7f3d0" fontSize="12" fontWeight="700" fontFamily="sans-serif">BASELINE WETLAND EXTENT</text>
              </svg>

              <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', color: '#a7f3d0', fontWeight: '700', border: '1px solid rgba(167, 243, 208, 0.3)' }}>
                <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} /> Previous Satellite Image (15 Oct 2025)
              </div>
            </div>
          </div>

          {/* Interactive Range Input overlay */}
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

          {/* Vertical Split Handle */}
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
      ) : (
        /* Side-by-Side View */
        <div className="grid-2" style={{ gap: '16px', marginBottom: 0 }}>
          <div style={{ position: 'relative', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)', background: 'radial-gradient(circle at 50% 50%, #15803d 0%, #0f172a 80%)', padding: '16px' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', display: 'inline-block', fontWeight: '700', color: '#a7f3d0' }}>
              Previous Satellite Image (15 Oct 2025)
            </div>
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#a7f3d0' }}>
              <div style={{ fontSize: '16px', fontWeight: '800' }}>Baseline Pre-Monsoon Imagery</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Water Coverage Index: 14.2% area</div>
            </div>
          </div>

          <div style={{ position: 'relative', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)', background: 'radial-gradient(circle at 50% 50%, #0284c7 0%, #0f172a 80%)', padding: '16px' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', display: 'inline-block', fontWeight: '700', color: '#38bdf8' }}>
              Recent Satellite Image (08 Sep 2026)
            </div>
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#38bdf8' }}>
              <div style={{ fontSize: '16px', fontWeight: '800' }}>Recent Sentinel-2 Pass</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Water Coverage Index: 41.2% area</div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Breakdown Cards */}
      <div className="grid-3" style={{ gap: '16px', marginBottom: 0 }}>
        
        {/* Water body change metric */}
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
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              Water-body change
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#38bdf8', fontFamily: 'var(--font-header)', margin: '4px 0' }}>
              +27% <ArrowUpRight size={20} style={{ display: 'inline', color: '#f43f5e' }} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
            Inundation extent expanded across low-lying sections of Pallikaranai marshland.
          </div>
        </div>

        {/* Vegetation change metric */}
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              Vegetation change
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#facc15', fontFamily: 'var(--font-header)', margin: '4px 0' }}>
              -12% <ArrowDownRight size={20} style={{ display: 'inline', color: '#facc15' }} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
            NDVI canopy index reduction due to seasonal submergence & eco-buffer loss.
          </div>
        </div>

        {/* Built-up area change metric */}
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
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              Built-up area change
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#c084fc', fontFamily: 'var(--font-header)', margin: '4px 0' }}>
              +8% <ArrowUpRight size={20} style={{ display: 'inline', color: '#c084fc' }} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
            Impervious surface expansion along the Velachery-Medavakkam commercial axis.
          </div>
        </div>

      </div>

      {/* Technical Architecture Footer Banner */}
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.02)', 
        border: '1px dashed var(--border-card)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>Note: Prototype values generated for demonstration. Ready for direct API pipeline with Sentinel Hub & Google Earth Engine.</span>
        </div>
        <span style={{ fontWeight: '700', color: 'var(--accent-blue)' }}>Sentinel-2A MSI</span>
      </div>

    </div>
  );
}
