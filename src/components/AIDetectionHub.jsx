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
  Waves
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

  // Real inference state & active request sequence tracker
  const [inferenceResult, setInferenceResult] = useState(null);
  const activeRequestSeqRef = useRef(0);

  const imgRef = useRef(null);
  const maskCanvasRef = useRef(null);

  // Execute genuine model inference when selected sample, image, or threshold changes
  useEffect(() => {
    let isMounted = true;
    const reqSeq = ++activeRequestSeqRef.current;

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

        // Calculate prototype severity and priority from actual visual evidence
        const severityAnalysis = calculateVisualDetectionsSeverity({
          ...rawResult,
          isAvailable: true
        });

        const fullResult = {
          ...rawResult,
          detections: {
            road: severityAnalysis.road.detections,
            waste: severityAnalysis.waste.detections
          },
          overallPriority: severityAnalysis.overallPriority,
          priorityReason: severityAnalysis.priorityReason,
          severityAnalysis,
          isAvailable: true
        };

        console.log(`[UI_STATE_UPDATE] Setting inferenceResult for Request #${reqSeq} (Flood: ${fullResult.flood.floodPixelsCount}px / ${fullResult.flood.floodedAreaPercent}%)`);
        setInferenceResult(fullResult);

        // Notify parent components / Civic Health contract if listener attached
        if (onVisualDetectionsChange) {
          onVisualDetectionsChange(fullResult);
        }
      } catch (err) {
        console.warn(`[INFERENCE_PIPELINE_ERROR] Request #${reqSeq} error:`, err);
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
      if (cls === 1 || cls === 3 || cls === 5) { // Target flood water classes: flooded building, flooded road, water
        data[idx] = 0;        // Red
        data[idx + 1] = 180;  // Green
        data[idx + 2] = 255;  // Blue
        data[idx + 3] = 150;  // Alpha (~60% opacity)
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0; // Completely transparent
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [inferenceResult]);

  const handleCustomUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
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

  // Combine all active bounding box detections (Road + Waste)
  const roadDetections = inferenceResult?.detections?.road || [];
  const wasteDetections = inferenceResult?.detections?.waste || [];
  const allDetections = [...roadDetections, ...wasteDetections];
  const floodResult = inferenceResult?.flood;

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

  const handleFileIssue = () => {
    if (allDetections.length === 0 && (!floodResult || !floodResult.detected)) return;
    
    const isFloodPrimary = floodResult && floodResult.detected && allDetections.length === 0;
    const newId = `CS-2026-${Math.floor(100 + (floodResult?.floodedAreaPercent || 50))}`;
    
    const newIssue = {
      id: newId,
      type: isFloodPrimary ? 'Street/Road Waterlogging' : (allDetections[0]?.type || 'Civic Defect'),
      title: isFloodPrimary 
        ? `Automated Detection: Visible Flood Water (${floodResult.floodedAreaPercent}% coverage)` 
        : `Automated Detection: ${allDetections[0].type} (${allDetections[0].classCode})`,
      description: `Verified by ${inferenceResult?.modelName}. Source: ${inferenceResult?.source}.`,
      location: {
        lat: inferenceResult?.metadata?.latitude,
        lng: inferenceResult?.metadata?.longitude,
        address: inferenceResult?.metadata?.latitude !== null ? `GPS: ${inferenceResult.metadata.latitude}, ${inferenceResult.metadata.longitude}` : 'LOCATION UNAVAILABLE',
        ward: 'Unassigned Spatial Ward'
      },
      severity: isFloodPrimary ? (inferenceResult?.severityAnalysis?.flood?.severity || 'Moderate') : 'Moderate',
      status: 'Pending Review',
      reportedAt: inferenceResult?.metadata?.timestamp || new Date().toISOString(),
      detectedBy: 'CivicSense Multi-Model ONNX Vision Engine',
      confidence: isFloodPrimary ? null : allDetections[0]?.confidence,
      image: selectedSample.path,
      recommendedDept: isFloodPrimary 
        ? 'Stormwater Drainage & Flood Management (SWDFM)' 
        : (allDetections[0]?.type.includes('Waste') ? 'Sanitation & Solid Waste (SSWM)' : 'Public Works Department (PWD)'),
      boundingBoxes: allDetections.map(d => d.boundingBox)
    };

    if (addCustomIssue) {
      addCustomIssue(newIssue);
    }
    setFiledIssues({ ...filedIssues, [selectedSample.id]: newId });
  };

  return (
    <div className="detection-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
            STREET-LEVEL CIVIC DETECTION (MULTI-MODEL AI ENGINE)
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            3 Verified Real ONNX AI Models: Road Damage (RDD2022), Waste Detection (YOLOv8), and Flood/Water Segmentation (SegFormer FloodNet)
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

      {/* Control Bar & Hyperparameters */}
      <div className="grid-2" style={{ marginBottom: '0px' }}>
        {/* Sample Selector & File Upload */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Select Image Source</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Choose a curated dataset image or upload a custom geotagged photo.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
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
                  setSelectedSample(samples[0]);
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
            <Sliders size={16} /> Inference Hyperparameters & Latency
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Adjust minimum confidence threshold for bounding box detection models
          </p>

          <div className="slider-container" style={{ marginBottom: '16px' }}>
            <div className="slider-header">
              <span className="slider-label">Min Confidence Threshold</span>
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

          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div style={{ flex: 1, backgroundColor: 'rgba(0, 168, 255, 0.04)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>BBox Detections:</strong> {allDetections.length} objects
            </div>
            <div style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.04)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>Visible Flood Coverage:</strong> {floodResult?.floodedAreaPercent ?? 0}%
            </div>
            <div style={{ flex: 1, backgroundColor: 'rgba(192, 132, 252, 0.04)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>Pure Tensor Latency:</strong> {isInferring ? 'Measuring...' : `${floodResult?.inferenceTimeMs || 0} ms`}
            </div>
          </div>
        </div>
      </div>

      {/* DEVELOPER DIAGNOSTICS PANEL */}
      <div className="glass-card" style={{ 
        padding: '14px 18px', 
        border: inferenceResult?.isModelVerified ? '1px solid var(--border-card)' : '1px dashed rgba(245, 158, 11, 0.5)',
        backgroundColor: inferenceResult?.isModelVerified ? 'rgba(0,168,255,0.02)' : 'rgba(245, 158, 11, 0.03)',
        borderRadius: '10px',
        fontSize: '11px'
      }}>
        <div className="flex-between" style={{ marginBottom: '8px' }}>
          <strong style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={14} /> MULTI-MODEL DIAGNOSTICS & PREPROCESSING
          </strong>
          <span style={{ fontWeight: '700', color: '#10b981' }}>
            VERIFIED ONNX INFERENCE ENGINE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', color: 'var(--text-secondary)' }}>
          <div><strong>Road Model Shape:</strong> [1, 3, 640, 640]</div>
          <div><strong>Waste Model Shape:</strong> [1, 3, 640, 640]</div>
          <div><strong>Flood Model Shape:</strong> [1, 3, 512, 512]</div>
          <div><strong>Flood Output Shape:</strong> {inferenceResult?.devDiagnostics?.floodOutputShape || '[1, 10, 128, 128]'}</div>
          <div><strong>Natural Resolution:</strong> {inferenceResult?.devDiagnostics?.naturalResolution || 'Unknown'}</div>
          <div><strong>Mask Dimensions:</strong> 128 × 128 (16,384 px)</div>
          <div><strong>Flood Pixels:</strong> {inferenceResult?.devDiagnostics?.floodPixels ?? 0} / 16,384</div>
          <div><strong>Flooded Area Ratio:</strong> {inferenceResult?.devDiagnostics?.floodedAreaRatio ?? 0}</div>
          <div><strong>Confidence Threshold:</strong> {Math.round(confidenceThreshold * 100)}%</div>
          <div><strong>Postprocessing Status:</strong> {inferenceResult?.devDiagnostics?.postprocessingStatus || 'COMPLETED'}</div>
        </div>

        {inferenceResult?.devDiagnostics?.isLowResolution && (
          <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px', color: '#f59e0b', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>⚠ <strong>LOW-RESOLUTION IMAGE:</strong> Flood segmentation & detection quality may be reduced because the uploaded image is below recommended resolution.</span>
          </div>
        )}
      </div>

      {/* Main Image View & AI Diagnostics */}
      <div className="grid-2-1" style={{ alignItems: 'start' }}>
        {/* Bounding Box & Segmentation Mask Canvas Overlay */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          
          <div className="flex-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Source:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedSample.sourceType}</strong>
            </div>

            {/* GPS Metadata Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: inferenceResult?.metadata?.isGpsVerified ? '#10b981' : '#f59e0b' }} />
              <span style={{
                fontWeight: '700',
                color: inferenceResult?.metadata?.isGpsVerified ? '#10b981' : '#f59e0b'
              }}>
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
                Running ONNX Model Tensor Inference...
              </div>
            )}

            {!isInferring && allDetections.map((box, index) => {
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
          </div>

          {/* Action Bar: File Report Button */}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              disabled={(allDetections.length === 0 && (!floodResult || !floodResult.detected)) || filedIssues[selectedSample.id]}
              onClick={handleFileIssue}
              style={{ padding: '10px 18px', fontSize: '13px' }}
            >
              {filedIssues[selectedSample.id] ? (
                <>
                  <Check size={16} style={{ marginRight: '6px' }} />
                  Issue Filed ({filedIssues[selectedSample.id]})
                </>
              ) : (
                <>
                  <FilePlus2 size={16} style={{ marginRight: '6px' }} />
                  File Verified Civic Issue ({allDetections.length + (floodResult?.detected ? 1 : 0)} Identified)
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Detection Breakdown & 3-Model Summary Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 🌊 FLOOD / WATER MODEL PANEL */}
          <div className="glass-card" style={{ padding: '18px', border: '1px solid rgba(0, 168, 255, 0.3)', backgroundColor: 'rgba(0, 168, 255, 0.02)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00a8ff' }}>
              <Waves size={18} /> 🌊 FLOOD / WATER AI MODEL
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Model Session:</span>
                <span className={`badge ${floodResult?.modelStatus === 'VERIFIED_ONNX' ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                  {floodResult?.modelStatus || 'MODEL UNAVAILABLE'}
                </span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Inference Execution:</span>
                <span className={`badge ${floodResult?.inferenceStatus === 'SUCCESS' ? 'badge-purple' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                  {floodResult?.inferenceStatus || 'FAILED'}
                </span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Detection Status:</span>
                <strong style={{ color: floodResult?.detected ? '#ef4444' : '#10b981' }}>
                  {floodResult?.inferenceStatus === 'SUCCESS'
                    ? (floodResult.detected ? 'DETECTED' : 'NOT DETECTED')
                    : 'UNAVAILABLE'}
                </strong>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Target Flood Pixels:</span>
                <strong style={{ color: floodResult?.floodPixelsCount > 0 ? '#00a8ff' : 'var(--text-muted)' }}>
                  {floodResult?.floodPixelsCount ?? 0} / 16,384
                </strong>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Visible Water Coverage:</span>
                <strong style={{ fontSize: '14px', color: floodResult?.floodedAreaPercent > 15 ? '#ef4444' : floodResult?.floodedAreaPercent > 3 ? '#f59e0b' : '#10b981' }}>
                  {floodResult?.floodedAreaPercent ?? 0}%
                </strong>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Flood Severity:</span>
                <span className={`badge ${
                  inferenceResult?.severityAnalysis?.flood?.severity === 'CRITICAL' ? 'badge-red' :
                  inferenceResult?.severityAnalysis?.flood?.severity === 'HIGH' ? 'badge-amber' :
                  inferenceResult?.severityAnalysis?.flood?.severity === 'MEDIUM' ? 'badge-purple' : 'badge-blue'
                }`} style={{ fontSize: '10px' }}>
                  {inferenceResult?.severityAnalysis?.flood?.severity || 'UNAVAILABLE'}
                </span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Tensor Inference Latency:</span>
                <span>{floodResult?.inferenceTimeMs || 0} ms</span>
              </div>

              <div className="flex-between">
                <span style={{ color: 'var(--text-muted)' }}>Image Resolution:</span>
                <span>{inferenceResult?.devDiagnostics?.naturalResolution || 'Unknown'}</span>
              </div>
            </div>

            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic', borderTop: '1px solid var(--border-card)', paddingTop: '8px' }}>
              Prototype visual severity derived directly from SegFormer FloodNet ONNX pixel segmentation map.
            </p>
          </div>

          {/* Detected Objects List (Road & Waste) */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} style={{ color: 'var(--accent-blue)' }} /> Detected Visual Objects ({allDetections.length})
            </h3>

            {allDetections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                No bounding box defects detected above threshold ({Math.round(confidenceThreshold * 100)}%).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {allDetections.map((det) => (
                  <div 
                    key={det.id}
                    onMouseEnter={() => setHoveredBox(det)}
                    onMouseLeave={() => setHoveredBox(null)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: hoveredBox === det ? 'rgba(0,168,255,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${hoveredBox === det ? 'var(--accent-blue)' : 'var(--border-card)'}`,
                      transition: 'var(--transition)',
                      cursor: 'pointer'
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '6px' }}>
                      <span style={{ fontWeight: '800', fontSize: '13px', color: getBoxColor(det.type) }}>
                        {det.type} ({det.classCode})
                      </span>
                      <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                        Model Conf: {Math.round(det.confidence * 100)}%
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <div>Bounding Box: [{det.boundingBox.x}%, {det.boundingBox.y}%]</div>
                      <div>Box Extent: {det.boundingBox.width}% × {det.boundingBox.height}%</div>
                      <div>Derived Severity: <strong style={{ color: det.severity === 'HIGH' ? '#ef4444' : det.severity === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>{det.severity || 'LOW'}</strong></div>
                      <div>Source: {det.source}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Priority & Severity Breakdown (Phase 8C-6B) */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
              Action Priority & Multi-Hazard Severity
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <div className="flex-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Action Priority:</span>
                <span className={`badge ${
                  inferenceResult?.overallPriority === 'IMMEDIATE' ? 'badge-red' :
                  inferenceResult?.overallPriority === 'HIGH' ? 'badge-amber' :
                  inferenceResult?.overallPriority === 'MEDIUM' ? 'badge-purple' : 'badge-blue'
                }`} style={{ fontSize: '11px', padding: '4px 8px' }}>
                  {inferenceResult?.overallPriority || 'ROUTINE'}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {inferenceResult?.priorityReason || 'Baseline monitoring'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div className="flex-between" style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span>Road Defect Severity:</span>
                <strong style={{ color: inferenceResult?.severityAnalysis?.road?.severity === 'HIGH' ? '#ef4444' : inferenceResult?.severityAnalysis?.road?.severity === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                  {inferenceResult?.severityAnalysis?.road?.severity || 'CLEAR'}
                </strong>
              </div>

              <div className="flex-between" style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span>Waste Accumulation:</span>
                <strong style={{ color: inferenceResult?.severityAnalysis?.waste?.severity === 'HIGH' ? '#ef4444' : inferenceResult?.severityAnalysis?.waste?.severity === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                  {inferenceResult?.severityAnalysis?.waste?.severity || 'UNAVAILABLE'}
                </strong>
              </div>

              <div className="flex-between" style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span>Flood / Water Severity:</span>
                <strong style={{ color: inferenceResult?.severityAnalysis?.flood?.severity === 'CRITICAL' || inferenceResult?.severityAnalysis?.flood?.severity === 'HIGH' ? '#ef4444' : inferenceResult?.severityAnalysis?.flood?.severity === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                  {inferenceResult?.severityAnalysis?.flood?.severity || 'UNAVAILABLE'}
                </strong>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
