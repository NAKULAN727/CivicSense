import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Cpu, 
  Layers, 
  Sliders, 
  Check, 
  AlertCircle,
  FilePlus2,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { MOCK_ISSUES } from '../data/mockData';

export default function AIDetectionHub({ issues, addCustomIssue }) {
  const samples = [
    {
      id: 'potholes',
      name: 'Drone Road Survey',
      path: '/assets/potholes_drone.png',
      type: 'Pothole',
      address: 'Double Road, Sector 3, HSR Layout',
      ward: 'Ward 174 - HSR Layout',
      coords: { lat: 12.9126, lng: 77.6384 },
      boxes: [
        { x: 22, y: 35, width: 14, height: 12, label: "Pothole", score: 0.94 },
        { x: 45, y: 50, width: 18, height: 16, label: "Pothole", score: 0.92 },
        { x: 70, y: 20, width: 12, height: 10, label: "Pothole", score: 0.88 },
        { x: 30, y: 68, width: 25, height: 8, label: "Road Crack", score: 0.86 }
      ]
    },
    {
      id: 'garbage',
      name: 'Sanitation Patrol View',
      path: '/assets/garbage_drone.png',
      type: 'Garbage Accumulation',
      address: '12th Main Road, Indiranagar',
      ward: 'Ward 80 - Indiranagar',
      coords: { lat: 12.9716, lng: 77.6406 },
      boxes: [
        { x: 15, y: 20, width: 55, height: 60, label: "Garbage Accumulation", score: 0.91 },
        { x: 72, y: 40, width: 20, height: 25, label: "Garbage Pile", score: 0.87 }
      ]
    },
    {
      id: 'flooding',
      name: 'Monsoon Sat-Surveillance',
      path: '/assets/flooding_drone.png',
      type: 'Waterlogging',
      address: '80 Feet Road, Koramangala',
      ward: 'Ward 151 - Koramangala',
      coords: { lat: 12.9304, lng: 77.6186 },
      boxes: [
        { x: 5, y: 15, width: 85, height: 75, label: "Waterlogging", score: 0.96 }
      ]
    }
  ];

  const [selectedSample, setSelectedSample] = useState(samples[0]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.85);
  const [hoveredBox, setHoveredBox] = useState(null);
  const [filedIssues, setFiledIssues] = useState({}); // Tracking which samples have been filed as issues
  const [customImage, setCustomImage] = useState(null);

  // Trigger simulated scan when sample changes
  useEffect(() => {
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [selectedSample]);

  const handleCustomUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const customSample = {
          id: 'custom-' + Date.now(),
          name: file.name,
          path: reader.result,
          type: 'Pothole',
          address: 'Unknown Location (Smart Camera Feed #882)',
          ward: 'Ward 112 - MG Road',
          coords: { lat: 12.9882, lng: 77.6046 },
          boxes: [
            { x: 30, y: 40, width: 25, height: 20, label: "Pothole", score: 0.95 },
            { x: 60, y: 55, width: 18, height: 15, label: "Road Crack", score: 0.89 }
          ]
        };
        setCustomImage(customSample);
        setSelectedSample(customSample);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileIssue = () => {
    // Generate a new issue item for global database
    const newId = `CS-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newIssue = {
      id: newId,
      type: selectedSample.type,
      title: `Automated Detection: ${selectedSample.type}`,
      description: `Discovered during AI scanning of image: ${selectedSample.name}. Automatic localization routed coords.`,
      location: {
        lat: selectedSample.coords.lat,
        lng: selectedSample.coords.lng,
        address: selectedSample.address,
        ward: selectedSample.ward
      },
      severity: selectedSample.type === 'Waterlogging' ? 'Critical' : 'High',
      status: 'Pending Review',
      reportedAt: new Date().toISOString(),
      detectedBy: 'YOLOv8 Live Analysis Model',
      confidence: selectedSample.boxes[0]?.score || 0.90,
      image: selectedSample.id.startsWith('custom') ? null : selectedSample.path,
      recommendedDept: selectedSample.type === 'Pothole' 
        ? 'Public Works Department (PWD)' 
        : selectedSample.type === 'Garbage Accumulation' 
        ? 'Sanitation & Solid Waste Management (SSWM)' 
        : 'Water Supply & Sewerage Board (BWSSB)',
      estCost: Math.round(5000 + Math.random() * 20000),
      slaHours: selectedSample.type === 'Waterlogging' ? 12 : 24,
      trafficVolume: 'High',
      boundingBoxes: selectedSample.boxes
    };

    if (addCustomIssue) {
      addCustomIssue(newIssue);
    }
    setFiledIssues({ ...filedIssues, [selectedSample.id]: newId });
  };

  const filteredBoxes = selectedSample.boxes.filter(
    box => box.score >= confidenceThreshold
  );

  const getBoxColor = (label) => {
    switch (label) {
      case 'Pothole': return '#00a8ff';
      case 'Road Crack': return '#c084fc';
      case 'Waterlogging': return '#f43f5e';
      case 'Garbage Accumulation': return '#fbbf24';
      default: return '#10b981';
    }
  };

  return (
    <div className="detection-container">
      {/* Sample and upload panel */}
      <div className="grid-2" style={{ marginBottom: '0px' }}>
        {/* Sample Selectors */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>Select Live Surveillance Feeds</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Choose a drone scan feed to verify infrastructure damage detections</p>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            {samples.map((sample) => (
              <button
                key={sample.id}
                className={`btn ${selectedSample.id === sample.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: '12px' }}
                onClick={() => setSelectedSample(sample)}
              >
                {sample.name}
              </button>
            ))}
            {customImage && (
              <button
                className={`btn ${selectedSample.id === customImage.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: '12px' }}
                onClick={() => setSelectedSample(customImage)}
              >
                Uploaded Image
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 14px', cursor: 'pointer' }}>
              <Upload size={14} style={{ marginRight: '6px' }} />
              Upload Aerial Image
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleCustomUpload} 
                style={{ display: 'none' }} 
              />
            </label>
            {customImage && (
              <button 
                className="action-btn" 
                onClick={() => {
                  setCustomImage(null);
                  setSelectedSample(samples[0]);
                }}
                title="Reset custom image"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="glass-card">
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} /> YOLOv8 Model Configuration
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Tune confidence thresholds and overlay criteria in real-time</p>
          
          <div className="slider-container" style={{ marginBottom: '16px' }}>
            <div className="slider-header">
              <span className="slider-label">Min Confidence Threshold</span>
              <span className="slider-value">{Math.round(confidenceThreshold * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.50" 
              max="0.98" 
              step="0.01" 
              value={confidenceThreshold} 
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))} 
              className="custom-range"
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div style={{ flex: 1, backgroundColor: 'rgba(var(--accent-blue-rgb), 0.03)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>Detections:</strong> {filteredBoxes.length} objects
            </div>
            <div style={{ flex: 1, backgroundColor: 'rgba(var(--accent-blue-rgb), 0.03)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>Inference Latency:</strong> 14.8 ms
            </div>
          </div>
        </div>
      </div>

      {/* Main Image and Overlay Hub */}
      <div className="grid-2-1" style={{ alignItems: 'start' }}>
        {/* Detection Area */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Location Context: <strong style={{ color: 'var(--text-primary)' }}>{selectedSample.address}</strong>
            </span>
            <span className="badge badge-purple" style={{ fontSize: '10px' }}>YOLOv8s Model</span>
          </div>

          <div className="image-canvas-wrapper">
            <img 
              src={selectedSample.path} 
              alt="surveillance-scan" 
              className="detection-image" 
            />
            
            {isScanning && (
              <>
                <div className="scanner-bar"></div>
                <div style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  border: '1px solid var(--accent-blue)',
                  fontWeight: '600',
                  color: 'var(--accent-blue)',
                  zIndex: 20
                }}>
                  Scanning YOLOv8 Core Weights... {scanProgress}%
                </div>
              </>
            )}

            {!isScanning && filteredBoxes.map((box, index) => {
              const borderCol = getBoxColor(box.label);
              return (
                <div
                  key={index}
                  className="bounding-box"
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                    borderColor: borderCol
                  }}
                  onMouseEnter={() => setHoveredBox(box)}
                  onMouseLeave={() => setHoveredBox(null)}
                >
                  <span 
                    className="yolo-box-label"
                    style={{
                      backgroundColor: borderCol,
                      bottom: '100%',
                      left: '-2px'
                    }}
                  >
                    {box.label} {Math.round(box.score * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Panel */}
        <div className="glass-card" style={{ minHeight: '430px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--accent-blue)' }} /> CV Diagnostics Report
            </h3>
            <div style={{ height: '1px', background: 'var(--border-card)', margin: '12px 0' }} />
            
            {/* Box Hover / Current Detections List */}
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Detected Class Breakdown:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredBoxes.map((box, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border-card)',
                      backgroundColor: hoveredBox === box ? 'rgba(var(--accent-blue-rgb), 0.05)' : 'rgba(255,255,255,0.01)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: getBoxColor(box.label) 
                      }} />
                      <strong style={{ fontSize: '12px' }}>{box.label}</strong>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '600', color: 'var(--accent-blue)' }}>
                      CONF: {Math.round(box.score * 100)}%
                    </span>
                  </div>
                ))}

                {filteredBoxes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    No items detected above {Math.round(confidenceThreshold * 100)}% confidence.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            {/* Routing Recommendations */}
            <div style={{ backgroundColor: 'rgba(var(--accent-blue-rgb), 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)', fontSize: '12px', marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={14} style={{ color: 'var(--accent-purple)' }} /> AI Routing Recommendation
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {selectedSample.type === 'Pothole' 
                  ? 'PWD targeted resurfacing is recommended. Estimated surface repair area: ~8.4 sq.m.' 
                  : selectedSample.type === 'Garbage Accumulation' 
                  ? 'SSWM Sanitation Division dispatch recommended. Expected volume: 1.2 metric tons.' 
                  : 'BWSSB storm drain clearance needed. Severe surface accumulation index flagged.'}
              </p>
            </div>

            {filedIssues[selectedSample.id] ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                color: 'var(--success)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                <Check size={16} /> Work Order Created: {filedIssues[selectedSample.id]}
              </div>
            ) : (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px' }}
                onClick={handleFileIssue}
                disabled={isScanning || filteredBoxes.length === 0}
              >
                <FilePlus2 size={16} />
                Dispatch & File Government Work Order
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
