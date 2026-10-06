import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Cpu, 
  Sliders, 
  Check, 
  FilePlus2,
  MapPin, 
  Clock, 
  RotateCcw, 
  Sparkles, 
  AlertTriangle, 
  Waves,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Building,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { 
  runGenuineVisualInference, 
  extractImageMetadata 
} from '../services/visualInferenceService';
import { 
  calculateVisualDetectionsSeverity 
} from '../services/civicSeverityService';

export default function AIDetectionHub({ addCustomIssue, onVisualDetectionsChange }) {
  const samples = [
    {
      id: 'potholes',
      name: 'Curated Test: Road Damage (RDD2022)',
      path: '/assets/potholes_drone.png',
      sourceType: 'CURATED TEST IMAGE'
    },
    {
      id: 'garbage',
      name: 'Curated Test: Waste Accumulation',
      path: '/assets/garbage_drone.png',
      sourceType: 'CURATED TEST IMAGE'
    },
    {
      id: 'flooding',
      name: 'Curated Test: Flood Water Inundation',
      path: '/assets/flooding_drone.png',
      sourceType: 'CURATED TEST IMAGE'
    }
  ];

  const [selectedSample, setSelectedSample] = useState(samples[0]);
  const [customImage, setCustomImage] = useState(null);
  const [isInferring, setIsInferring] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.50);
  const [hoveredBox, setHoveredBox] = useState(null);
  const [filedIssues, setFiledIssues] = useState({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSuppressedBoxes, setShowSuppressedBoxes] = useState(true);

  // Real inference state & active request sequence tracker
  const [inferenceResult, setInferenceResult] = useState(null);
  const activeRequestSeqRef = useRef(0);

  const imgRef = useRef(null);
  const maskCanvasRef = useRef(null);

  // Helper for sample switching with immediate state reset to prevent stale data bleed
  const handleSelectSample = (sample) => {
    setInferenceResult(null);
    if (onVisualDetectionsChange) {
      onVisualDetectionsChange(null);
    }
    setSelectedSample(sample);
  };

  // Execute genuine model inference when selected sample, image, or threshold changes
  useEffect(() => {
    let isMounted = true;
    const reqSeq = ++activeRequestSeqRef.current;

    // Reset previous results immediately upon parameter/sample change
    setInferenceResult(null);
    if (onVisualDetectionsChange) {
      onVisualDetectionsChange(null);
    }

    const runInferencePipeline = async () => {
      setIsInferring(true);
      
      try {
        const imageElement = new Image();
        if (selectedSample.path && (selectedSample.path.startsWith('http://') || selectedSample.path.startsWith('https://'))) {
          imageElement.crossOrigin = 'anonymous';
        }
        imageElement.src = selectedSample.path;

        await new Promise((resolve, reject) => {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        });

        if (!isMounted || reqSeq !== activeRequestSeqRef.current) return;

        // Parse genuine EXIF metadata (GPS & Timestamp)
        let metadata = { latitude: null, longitude: null, timestamp: null, isGpsVerified: false };
        if (selectedSample.file) {
          metadata = await extractImageMetadata(selectedSample.file);
        } else if (selectedSample.path.startsWith('data:')) {
          const fetchRes = await fetch(selectedSample.path);
          const buf = await fetchRes.arrayBuffer();
          metadata = await extractImageMetadata(buf);
        }

        if (!isMounted || reqSeq !== activeRequestSeqRef.current) return;

        // Run real multi-model inference (Road + Waste + Flood ONNX Models)
        const rawResult = await runGenuineVisualInference({
          imageElement,
          metadata,
          imageSourceType: selectedSample.sourceType,
          confidenceThreshold,
          floodModelUrl: '/models/flood-water-segmentation.onnx?v=phase8c6d'
        });

        if (!isMounted || reqSeq !== activeRequestSeqRef.current) {
          console.log(`[STALE_INFERENCE_DISCARDED] Request #${reqSeq} discarded because newer request #${activeRequestSeqRef.current} is active.`);
          return;
        }

        // Calculate contextual arbitration, severity, priority, and confirmed civic incidents
        const severityAnalysis = calculateVisualDetectionsSeverity({
          ...rawResult,
          isAvailable: true
        });

        const fullResult = {
          ...rawResult,
          ...severityAnalysis,
          isAvailable: true
        };

        console.log(`[UI_STATE_UPDATE] Setting inferenceResult for Request #${reqSeq} (Incidents: ${fullResult.civicIncidents?.length ?? 0}, Suppressed: ${fullResult.suppressedDetections?.length ?? 0})`);
        setInferenceResult(fullResult);

        // Notify parent components / central state
        if (onVisualDetectionsChange) {
          onVisualDetectionsChange(fullResult);
        }
      } catch (err) {
        console.warn(`[INFERENCE_PIPELINE_ERROR] Request #${reqSeq} error:`, err);
        if (isMounted && reqSeq === activeRequestSeqRef.current) {
          setInferenceResult(null);
          if (onVisualDetectionsChange) {
            onVisualDetectionsChange(null);
          }
        }
      } finally {
        if (isMounted && reqSeq === activeRequestSeqRef.current) {
          setIsInferring(false);
        }
      }
    };

    runInferencePipeline();

    return () => {
      isMounted = false;
    };
  }, [selectedSample.id, selectedSample.path, confidenceThreshold]);

  // Render ONNX Segmentation Mask Overlay directly onto HTML Canvas
  useEffect(() => {
    if (!inferenceResult?.flood?.maskClassArray || !maskCanvasRef.current) return;

    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const maskW = inferenceResult.flood.maskWidth || 128;
    const maskH = inferenceResult.flood.maskHeight || 128;

    canvas.width = maskW;
    canvas.height = maskH;

    const imgData = ctx.createImageData(maskW, maskH);
    const data = imgData.data;
    const maskArr = inferenceResult.flood.maskClassArray;

    for (let i = 0; i < maskArr.length; i++) {
      const cls = maskArr[i];
      const idx = i * 4;
      if (cls === 1 || cls === 3 || cls === 5) {
        data[idx] = 0;        // Red
        data[idx + 1] = 180;  // Green
        data[idx + 2] = 255;  // Blue
        data[idx + 3] = 150;  // Alpha (~60% opacity)
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;     // Completely transparent
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [inferenceResult]);

  const handleCustomUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setInferenceResult(null);
      if (onVisualDetectionsChange) onVisualDetectionsChange(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const customSample = {
          id: 'custom-' + Date.now(),
          name: file.name,
          path: reader.result,
          file: file,
          sourceType: 'USER-UPLOADED IMAGE'
        };
        setCustomImage(customSample);
        setSelectedSample(customSample);
      };
      reader.readAsDataURL(file);
    }
  };

  // Extract layers from inferenceResult
  const rawRoad = inferenceResult?.rawDetections?.road || [];
  const rawWaste = inferenceResult?.rawDetections?.waste || [];
  const acceptedRoad = inferenceResult?.contextualDetections?.road || [];
  const acceptedWaste = inferenceResult?.contextualDetections?.waste || [];
  const suppressedWaste = inferenceResult?.suppressedDetections || [];
  const civicIncidents = inferenceResult?.civicIncidents || [];
  const floodResult = inferenceResult?.flood;
  const floodInterp = inferenceResult?.floodInterpretation;
  const fusionEv = inferenceResult?.fusionEvidence;

  const getBoxColor = (label) => {
    switch (label) {
      case 'Pothole': return '#00a8ff';
      case 'Longitudinal Crack': return '#c084fc';
      case 'Transverse Crack': return '#e879f9';
      case 'Alligator Crack': return '#a855f7';
      case 'Cardboard Waste':
      case 'E-Waste':
      case 'Glass Waste':
      case 'Medical Waste':
      case 'Metal Waste':
      case 'Organic Waste':
      case 'Paper Waste':
      case 'Plastic Waste':
      case 'Detected Waste': return '#fbbf24';
      default: return '#10b981';
    }
  };

  const handleFileIssue = (incident) => {
    if (!incident) return;
    const issueId = incident.id || `CS-INC-${Date.now().toString().slice(-6)}`;

    const newIssue = {
      id: issueId,
      type: incident.title,
      title: `${incident.title} (${incident.severity} Severity)`,
      description: incident.sourceEvidence,
      location: {
        lat: inferenceResult?.metadata?.latitude,
        lng: inferenceResult?.metadata?.longitude,
        address: incident.location?.formatted || 'LOCATION UNAVAILABLE',
        ward: 'Metropolitan Spatial District'
      },
      severity: incident.severity,
      priority: incident.priority,
      status: 'Pending Review',
      reportedAt: incident.timestamp || new Date().toISOString(),
      detectedBy: 'CivicSense Multi-Model ONNX Vision Engine',
      confidence: incident.confidence,
      image: selectedSample.path,
      recommendedDept: incident.recommendedDepartment,
      recommendedAction: incident.recommendedAction,
      boundingBoxes: incident.boundingBoxes || []
    };

    if (addCustomIssue) {
      addCustomIssue(newIssue);
    }
    setFiledIssues(prev => ({ ...prev, [incident.id]: issueId }));
  };

  return (
    <div className="detection-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
            STREET-LEVEL CIVIC DETECTION & ARBITRATION HUB
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            End-to-End Visual Intelligence: Raw AI Detections → Contextual Cross-Model Arbitration → Confirmed Civic Incidents
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className={`badge ${inferenceResult?.isModelVerified ? 'badge-purple' : 'badge-amber'}`} style={{ fontSize: '11px', padding: '6px 12px' }}>
            Road: {inferenceResult?.isModelVerified ? 'VERIFIED ONNX' : 'UNAVAILABLE'}
          </span>
          <span className={`badge ${inferenceResult?.isWasteModelVerified ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: '11px', padding: '6px 12px' }}>
            Waste: {inferenceResult?.isWasteModelVerified ? 'VERIFIED ONNX' : 'UNAVAILABLE'}
          </span>
          <span className={`badge ${inferenceResult?.isFloodModelVerified ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '11px', padding: '6px 12px' }}>
            Flood: {inferenceResult?.isFloodModelVerified ? 'VERIFIED ONNX' : 'UNAVAILABLE'}
          </span>
        </div>
      </div>

      {/* Control Bar & Sample Selector */}
      <div className="grid-2" style={{ marginBottom: '0px' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Select Image Source</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Choose a curated dataset image or upload an arbitrary street image for multi-model inference.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            {samples.map((sample) => (
              <button
                key={sample.id}
                className={`btn ${selectedSample.id === sample.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: '12px' }}
                onClick={() => handleSelectSample(sample)}
              >
                {sample.name}
              </button>
            ))}
            {customImage && (
              <button
                className={`btn ${selectedSample.id === customImage.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: '12px' }}
                onClick={() => handleSelectSample(customImage)}
              >
                Uploaded Image
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 14px', cursor: 'pointer' }}>
              <Upload size={14} style={{ marginRight: '6px' }} />
              Upload Image for AI Inference
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
                  handleSelectSample(samples[0]);
                }}
                title="Reset custom image"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Hyperparameters & Performance Metric */}
        <div className="glass-card">
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} /> Inference Hyperparameters & Pipeline Controls
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Adjust minimum confidence threshold and toggle diagnostic overlays
          </p>

          <div className="slider-container" style={{ marginBottom: '14px' }}>
            <div className="slider-header">
              <span className="slider-label">Detection Confidence Threshold</span>
              <span className="slider-value">{Math.round(confidenceThreshold * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.30" 
              max="0.95" 
              step="0.05" 
              value={confidenceThreshold} 
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))} 
              className="custom-range"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowSuppressedBoxes(prev => !prev)}
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {showSuppressedBoxes ? <Eye size={13} /> : <EyeOff size={13} />}
              {showSuppressedBoxes ? 'Hide Suppressed Boxes' : 'Show Suppressed Boxes'}
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowDiagnostics(prev => !prev)}
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {showDiagnostics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showDiagnostics ? 'Hide Tensor Diagnostics' : 'Show Tensor Diagnostics'}
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDABLE DEVELOPER DIAGNOSTICS */}
      {showDiagnostics && (
        <div className="glass-card" style={{ 
          padding: '14px 18px', 
          border: '1px solid var(--border-card)',
          backgroundColor: 'rgba(0,168,255,0.02)',
          borderRadius: '10px',
          fontSize: '11px'
        }}>
          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '8px' }}>
            ⚙ TECHNICAL TENSOR & PREPROCESSING DIAGNOSTICS
          </strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', color: 'var(--text-secondary)' }}>
            <div><strong>Road Model:</strong> {inferenceResult?.devDiagnostics?.roadModelFile || '/models/rdd2022-road-damage.onnx'}</div>
            <div><strong>Waste Model:</strong> {inferenceResult?.devDiagnostics?.wasteModelFile || '/models/waste-detection.onnx'}</div>
            <div><strong>Flood Model:</strong> {inferenceResult?.devDiagnostics?.floodModelFile || '/models/flood-water-segmentation.onnx'}</div>
            <div><strong>Natural Resolution:</strong> {inferenceResult?.devDiagnostics?.naturalResolution || 'Unknown'}</div>
            <div><strong>Input Shape:</strong> [1, 3, 640, 640] (Flood: [1, 3, 512, 512])</div>
            <div><strong>Raw Candidates:</strong> Road: {inferenceResult?.devDiagnostics?.rawRoadCandidates ?? 0}, Waste: {inferenceResult?.devDiagnostics?.rawWasteCandidates ?? 0}</div>
            <div><strong>Post-NMS Detections:</strong> Road: {inferenceResult?.devDiagnostics?.postNmsRoadDetections ?? 0}, Waste: {inferenceResult?.devDiagnostics?.postNmsWasteDetections ?? 0}</div>
            <div><strong>Pure Latency:</strong> Flood: {floodResult?.inferenceTimeMs || 0}ms, Total: {inferenceResult?.inferenceTimeMs || 0}ms</div>
          </div>
        </div>
      )}

      {/* Main Image View & 3-Layer Panel */}
      <div className="grid-2-1" style={{ alignItems: 'start' }}>
        
        {/* Left Column: Image Canvas & Visual Overlays */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          
          <div className="flex-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Source:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedSample.sourceType}</strong>
            </div>

            {/* GPS Metadata Badge (Strict: NO fake coordinates) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: inferenceResult?.metadata?.isGpsVerified ? '#10b981' : '#f59e0b' }} />
              <span style={{ fontWeight: '700', color: inferenceResult?.metadata?.isGpsVerified ? '#10b981' : '#f59e0b' }}>
                {inferenceResult?.metadata?.isGpsVerified 
                  ? `GPS: ${inferenceResult.metadata.latitude}, ${inferenceResult.metadata.longitude}` 
                  : 'LOCATION UNAVAILABLE'}
              </span>
            </div>

            {/* Timestamp Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: inferenceResult?.metadata?.timestamp ? '#10b981' : 'var(--text-muted)' }} />
              <span style={{ color: inferenceResult?.metadata?.timestamp ? '#10b981' : 'var(--text-muted)' }}>
                {inferenceResult?.metadata?.timestamp ? `Captured: ${inferenceResult.metadata.timestamp}` : 'CAPTURE TIME UNAVAILABLE'}
              </span>
            </div>
          </div>

          {/* Image & Overlay Canvas Container */}
          <div className="image-canvas-wrapper" style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
            <img 
              ref={imgRef}
              src={selectedSample.path} 
              alt="civic-visual-inspection" 
              className="detection-image" 
              style={{ width: '100%', display: 'block', borderRadius: '8px' }}
            />

            {/* Segmentation Mask Overlay Canvas */}
            <canvas 
              ref={maskCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                borderRadius: '8px',
                zIndex: 5
              }}
            />

            {isInferring && (
              <div style={{ 
                position: 'absolute', 
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)',
                fontWeight: '700',
                fontSize: '14px',
                zIndex: 20
              }}>
                <Cpu className="spin" size={32} style={{ marginBottom: '8px' }} />
                Executing Multi-Model Tensor Inference & Contextual Arbitration...
              </div>
            )}

            {/* Accepted Bounding Boxes */}
            {!isInferring && [...acceptedRoad, ...acceptedWaste].map((box, index) => {
              const borderCol = getBoxColor(box.type);
              return (
                <div
                  key={box.id || index}
                  className="bounding-box"
                  style={{
                    position: 'absolute',
                    left: `${box.boundingBox.x}%`,
                    top: `${box.boundingBox.y}%`,
                    width: `${box.boundingBox.width}%`,
                    height: `${box.boundingBox.height}%`,
                    border: `2px solid ${borderCol}`,
                    backgroundColor: hoveredBox === box ? `${borderCol}22` : 'transparent',
                    boxShadow: `0 0 10px ${borderCol}66`,
                    transition: 'var(--transition)',
                    zIndex: 10
                  }}
                  onMouseEnter={() => setHoveredBox(box)}
                  onMouseLeave={() => setHoveredBox(null)}
                >
                  <span 
                    className="yolo-box-label"
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '-2px',
                      backgroundColor: borderCol,
                      color: '#000',
                      fontWeight: '800',
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px 4px 0 0',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {box.type} ({box.classCode}): {Math.round(box.confidence * 100)}%
                  </span>
                </div>
              );
            })}

            {/* Suppressed Monolithic Waste Boxes (Dashed Border with Audit Label) */}
            {!isInferring && showSuppressedBoxes && suppressedWaste.map((box, index) => (
              <div
                key={`supp-${box.id || index}`}
                className="bounding-box suppressed-box"
                style={{
                  position: 'absolute',
                  left: `${box.boundingBox.x}%`,
                  top: `${box.boundingBox.y}%`,
                  width: `${box.boundingBox.width}%`,
                  height: `${box.boundingBox.height}%`,
                  border: '2px dashed #f59e0b',
                  backgroundColor: hoveredBox === box ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
                  zIndex: 8
                }}
                onMouseEnter={() => setHoveredBox(box)}
                onMouseLeave={() => setHoveredBox(null)}
              >
                <span 
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    backgroundColor: 'rgba(245, 158, 11, 0.9)',
                    color: '#000',
                    fontWeight: '800',
                    fontSize: '10px',
                    padding: '2px 5px',
                    borderRadius: '3px'
                  }}
                >
                  ⚠ SUPPRESSED (Contextual Conflict)
                </span>
              </div>
            ))}
          </div>

          {/* Low Resolution Notice */}
          {inferenceResult?.devDiagnostics?.isLowResolution && (
            <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>Low-resolution image may reduce detection reliability.</span>
            </div>
          )}
        </div>

        {/* Right Column: 3 DISTINCT ARCHITECTURAL LAYERS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ======================================================== */}
          {/* LAYER 3 (PRIMARY): FINAL CIVIC INTERPRETATION            */}
          {/* ======================================================== */}
          <div className="glass-card" style={{ 
            padding: '18px', 
            border: civicIncidents.length > 0 ? '1.5px solid rgba(0, 168, 255, 0.4)' : '1px solid var(--border-card)',
            backgroundColor: civicIncidents.length > 0 ? 'rgba(0, 168, 255, 0.03)' : 'var(--bg-card)'
          }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#00a8ff' }}>
                <ShieldCheck size={18} /> LAYER 3: FINAL CIVIC INCIDENT(S)
              </h3>
              <span className={`badge ${civicIncidents.length > 0 ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                {civicIncidents.length} Confirmed
              </span>
            </div>

            {civicIncidents.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                {isInferring ? 'Evaluating multi-modal evidence...' : 'No verified civic incidents from current evidence.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {civicIncidents.map((incident) => (
                  <div 
                    key={incident.id} 
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '12px'
                    }}
                  >
                    <div className="flex-between">
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        {incident.title}
                      </strong>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className={`badge ${incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                          {incident.severity} SEVERITY
                        </span>
                        <span className={`badge ${incident.priority === 'IMMEDIATE' ? 'badge-red' : 'badge-purple'}`} style={{ fontSize: '10px' }}>
                          {incident.priority} PRIORITY
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building size={13} style={{ color: '#c084fc' }} />
                        <span><strong>Department:</strong> <span style={{ color: '#c084fc', fontWeight: '600' }}>{incident.recommendedDepartment}</span></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,168,255,0.06)', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid var(--accent-blue)' }}>
                        <Wrench size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                        <span><strong>AI Recommendation:</strong> {incident.recommendedAction}</span>
                      </div>

                      <div style={{ fontStyle: 'italic', color: '#94a3b8', marginTop: '2px' }}>
                        {incident.contextualInterpretation}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      disabled={filedIssues[incident.id]}
                      onClick={() => handleFileIssue(incident)}
                      style={{ padding: '6px 12px', fontSize: '11px', alignSelf: 'flex-end', marginTop: '4px' }}
                    >
                      {filedIssues[incident.id] ? (
                        <>
                          <Check size={14} style={{ marginRight: '4px' }} />
                          Dispatched ({filedIssues[incident.id]})
                        </>
                      ) : (
                        <>
                          <FilePlus2 size={14} style={{ marginRight: '4px' }} />
                          Confirm & Dispatch Incident
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* LAYER 2: CONTEXTUAL CROSS-MODEL ARBITRATION              */}
          {/* ======================================================== */}
          <div className="glass-card" style={{ padding: '18px', border: '1px solid rgba(192, 132, 252, 0.3)', backgroundColor: 'rgba(192, 132, 252, 0.02)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc' }}>
              <Sliders size={18} /> LAYER 2: CONTEXTUAL ARBITRATION
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Flood Topology:</span>
                <span className={`badge ${floodInterp?.isSignificantFlood ? 'badge-blue' : floodInterp?.isPossibleWater ? 'badge-purple' : 'badge-green'}`} style={{ fontSize: '10px' }}>
                  {floodInterp?.status || 'NO SIGNIFICANT WATER'}
                </span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Multi-Modal Fusion:</span>
                <strong style={{ color: fusionEv?.isWaterFilledPothole ? '#f43f5e' : 'var(--text-primary)' }}>
                  {fusionEv?.isWaterFilledPothole ? 'WATER-FILLED POTHOLE ACTIVE' : 'STANDARD ARBITRATION'}
                </strong>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Waste Arbitration:</span>
                <span>{acceptedWaste.length} accepted / {suppressedWaste.length} suppressed</span>
              </div>

              {/* Suppressed Detections Detail */}
              {suppressedWaste.length > 0 && (
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '4px' }}>
                    ⚠ Suppressed Cross-Category Conflicts ({suppressedWaste.length}):
                  </strong>
                  {suppressedWaste.map((s, idx) => (
                    <div key={idx} style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      • <strong>{s.type} ({s.classCode})</strong>: {s.arbitrationReason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* LAYER 1: RAW MODEL OUTPUTS & AUDIT                       */}
          {/* ======================================================== */}
          <div className="glass-card" style={{ padding: '18px', border: '1px solid rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
              <Cpu size={18} /> LAYER 1: RAW MODEL DETECTIONS
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>RDD2022 Road Model:</span>
                <span>{rawRoad.length} detection(s) {rawRoad.length > 0 ? `(${rawRoad.map(d => d.classCode).join(', ')})` : ''}</span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>YOLOv8 Waste Model:</span>
                <span>{rawWaste.length} raw detection(s) {rawWaste.length > 0 ? `(${rawWaste.map(d => d.classCode).join(', ')})` : ''}</span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>FloodNet Segmentation:</span>
                <span>{floodResult?.floodedAreaPercent ?? 0}% water ({floodResult?.floodPixelsCount ?? 0} px)</span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Raw Candidates Screened:</span>
                <span>{inferenceResult?.devDiagnostics?.rawCandidates ?? 0} proposals</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
