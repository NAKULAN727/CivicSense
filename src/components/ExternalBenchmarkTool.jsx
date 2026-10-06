import React, { useState } from 'react';
import { 
  GitCompare, 
  Download, 
  FileSpreadsheet, 
  ShieldCheck, 
  Server, 
  Search, 
  Lock,
  ArrowRightLeft,
  Info,
  Layers,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  HelpCircle,
  Activity,
  FileCheck,
  Eye,
  SlidersHorizontal,
  Droplets
} from 'lucide-react';
import benchmarkData from '../data/externalBenchmarkReport.json';

export default function ExternalBenchmarkTool() {
  const [report] = useState(benchmarkData);
  const [activeTab, setActiveTab] = useState('AUDIT'); // 'AUDIT' or 'BENCHMARK'
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [auditFilterFolder, setAuditFilterFolder] = useState('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [vfloodnetFilterFolder, setVfloodnetFilterFolder] = useState('ALL');
  const [vfloodnetSearchQuery, setVfloodnetSearchQuery] = useState('');

  const cand2 = report.candidate2VFloodNetVerification;
  const cand2Meta = cand2?.benchmark_metadata;
  const cand2Screening = cand2?.category_screening_summary;
  const cand2Records = cand2?.audit_records || [];
  const cand2Quality = cand2?.quality_gate_audit;
  const cand2Comparison = cand2?.comparison_with_production;

  const calib = report.vfloodnetCalibrationReport;
  const calibSweep = calib?.threshold_sweep_analysis?.sweep_table || [];
  const calibRecords = calib?.calibrated_records || [];
  const calibPotholes = calib?.water_filled_pothole_analysis || [];
  const [calibFilterFolder, setCalibFilterFolder] = useState('ALL');
  const [calibSearchQuery, setCalibSearchQuery] = useState('');

  const filteredCalibRecords = calibRecords.filter(r => {
    let matchFolder = true;
    if (calibFilterFolder === 'NON_FLOOD') {
      matchFolder = r.source_folder === 'Pathole' || r.source_folder === 'Garbage';
    } else if (calibFilterFolder !== 'ALL') {
      matchFolder = r.source_folder === calibFilterFolder;
    }
    const matchSearch = calibSearchQuery.trim() === '' ||
      r.filename.toLowerCase().includes(calibSearchQuery.toLowerCase());
    return matchFolder && matchSearch;
  });

  const filteredCand2Records = cand2Records.filter(r => {
    let matchFolder = true;
    if (vfloodnetFilterFolder === 'NON_FLOOD') {
      matchFolder = r.source_folder === 'Pathole' || r.source_folder === 'Garbage';
    } else if (vfloodnetFilterFolder !== 'ALL') {
      matchFolder = r.source_folder === vfloodnetFilterFolder;
    }
    const matchSearch = vfloodnetSearchQuery.trim() === '' ||
      r.filename.toLowerCase().includes(vfloodnetSearchQuery.toLowerCase());
    return matchFolder && matchSearch;
  });

  const summary = report.sideBySideSummary;
  const records = report.benchmarkRecords || [];
  const audit = report.candidateFloodCrossCategoryAudit;
  const auditRecords = audit?.audit_records || [];
  const screening = audit?.screening_results;

  const filteredRecords = records.filter(r => {
    const matchGroup = selectedGroup === 'ALL' || r.groundTruthFolder === selectedGroup;
    const matchSearch = searchQuery.trim() === '' || 
      r.filename.toLowerCase().includes(searchQuery.toLowerCase());
    return matchGroup && matchSearch;
  });

  const filteredAuditRecords = auditRecords.filter(r => {
    let matchFolder = true;
    if (auditFilterFolder === 'NON_FLOOD') {
      matchFolder = r.source_folder === 'Pathole' || r.source_folder === 'Garbage';
    } else if (auditFilterFolder !== 'ALL') {
      matchFolder = r.source_folder === auditFilterFolder;
    }
    const matchSearch = auditSearchQuery.trim() === '' ||
      r.filename.toLowerCase().includes(auditSearchQuery.toLowerCase());
    return matchFolder && matchSearch;
  });

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "external_benchmark_report.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = [
      'Filename', 'GroundTruthFolder', 'Width', 'Height', 
      'CurrentModelResult', 'CurrentModelConfidence', 
      'ExternalModelResult', 'ExternalModelConfidence', 
      'LatencyMs', 'ApiModelStatus', 'Errors'
    ];
    const rows = records.map(r => [
      `"${r.filename}"`,
      `"${r.groundTruthFolder}"`,
      r.imageWidth,
      r.imageHeight,
      `"${r.currentModelResult}"`,
      r.currentModelConfidence !== null ? r.currentModelConfidence : 'N/A',
      `"${r.externalModelResult}"`,
      r.externalModelConfidence !== null ? r.externalModelConfidence : 'N/A',
      r.latencyMs,
      `"${r.apiModelStatus}"`,
      `"${r.errors}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'external_benchmark_report.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportAuditJSON = () => {
    if (!audit) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(audit, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "flood_candidate_cross_category_audit.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportAuditCSV = () => {
    if (!auditRecords.length) return;
    const headers = [
      'filename', 'source_folder', 'category', 'image_resolution',
      'candidate_flood_prediction', 'water_coverage_percentage',
      'water_category', 'substantial_water_coverage', 'mean_water_prob',
      'max_water_prob', 'logit_diff', 'water_pixels', 'total_pixels', 'inference_latency_ms'
    ];
    const rows = auditRecords.map(r => [
      `"${r.filename}"`,
      `"${r.source_folder}"`,
      `"${r.category}"`,
      `"${r.image_resolution}"`,
      `"${r.candidate_flood_prediction}"`,
      r.water_coverage_percentage,
      `"${r.water_category}"`,
      r.substantial_water_coverage,
      r.confidence_statistics.mean_water_prob,
      r.confidence_statistics.max_water_prob,
      r.water_mask_statistics.logit_diff,
      r.water_mask_statistics.water_pixels,
      r.water_mask_statistics.total_pixels,
      r.inference_latency_ms
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'flood_candidate_cross_category_audit.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportCandidate1JSON = () => {
    if (!report.candidate1Yolov8SegVerification) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report.candidate1Yolov8SegVerification, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "flood_yolov8seg_benchmark.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCandidate1CSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + encodeURI([
      "Candidate,Source_1,Source_2,Verification_Status,Weights_Downloadable,License,Architecture,ONNX_Size,Flood_Result,Pothole_FP,Garbage_FP,Production_Status,Final_Recommendation",
      '"Candidate 1 (YOLOv8-Seg Waterlogging)","henrys-workspace-ds68i/waterlogging-1hcfe","jhonattan-fredy-moreno-bernal/flood-ai","WEIGHTS NOT VERIFIED","FALSE (Gated behind Roboflow paid tier/serverless API)","CC BY 4.0 (Dataset) / Gated (Weights)","YOLOv8-Seg","N/A (Not verified)","NOT TESTED (STOPPED PER SPEC)","NOT TESTED (STOPPED PER SPEC)","NOT TESTED (STOPPED PER SPEC)","flood-water-segmentation.onnx ACTIVE PRODUCTION","NOT VERIFIED"'
    ].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'flood_yolov8seg_benchmark.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportCandidate2JSON = () => {
    if (!cand2) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cand2, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "vfloodnet_benchmark.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCandidate2CSV = () => {
    if (!cand2Records.length) return;
    const headers = [
      'filename', 'source_folder', 'category', 'image_resolution',
      'candidate_flood_prediction', 'water_coverage_percentage',
      'water_category', 'substantial_water_coverage', 'mean_water_prob',
      'max_water_prob', 'water_pixels', 'total_pixels', 'latency_ms', 'inference_status'
    ];
    const rows = cand2Records.map(r => [
      `"${r.filename}"`,
      `"${r.source_folder}"`,
      `"${r.category}"`,
      `"${r.image_resolution}"`,
      `"${r.candidate_flood_prediction}"`,
      r.water_coverage_percentage,
      `"${r.water_category}"`,
      r.substantial_water_coverage,
      r.mean_water_prob,
      r.max_water_prob,
      r.water_pixels,
      r.total_pixels,
      r.latency_ms,
      `"${r.inference_status}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'vfloodnet_benchmark.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportCalibrationJSON = () => {
    if (!calib) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calib, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "vfloodnet_calibration.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCalibrationCSV = () => {
    if (!calibRecords.length) return;
    const headers = [
      'filename', 'source_folder', 'category', 'image_resolution', 'resolution_warning',
      'water_coverage_percentage', 'mean_water_prob', 'max_water_prob',
      'calibrated_waterlogging_status', 'calibrated_severity_tier',
      'num_connected_components', 'largest_component_area_pct', 'largest_component_ratio_pct',
      'spatial_topology', 'latency_ms', 'model_version'
    ];
    const rows = calibRecords.map(r => [
      `"${r.filename}"`,
      `"${r.source_folder}"`,
      `"${r.category}"`,
      `"${r.image_resolution}"`,
      `"${r.resolution_warning}"`,
      r.water_coverage_percentage,
      r.mean_water_prob,
      r.max_water_prob,
      `"${r.calibrated_waterlogging_status}"`,
      `"${r.calibrated_severity_tier}"`,
      r.num_connected_components,
      r.largest_component_area_pct,
      r.largest_component_ratio_pct,
      `"${r.spatial_topology}"`,
      r.latency_ms,
      `"${r.model_version}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'vfloodnet_calibration.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="benchmark-tool-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-main, #e2e8f0)' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <GitCompare size={24} style={{ color: '#c084fc' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>CivicSense AI – External Model Benchmark & Audit Utility</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.875rem' }}>
            Multi-model evaluation suite comparing production models against external candidates with rigorous cross-category false-positive auditing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={handleExportAuditJSON}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download Candidate Flood Cross-Category Audit JSON"
          >
            <Download size={14} /> Audit JSON
          </button>
          <button 
            onClick={handleExportCandidate1JSON}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download Candidate 1 Verification JSON"
          >
            <Download size={14} /> Cand 1 JSON
          </button>
          <button 
            onClick={handleExportCandidate1CSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.25)', color: '#fff', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download Candidate 1 Verification CSV"
          >
            <FileSpreadsheet size={14} /> Cand 1 CSV
          </button>
          <button 
            onClick={handleExportCandidate2JSON}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download Candidate 2 V-FloodNet Benchmark JSON"
          >
            <Download size={14} /> Cand 2 JSON
          </button>
          <button 
            onClick={handleExportCandidate2CSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download Candidate 2 V-FloodNet Benchmark CSV"
          >
            <FileSpreadsheet size={14} /> Cand 2 CSV
          </button>
          <button 
            onClick={handleExportCalibrationJSON}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.4)', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download V-FloodNet Calibration JSON"
          >
            <Download size={14} /> Calib JSON
          </button>
          <button 
            onClick={handleExportCalibrationCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.4)', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download V-FloodNet Calibration CSV"
          >
            <FileSpreadsheet size={14} /> Calib CSV
          </button>
          <button 
            onClick={handleExportAuditCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.25)', color: '#fff', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
            title="Download Candidate Flood Cross-Category Audit CSV"
          >
            <FileSpreadsheet size={14} /> Audit CSV
          </button>
          <button 
            onClick={handleExportJSON}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(51, 65, 85, 0.6)', color: '#fff', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
          >
            <Download size={14} /> Benchmark JSON
          </button>
          <button 
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #9333ea, #4f46e5)', color: '#fff', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}
          >
            <FileSpreadsheet size={14} /> Benchmark CSV
          </button>
        </div>
      </div>

      {/* Production Model Preservation & Security Banners */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Status Card 1: Production Preservation Guarantee */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldCheck size={18} style={{ color: '#10b981' }} />
            <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>PRODUCTION FLOOD MODEL PRESERVED</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.825rem', opacity: 0.9, lineHeight: 1.5 }}>
            <code style={{ color: '#6ee7b7' }}>flood-water-segmentation.onnx</code> remains <strong>ACTIVE PRODUCTION</strong>. Candidate <code style={{ color: '#fca5a5' }}>segformer_water_b0.onnx</code> is strictly benchmarked and not deployed.
          </p>
        </div>

        {/* Status Card 2: Candidate Recommendation Alert */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem' }}>CANDIDATE AUDIT RECOMMENDATION</span>
          </div>
          <div style={{ display: 'inline-block', background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.5)', marginBottom: '4px' }}>
            REJECT DUE TO FALSE POSITIVES
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.4 }}>
            Candidate detected water on <strong>24/24 non-flood images (100%)</strong> with &gt;81% mean water area across clean dry asphalt and waste piles.
          </p>
        </div>

        {/* Status Card 3: Metric Disclaimer */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Info size={18} style={{ color: '#60a5fa' }} />
            <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem' }}>EVALUATION METRIC STANDARD</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.825rem', opacity: 0.9, lineHeight: 1.5 }}>
            No accuracy, precision, or specificity is claimed without pixel-level ground truth. Audit evaluates category-level water screening and false-positive sensitivity.
          </p>
        </div>
      </div>

      {/* SECTION: CANDIDATE FLOOD MODEL CROSS-CATEGORY AUDIT REPORT */}
      {audit && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <Droplets size={20} style={{ color: '#38bdf8' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Candidate Flood Model Cross-Category Negative Audit
                </h2>
                <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                  NEGATIVE AUDIT COMPLETE
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                Model: <code style={{ color: '#38bdf8' }}>{audit.audit_metadata.candidate_model_id}</code> | Candidate File: <code style={{ color: '#c084fc' }}>{audit.audit_metadata.candidate_model_file}</code>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.725rem', opacity: 0.7 }}>ACTIVE PRODUCTION</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>flood-water-segmentation.onnx</div>
              </div>
              <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.725rem', opacity: 0.7 }}>BENCHMARK CANDIDATE</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171' }}>segformer_water_b0.onnx</div>
              </div>
            </div>
          </div>

          {/* 4 Screening Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* Metric A */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '6px', fontWeight: 600 }}>
                A. FLOOD-POSITIVE SCREENING
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
                {screening.flood_positive_screening.formatted}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#93c5fd' }}>
                Rate: <strong>{screening.flood_positive_screening.rate_percent}%</strong> (14/14 Real Flood)
              </div>
              <div style={{ fontSize: '0.725rem', opacity: 0.7, marginTop: '6px' }}>
                High recall on true floods, but uncalibrated
              </div>
            </div>

            {/* Metric B */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '6px', fontWeight: 600 }}>
                B. POTHOLE-CATEGORY WATER DETECTIONS
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fb923c', marginBottom: '4px' }}>
                {screening.pothole_water_screening.formatted}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fdba74' }}>
                Rate: <strong>{screening.pothole_water_screening.rate_percent}%</strong> (12/12 Pothole Images)
              </div>
              <div style={{ fontSize: '0.725rem', color: '#fb923c', marginTop: '6px', fontWeight: 600 }}>
                12 False Positives (Mean 92.81% water)
              </div>
            </div>

            {/* Metric C */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '6px', fontWeight: 600 }}>
                C. GARBAGE-CATEGORY WATER DETECTIONS
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc', marginBottom: '4px' }}>
                {screening.garbage_water_screening.formatted}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#d8b4fe' }}>
                Rate: <strong>{screening.garbage_water_screening.rate_percent}%</strong> (12/12 Garbage Images)
              </div>
              <div style={{ fontSize: '0.725rem', color: '#c084fc', marginTop: '6px', fontWeight: 600 }}>
                12 False Positives (Mean 88.75% water)
              </div>
            </div>

            {/* Metric D */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '6px', fontWeight: 600 }}>
                D. COMBINED NON-FLOOD SCREENING
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171', marginBottom: '4px' }}>
                {screening.combined_non_flood_screening.formatted}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                Rate: <strong>{screening.combined_non_flood_screening.rate_percent}%</strong> (24/24 Non-Flood)
              </div>
              <div style={{ fontSize: '0.725rem', color: '#ef4444', marginTop: '6px', fontWeight: 700 }}>
                100.0% False Positive Screening Rate
              </div>
            </div>
          </div>

          {/* Deterministic Thresholding Rule and Rationale */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
                <SlidersHorizontal size={16} /> Deterministic Thresholding Rule
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700, minWidth: '160px' }}>
                    1. NO SIGNIFICANT WATER
                  </span>
                  <span style={{ opacity: 0.85 }}>Water mask coverage &lt; 5.0%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', fontWeight: 700, minWidth: '160px' }}>
                    2. POSSIBLE / AMBIGUOUS
                  </span>
                  <span style={{ opacity: 0.85 }}>Water mask coverage 5.0% – 20.0% (puddles, wet edges)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700, minWidth: '160px' }}>
                    3. SIGNIFICANT WATER
                  </span>
                  <span style={{ opacity: 0.85 }}>Water mask coverage &gt; 20.0% (substantial standing water)</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>
                <XCircle size={16} /> Candidate Diagnostic Findings
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.45 }}>
                {audit.statistical_insights.key_finding}
              </p>
              <div style={{ marginTop: '8px', fontSize: '0.775rem', color: '#fca5a5', fontWeight: 600 }}>
                Clean dry road sample (<code style={{ color: '#fff' }}>road without pothole.webp</code>): {audit.statistical_insights.dry_road_sample_coverage_percent}% water mask coverage.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: CANDIDATE 1 YOLOV8-SEG WATERLOGGING VERIFICATION */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Layers size={20} style={{ color: '#fbbf24' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Candidate 1: YOLOv8-Seg Waterlogging Model Acquisition & Verification
              </h2>
              <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                WEIGHTS NOT VERIFIED
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
              Evaluated Sources: <code style={{ color: '#fbbf24' }}>henrys-workspace-ds68i/waterlogging-1hcfe</code> & <code style={{ color: '#fbbf24' }}>jhonattan-fredy-moreno-bernal/flood-ai</code>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
              RECOMMENDATION: NOT VERIFIED
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '6px', fontWeight: 600, color: '#fbbf24' }}>
              PHASE 1 VERIFICATION OUTCOME
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
              CANDIDATE 1 WEIGHTS NOT VERIFIED
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.45 }}>
              Roboflow Universe projects do not provide public direct download links for trained model weight files (.pt or .onnx). Model export is restricted to paid workspace accounts, and inference is serverless API only (requiring private secret keys).
            </p>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '6px', fontWeight: 600, color: '#10b981' }}>
              INTEGRITY CONSTRAINT ENFORCED
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', marginBottom: '6px' }}>
              BENCHMARK HALTED (ZERO FABRICATION)
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.45 }}>
              In compliance with explicit instructions (&ldquo;If the exact trained weights cannot be obtained, report: CANDIDATE 1 WEIGHTS NOT VERIFIED and STOP this phase&rdquo;), no synthetic, dummy, or random weights were benchmarked.
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
            Active Production Status: <code style={{ color: '#10b981' }}>flood-water-segmentation.onnx</code> remains <strong>ACTIVE PRODUCTION</strong> (Unchanged).
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleExportCandidate1JSON}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(51, 65, 85, 0.6)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              <Download size={12} /> Verification JSON
            </button>
            <button 
              onClick={handleExportCandidate1CSV}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              <FileSpreadsheet size={12} /> Verification CSV
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: CANDIDATE 2 V-FLOODNET VERIFICATION & BENCHMARK */}
      {cand2 && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <Droplets size={20} style={{ color: '#34d399' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Candidate 2: V-FloodNet (LinkNet EfficientNet-B4) Verification & Benchmark
                </h2>
                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                  AUTHENTIC WEIGHTS VERIFIED
                </span>
                <span style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                  BENCHMARK CANDIDATE
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>
                Repository: <code style={{ color: '#38bdf8' }}>xmlyqing00/V-FloodNet</code> | Paper: <em>Environmental Modelling & Software (Elsevier 2023)</em> | Checkpoint: <code style={{ color: '#6ee7b7' }}>records/link_efficientb4_model.pth</code>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                RECOMMENDATION: PROMISING WITH CALIBRATION
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '4px', fontWeight: 600, color: '#34d399' }}>
                FLOOD SCREENING DETECTION (14)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                {cand2Screening?.flood?.formatted} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>({cand2Screening?.flood?.detection_rate_percent}%)</span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                12 of 14 images &gt; 20% significant flood. Mean coverage: {cand2Screening?.flood?.mean_coverage_percent}%.
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '4px', fontWeight: 600, color: '#fbbf24' }}>
                POTHOLE FALSE SCREENING (12)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                {cand2Screening?.pothole_cross_audit?.formatted} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>({cand2Screening?.pothole_cross_audit?.screening_rate_percent}%)</span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                Dry road: <strong>0.0% water</strong>. 4 of 5 positive detections contain actual rainwater puddles in pothole craters.
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '4px', fontWeight: 600, color: '#60a5fa' }}>
                GARBAGE FALSE SCREENING (12)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                {cand2Screening?.garbage_cross_audit?.formatted} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#60a5fa' }}>({cand2Screening?.garbage_cross_audit?.screening_rate_percent}%)</span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                9 of 12 &lt; 5% water (mean 3.85%). Zero images &gt; 20% significant flood.
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(192, 132, 252, 0.25)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '4px', fontWeight: 600, color: '#c084fc' }}>
                COMBINED NON-FLOOD FALSE SCREENING (24)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                {cand2Screening?.combined_non_flood_cross_audit?.formatted} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c084fc' }}>({cand2Screening?.combined_non_flood_cross_audit?.screening_rate_percent}%)</span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                16 of 24 images cleanly filtered. (Compared to 24/24 false positives on rejected SegFormer).
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                Architecture & ONNX Specifications
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.775rem', opacity: 0.9, lineHeight: 1.6 }}>
                <li>Architecture: <strong>SMP LinkNet</strong> with <strong>EfficientNet-B4</strong> encoder (17.86M params)</li>
                <li>Input / Output: <code>[batch, 3, 416, 416]</code> &rarr; <code>[batch, 1, 416, 416]</code> (Sigmoid)</li>
                <li>ONNX Export: <code>scratch/vfloodnet_deeplabv3plus.onnx</code> ({cand2Meta?.onnx_file_size_mb} MB, Opset 14)</li>
                <li>Domain: Ground-level oblique CCTV / surveillance flood video cameras (NOT aerial/satellite)</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>
                Quality Gate Assessment
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.775rem', opacity: 0.9, lineHeight: 1.6 }}>
                <li>Dry Road Discrimination: <strong>PASSED (0.0% water on clean asphalt)</strong></li>
                <li>Mask Degeneracy: <strong>PASSED (Produces selective, sharp boundaries)</strong></li>
                <li>Calibration Need: <strong>YES</strong> (Potholes containing puddles trigger water detection; threshold calibration to &gt;20% or pothole spatial masking reduces false positives to near zero)</li>
                <li>Production Action: <strong>ISOLATED IN SCRATCH</strong>. Production model preserved.</li>
              </ul>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Candidate Location: <code style={{ color: '#c084fc' }}>scratch/vfloodnet_deeplabv3plus.onnx</code> | Status: <strong>BENCHMARK CANDIDATE</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleExportCandidate2JSON}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(51, 65, 85, 0.6)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
              >
                <Download size={12} /> Benchmark JSON
              </button>
              <button 
                onClick={handleExportCandidate2CSV}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
              >
                <FileSpreadsheet size={12} /> Benchmark CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TOGGLE BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('VFLOODNET')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: activeTab === 'VFLOODNET' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255,255,255,0.1)', 
              background: activeTab === 'VFLOODNET' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)', 
              color: activeTab === 'VFLOODNET' ? '#34d399' : '#94a3b8', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.85rem' 
            }}
          >
            <Activity size={16} /> Candidate 2: V-FloodNet Table ({cand2Records.length})
          </button>
          <button 
            onClick={() => setActiveTab('AUDIT')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: activeTab === 'AUDIT' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255,255,255,0.1)', 
              background: activeTab === 'AUDIT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.5)', 
              color: activeTab === 'AUDIT' ? '#fca5a5' : '#94a3b8', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.85rem' 
            }}
          >
            <Activity size={16} /> Candidate Flood Cross-Category Audit Table ({auditRecords.length})
          </button>
          <button 
            onClick={() => setActiveTab('BENCHMARK')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: activeTab === 'BENCHMARK' ? '1px solid rgba(192, 132, 252, 0.5)' : '1px solid rgba(255,255,255,0.1)', 
              background: activeTab === 'BENCHMARK' ? 'rgba(192, 132, 252, 0.2)' : 'rgba(30, 41, 59, 0.5)', 
              color: activeTab === 'BENCHMARK' ? '#c084fc' : '#94a3b8', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.85rem' 
            }}
          >
            <Layers size={16} /> Side-by-Side Benchmark Table ({records.length})
          </button>
        </div>

        {activeTab === 'CALIBRATION' ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text"
                placeholder="Search calibrated image..."
                value={calibSearchQuery}
                onChange={e => setCalibSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 30px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem', width: '220px' }}
              />
            </div>
            <select 
              value={calibFilterFolder} 
              onChange={e => setCalibFilterFolder(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Categories ({calibRecords.length})</option>
              <option value="Flood">Flood Category (14)</option>
              <option value="NON_FLOOD">Combined Non-Flood Only (24)</option>
              <option value="Pathole">Pothole Category (12)</option>
              <option value="Garbage">Garbage Category (12)</option>
            </select>
          </div>
        ) : activeTab === 'VFLOODNET' ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text"
                placeholder="Search V-FloodNet image..."
                value={vfloodnetSearchQuery}
                onChange={e => setVfloodnetSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 30px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem', width: '220px' }}
              />
            </div>
            <select 
              value={vfloodnetFilterFolder} 
              onChange={e => setVfloodnetFilterFolder(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Categories ({cand2Records.length})</option>
              <option value="Flood">Flood Category (14)</option>
              <option value="NON_FLOOD">Combined Non-Flood Only (24)</option>
              <option value="Pathole">Pothole Category (12)</option>
              <option value="Garbage">Garbage Category (12)</option>
            </select>
          </div>
        ) : activeTab === 'AUDIT' ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text"
                placeholder="Search audit image..."
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 30px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem', width: '220px' }}
              />
            </div>
            <select 
              value={auditFilterFolder} 
              onChange={e => setAuditFilterFolder(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Categories ({auditRecords.length})</option>
              <option value="NON_FLOOD">Combined Non-Flood Only (24)</option>
              <option value="Pathole">Pothole Category (12)</option>
              <option value="Garbage">Garbage Category (12)</option>
              <option value="Flood">Flood Category (14)</option>
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text"
                placeholder="Search benchmark image..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 30px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem', width: '220px' }}
              />
            </div>
            <select 
              value={selectedGroup} 
              onChange={e => setSelectedGroup(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Benchmark Groups ({records.length})</option>
              <option value="POTHOLE">Pothole Group ({summary.POTHOLE.totalImages})</option>
              <option value="FLOOD">Flood Group ({summary.FLOOD.totalImages})</option>
              <option value="GARBAGE">Garbage Group ({summary.GARBAGE.totalImages})</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB -1: V-FLOODNET CALIBRATION & PRODUCTION READINESS VIEW */}
      {activeTab === 'CALIBRATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
          {/* Section A: Production Readiness Banner */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(14, 165, 233, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <ShieldCheck size={22} style={{ color: '#38bdf8' }} />
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    Phase 8C-7: V-FloodNet Calibration & Production Readiness Assessment
                  </h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>
                  Deterministic threshold sweep, spatial connected-component topology, and water-filled pothole dual-model fusion.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.4)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
                  RECOMMENDATION: READY AFTER ADDITIONAL VALIDATION
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>
                  PRODUCTION PRESERVATION ASSURANCE
                </div>
                <div style={{ fontSize: '0.825rem', opacity: 0.9, lineHeight: 1.5 }}>
                  Active Production: <code style={{ color: '#6ee7b7' }}>flood-water-segmentation.onnx</code> is <strong>UNTOUCHED</strong>.
                  Calibrated Candidate service is strictly isolated in <code>vfloodnetCalibrationService.js</code> (NOT globally active).
                </div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>
                  CONSERVATIVE READINESS RATIONALE
                </div>
                <div style={{ fontSize: '0.825rem', opacity: 0.9, lineHeight: 1.5 }}>
                  Dataset scale is 38 images (14 flood, 24 non-flood). While V-FloodNet is non-degenerate and filters clean dry asphalt (0.0%), conservative engineering requires an expanded 100+ municipal image benchmark prior to production replacement.
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Threshold Sweep Table */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
                Phase 1: Deterministic Threshold Sweep Analysis (5% to 50%)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>
                Category-level screening detection rates across all 38 real images under uniform water-coverage thresholds.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <th style={{ padding: '10px 12px' }}>Threshold</th>
                    <th style={{ padding: '10px 12px', color: '#38bdf8' }}>Flood (14) Detection</th>
                    <th style={{ padding: '10px 12px', color: '#fbbf24' }}>Pothole (12) Screening</th>
                    <th style={{ padding: '10px 12px', color: '#c084fc' }}>Garbage (12) Screening</th>
                    <th style={{ padding: '10px 12px', color: '#f87171' }}>Combined Non-Flood (24)</th>
                    <th style={{ padding: '10px 12px' }}>Strategic Insight</th>
                  </tr>
                </thead>
                <tbody>
                  {calibSweep.map((s, idx) => {
                    const isOptimalFloor = s.threshold_percentage === 5;
                    const isOptimalCeiling = s.threshold_percentage === 25;
                    return (
                      <tr 
                        key={idx}
                        style={{ 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          background: isOptimalCeiling ? 'rgba(14, 165, 233, 0.12)' : isOptimalFloor ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          {s.threshold_percentage}%
                          {isOptimalFloor && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#34d399' }}>(Sensitivity Floor)</span>}
                          {isOptimalCeiling && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#38bdf8' }}>(Specificity Ceiling)</span>}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#38bdf8' }}>
                          {s.flood_detections} ({s.flood_detection_rate_pct}%)
                        </td>
                        <td style={{ padding: '10px 12px', color: '#fbbf24' }}>
                          {s.pothole_detections} ({s.pothole_detection_rate_pct}%)
                        </td>
                        <td style={{ padding: '10px 12px', color: '#c084fc' }}>
                          {s.garbage_detections} ({s.garbage_detection_rate_pct}%)
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: s.combined_non_flood_screening_rate_pct <= 16.7 ? '#34d399' : '#f87171' }}>
                          {s.combined_non_flood_detections} ({s.combined_non_flood_screening_rate_pct}%)
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.775rem', opacity: 0.85 }}>
                          {s.threshold_percentage === 5 && "Retains 100% of true flood images including receding edges."}
                          {s.threshold_percentage === 20 && "Garbage false triggers drop to exactly 0.0%."}
                          {s.threshold_percentage === 25 && "100% Garbage exclusion + 10% safety margin. 12/14 Flood retained."}
                          {s.threshold_percentage >= 40 && "Flood sensitivity degrades significantly (<78%)."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section C: Dual Policy Definition & Water-Filled Potholes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* Policy Tiers */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>
                Phase 2 & 6: Calibrated 4-Tier Waterlogging Policy
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <strong style={{ color: '#60a5fa' }}>LEVEL 1: NO SIGNIFICANT WATER (&lt; 5.0%)</strong>
                  <div style={{ opacity: 0.85, marginTop: '2px' }}>Normal dry road texture, dry potholes, clean surfaces. Zero municipal alert.</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <strong style={{ color: '#fbbf24' }}>LEVEL 2: POSSIBLE WATERLOGGING (5.0% – 25.0%)</strong>
                  <div style={{ opacity: 0.85, marginTop: '2px' }}>Localized pooling, wet asphalt sheen, receding edges. Stormwater watch alert.</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <strong style={{ color: '#f87171' }}>LEVEL 3: SIGNIFICANT WATERLOGGING (&gt; 25.0%)</strong>
                  <div style={{ opacity: 0.85, marginTop: '2px' }}>Substantial continuous roadway waterlogging. Priority Drainage Department alert.</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <strong style={{ color: '#c084fc' }}>FUSED STATUS: WATER-FILLED POTHOLE</strong>
                  <div style={{ opacity: 0.85, marginTop: '2px' }}>Road Model (D40 Pothole) + V-FloodNet Water (&ge;5.0%). Dispatched to Highways Dept as structural pavement hazard.</div>
                </div>
              </div>
            </div>

            {/* Pothole Analysis */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700, color: '#fbbf24' }}>
                Phase 3: Ground-Truth Water-Filled Pothole Audit
              </h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', opacity: 0.8 }}>
                The 4 pothole images exceeding 25% water coverage contain genuine physical rainwater pools inside road cavities:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                {calibPotholes.map((p, idx) => (
                  <div key={idx} style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <code style={{ color: '#fbbf24' }}>{p.filename}</code>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{p.water_coverage_pct}% water</span>
                    </div>
                    <div style={{ opacity: 0.8 }}>{p.visual_inspection}</div>
                    <div style={{ marginTop: '2px', color: '#34d399', fontWeight: 600 }}>Resolved as: {p.fused_civicsense_status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section D: Per-Image Calibrated Results Table */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
                  Calibrated Decision Policy Evaluation Across All 38 Images
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>
                  Displays deterministic 4-tier classification, resolution warnings, and spatial connected-component topology.
                </p>
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Showing <strong>{filteredCalibRecords.length}</strong> of <strong>{calibRecords.length}</strong> images
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <th style={{ padding: '10px 12px' }}>Filename</th>
                    <th style={{ padding: '10px 12px' }}>Source Folder</th>
                    <th style={{ padding: '10px 12px' }}>Resolution</th>
                    <th style={{ padding: '10px 12px' }}>Res Warning</th>
                    <th style={{ padding: '10px 12px', color: '#38bdf8' }}>Water Cov %</th>
                    <th style={{ padding: '10px 12px' }}>Calibrated Status</th>
                    <th style={{ padding: '10px 12px' }}>Severity Tier</th>
                    <th style={{ padding: '10px 12px' }}>Spatial Topology</th>
                    <th style={{ padding: '10px 12px' }}>Components</th>
                    <th style={{ padding: '10px 12px' }}>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalibRecords.map((r, idx) => {
                    const isPotholeWater = r.calibrated_waterlogging_status === 'WATER-FILLED POTHOLE';
                    const isSigFlood = r.calibrated_waterlogging_status === 'SIGNIFICANT WATERLOGGING';
                    const isPossible = r.calibrated_waterlogging_status === 'POSSIBLE WATERLOGGING';
                    const isLowRes = r.resolution_warning === 'LOW RESOLUTION';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.filename}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 700,
                            background: r.source_folder === 'Flood' ? 'rgba(56, 189, 248, 0.2)' : r.source_folder === 'Pathole' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                            color: r.source_folder === 'Flood' ? '#38bdf8' : r.source_folder === 'Pathole' ? '#fbbf24' : '#c084fc'
                          }}>
                            {r.source_folder}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', opacity: 0.85, fontFamily: 'monospace' }}>{r.image_resolution}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {isLowRes ? (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                              LOW RES
                            </span>
                          ) : (
                            <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>Normal</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: r.water_coverage_percentage > 25 ? '#34d399' : r.water_coverage_percentage >= 5 ? '#38bdf8' : '#94a3b8' }}>
                          {r.water_coverage_percentage}%
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 700,
                            background: isPotholeWater ? 'rgba(168, 85, 247, 0.25)' : isSigFlood ? 'rgba(16, 185, 129, 0.25)' : isPossible ? 'rgba(245, 158, 11, 0.25)' : 'rgba(148, 163, 184, 0.15)',
                            color: isPotholeWater ? '#c084fc' : isSigFlood ? '#34d399' : isPossible ? '#fbbf24' : '#94a3b8'
                          }}>
                            {r.calibrated_waterlogging_status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600 }}>{r.calibrated_severity_tier}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.725rem', opacity: 0.85 }}>{r.spatial_topology}</td>
                        <td style={{ padding: '10px 12px', opacity: 0.8, textAlign: 'center' }}>{r.num_connected_components}</td>
                        <td style={{ padding: '10px 12px', opacity: 0.75 }}>{r.latency_ms} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 0: V-FLOODNET BENCHMARK TABLE */}
      {activeTab === 'VFLOODNET' && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#34d399' }}>
                Candidate 2: V-FloodNet (LinkNet EfficientNet-B4) Real-Image Screening Audit
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
                Direct execution of verified authentic checkpoint on all 38 real images in REAL_TEST_DATASET.
              </p>
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              Showing <strong>{filteredCand2Records.length}</strong> of <strong>{cand2Records.length}</strong> images
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(15, 23, 42, 0.5)' }}>
                  <th style={{ padding: '10px 12px' }}>Filename</th>
                  <th style={{ padding: '10px 12px' }}>Source Folder</th>
                  <th style={{ padding: '10px 12px' }}>Resolution</th>
                  <th style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)' }}>Candidate Prediction</th>
                  <th style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)' }}>Water Coverage %</th>
                  <th style={{ padding: '10px 12px' }}>Deterministic Category</th>
                  <th style={{ padding: '10px 12px' }}>Substantial Water?</th>
                  <th style={{ padding: '10px 12px' }}>Mean Water Prob</th>
                  <th style={{ padding: '10px 12px' }}>Max Water Prob</th>
                  <th style={{ padding: '10px 12px' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {filteredCand2Records.map((r, idx) => {
                  const isPositive = r.water_coverage_percentage >= 5.0;
                  const isSubstantial = r.water_coverage_percentage > 20.0;
                  const isGroundFlood = r.source_folder === 'Flood';
                  const isFalsePositive = !isGroundFlood && isPositive;
                  const isCleanNegative = !isGroundFlood && !isPositive;

                  let rowBg = 'transparent';
                  if (isGroundFlood && isPositive) rowBg = 'rgba(16, 185, 129, 0.05)';
                  else if (isFalsePositive) rowBg = 'rgba(245, 158, 11, 0.06)';
                  else if (isCleanNegative) rowBg = 'rgba(59, 130, 246, 0.03)';

                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        background: rowBg
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.filename}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: r.source_folder === 'Flood' ? 'rgba(56, 189, 248, 0.2)' : r.source_folder === 'Pathole' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                          color: r.source_folder === 'Flood' ? '#38bdf8' : r.source_folder === 'Pathole' ? '#fbbf24' : '#c084fc'
                        }}>
                          {r.source_folder}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', opacity: 0.8 }}>{r.image_resolution}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isSubstantial ? 'rgba(16, 185, 129, 0.25)' : isPositive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: isSubstantial ? '#34d399' : isPositive ? '#38bdf8' : '#94a3b8'
                        }}>
                          {r.candidate_flood_prediction}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: r.water_coverage_percentage > 20 ? '#34d399' : r.water_coverage_percentage >= 5 ? '#38bdf8' : '#94a3b8' }}>
                        {r.water_coverage_percentage}%
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: r.water_category === 'SIGNIFICANT WATER' ? 'rgba(16, 185, 129, 0.2)' : r.water_category === 'POSSIBLE WATER / AMBIGUOUS' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: r.water_category === 'SIGNIFICANT WATER' ? '#34d399' : r.water_category === 'POSSIBLE WATER / AMBIGUOUS' ? '#fbbf24' : '#60a5fa'
                        }}>
                          {r.water_category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.substantial_water_coverage ? (
                          <span style={{ color: '#34d399', fontWeight: 700 }}>YES (&gt;20%)</span>
                        ) : (
                          <span style={{ color: '#94a3b8', opacity: 0.7 }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', opacity: 0.85 }}>{r.mean_water_prob}</td>
                      <td style={{ padding: '10px 12px', opacity: 0.85 }}>{r.max_water_prob}</td>
                      <td style={{ padding: '10px 12px', opacity: 0.75 }}>{r.latency_ms} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 1: AUDIT TABLE */}
      {activeTab === 'AUDIT' && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Candidate Flood Model Per-Image Screening Audit</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
                Displays honest model predictions, water coverage %, deterministic classification, and logit metrics for each image.
              </p>
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              Showing <strong>{filteredAuditRecords.length}</strong> of <strong>{auditRecords.length}</strong> images
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(15, 23, 42, 0.5)' }}>
                  <th style={{ padding: '10px 12px' }}>Filename</th>
                  <th style={{ padding: '10px 12px' }}>Source Folder</th>
                  <th style={{ padding: '10px 12px' }}>Resolution</th>
                  <th style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)' }}>Candidate Prediction</th>
                  <th style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)' }}>Water Coverage %</th>
                  <th style={{ padding: '10px 12px' }}>Deterministic Category</th>
                  <th style={{ padding: '10px 12px' }}>Substantial Water?</th>
                  <th style={{ padding: '10px 12px' }}>Mean Water Prob</th>
                  <th style={{ padding: '10px 12px' }}>Logit Margin</th>
                  <th style={{ padding: '10px 12px' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditRecords.map((r, idx) => (
                  <tr key={r.filename + idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f8fafc' }}>{r.filename}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '0.725rem', 
                        fontWeight: 600, 
                        background: r.source_folder === 'Pathole' ? 'rgba(249, 115, 22, 0.2)' : r.source_folder === 'Flood' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(168, 85, 247, 0.2)', 
                        color: r.source_folder === 'Pathole' ? '#fb923c' : r.source_folder === 'Flood' ? '#38bdf8' : '#c084fc' 
                      }}>
                        {r.source_folder}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', opacity: 0.8 }}>{r.image_resolution}</td>
                    <td style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.04)' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: r.candidate_flood_prediction.includes('SIGNIFICANT') ? '#f87171' : '#fb923c',
                        fontSize: '0.75rem'
                      }}>
                        {r.candidate_flood_prediction}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(239, 68, 68, 0.04)', color: r.water_coverage_percentage > 80 ? '#f87171' : '#38bdf8' }}>
                      {r.water_coverage_percentage}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '0.725rem', 
                        fontWeight: 700,
                        background: r.water_category === 'SIGNIFICANT WATER' ? 'rgba(239, 68, 68, 0.2)' : r.water_category === 'POSSIBLE WATER / AMBIGUOUS' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: r.water_category === 'SIGNIFICANT WATER' ? '#ef4444' : r.water_category === 'POSSIBLE WATER / AMBIGUOUS' ? '#eab308' : '#10b981'
                      }}>
                        {r.water_category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {r.substantial_water_coverage ? (
                        <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.75rem' }}>YES (&gt;20%)</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.75rem' }}>NO</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', opacity: 0.85 }}>
                      {r.confidence_statistics.mean_water_prob}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#fb923c' }}>
                      +{r.water_mask_statistics.logit_diff}
                    </td>
                    <td style={{ padding: '10px 12px', opacity: 0.8, fontSize: '0.78rem' }}>
                      {r.inference_latency_ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BENCHMARK SIDE-BY-SIDE TABLE */}
      {activeTab === 'BENCHMARK' && (
        <>
          {/* Side-by-Side Benchmark Groups Comparison */}
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={18} style={{ color: '#c084fc' }} />
            Benchmark Group Evaluation (Current Production vs External Candidate)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* Phase 1: POTHOLE */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fb923c' }}>POTHOLE BENCHMARK GROUP (PHASE 1)</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{summary.POTHOLE.totalImages} Images Tested</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Current Model */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>CURRENT PRODUCTION</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>{summary.POTHOLE.currentModel.modelName}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                    {summary.POTHOLE.currentModel.detectedCount} / {summary.POTHOLE.totalImages} ({summary.POTHOLE.currentModel.detectionRatePercent}%)
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                    Detections: <strong>{summary.POTHOLE.currentModel.detectedCount}</strong> | No Detections: <strong>{summary.POTHOLE.currentModel.noDetectedCount}</strong>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#10b981', fontWeight: 700, marginTop: '6px' }}>ACTIVE PRODUCTION</div>
                </div>

                {/* External Candidate */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>EXTERNAL CANDIDATE</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>{summary.POTHOLE.externalModel.candidateName}</div>
                  <div style={{ fontSize: '1.0rem', fontWeight: 700, color: '#ef4444', margin: '6px 0' }}>
                    REQUIRES BACKEND PROXY
                  </div>
                  <div style={{ fontSize: '0.725rem', opacity: 0.75, lineHeight: 1.3 }}>
                    {summary.POTHOLE.externalModel.blockerReason}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#ef4444', fontWeight: 700, marginTop: '6px' }}>
                    EXTERNAL API REQUIRES BACKEND PROXY
                  </div>
                </div>
              </div>
            </div>

      {/* Phase 2: FLOOD */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>FLOOD BENCHMARK GROUP (PHASE 2)</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{summary.FLOOD.totalImages} Images Tested</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Current Model */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>CURRENT PRODUCTION</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>{summary.FLOOD.currentModel.modelName}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                    {summary.FLOOD.currentModel.detectedCount} / {summary.FLOOD.totalImages} ({summary.FLOOD.currentModel.detectionRatePercent}%)
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>
                    Detections: <strong>{summary.FLOOD.currentModel.detectedCount}</strong> | No Detections: <strong>{summary.FLOOD.currentModel.noDetectedCount}</strong>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#10b981', fontWeight: 700, marginTop: '6px' }}>ACTIVE PRODUCTION</div>
                </div>

                {/* External Candidate */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>BENCHMARK CANDIDATE</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>{summary.FLOOD.externalModel.candidateName}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171', margin: '6px 0' }}>
                    REJECT DUE TO FALSE POSITIVES
                  </div>
                  <div style={{ fontSize: '0.725rem', opacity: 0.75, lineHeight: 1.3 }}>
                    {summary.FLOOD.externalModel.blockerReason}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#f87171', fontWeight: 700, marginTop: '6px' }}>
                    DO NOT DEPLOY (24/24 NON-FLOOD FP)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Per-Image Benchmark Table */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Side-by-Side Benchmark Table</h3>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong> images
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(15, 23, 42, 0.4)' }}>
                    <th style={{ padding: '10px 12px' }}>Filename</th>
                    <th style={{ padding: '10px 12px' }}>Ground Truth</th>
                    <th style={{ padding: '10px 12px' }}>Resolution</th>
                    <th style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)' }}>Current Model Result</th>
                    <th style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)' }}>Current Conf</th>
                    <th style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)' }}>External Model Result</th>
                    <th style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)' }}>External Conf</th>
                    <th style={{ padding: '10px 12px' }}>Latency</th>
                    <th style={{ padding: '10px 12px' }}>API / Model Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, idx) => (
                    <tr key={r.filename + idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f8fafc' }}>{r.filename}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: r.groundTruthFolder === 'POTHOLE' ? 'rgba(249, 115, 22, 0.2)' : r.groundTruthFolder === 'FLOOD' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(168, 85, 247, 0.2)', color: r.groundTruthFolder === 'POTHOLE' ? '#fb923c' : r.groundTruthFolder === 'FLOOD' ? '#38bdf8' : '#c084fc' }}>
                          {r.groundTruthFolder}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', opacity: 0.8 }}>{r.resolution}</td>
                      <td style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.04)' }}>
                        <span style={{ fontWeight: 600, color: r.currentModelResult === 'TRUE POSITIVE' ? '#10b981' : r.currentModelResult === 'CORRECT NEGATIVE' ? '#60a5fa' : '#ef4444' }}>
                          {r.currentModelResult}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', background: 'rgba(16, 185, 129, 0.04)' }}>
                        {r.currentModelConfidence !== null ? `${(r.currentModelConfidence * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.04)', color: '#94a3b8', fontStyle: 'italic' }}>
                        {r.externalModelResult}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', background: 'rgba(239, 68, 68, 0.04)', color: '#94a3b8' }}>
                        N/A
                      </td>
                      <td style={{ padding: '10px 12px', opacity: 0.8, fontSize: '0.8rem' }}>{r.latencyMs} ms</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 600 }}>
                          {r.apiModelStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
