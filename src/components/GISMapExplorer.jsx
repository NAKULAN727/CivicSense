import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Search, 
  Target, 
  Layers, 
  MapPin, 
  Info,
  Maximize2
} from 'lucide-react';
import { 
  CHENNAI_CENTER, 
  STUDY_AREAS, 
  PALLIKARANAI_RISK_ZONES, 
  CHENNAI_HOTSPOTS 
} from '../data/mockData';

// Fix Leaflet default icon assets path issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

export default function GISMapExplorer({ 
  theme, 
  currentStudyArea = STUDY_AREAS.pallikaranai_velachery,
  setCurrentStudyArea,
  selectedZone, 
  setSelectedZone,
  onSendAlertClick,
  visualDetections = null
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroupRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const tileLayerRef = useRef(null);

  // States
  const [activeLayer, setActiveLayer] = useState('All');
  const [isFocusedOnStudy, setIsFocusedOnStudy] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHotspots, setShowHotspots] = useState(true);

  // Available Study Areas
  const LOCATIONS_LIST = [
    STUDY_AREAS.pallikaranai_velachery,
    STUDY_AREAS.mumbai,
    STUDY_AREAS.delhi
  ];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    // Create map centered on currentStudyArea
    const map = L.map(mapRef.current, {
      center: [currentStudyArea.lat, currentStudyArea.lng],
      zoom: currentStudyArea.zoom || 14,
      zoomControl: false
    });

    mapInstance.current = map;

    // Custom Zoom controls
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add OpenStreetMap base tile layer
    tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    boundaryLayerRef.current = L.layerGroup().addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);

    const timer = setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize();
      }
    }, 150);

    let resizeObserver;
    if (window.ResizeObserver && mapRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Sync map center whenever currentStudyArea changes
  useEffect(() => {
    if (!mapInstance.current || !currentStudyArea) return;

    mapInstance.current.flyTo([currentStudyArea.lat, currentStudyArea.lng], currentStudyArea.zoom || 14, {
      duration: 1.6,
      easeLinearity: 0.25
    });
  }, [currentStudyArea]);

  // Render Risk Layers & Boundary Overlays for currentStudyArea
  useEffect(() => {
    if (!mapInstance.current || !layerGroupRef.current || !boundaryLayerRef.current) return;

    layerGroupRef.current.clearLayers();
    boundaryLayerRef.current.clearLayers();

    // 1. Draw Study Area Boundary Polygon & Label Marker Overlay
    const bounds = currentStudyArea.bounds || [
      [currentStudyArea.lat + 0.04, currentStudyArea.lng - 0.04],
      [currentStudyArea.lat + 0.04, currentStudyArea.lng + 0.04],
      [currentStudyArea.lat - 0.04, currentStudyArea.lng + 0.04],
      [currentStudyArea.lat - 0.04, currentStudyArea.lng - 0.04]
    ];

    const boundaryPolygon = L.polygon(bounds, {
      color: '#00a8ff',
      weight: 2.5,
      dashArray: '6, 6',
      fillColor: '#00a8ff',
      fillOpacity: 0.05
    }).addTo(boundaryLayerRef.current);

    boundaryPolygon.bindTooltip(
      `<div style="font-weight:700; color:#00a8ff; font-family:sans-serif; padding:4px;">
         CivicSense AI Study Area<br/>${currentStudyArea.name}
       </div>`,
      { permanent: true, direction: 'top', className: 'study-boundary-tooltip' }
    );

    // Study Area center marker at currentStudyArea lat/lng
    const studyMarkerIcon = L.divIcon({
      html: `
        <div style="
          background: linear-gradient(135deg, rgba(11, 15, 25, 0.95), rgba(0, 168, 255, 0.9));
          color: white;
          padding: 6px 12px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 11px;
          box-shadow: 0 4px 16px rgba(0, 168, 255, 0.4);
          border: 1px solid #00a8ff;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        ">
          <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #00a8ff; display: inline-block; animation: pulse 1.5s infinite;"></span>
          <span><strong>CivicSense AI Study Area</strong><br/>${currentStudyArea.name}</span>
        </div>
      `,
      className: 'study-area-div-icon',
      iconSize: [210, 42],
      iconAnchor: [105, 21]
    });

    const studyMarker = L.marker([currentStudyArea.lat, currentStudyArea.lng], { icon: studyMarkerIcon })
      .addTo(boundaryLayerRef.current);

    studyMarker.on('click', () => {
      handleFocusStudyArea(currentStudyArea);
    });

    // 2. Draw Selectable Risk Zones inside Study Area
    const zonesToDraw = PALLIKARANAI_RISK_ZONES.filter(zone => {
      if (activeLayer === 'All') return true;
      return zone.layer === activeLayer;
    });

    zonesToDraw.forEach(zone => {
      const polygon = L.polygon(zone.polygon, {
        color: zone.strokeColor,
        weight: selectedZone?.id === zone.id ? 3 : 2,
        fillColor: zone.color,
        fillOpacity: activeLayer === 'All' ? 0.35 : 0.55
      }).addTo(layerGroupRef.current);

      const popupContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; width: 310px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px; margin-bottom: 10px;">
            <strong style="font-size: 14px; color: ${theme === 'dark' ? '#f8fafc' : '#0f172a'};">${zone.name}</strong>
            <span style="background-color: ${zone.color}; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px;">
              ${zone.riskLevel}
            </span>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; margin-bottom: 10px; background: rgba(0,168,255,0.06); padding: 8px; border-radius: 6px;">
            <div><span style="color: #94a3b8;">Risk Type:</span> <br><strong style="color: ${theme === 'dark' ? '#38bdf8' : '#0284c7'};">${zone.layer}</strong></div>
            <div><span style="color: #94a3b8;">Risk Score:</span> <br><strong style="color: ${zone.color}; font-size: 14px;">${zone.riskScore}/100</strong></div>
          </div>

          <div style="font-size: 11px; color: ${theme === 'dark' ? '#cbd5e1' : '#334155'}; line-height: 1.4; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
            <div><strong>Location:</strong> ${currentStudyArea.name}</div>
            <div><strong>Detected Change:</strong> <span style="color: #f43f5e; font-weight: 600;">${zone.detectedChange}</span></div>
            <div><strong>Supporting Data:</strong> ${zone.supportingData}</div>
            <div><strong>Responsible Department:</strong> <span style="color: #c084fc; font-weight: 600;">${zone.responsibleDept}</span></div>
          </div>

          <div style="background: rgba(244,63,94,0.1); border-left: 3px solid #f43f5e; padding: 8px; font-size: 11px; border-radius: 4px; margin-bottom: 10px; color: ${theme === 'dark' ? '#fecdd3' : '#9f1239'};">
            <strong>Recommended Action:</strong> ${zone.recommendedAction}
          </div>
          
          <button id="alert-btn-${zone.id}" style="width: 100%; background: linear-gradient(135deg, #f43f5e, #e11d48); color: white; border: none; border-radius: 6px; padding: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(244,63,94,0.3);">
            🚨 Send Department Alert
          </button>
        </div>
      `;

      polygon.bindPopup(popupContent, { maxWidth: 330 });

      polygon.on('click', () => {
        setSelectedZone(zone);
        setTimeout(() => {
          const btn = document.getElementById(`alert-btn-${zone.id}`);
          if (btn && onSendAlertClick) {
            btn.onclick = () => onSendAlertClick(zone);
          }
        }, 100);
      });
    });

    // 3. Draw Visual Detection Markers ONLY when latitude !== null AND longitude !== null
    const roadDets = visualDetections?.detections?.road ?? visualDetections?.road ?? [];
    const wasteDets = visualDetections?.detections?.waste ?? visualDetections?.waste ?? [];
    const allVisualDets = [...roadDets, ...wasteDets];

    allVisualDets.forEach(det => {
      if (typeof det.latitude === 'number' && typeof det.longitude === 'number' && det.latitude !== null && det.longitude !== null) {
        const isWaste = det.type.includes('Waste') || (det.classCode && det.classCode.startsWith('W')) || det.classCode === 'WASTE';
        const markerColor = isWaste ? '#fbbf24' : '#00a8ff';

        const customIcon = L.divIcon({
          html: `
            <div style="
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background-color: ${markerColor};
              border: 2px solid white;
              box-shadow: 0 0 12px ${markerColor};
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="width: 6px; height: 6px; border-radius: 50%; background-color: white;"></span>
            </div>
          `,
          className: 'visual-detection-marker-icon',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const marker = L.marker([det.latitude, det.longitude], { icon: customIcon }).addTo(layerGroupRef.current);

        const detSev = det.severity || 'UNAVAILABLE';
        const detPriority = visualDetections?.overallPriority || 'MEDIUM';

        const popupHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px; width: 230px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: ${markerColor}; font-size: 13px;">${det.type}</strong>
              <span style="font-size: 10px; font-weight: 800; background: rgba(0,168,255,0.15); color: #38bdf8; padding: 2px 6px; borderRadius: 4px;">
                PRIORITY: ${detPriority}
              </span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; color: ${theme === 'dark' ? '#cbd5e1' : '#334155'};">
              <div><strong>Class Code:</strong> ${det.classCode}</div>
              <div><strong>Model Confidence:</strong> ${Math.round(det.confidence * 100)}%</div>
              <div><strong>Prototype Severity:</strong> <strong style="color: ${detSev === 'HIGH' ? '#f43f5e' : detSev === 'MEDIUM' ? '#f59e0b' : '#10b981'};">${detSev}</strong></div>
              ${det.severityReason ? `<div style="font-size: 10px; font-style: italic; color: #94a3b8;">${det.severityReason}</div>` : ''}
              <div><strong>Source:</strong> Real ONNX Model Inference</div>
              <div><strong>Capture Time:</strong> ${det.timestamp || 'CAPTURE TIME UNAVAILABLE'}</div>
              <div><strong>Verified GPS:</strong> ${det.latitude}, ${det.longitude}</div>
            </div>
          </div>
        `;
        marker.bindPopup(popupHtml);
      }
    });

    // 4. Draw Flood Visual Marker ONLY when EXIF GPS is verified
    const floodResult = visualDetections?.flood;
    const metadata = visualDetections?.metadata;
    if (floodResult && floodResult.detected && metadata && metadata.isGpsVerified && typeof metadata.latitude === 'number' && typeof metadata.longitude === 'number' && metadata.latitude !== null && metadata.longitude !== null) {
      const floodMarkerIcon = L.divIcon({
        html: `
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background-color: #00a8ff;
            border: 2px solid white;
            box-shadow: 0 0 14px #00a8ff;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: white;"></span>
          </div>
        `,
        className: 'flood-visual-marker-icon',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const floodMarker = L.marker([metadata.latitude, metadata.longitude], { icon: floodMarkerIcon }).addTo(layerGroupRef.current);
      const floodSev = visualDetections?.severityAnalysis?.flood?.severity || 'MEDIUM';

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px; width: 240px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #00a8ff; font-size: 13px;">🌊 RGB Flood Visual Detection</strong>
            <span style="font-size: 10px; font-weight: 800; background: rgba(0,168,255,0.15); color: #38bdf8; padding: 2px 6px; borderRadius: 4px;">
              VERIFIED ONNX
            </span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; color: ${theme === 'dark' ? '#cbd5e1' : '#334155'};">
            <div><strong>Visible Water Coverage:</strong> ${floodResult.floodedAreaPercent}%</div>
            <div><strong>Prototype Severity:</strong> <strong style="color: ${floodSev === 'CRITICAL' || floodSev === 'HIGH' ? '#f43f5e' : '#f59e0b'};">${floodSev}</strong></div>
            <div><strong>Model:</strong> SegFormer FloodNet ONNX</div>
            <div><strong>Source:</strong> RGB Visual Flood Segmentation</div>
            <div><strong>Capture Time:</strong> ${metadata.timestamp || 'CAPTURE TIME UNAVAILABLE'}</div>
            <div><strong>Verified GPS:</strong> ${metadata.latitude}, ${metadata.longitude}</div>
          </div>
        </div>
      `;
      floodMarker.bindPopup(popupHtml);
    }

  }, [activeLayer, currentStudyArea, isFocusedOnStudy, selectedZone, showHotspots, theme, visualDetections]);

  // Smooth FlyTo Focus Study Area handler
  const handleFocusStudyArea = (targetArea = currentStudyArea) => {
    if (!mapInstance.current) return;
    setIsFocusedOnStudy(true);
    if (setCurrentStudyArea && targetArea.id !== currentStudyArea.id) {
      setCurrentStudyArea(targetArea);
    }

    mapInstance.current.flyTo([targetArea.lat, targetArea.lng], targetArea.zoom || 14, {
      duration: 1.8,
      easeLinearity: 0.25
    });

    const floodZone = PALLIKARANAI_RISK_ZONES.find(z => z.layer === 'Flood Risk');
    if (floodZone) {
      setSelectedZone(floodZone);
    }
  };

  const handleResetToChennai = () => {
    if (!mapInstance.current) return;
    setIsFocusedOnStudy(false);
    mapInstance.current.flyTo([CHENNAI_CENTER.lat, CHENNAI_CENTER.lng], CHENNAI_CENTER.zoom, {
      duration: 1.8
    });
  };

  const handleSelectLocation = (loc) => {
    setSearchQuery(loc.name);
    if (!mapInstance.current) return;

    handleFocusStudyArea(loc);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      
      const match = LOCATIONS_LIST.find(l => 
        l.name.toLowerCase().includes(query) || 
        l.region.toLowerCase().includes(query)
      );

      if (match) {
        handleSelectLocation(match);
      } else if (query.includes('mumbai')) {
        handleSelectLocation(STUDY_AREAS.mumbai);
      } else if (query.includes('delhi')) {
        handleSelectLocation(STUDY_AREAS.delhi);
      } else {
        handleSelectLocation(STUDY_AREAS.pallikaranai_velachery);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      {/* Top Map Control Bar */}
      <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search / Location Control */}
        <div style={{ position: 'relative', width: '280px' }}>
          <div className="search-bar" style={{ width: '100%' }}>
            <Search size={16} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search Pallikaranai, Mumbai, Delhi..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* Autocomplete suggestions dropdown */}
          {searchQuery && (
            <div className="glass-card" style={{ 
              position: 'absolute', 
              top: '42px', 
              left: 0, 
              right: 0, 
              zIndex: 2000, 
              padding: '6px', 
              backgroundColor: 'var(--bg-card-solid)',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {LOCATIONS_LIST
                .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.region.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((loc) => (
                  <div 
                    key={loc.id}
                    onClick={() => {
                      handleSelectLocation(loc);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: loc.id === currentStudyArea.id ? 'var(--accent-blue)' : 'var(--text-primary)',
                      fontWeight: loc.id === currentStudyArea.id ? '700' : '400',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,168,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <MapPin size={14} style={{ flexShrink: 0 }} />
                    <span>{loc.name} ({loc.region})</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Study Area Preset Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>Study Area:</span>
          {LOCATIONS_LIST.map(area => (
            <button 
              key={area.id}
              className={`btn ${currentStudyArea.id === area.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleFocusStudyArea(area)}
              style={{ 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: '700',
                borderColor: currentStudyArea.id === area.id ? 'var(--accent-blue)' : 'var(--border-card)',
                boxShadow: currentStudyArea.id === area.id ? '0 0 12px rgba(0, 168, 255, 0.4)' : 'none'
              }}
            >
              <Target size={13} /> {area.name}
            </button>
          ))}

          <button 
            className="btn btn-secondary"
            onClick={handleResetToChennai}
            style={{ padding: '6px 10px', fontSize: '11px' }}
            title="Reset view to overview region"
          >
            <Maximize2 size={13} /> Overview
          </button>
        </div>

        {/* Risk Layer Selector Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { label: 'All Layers', value: 'All', icon: <Layers size={13} /> },
            { label: '🌊 Flood Risk', value: 'Flood Risk' },
            { label: '🔥 Heat Risk', value: 'Heat Risk' },
            { label: '💧 Water Stress', value: 'Water Stress' },
            { label: '🌳 Vegetation', value: 'Vegetation Change' },
            { label: '🏗️ Land-Use', value: 'Land-Use Change' }
          ].map(layer => (
            <button
              key={layer.value}
              onClick={() => setActiveLayer(layer.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: activeLayer === layer.value ? 'var(--accent-blue)' : 'var(--border-card)',
                backgroundColor: activeLayer === layer.value ? 'rgba(0, 168, 255, 0.15)' : 'var(--bg-card-solid)',
                color: activeLayer === layer.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {layer.icon}
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Leaflet Map Container */}
      <div style={{ flex: 1, minHeight: '480px', position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>

        {/* Study Area Overlay Label Floating Pill */}
        {isFocusedOnStudy && (
          <div className="glass-card" style={{ 
            position: 'absolute', 
            top: '16px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1000, 
            padding: '6px 16px',
            borderRadius: '99px',
            backgroundColor: 'rgba(11, 15, 25, 0.88)',
            border: '1px solid var(--accent-blue)',
            boxShadow: '0 4px 20px rgba(0, 168, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00a8ff', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#f8fafc', letterSpacing: '0.3px' }}>
              CivicSense AI Study Area – {currentStudyArea.name} ({currentStudyArea.region})
            </span>
          </div>
        )}

        {/* Interactive Risk Legend Floating Panel */}
        <div className="glass-card" style={{ 
          position: 'absolute', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 1000, 
          padding: '12px 14px', 
          width: '190px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Info size={12} /> Risk Intensity Scale
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#10b981' }} />
              <span>Low (0-25)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#eab308' }} />
              <span>Mod (26-50)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#ea580c' }} />
              <span>High (51-75)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#f43f5e' }} />
              <span>Crit (&gt;75)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
