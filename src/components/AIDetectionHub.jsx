import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Camera,
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
  CheckCircle2,
  XCircle,
  HelpCircle,
  History,
  UserCheck,
  Timer,
  FileText,
  Smartphone,
  Layers,
  Info
} from 'lucide-react';
import { 
  runGenuineVisualInference, 
  extractImageMetadata,
  auditImageQuality
} from '../services/visualInferenceService';
import { 
  calculateVisualDetectionsSeverity,
  applyOperatorReview,
  updateIncidentLifecycleStatus
} from '../services/civicSeverityService';
import { 
  enqueueIncidentForDispatch, 
  getOfflineQueue,
  getIntegrationMode,
  recordTelemetryEvent
} from '../services/municipalIntegrationService';
import { 
  createWorkOrder, 
  generateSandboxWorkOrderId,
  getAllSandboxWorkOrders 
} from '../services/municipalAdapters/sandboxMunicipalAdapter';
import { 
  getCurrentSession, 
  hasPermission, 
  AUTH_ROLES,
  AUTH_TYPE 
} from '../services/authService';
import { getActiveRoadModelConfig } from '../config/modelRegistry';
import { 
  orchestrateImageAnalysis,
  acceptIncidentCandidate,
  ignoreIncidentCandidate,
  rejectIncidentCandidate,
  updateIncidentLifecycle,
  getAllIncidents
} from '../services/incidentOrchestrationService';

export default function AIDetectionHub({ addCustomIssue, onVisualDetectionsChange }) {
  const samples = [
    {
      id: 'potholes',
      name: 'Road Damage (RDD2022)',
      path: '/assets/potholes_drone.png',
      sourceType: 'CURATED TEST IMAGE',
      badge: 'Base Sample'
    },
    {
      id: 'garbage',
      name: 'Waste Accumulation',
      path: '/assets/garbage_drone.png',
      sourceType: 'CURATED TEST IMAGE',
      badge: 'Base Sample'
    },
    {
      id: 'flooding',
      name: 'Flood Water Inundation',
      path: '/assets/flooding_drone.png',
      sourceType: 'CURATED TEST IMAGE',
      badge: 'Base Sample'
    },
    // Field Pilot Matrix Test Cases (Tests A through F)
    {
      id: 'test_a',
      name: 'Test A: EXIF GPS & Time',
      path: '/assets/field_test/test_a_gps_and_time.jpg',
      sourceType: 'FIELD TEST A (GPS + TIMESTAMP)',
      badge: 'Test Matrix A'
    },
    {
      id: 'test_b',
      name: 'Test B: Timestamp Only',
      path: '/assets/field_test/test_b_time_no_gps.jpg',
      sourceType: 'FIELD TEST B (NO GPS)',
      badge: 'Test Matrix B'
    },
    {
      id: 'test_c',
      name: 'Test C: GPS Only',
      path: '/assets/field_test/test_c_gps_no_time.jpg',
      sourceType: 'FIELD TEST C (NO TIMESTAMP)',
      badge: 'Test Matrix C'
    },
    {
      id: 'test_d',
      name: 'Test D: Neither GPS/Time',
      path: '/assets/field_test/test_d_neither.jpg',
      sourceType: 'FIELD TEST D (NO METADATA)',
      badge: 'Test Matrix D'
    },
    {
      id: 'test_e',
      name: 'Test E: Low-Res Image',
      path: '/assets/field_test/test_e_low_res.jpg',
      sourceType: 'FIELD TEST E (LOW-RESOLUTION)',
      badge: 'Test Matrix E'
    },
    {
      id: 'test_f',
      name: 'Test F: High-Res Normal',
      path: '/assets/field_test/test_f_high_res.jpg',
      sourceType: 'FIELD TEST F (NORMAL HIGH-RES)',
      badge: 'Test Matrix F'
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
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);

  // Field Operator Review & Lifecycle State
  const [operatorDecisions, setOperatorDecisions] = useState({});
  const [incidentStatuses, setIncidentStatuses] = useState({});
  const [operatorNotes, setOperatorNotes] = useState({});
  const [activeNotesInputId, setActiveNotesInputId] = useState(null);
  const [activeAuditTrailIncident, setActiveAuditTrailIncident] = useState(null);
  const [reasonModal, setReasonModal] = useState({ open: false, action: null, incident: null, reason: '' });

  // Phase 10 Municipal Dispatch & Authentication State
  const [session, setSession] = useState(getCurrentSession());
  const [dispatchedWorkOrders, setDispatchedWorkOrders] = useState({});
  const [syncStates, setSyncStates] = useState({});
  const [dispatchErrors, setDispatchErrors] = useState({});
  const integrationMode = getIntegrationMode();

  // Real inference state & active request sequence tracker
  const [inferenceResult, setInferenceResult] = useState(null);
  const [pipelineError, setPipelineError] = useState(null);
  const activeRequestSeqRef = useRef(0);

  const imgRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Helper for sample switching with immediate state reset to prevent stale data bleed
  const handleSelectSample = (sample) => {
    setPipelineError(null);
    setInferenceResult(null);
    if (onVisualDetectionsChange) {
      onVisualDetectionsChange(null);
    }
    setSelectedSample(sample);
    setActiveWorkflowStep(1);
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
      setPipelineError(null);
      setActiveWorkflowStep(3); // Step 3: Run AI analysis
      
      try {
        const imageElement = new Image();
        if (selectedSample.path && (selectedSample.path.startsWith('http://') || selectedSample.path.startsWith('https://'))) {
          imageElement.crossOrigin = 'anonymous';
        }
        imageElement.src = selectedSample.path;

        const loadStartTime = performance.now();
        await new Promise((resolve, reject) => {
          if (imageElement.complete && imageElement.naturalWidth > 0) {
            resolve();
            return;
          }
          imageElement.onload = () => resolve();
          imageElement.onerror = () => reject(new Error(`Failed to load image from source: ${selectedSample.name || selectedSample.path}`));
        });
        const loadEndTime = performance.now();
        const imageLoadTimeMs = Number((loadEndTime - loadStartTime).toFixed(1));

        if (!isMounted || reqSeq !== activeRequestSeqRef.current) return;

        // Step 2: Parse genuine EXIF metadata (GPS & Timestamp)
        let metadata = { latitude: null, longitude: null, timestamp: null, isGpsVerified: false, orientation: "Normal" };
        if (selectedSample.file) {
          metadata = await extractImageMetadata(selectedSample.file);
        } else if (selectedSample.path) {
          try {
            const fetchRes = await fetch(selectedSample.path);
            const buf = await fetchRes.arrayBuffer();
            metadata = await extractImageMetadata(buf);
          } catch (e) {
            console.warn("[METADATA_FETCH_NOTICE] Could not parse EXIF buffer from URL, proceeding without EXIF.");
          }
        }

        if (!isMounted || reqSeq !== activeRequestSeqRef.current) return;

        // Run Central Incident Orchestration (Phase 17 Unified Pipeline)
        const orchestration = await orchestrateImageAnalysis({
          imageElement,
          metadata,
          imageSourceType: selectedSample.sourceType,
          confidenceThreshold,
          imageLoadTimeMs
        });

        if (!isMounted || reqSeq !== activeRequestSeqRef.current) {
          console.log(`[STALE_INFERENCE_DISCARDED] Request #${reqSeq} discarded.`);
          return;
        }

        if (!orchestration.success) {
          throw new Error(orchestration.error || "Orchestration pipeline execution failed.");
        }

        const rawResult = orchestration.inferenceResult;
        const severityAnalysis = orchestration.severityAnalysis;

        const fullResult = {
          ...rawResult,
          ...severityAnalysis,
          civicIncidents: orchestration.candidates,
          pipelineTrace: orchestration.pipelineTrace,
          isAvailable: true
        };

        console.log(`[UI_STATE_UPDATE] Orchestration completed for Request #${reqSeq} (Candidates: ${fullResult.civicIncidents?.length ?? 0})`);
        setInferenceResult(fullResult);
        setActiveWorkflowStep(8); // Progress to Step 8: Candidate Generation & Review Gate

        // Notify parent components / central state
        if (onVisualDetectionsChange) {
          onVisualDetectionsChange(fullResult);
        }
      } catch (err) {
        console.warn(`[INFERENCE_PIPELINE_ERROR] Request #${reqSeq} error:`, err);
        if (isMounted && reqSeq === activeRequestSeqRef.current) {
          setPipelineError(err?.message || String(err));
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
        data[idx + 3] = 0;     // Transparent
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [inferenceResult]);

  // Unified file/camera capture handler
  const handleCustomUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPipelineError(null);
      setInferenceResult(null);
      if (onVisualDetectionsChange) onVisualDetectionsChange(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const customSample = {
          id: 'custom-' + Date.now(),
          name: file.name || 'Mobile Camera Capture',
          path: reader.result,
          file: file,
          sourceType: file.name ? `UPLOAD: ${file.name}` : 'MOBILE CAMERA CAPTURE'
        };
        setCustomImage(customSample);
        setSelectedSample(customSample);
        setActiveWorkflowStep(2); // Step 2: Metadata Review
      };
      reader.onerror = (err) => {
        console.error("FileReader failed to load image:", err);
        setPipelineError("Failed to read image file from disk.");
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so selecting the same file again triggers onChange
    if (e?.target) {
      e.target.value = '';
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
  const qualityAudit = inferenceResult?.qualityAudit;
  const timing = inferenceResult?.timingBreakdown;

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

  // Operator Action: Confirm, Reject, or Needs Review
  const handleOperatorReview = (incident, decision) => {
    const note = operatorNotes[incident.id] || '';
    const updated = applyOperatorReview(incident, {
      decision,
      reason: note,
      operatorId: session.userId
    });

    setOperatorDecisions(prev => ({ ...prev, [incident.id]: updated.operatorDecision }));
    
    // Telemetry: record review event
    recordTelemetryEvent('OPERATOR_REVIEWED', {
      incidentId: incident.id,
      operatorId: session.userId,
      notes: `Operator decision: ${decision}${note ? ` (Reason: "${note}")` : ''}`
    });

    if (decision === 'CONFIRMED') {
      recordTelemetryEvent('INCIDENT_CONFIRMED', {
        incidentId: incident.id,
        operatorId: session.userId
      });
    } else if (decision === 'REJECTED') {
      recordTelemetryEvent('INCIDENT_REJECTED', {
        incidentId: incident.id,
        operatorId: session.userId,
        notes: note || "Rejected by operator"
      });
    }

    // Update local incident in inferenceResult
    if (inferenceResult?.civicIncidents) {
      const newIncidents = inferenceResult.civicIncidents.map(inc => 
        inc.id === incident.id ? updated : inc
      );
      const newResult = { ...inferenceResult, civicIncidents: newIncidents };
      setInferenceResult(newResult);
      if (onVisualDetectionsChange) onVisualDetectionsChange(newResult);
    }

    setActiveWorkflowStep(8); // Step 8 completed
    setActiveNotesInputId(null);
  };

  // Phase 17 Explicit Human Review Gate Handlers
  const handleAcceptCandidate = async (incident) => {
    const candidateId = incident.incidentId || incident.id;
    try {
      const res = await acceptIncidentCandidate(candidateId, {
        operatorId: session.userId,
        operatorName: session.displayName,
        notes: operatorNotes[candidateId] || ""
      });

      if (res.success) {
        setOperatorDecisions(prev => ({ 
          ...prev, 
          [candidateId]: { decision: 'ACCEPTED', timestamp: new Date().toISOString() } 
        }));
        setFiledIssues(prev => ({ ...prev, [candidateId]: res.incident?.workOrderId || 'ACCEPTED' }));

        if (onVisualDetectionsChange && inferenceResult) {
          const updated = (inferenceResult.civicIncidents || []).map(inc => 
            (inc.id === candidateId || inc.incidentId === candidateId) ? res.incident : inc
          );
          const newRes = { ...inferenceResult, civicIncidents: updated };
          setInferenceResult(newRes);
          onVisualDetectionsChange(newRes);
        }

        if (addCustomIssue && res.incident) {
          addCustomIssue({
            id: res.incident.workOrderId || res.incident.incidentId,
            type: res.incident.title || res.incident.incidentType,
            title: `${res.incident.title || res.incident.incidentType} (${res.incident.severity} Severity)`,
            description: res.incident.detectionEvidence || res.incident.sourceEvidence,
            location: {
              lat: res.incident.latitude,
              lng: res.incident.longitude,
              address: res.incident.location?.address || 'Verified Geographic Zone',
              ward: res.incident.ward || 'Central Metropolitan Ward'
            },
            severity: res.incident.severity,
            priority: res.incident.priority,
            status: 'ACCEPTED',
            reportedAt: res.incident.captureTimestamp || new Date().toISOString(),
            confidence: res.incident.confidence,
            recommendedDept: res.incident.department,
            recommendedAction: res.incident.recommendations?.primaryAction
          });
        }
        setActiveWorkflowStep(10);
      }
    } catch (e) {
      console.error("[ACCEPT_CANDIDATE_ERROR]", e);
      alert(`Could not accept candidate: ${e.message}`);
    }
  };

  const handleOpenReasonDialog = (incident, action) => {
    setReasonModal({
      open: true,
      action,
      incident,
      reason: ''
    });
  };

  const handleConfirmReasonDialog = async () => {
    if (!reasonModal.reason.trim()) {
      alert("A mandatory reason is required to ignore or reject an incident candidate.");
      return;
    }

    const candidateId = reasonModal.incident.incidentId || reasonModal.incident.id;
    try {
      if (reasonModal.action === 'IGNORE') {
        const res = await ignoreIncidentCandidate(candidateId, reasonModal.reason.trim(), {
          operatorId: session.userId,
          operatorName: session.displayName
        });
        if (res.success) {
          setOperatorDecisions(prev => ({
            ...prev,
            [candidateId]: { decision: 'IGNORED', reason: reasonModal.reason.trim(), timestamp: new Date().toISOString() }
          }));
        }
      } else if (reasonModal.action === 'REJECT') {
        const res = await rejectIncidentCandidate(candidateId, reasonModal.reason.trim(), {
          operatorId: session.userId,
          operatorName: session.displayName
        });
        if (res.success) {
          setOperatorDecisions(prev => ({
            ...prev,
            [candidateId]: { decision: 'REJECTED', reason: reasonModal.reason.trim(), timestamp: new Date().toISOString() }
          }));
        }
      }

      if (onVisualDetectionsChange && inferenceResult) {
        const updated = (inferenceResult.civicIncidents || []).map(inc => {
          if (inc.id === candidateId || inc.incidentId === candidateId) {
            return {
              ...inc,
              operatorStatus: reasonModal.action === 'IGNORE' ? 'IGNORED' : 'REJECTED',
              operatorReason: reasonModal.reason.trim()
            };
          }
          return inc;
        });
        const newRes = { ...inferenceResult, civicIncidents: updated };
        setInferenceResult(newRes);
        onVisualDetectionsChange(newRes);
      }

      setReasonModal({ open: false, action: null, incident: null, reason: '' });
      setActiveWorkflowStep(9);
    } catch (e) {
      console.error("[REASON_SUBMISSION_ERROR]", e);
      alert(`Failed to record action: ${e.message}`);
    }
  };

  // Lifecycle Status update (NEW -> ACKNOWLEDGED -> ACTION REQUIRED -> IN PROGRESS -> RESOLVED)
  const handleLifecycleUpdate = (incident, newStatus) => {
    const updated = updateIncidentLifecycleStatus(incident, newStatus, `Operator set state to ${newStatus}`);
    setIncidentStatuses(prev => ({ ...prev, [incident.id]: newStatus }));

    if (inferenceResult?.civicIncidents) {
      const newIncidents = inferenceResult.civicIncidents.map(inc => 
        inc.id === incident.id ? updated : inc
      );
      const newResult = { ...inferenceResult, civicIncidents: newIncidents };
      setInferenceResult(newResult);
      if (onVisualDetectionsChange) onVisualDetectionsChange(newResult);
    }

    setActiveWorkflowStep(9); // Step 9 completed
  };

  // Phase 10 Municipal Sandbox Dispatch Handler
  const handleFileIssue = async (incident) => {
    if (!incident) return;
    const currentDecision = operatorDecisions[incident.id]?.decision || incident.operatorStatus || 'NEEDS REVIEW';

    // 1. Dispatch Eligibility Check (Section 15)
    if (currentDecision === 'REJECTED') {
      setDispatchErrors(prev => ({ ...prev, [incident.id]: "Cannot dispatch: Incident was REJECTED during triage." }));
      return;
    }
    if (currentDecision === 'NEEDS REVIEW') {
      setDispatchErrors(prev => ({ ...prev, [incident.id]: "Cannot dispatch: Incident requires explicit operator confirmation." }));
      return;
    }

    const isHighRisk = incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ||
      incident.priority === 'IMMEDIATE' || incident.incidentType === 'WATER_FILLED_POTHOLE' ||
      incident.incidentType === 'SIGNIFICANT_WATERLOGGING' || incident.incidentType === 'GENERAL_SIGNIFICANT_FLOODING' ||
      incident.incidentType === 'ROAD_WATERLOGGING';

    if (isHighRisk && session.role === AUTH_ROLES.FIELD_OPERATOR && currentDecision !== 'CONFIRMED') {
      setDispatchErrors(prev => ({ ...prev, [incident.id]: "High-risk hazard requires Supervisor approval before dispatch." }));
      return;
    }

    try {
      // 2. Local Offline Queue Ingestion (Section 8)
      enqueueIncidentForDispatch(incident, { notes: operatorNotes[incident.id] || "" });
      setSyncStates(prev => ({ ...prev, [incident.id]: 'PENDING_SYNC' }));

      // 3. Idempotent Dispatch to Municipal Sandbox Adapter (Section 10)
      const wo = await createWorkOrder(incident, {
        operatorId: session.userId,
        approvedBySupervisor: session.role === 'SUPERVISOR' || session.role === 'ADMIN',
        notes: operatorNotes[incident.id] || ""
      });

      setDispatchedWorkOrders(prev => ({ ...prev, [incident.id]: wo.workOrderId }));
      setSyncStates(prev => ({ ...prev, [incident.id]: 'SYNCED' }));
      setFiledIssues(prev => ({ ...prev, [incident.id]: wo.workOrderId }));
      setDispatchErrors(prev => ({ ...prev, [incident.id]: null }));

      // 4. Extended Audit Trail (Section 24)
      const pTime = new Date().toISOString();
      const updatedAudit = [
        ...(incident.auditTrail || []),
        {
          stepNumber: (incident.auditTrail?.length || 7) + 1,
          stepName: "DISPATCH_ELIGIBILITY",
          timestamp: pTime,
          summary: `Dispatch eligibility confirmed for ${incident.recommendedDepartment}`,
          details: `Authorized by ${session.displayName} (${session.role}). Hazard verified.`
        },
        {
          stepNumber: (incident.auditTrail?.length || 7) + 2,
          stepName: "WORK_ORDER_CREATED",
          timestamp: pTime,
          summary: `Work Order Dispatched: ${wo.workOrderId}`,
          details: `Dispatched to Municipal Sandbox Depot: ${incident.recommendedDepartment}.`
        },
        {
          stepNumber: (incident.auditTrail?.length || 7) + 3,
          stepName: "SYNC_STATUS",
          timestamp: pTime,
          summary: `Municipal Sync State: SYNCED`,
          details: `Saved to Municipal Sandbox Registry (${wo.workOrderId}) without data corruption.`
        }
      ];

      const enrichedIncident = {
        ...incident,
        auditTrail: updatedAudit,
        workOrderId: wo.workOrderId
      };

      if (addCustomIssue) {
        addCustomIssue({
          id: wo.workOrderId,
          type: incident.title,
          title: `${incident.title} (${incident.severity} Severity)`,
          description: incident.sourceEvidence,
          location: {
            lat: inferenceResult?.metadata?.latitude,
            lng: inferenceResult?.metadata?.longitude,
            address: incident.location?.formatted || 'LOCATION UNAVAILABLE',
            ward: incident.wardName || incident.wardAssignmentStatus || 'Metropolitan Spatial District'
          },
          severity: incident.severity,
          priority: incident.priority,
          status: 'ACKNOWLEDGED',
          reportedAt: incident.captureTimestamp || incident.timestamp || new Date().toISOString(),
          detectedBy: 'CivicSense Multi-Model ONNX Vision Engine',
          confidence: incident.confidence,
          image: selectedSample.path,
          recommendedDept: incident.recommendedDepartment,
          recommendedAction: incident.recommendedAction,
          boundingBoxes: incident.boundingBoxes || []
        });
      }

      handleLifecycleUpdate(enrichedIncident, 'ACKNOWLEDGED');
    } catch (err) {
      setSyncStates(prev => ({ ...prev, [incident.id]: 'SYNC_FAILED' }));
      setDispatchErrors(prev => ({ ...prev, [incident.id]: err.message }));
    }
  };

  return (
    <div className="detection-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '18px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
            PHASE 9 LIVE FIELD PILOT & MOBILE OPERATOR DETECTION HUB
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-Model Computer Vision • Contextual Cross-Model Arbitration • Controlled Field Operator Workflow
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

      {/* 12-STAGE CENTRAL ORCHESTRATION PIPELINE STEPPER (Phase 17) */}
      <div className="glass-card" style={{ padding: '14px 20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <strong style={{ fontSize: '12px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={15} /> UNIFIED AI DETECTION TO CIVIC INTELLIGENCE PIPELINE (12 STAGES)
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Active Stage: {activeWorkflowStep} of 12
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(85px, 1fr))', gap: '4px', fontSize: '10px' }}>
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Quality' },
            { num: 3, label: 'Metadata' },
            { num: 4, label: 'Hazard Class' },
            { num: 5, label: 'Inference' },
            { num: 6, label: 'Arbitration' },
            { num: 7, label: 'Severity' },
            { num: 8, label: 'Candidate' },
            { num: 9, label: 'Human Review' },
            { num: 10, label: 'Filing/Route' },
            { num: 11, label: 'Predictive' },
            { num: 12, label: 'Operations' }
          ].map(st => {
            const isDone = activeWorkflowStep > st.num;
            const isCurrent = activeWorkflowStep === st.num;
            return (
              <div 
                key={st.num}
                style={{
                  padding: '5px 4px',
                  borderRadius: '6px',
                  border: isCurrent ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-card)',
                  backgroundColor: isCurrent ? 'rgba(0, 168, 255, 0.15)' : isDone ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  color: isCurrent ? 'var(--accent-blue)' : isDone ? '#10b981' : 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontWeight: '800' }}>ST {st.num}</div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Bar: Image Input & Hyperparameters */}
      <div className="grid-2" style={{ marginBottom: '0px' }}>
        
        {/* Left: Input Selection (Desktop Upload + Mobile Camera) */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={16} /> Image Capture & Source Selection
              </h3>
              <span className="badge badge-blue" style={{ fontSize: '10px' }}>Mobile Ready</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Select a curated benchmark image, capture directly via mobile camera, or upload an arbitrary street photo.
            </p>
          </div>

          {/* Quick Select Preset Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {samples.map((sample) => (
              <button
                key={sample.id}
                className={`btn ${selectedSample.id === sample.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleSelectSample(sample)}
              >
                {sample.name}
              </button>
            ))}
            {customImage && (
              <button
                className={`btn ${selectedSample.id === customImage.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '11px' }}
                onClick={() => handleSelectSample(customImage)}
              >
                Captured/Uploaded Image
              </button>
            )}
          </div>

          {/* Direct Camera Capture & Gallery Upload Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Native Mobile Camera Button (capture="environment") */}
            <label className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={15} />
              Take Photo / Camera
              <input 
                ref={cameraInputRef}
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={handleCustomUpload} 
                style={{ display: 'none' }} 
              />
            </label>

            {/* Standard File Upload */}
            <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={15} />
              Upload Image / Gallery
              <input 
                ref={uploadInputRef}
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
                title="Reset custom capture"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Hyperparameters & Latency Breakdown */}
        <div className="glass-card">
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} /> Inference Controls & Latency Monitor
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Adjust detection threshold and observe genuine model latencies.
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

          {/* Pipeline Error Banner */}
          {pipelineError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span><strong>Inference Pipeline Error:</strong> {pipelineError}</span>
            </div>
          )}

          {/* Latency Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', fontSize: '11px', marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Image Load:</span><br/>
              <strong>
                {typeof timing?.imageLoadTimeMs === 'number' 
                  ? `${timing.imageLoadTimeMs}ms` 
                  : (pipelineError ? 'FAILED' : (isInferring ? 'LOADING...' : 'NOT MEASURED'))}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Road Model:</span><br/>
              <strong style={{ color: timing?.roadModelError ? '#ef4444' : undefined }}>
                {typeof timing?.roadInferenceTimeMs === 'number' 
                  ? `${timing.roadInferenceTimeMs}ms` 
                  : (timing?.roadModelError ? `ERROR: ${timing.roadModelError}` : (pipelineError ? 'FAILED' : (isInferring ? 'INFERRING...' : 'NOT MEASURED')))}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Waste Model:</span><br/>
              <strong style={{ color: timing?.wasteModelError ? '#ef4444' : undefined }}>
                {typeof timing?.wasteInferenceTimeMs === 'number' 
                  ? `${timing.wasteInferenceTimeMs}ms` 
                  : (timing?.wasteModelError ? `ERROR: ${timing.wasteModelError}` : (pipelineError ? 'FAILED' : (isInferring ? 'INFERRING...' : 'NOT MEASURED')))}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Flood Model:</span><br/>
              <strong style={{ color: timing?.floodModelError ? '#ef4444' : undefined }}>
                {typeof timing?.floodInferenceTimeMs === 'number' 
                  ? `${timing.floodInferenceTimeMs}ms` 
                  : (timing?.floodModelError ? `ERROR: ${timing.floodModelError}` : (pipelineError ? 'FAILED' : (isInferring ? 'INFERRING...' : 'NOT MEASURED')))}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Arbitration:</span><br/>
              <strong>
                {typeof timing?.arbitrationTimeMs === 'number' 
                  ? `${timing.arbitrationTimeMs}ms` 
                  : (pipelineError ? 'FAILED' : (isInferring ? 'COMPUTING...' : 'NOT MEASURED'))}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--accent-blue)' }}>Total Processing:</span><br/>
              <strong style={{ color: 'var(--accent-blue)' }}>
                {typeof timing?.totalProcessingTimeMs === 'number' 
                  ? `${timing.totalProcessingTimeMs}ms` 
                  : (pipelineError ? 'FAILED' : (isInferring ? 'MEASURING...' : 'NOT MEASURED'))}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
              {showDiagnostics ? 'Hide Tensor Diagnostics' : 'Show Diagnostics'}
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
            ⚙ TECHNICAL TENSOR & HARDWARE DIAGNOSTICS
          </strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', color: 'var(--text-secondary)' }}>
            <div><strong>Road Model:</strong> {inferenceResult?.devDiagnostics?.roadModelFile || getActiveRoadModelConfig().fileUrl} ({inferenceResult?.devDiagnostics?.roadModelId || getActiveRoadModelConfig().id})</div>
            <div><strong>Waste Model:</strong> {inferenceResult?.devDiagnostics?.wasteModelFile || '/models/waste-detection.onnx'}</div>
            <div><strong>Flood Model:</strong> {inferenceResult?.devDiagnostics?.floodModelFile || '/models/flood_segmentation.onnx'}</div>
            <div><strong>Natural Resolution:</strong> {inferenceResult?.devDiagnostics?.naturalResolution || 'Unknown'}</div>
            <div><strong>Input Shape:</strong> [1, 3, 640, 640] (Flood: [1, 3, 512, 512])</div>
            <div><strong>Raw Candidates:</strong> Road: {inferenceResult?.devDiagnostics?.rawRoadCandidates ?? 0}, Waste: {inferenceResult?.devDiagnostics?.rawWasteCandidates ?? 0}</div>
            <div><strong>Post-NMS Detections:</strong> Road: {inferenceResult?.devDiagnostics?.postNmsRoadDetections ?? 0}, Waste: {inferenceResult?.devDiagnostics?.postNmsWasteDetections ?? 0}</div>
            <div><strong>Orientation:</strong> {qualityAudit?.orientation || 'Normal'}</div>
          </div>
        </div>
      )}

      {/* Main Image View & 3-Layer Architecture */}
      <div className="grid-2-1" style={{ alignItems: 'start' }}>
        
        {/* Left Column: Image Canvas, EXIF Metadata & Quality Diagnostics */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Metadata Badges: STRICT EXIF GPS, CAPTURE TIME, and PROCESSING TIME */}
          <div className="flex-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
            
            {/* GPS Metadata Badge (Strict: NO fake coordinates) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: inferenceResult?.metadata?.isGpsVerified ? '#10b981' : '#f59e0b' }} />
              <span style={{ fontWeight: '700', color: inferenceResult?.metadata?.isGpsVerified ? '#10b981' : '#f59e0b' }}>
                {inferenceResult?.metadata?.isGpsVerified 
                  ? `GPS: ${inferenceResult.metadata.latitude}, ${inferenceResult.metadata.longitude}` 
                  : 'LOCATION UNAVAILABLE'}
              </span>
            </div>

            {/* EXIF Capture Timestamp Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: inferenceResult?.metadata?.timestamp ? '#10b981' : 'var(--text-muted)' }} />
              <span style={{ color: inferenceResult?.metadata?.timestamp ? '#10b981' : 'var(--text-muted)' }}>
                {inferenceResult?.metadata?.timestamp ? `CAPTURE TIME: ${inferenceResult.metadata.timestamp}` : 'CAPTURE TIME UNAVAILABLE'}
              </span>
            </div>

            {/* Processing Timestamp Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Timer size={14} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                PROCESSING TIME: {inferenceResult?.processingTimestamp ? new Date(inferenceResult.processingTimestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Image Quality Diagnostics Pill Bar */}
          {qualityAudit && (
            <div style={{ 
              marginBottom: '10px', 
              padding: '6px 12px', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '6px', 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '12px', 
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-secondary)'
            }}>
              <div><strong>Resolution:</strong> {qualityAudit.originalWidth} × {qualityAudit.originalHeight} ({qualityAudit.totalPixels.toLocaleString()} px)</div>
              <div><strong>Aspect Ratio:</strong> {qualityAudit.aspectRatio}:1</div>
              <div><strong>Orientation:</strong> {qualityAudit.orientation}</div>
              <div><strong>Quality Status:</strong> <span style={{ color: qualityAudit.isLowResolution ? '#f59e0b' : '#10b981', fontWeight: '700' }}>{qualityAudit.observations.join(', ')}</span></div>
            </div>
          )}

          {/* Low-Resolution Warning Banner (Section 5) */}
          {qualityAudit?.isLowResolution && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{qualityAudit.lowResWarning}</span>
            </div>
          )}

          {/* Extreme Aspect Ratio Warning Banner (Section 6) */}
          {qualityAudit?.isExtremeAspectRatio && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{qualityAudit.extremeAspectWarning}</span>
            </div>
          )}

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

            {/* Suppressed Monolithic Waste Boxes */}
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
        </div>

        {/* Right Column: 3 DISTINCT ARCHITECTURAL LAYERS & OPERATOR REVIEW */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ======================================================== */}
          {/* LAYER 3: FINAL CIVIC INCIDENT(S) & FIELD OPERATOR REVIEW */}
          {/* ======================================================== */}
          <div className="glass-card" style={{ 
            padding: '18px', 
            border: civicIncidents.length > 0 ? '1.5px solid rgba(0, 168, 255, 0.4)' : '1px solid var(--border-card)',
            backgroundColor: civicIncidents.length > 0 ? 'rgba(0, 168, 255, 0.03)' : 'var(--bg-card)'
          }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#00a8ff' }}>
                <ShieldCheck size={18} /> LAYER 3: FINAL CIVIC INCIDENTS
              </h3>
              <span className={`badge ${civicIncidents.length > 0 ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                {civicIncidents.length} Confirmed
              </span>
            </div>

            {civicIncidents.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                {isInferring ? 'Evaluating multi-modal evidence...' : 'No actionable civic incidents from current evidence.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {civicIncidents.map((incident) => {
                  const currentDecision = operatorDecisions[incident.id]?.decision || incident.operatorStatus || 'NEEDS REVIEW';
                  const currentLifecycle = incidentStatuses[incident.id] || incident.incidentStatus || 'NEW';
                  const isConfirmed = currentDecision === 'CONFIRMED';
                  const isRejected = currentDecision === 'REJECTED';

                  return (
                    <div 
                      key={incident.id} 
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: isRejected ? '1.5px solid rgba(244, 63, 94, 0.4)' : isConfirmed ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-card)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        fontSize: '12px'
                      }}
                    >
                      {/* Incident Header & Badges */}
                      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            {incident.title}
                          </strong>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ID: {incident.id}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {incident.isUncertain && (
                            <span className="badge badge-amber" style={{ fontSize: '10px' }}>
                              REVIEW CANDIDATE
                            </span>
                          )}
                          <span className={`badge ${incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                            {incident.severity} SEVERITY
                          </span>
                          <span className={`badge ${incident.priority === 'IMMEDIATE' ? 'badge-red' : 'badge-purple'}`} style={{ fontSize: '10px' }}>
                            {incident.priority} PRIORITY
                          </span>
                        </div>
                      </div>

                      {/* Low-Resolution Incident Warning Notice */}
                      {incident.lowResolutionWarning && (
                        <div style={{ padding: '6px 10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                          <span><strong>LOW IMAGE RESOLUTION:</strong> Visual classification uncertain on low-resolution imagery. Operator review required.</span>
                        </div>
                      )}

                      {/* 10-Field Incident Specification Table (Section 13) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        
                        <div><strong>Incident Type:</strong> <code>{incident.incidentType}</code></div>
                        
                        <div><strong>AI Confidence / Evidence:</strong> {incident.confidence ? `${Math.round(incident.confidence * 100)}% confidence • ` : ''}{incident.sourceEvidence}</div>
                        
                        <div>
                          <strong>Location Status:</strong>{' '}
                          <span style={{ color: incident.location?.isGpsVerified ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                            {incident.locationStatus || (incident.location?.isGpsVerified ? `GPS AVAILABLE (${incident.location.formatted})` : 'LOCATION UNAVAILABLE')}
                          </span>
                        </div>

                        <div>
                          <strong>Capture Time:</strong> {incident.captureTimestamp || 'CAPTURE TIME UNAVAILABLE'}
                        </div>

                        <div>
                          <strong>Processing Time:</strong> {incident.processingTimestamp ? new Date(incident.processingTimestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building size={13} style={{ color: '#c084fc', flexShrink: 0 }} />
                          <span><strong>Department & Ward:</strong> <span style={{ color: '#c084fc', fontWeight: '600' }}>{incident.recommendedDepartment}</span> • <span style={{ fontStyle: 'italic' }}>{incident.wardAssignmentStatus || 'WARD ASSIGNMENT UNAVAILABLE'}</span></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,168,255,0.06)', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid var(--accent-blue)' }}>
                          <Wrench size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                          <span><strong>AI Action:</strong> {incident.recommendedAction}</span>
                        </div>

                        {/* Distinction: AI Interpretation vs Human Operator Decision (Section 8) */}
                        <div style={{ padding: '8px', background: isRejected ? 'rgba(244,63,94,0.08)' : isConfirmed ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span><strong>AI Interpretation:</strong> {incident.contextualInterpretation}</span>
                          </div>
                          <div>
                            <strong>Human Operator Status:</strong>{' '}
                            <span style={{ 
                              fontWeight: '800', 
                              color: isConfirmed ? '#10b981' : isRejected ? '#f43f5e' : '#f59e0b' 
                            }}>
                              {currentDecision}
                            </span>
                            {operatorDecisions[incident.id]?.reason && (
                              <div style={{ fontStyle: 'italic', marginTop: '3px', color: 'var(--text-primary)' }}>
                                Reason: "{operatorDecisions[incident.id].reason}"
                              </div>
                            )}
                          </div>
                                           {/* Lifecycle Status Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span><strong>Incident Lifecycle State:</strong></span>
                          <span className={`badge ${currentLifecycle === 'RESOLVED' ? 'badge-green' : currentLifecycle === 'IN PROGRESS' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '10px' }}>
                            {currentLifecycle}
                          </span>
                        </div>

                        {/* PHASE 10 SECTION 23: MUNICIPAL INTEGRATION & DISPATCH STATUS */}
                        <div style={{ 
                          padding: '10px 12px', 
                          background: 'rgba(0, 168, 255, 0.04)', 
                          border: '1px solid rgba(0, 168, 255, 0.25)', 
                          borderRadius: '6px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '5px', 
                          fontSize: '11px' 
                        }}>
                          <div className="flex-between">
                            <strong style={{ color: 'var(--accent-blue)' }}>MUNICIPAL INTEGRATION:</strong>
                            <span className="badge badge-blue" style={{ fontSize: '9px', padding: '2px 6px' }}>{integrationMode}</span>
                          </div>
                          <div><strong>OPERATOR DECISION:</strong> <span style={{ fontWeight: '700', color: isConfirmed ? '#10b981' : isRejected ? '#f43f5e' : '#f59e0b' }}>{currentDecision}</span></div>
                          <div>
                            <strong>DISPATCH STATUS:</strong>{' '}
                            <span style={{ 
                              fontWeight: '700', 
                              color: filedIssues[incident.id] ? '#10b981' : isConfirmed ? '#38bdf8' : isRejected ? '#f43f5e' : '#f59e0b' 
                            }}>
                              {filedIssues[incident.id] ? 'DISPATCHED' : isRejected ? 'NOT ELIGIBLE' : (incident.severity === 'HIGH' || incident.severity === 'CRITICAL' || incident.priority === 'IMMEDIATE') && session.role === 'FIELD_OPERATOR' && !isConfirmed ? 'PENDING APPROVAL' : isConfirmed ? 'READY' : 'PENDING APPROVAL'}
                            </span>
                          </div>
                          <div>
                            <strong>SYNC STATUS:</strong>{' '}
                            <span style={{ 
                              fontWeight: '700', 
                              color: syncStates[incident.id] === 'SYNCED' ? '#10b981' : syncStates[incident.id] === 'SYNC_FAILED' ? '#f43f5e' : 'var(--text-secondary)' 
                            }}>
                              {syncStates[incident.id] || (filedIssues[incident.id] ? 'SYNCED' : 'LOCAL ONLY')}
                            </span>
                          </div>
                          <div>
                            <strong>WORK ORDER:</strong>{' '}
                            <code style={{ color: filedIssues[incident.id] ? '#38bdf8' : 'var(--text-muted)' }}>
                              {filedIssues[incident.id] || 'UNAVAILABLE'}
                            </code>
                          </div>
                          {dispatchErrors[incident.id] && (
                            <div style={{ color: '#f43f5e', fontSize: '10px', marginTop: '2px' }}>
                              Notice: {dispatchErrors[incident.id]}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PREDICTIVE ANALYTICS PROVENANCE CARD */}
                      {incident.predictionStatus && (
                        <div style={{
                          padding: '8px 10px',
                          backgroundColor: 'rgba(0, 168, 255, 0.04)',
                          border: '1px solid rgba(0, 168, 255, 0.2)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--accent-blue)' }}>Predictive Analytics Assessment</strong>
                            <span className="badge badge-purple" style={{ fontSize: '9px' }}>PROVENANCE: {incident.predictionStatus.provenance || 'RULE-BASED ESTIMATE'}</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {incident.predictionStatus.details || 'Predictive analysis computed.'}
                          </div>
                        </div>
                      )}

                      {/* PHASE 17: EXPLICIT HUMAN REVIEW GATE (ACCEPT / IGNORE / REJECT) */}
                      <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            Human Review Gate:
                          </span>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              className="btn"
                              onClick={() => handleAcceptCandidate(incident)}
                              disabled={isConfirmed || isRejected || currentDecision === 'IGNORED'}
                              style={{ 
                                padding: '5px 10px', 
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: isConfirmed ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                                borderColor: '#10b981',
                                color: isConfirmed ? '#ffffff' : '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Confirm candidate and promote to active municipal incident"
                            >
                              <CheckCircle2 size={13} />
                              {isConfirmed ? 'Accepted (Active)' : 'ACCEPT'}
                            </button>

                            <button
                              className="btn"
                              onClick={() => handleOpenReasonDialog(incident, 'IGNORE')}
                              disabled={isConfirmed || isRejected || currentDecision === 'IGNORED'}
                              style={{ 
                                padding: '5px 10px', 
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: currentDecision === 'IGNORED' ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)',
                                borderColor: '#f59e0b',
                                color: currentDecision === 'IGNORED' ? '#ffffff' : '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Determine candidate is non-actionable (requires mandatory reason)"
                            >
                              <EyeOff size={13} />
                              {currentDecision === 'IGNORED' ? 'Ignored' : 'IGNORE'}
                            </button>

                            <button
                              className="btn"
                              onClick={() => handleOpenReasonDialog(incident, 'REJECT')}
                              disabled={isConfirmed || isRejected || currentDecision === 'IGNORED'}
                              style={{ 
                                padding: '5px 10px', 
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: isRejected ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                                borderColor: '#ef4444',
                                color: isRejected ? '#ffffff' : '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Confirm candidate is false positive (requires mandatory reason)"
                            >
                              <XCircle size={13} />
                              {isRejected ? 'Rejected' : 'REJECT'}
                            </button>
                          </div>
                        </div>

                        {/* Optional Inline Reason Input for Rejection / Notes */}
                        {activeNotesInputId === incident.id && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input 
                              type="text"
                              placeholder='Reason (e.g. "No visible waste at detected location")'
                              value={operatorNotes[incident.id] || ''}
                              onChange={(e) => setOperatorNotes({ ...operatorNotes, [incident.id]: e.target.value })}
                              style={{ 
                                flex: 1, 
                                padding: '5px 8px', 
                                fontSize: '11px', 
                                background: 'rgba(0,0,0,0.3)', 
                                border: '1px solid var(--border-card)',
                                borderRadius: '4px',
                                color: '#fff'
                              }}
                            />
                            <button 
                              className="btn btn-primary"
                              style={{ padding: '5px 10px', fontSize: '11px' }}
                              onClick={() => handleOperatorReview(incident, 'REJECTED')}
                            >
                              Submit Rejection
                            </button>
                          </div>
                        )}

                        {/* Lifecycle Status Buttons (Section 7) */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                            Lifecycle Transition:
                          </span>

                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['NEW', 'ACKNOWLEDGED', 'ACTION REQUIRED', 'IN PROGRESS', 'RESOLVED'].map(st => (
                              <button
                                key={st}
                                className="btn btn-secondary"
                                onClick={() => handleLifecycleUpdate(incident, st)}
                                style={{ 
                                  padding: '3px 6px', 
                                  fontSize: '10px', 
                                  borderColor: currentLifecycle === st ? 'var(--accent-blue)' : 'var(--border-card)',
                                  color: currentLifecycle === st ? 'var(--accent-blue)' : 'var(--text-secondary)'
                                }}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Audit Trail & Dispatch Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setActiveAuditTrailIncident(incident)}
                            style={{ padding: '5px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <History size={13} />
                            View Audit Trail ({incident.auditTrail?.length || 7} Steps)
                          </button>

                          <button
                            className="btn btn-primary"
                            disabled={Boolean(filedIssues[incident.id]) || isRejected}
                            onClick={() => handleFileIssue(incident)}
                            style={{ padding: '5px 12px', fontSize: '11px' }}
                          >
                            {filedIssues[incident.id] ? (
                              <>
                                <Check size={13} style={{ marginRight: '4px' }} />
                                Dispatched ({filedIssues[incident.id]})
                              </>
                            ) : (
                              <>
                                <FilePlus2 size={13} style={{ marginRight: '4px' }} />
                                Dispatch to Municipal Sandbox
                              </>
                            )}
                          </button>
                        </div>
                      </div>       </div>
                    </div>
                  );
                })}
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
                <span>
                  {acceptedWaste.length} accepted
                  {inferenceResult?.candidateWaste?.length > 0 ? ` / ${inferenceResult.candidateWaste.length} candidate(s)` : ''}
                  {' '}/ {suppressedWaste.length} suppressed
                </span>
              </div>

              {/* Candidate Detections Detail (Uncertain / Low Resolution) */}
              {inferenceResult?.candidateWaste?.length > 0 && (
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '4px' }}>
                    ⚠ Uncertain Review Candidates ({inferenceResult.candidateWaste.length}):
                  </strong>
                  {inferenceResult.candidateWaste.map((c, idx) => (
                    <div key={idx} style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      • <strong>{c.type} ({c.classCode})</strong>: {c.arbitrationReason}
                    </div>
                  ))}
                </div>
              )}

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

      {/* AUDIT TRAIL MODAL VIEWER (Section 9) */}
      {activeAuditTrailIncident && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: 'var(--bg-card-solid)',
            borderRadius: '12px',
            border: '1px solid var(--accent-blue)'
          }}>
            <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-card)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={18} /> INCIDENT AUDIT TRAIL
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ID: {activeAuditTrailIncident.id} • Type: {activeAuditTrailIncident.incidentType}
                </div>
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={() => setActiveAuditTrailIncident(null)}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(activeAuditTrailIncident.auditTrail || []).map((step, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderLeft: '3px solid var(--accent-blue)',
                    fontSize: '11px'
                  }}
                >
                  <div className="flex-between" style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--accent-blue)' }}>
                      STEP {step.stepNumber}: {step.stepName}
                    </strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {step.summary}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {step.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REASON MODAL FOR IGNORE / REJECT ACTIONS (Phase 17 Human Review Gate) */}
      {reasonModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px', backgroundColor: 'var(--bg-card-solid)', border: '1px solid var(--border-card)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '8px', color: reasonModal.action === 'REJECT' ? '#f43f5e' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {reasonModal.action === 'REJECT' ? <XCircle size={18} /> : <EyeOff size={18} />}
              {reasonModal.action === 'REJECT' ? 'Reject Incident Candidate (False Positive)' : 'Ignore Incident Candidate (Non-Actionable)'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
              A mandatory operator reason is required for audit logs and future model fine-tuning. This record will not create an active municipal incident.
            </p>

            {/* Quick-select chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {[
                'Wet surface reflection mistaken for floodwater',
                'Minor surface paint / shadow, not structural defect',
                'Authorized utility container, not scattered waste',
                'Duplicate report of existing municipal incident',
                'Low image resolution makes verification impossible',
                'Outside municipal jurisdiction'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReasonModal(prev => ({ ...prev, reason: preset }))}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-card)',
                    backgroundColor: reasonModal.reason === preset ? 'rgba(0,168,255,0.2)' : 'rgba(255,255,255,0.03)',
                    color: reasonModal.reason === preset ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Type operator reason for audit trail..."
              value={reasonModal.reason}
              onChange={(e) => setReasonModal(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-card)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '10px',
                fontSize: '12px',
                outline: 'none',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setReasonModal({ open: false, action: null, incident: null, reason: '' })}
                style={{ padding: '6px 14px', fontSize: '11px' }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleConfirmReasonDialog}
                disabled={!reasonModal.reason.trim()}
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontWeight: '700',
                  backgroundColor: reasonModal.action === 'REJECT' ? '#f43f5e' : '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: reasonModal.reason.trim() ? 'pointer' : 'not-allowed',
                  opacity: reasonModal.reason.trim() ? 1 : 0.5
                }}
              >
                Confirm {reasonModal.action === 'REJECT' ? 'Rejection' : 'Ignore'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
