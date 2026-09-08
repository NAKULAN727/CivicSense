import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Search, 
  Target, 
  Layers, 
  ShieldAlert, 
  MapPin, 
  Info,
  Maximize2,
  Minimize2,
  Activity,
  Flame,
  Droplets,
  Trees,
  Building2,
  Waves
} from 'lucide-react';
import { 
  CHENNAI_CENTER, 
  STUDY_AREA_CENTER, 
  PALLIKARANAI_RISK_ZONES, 
  CHENNAI_HOTSPOTS 
} from '../data/mockData';

export default function GISMapExplorer({ 
  theme, 
  selectedZone, 
  setSelectedZone,
  onSendAlertClick
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroupRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const tileLayerRef = useRef(null);

  // States
  const [activeLayer, setActiveLayer] = useState('All'); // 'All', 'Flood Risk', 'Heat Risk', etc.
  const [isFocusedOnStudy, setIsFocusedOnStudy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHotspots, setShowHotspots] = useState(true);

  // Location suggestions for Chennai search
  const CHENNAI_LOCATIONS = [
    { name: "Pallikaranai–Velachery (Study Area)", lat: 12.94, lng: 80.21, zoom: 14, isStudy: true },
    { name: "Chennai Central Railway Station", lat: 13.0827, lng: 80.2707, zoom: 13 },
    { name: "T. Nagar Commercial Axis", lat: 13.0418, lng: 80.2341, zoom: 14 },
    { name: "Guindy National Park", lat: 13.0067, lng: 80.2206, zoom: 14 },
    { name: "Koyambedu Bus Terminal", lat: 13.0694, lng: 80.1948, zoom: 14 },
    { name: "Sholinganallur OMR IT Corridor", lat: 12.9010, lng: 80.2279, zoom: 14 },
    { name: "Marina Beach Promenade", lat: 13.0499, lng: 80.2824, zoom: 13 }
  ];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map centered on Chennai
    mapInstance.current = L.map(mapRef.current, {
      center: [CHENNAI_CENTER.lat, CHENNAI_CENTER.lng],
      zoom: CHENNAI_CENTER.zoom,
      zoomControl: false
    });

    // Custom Zoom controls
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

    // Add OpenStreetMap base tile layer
    tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance.current);

    // Layer groups for boundary and risk overlays
    boundaryLayerRef.current = L.layerGroup().addTo(mapInstance.current);
    layerGroupRef.current = L.layerGroup().addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Render Risk Layers & Boundary Polygons
  useEffect(() => {
    if (!mapInstance.current || !layerGroupRef.current || !boundaryLayerRef.current) return;

    layerGroupRef.current.clearLayers();
    boundaryLayerRef.current.clearLayers();

    // 1. Draw Study Area Boundary if focused or always available
    if (isFocusedOnStudy) {
      const boundaryPolygon = L.polygon(STUDY_AREA_CENTER.bounds, {
        color: '#00a8ff',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#00a8ff',
        fillOpacity: 0.04
      }).addTo(boundaryLayerRef.current);

      boundaryPolygon.bindTooltip(
        `<div style="font-weight:700; color:#00a8ff; font-family:sans-serif; padding:4px;">
           CivicSense AI Study Area – Pallikaranai–Velachery
         </div>`,
        { permanent: true, direction: 'top', className: 'study-boundary-tooltip' }
      );
    }

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

      // Create rich interactive Leaflet popup with all exact user specs
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
            <div><strong>Location:</strong> Pallikaranai–Velachery</div>
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

    // 3. Draw Regional Chennai Hotspots if enabled
    if (showHotspots && !isFocusedOnStudy) {
      CHENNAI_HOTSPOTS.forEach(spot => {
        const isCritical = spot.severity === 'Critical';
        const color = isCritical ? '#f43f5e' : '#f59e0b';
        
        const iconHtml = `
          <div style="
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background-color: ${color};
            border: 2px solid #ffffff;
            box-shadow: 0 0 12px ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
            position: relative;
          ">
            <div style="
              position: absolute;
              width: 38px;
              height: 38px;
              border: 2px solid ${color};
              border-radius: 50%;
              animation: pulse 2s infinite;
              opacity: 0.4;
              pointer-events: none;
            "></div>
            ${spot.riskScore}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'hotspot-div-icon',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker([spot.location.lat, spot.location.lng], { icon: customIcon })
          .addTo(layerGroupRef.current);

        marker.bindTooltip(`<strong>${spot.title}</strong><br/>Score: ${spot.riskScore}/100`, {
          direction: 'top',
          offset: [0, -10]
        });

        marker.on('click', () => {
          if (spot.location.lat === STUDY_AREA_CENTER.lat) {
            handleFocusStudyArea();
          }
        });
      });
    }

  }, [activeLayer, isFocusedOnStudy, selectedZone, showHotspots, theme]);

  // Smooth FlyTo Focus Study Area handler
  const handleFocusStudyArea = () => {
    if (!mapInstance.current) return;
    setIsFocusedOnStudy(true);

    // Smooth flight animation to Pallikaranai-Velachery
    mapInstance.current.flyTo([STUDY_AREA_CENTER.lat, STUDY_AREA_CENTER.lng], STUDY_AREA_CENTER.zoom, {
      duration: 2.2,
      easeLinearity: 0.25
    });

    // Select primary high risk flood zone by default
    const floodZone = PALLIKARANAI_RISK_ZONES.find(z => z.layer === 'Flood Risk');
    if (floodZone) {
      setSelectedZone(floodZone);
    }
  };

  // Reset view to entire Chennai metropolitan region
  const handleResetToChennai = () => {
    if (!mapInstance.current) return;
    setIsFocusedOnStudy(false);
    mapInstance.current.flyTo([CHENNAI_CENTER.lat, CHENNAI_CENTER.lng], CHENNAI_CENTER.zoom, {
      duration: 2.0
    });
  };

  // Search input handler
  const handleSelectLocation = (loc) => {
    setSearchQuery(loc.name);
    if (!mapInstance.current) return;

    if (loc.isStudy) {
      handleFocusStudyArea();
    } else {
      setIsFocusedOnStudy(false);
      mapInstance.current.flyTo([loc.lat, loc.lng], loc.zoom, { duration: 1.8 });
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
              placeholder="Search Chennai locations (e.g. Velachery)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              {CHENNAI_LOCATIONS
                .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((loc, idx) => (
                  <div 
                    key={idx}
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
                      color: loc.isStudy ? 'var(--accent-blue)' : 'var(--text-primary)',
                      fontWeight: loc.isStudy ? '700' : '400',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,168,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <MapPin size={14} style={{ flexShrink: 0 }} />
                    <span>{loc.name}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Primary Action Button: "Focus Study Area" */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className={`btn ${isFocusedOnStudy ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleFocusStudyArea}
            style={{ 
              padding: '8px 16px', 
              fontSize: '12px', 
              fontWeight: '700',
              borderColor: 'var(--accent-blue)',
              boxShadow: isFocusedOnStudy ? '0 0 16px rgba(0, 168, 255, 0.4)' : 'none'
            }}
          >
            <Target size={15} style={{ color: 'var(--accent-blue)' }} /> Focus Study Area (Pallikaranai–Velachery)
          </button>

          {isFocusedOnStudy && (
            <button 
              className="btn btn-secondary"
              onClick={handleResetToChennai}
              style={{ padding: '8px 12px', fontSize: '12px' }}
              title="Reset view to entire Chennai region"
            >
              <Maximize2 size={14} /> Full Chennai View
            </button>
          )}
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
              CivicSense AI Study Area – Pallikaranai–Velachery
            </span>
            <span style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: '600', backgroundColor: 'rgba(0, 168, 255, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
              2–5 km² Wetland Basin
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

        {/* Selected Risk Zone Quick Summary Card */}
        {selectedZone && isFocusedOnStudy && (
          <div className="glass-card" style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            zIndex: 1000,
            width: '320px',
            backgroundColor: 'var(--bg-card-solid)',
            border: `1px solid ${selectedZone.color}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: selectedZone.color, textTransform: 'uppercase' }}>
                {selectedZone.layer} Layer Active
              </span>
              <span style={{ backgroundColor: selectedZone.color, color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '99px' }}>
                {selectedZone.riskLevel} ({selectedZone.riskScore}/100)
              </span>
            </div>

            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>{selectedZone.name}</h4>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '10px' }}>
              {selectedZone.detectedChange}
            </p>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Dept: <strong style={{ color: 'var(--accent-purple)' }}>{selectedZone.responsibleDept}</strong>
            </div>

            <button
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                padding: '8px', 
                fontSize: '12px', 
                background: `linear-gradient(135deg, ${selectedZone.color}, #be123c)`,
                border: 'none'
              }}
              onClick={() => onSendAlertClick && onSendAlertClick(selectedZone)}
            >
              🚨 Send Department Alert
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
