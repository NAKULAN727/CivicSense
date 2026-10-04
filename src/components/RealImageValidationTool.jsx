import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Layers, 
  Filter, 
  FileText, 
  Search,
  ShieldAlert,
  Database,
  Eye,
  Info,
  Maximize2
} from 'lucide-react';
import validationReportData from '../data/realValidationReport.json';

export default function RealImageValidationTool() {
  const [report, setReport] = useState(validationReportData);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedClassification, setSelectedClassification] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImageDetail, setSelectedImageDetail] = useState(null);

  const datasetSummary = report.datasetSummary;
  const categoryResults = report.categoryResults;
  const failureAnalysis = report.modelFailureAnalysis;
  const perImageResults = report.perImageResults || [];

  // Filtered image list
  const filteredResults = perImageResults.filter(img => {
    const matchCat = selectedCategory === 'ALL' || img.groundTruth === selectedCategory;
    const matchClass = selectedClassification === 'ALL' || img.classification === selectedClassification;
    const matchSearch = searchQuery.trim() === '' || 
      img.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (img.detectedClasses && img.detectedClasses.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchCat && matchClass && matchSearch;
  });

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "CivicSense_Real_Image_Validation_Report.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = [
      'Filename', 'GroundTruth', 'Width', 'Height', 'Classification', 
      'RawCandidates', 'PostNmsDetections', 'DetectedClasses', 
      'MaxConfidence', 'FloodAreaPercent', 'CrossModelFalsePositives', 'InferenceTimeMs'
    ];
    const rows = perImageResults.map(r => [
      `"${r.filename}"`,
      `"${r.groundTruth}"`,
      r.imageWidth,
      r.imageHeight,
      `"${r.classification}"`,
      r.numRawCandidates,
      r.numPostNmsDetections,
      `"${(r.detectedClasses || []).join('; ')}"`,
      r.maxConfidence !== null ? r.maxConfidence : 'N/A',
      r.floodAreaPercent || 0,
      `"${(r.crossModelFalsePositives || []).join('; ')}"`,
      r.inferenceTimeMs
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'CivicSense_Real_Image_Validation_Report.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'TRUE POSITIVE':
        return <span className="status-badge success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> TRUE POSITIVE</span>;
      case 'FALSE NEGATIVE':
        return <span className="status-badge danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> FALSE NEGATIVE</span>;
      case 'FALSE POSITIVE':
        return <span className="status-badge warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> FALSE POSITIVE</span>;
      case 'CORRECT NEGATIVE':
        return <span className="status-badge info" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> CORRECT NEGATIVE</span>;
      default:
        return <span className="status-badge neutral">{classification}</span>;
    }
  };

  const getCategoryBadge = (gt) => {
    switch (gt) {
      case 'FLOOD':
        return <span style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>FLOOD</span>;
      case 'GARBAGE':
        return <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>GARBAGE</span>;
      case 'POTHOLE':
        return <span style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>POTHOLE</span>;
      default:
        return <span>{gt}</span>;
    }
  };

  return (
    <div className="validation-tool-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-main, #e2e8f0)' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Database size={24} style={{ color: '#38bdf8' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>CivicSense AI – Real Image Validation Phase</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.875rem' }}>
            Rigorous evaluation of production ONNX models (RDD2022 Road Damage, Multi-Class Waste, SegFormer FloodNet) against real-world test images without model tuning or heuristics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleExportJSON}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(51, 65, 85, 0.6)', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            <Download size={14} /> Export JSON
          </button>
          <button 
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #0284c7, #2563eb)', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            <FileText size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Total Evaluated */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', tracking: '0.05em', marginBottom: '4px' }}>Dataset Size</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc' }}>{datasetSummary.totalImages} Real Images</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
            Flood: {datasetSummary.imagesPerCategory.FLOOD} | Garbage: {datasetSummary.imagesPerCategory.GARBAGE} | Pothole: {datasetSummary.imagesPerCategory.POTHOLE}
          </div>
        </div>

        {/* Pothole Results */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase' }}>Pothole Detection</div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fb923c' }}>{categoryResults.POTHOLE.detectionRatePercent}% Rate</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '4px 0', color: '#fb923c' }}>
            {categoryResults.POTHOLE.truePositives} / {categoryResults.POTHOLE.total} TP
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
            FN: {categoryResults.POTHOLE.falseNegatives} | FP: {categoryResults.POTHOLE.falsePositivesIdentified} | TN: {categoryResults.POTHOLE.correctNegatives}
          </div>
        </div>

        {/* Garbage Results */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase' }}>Garbage Detection</div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc' }}>{categoryResults.GARBAGE.detectionRatePercent}% Rate</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '4px 0', color: '#c084fc' }}>
            {categoryResults.GARBAGE.truePositives} / {categoryResults.GARBAGE.total} TP
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
            FN: {categoryResults.GARBAGE.falseNegatives} | FP: {categoryResults.GARBAGE.falsePositivesIdentified}
          </div>
        </div>

        {/* Flood Results */}
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase' }}>Flood Water Segmenter</div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>{categoryResults.FLOOD.detectionRatePercent}% Rate</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '4px 0', color: '#38bdf8' }}>
            {categoryResults.FLOOD.truePositives} / {categoryResults.FLOOD.total} TP
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
            FN: {categoryResults.FLOOD.falseNegatives} | FP: {categoryResults.FLOOD.falsePositivesIdentified}
          </div>
        </div>
      </div>

      {/* Model Failure Pattern Analysis Section */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ShieldAlert size={20} style={{ color: '#ef4444' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Empirical Model Failure Analysis & Root Cause Audit</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '14px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.9rem', marginBottom: '4px' }}>1. Resolution & Resizing Interpolation Failure</div>
            <p style={{ margin: 0, fontSize: '0.825rem', opacity: 0.85, lineHeight: 1.5 }}>
              {failureAnalysis.lowResolutionImpact}
            </p>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '14px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
            <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.9rem', marginBottom: '4px' }}>2. Cross-Model False Positive Confusion</div>
            <p style={{ margin: 0, fontSize: '0.825rem', opacity: 0.85, lineHeight: 1.5 }}>
              {failureAnalysis.wasteModelBackgroundConfusion}
            </p>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '14px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.9rem', marginBottom: '4px' }}>3. Domain Mismatch (Drone vs Street-Level)</div>
            <p style={{ margin: 0, fontSize: '0.825rem', opacity: 0.85, lineHeight: 1.5 }}>
              {failureAnalysis.floodModelDomainMismatch}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', background: 'rgba(51, 65, 85, 0.4)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <span><strong>Disclaimer:</strong> {report.accuracyClaimDisclaimer}</span>
        </div>
      </div>

      {/* Per-Image Results Table */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Per-Image Inference Results & Detections Log</h3>

          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text"
                placeholder="Search image filename..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 30px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem', width: '200px' }}
              />
            </div>

            {/* Category Filter */}
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Categories ({datasetSummary.totalImages})</option>
              <option value="POTHOLE">Pothole ({categoryResults.POTHOLE.total})</option>
              <option value="GARBAGE">Garbage ({categoryResults.GARBAGE.total})</option>
              <option value="FLOOD">Flood ({categoryResults.FLOOD.total})</option>
            </select>

            {/* Classification Filter */}
            <select 
              value={selectedClassification} 
              onChange={e => setSelectedClassification(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Classifications</option>
              <option value="TRUE POSITIVE">True Positives</option>
              <option value="FALSE NEGATIVE">False Negatives</option>
              <option value="FALSE POSITIVE">False Positives</option>
              <option value="CORRECT NEGATIVE">Correct Negatives</option>
            </select>
          </div>
        </div>

        {/* Results Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(15, 23, 42, 0.4)' }}>
                <th style={{ padding: '10px 12px' }}>#</th>
                <th style={{ padding: '10px 12px' }}>Filename</th>
                <th style={{ padding: '10px 12px' }}>Ground Truth</th>
                <th style={{ padding: '10px 12px' }}>Resolution</th>
                <th style={{ padding: '10px 12px' }}>Evaluation Tag</th>
                <th style={{ padding: '10px 12px' }}>Raw Candidates</th>
                <th style={{ padding: '10px 12px' }}>Post-NMS</th>
                <th style={{ padding: '10px 12px' }}>Detected Classes</th>
                <th style={{ padding: '10px 12px' }}>Max Conf</th>
                <th style={{ padding: '10px 12px' }}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
                    No matching image evaluation records found.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r, idx) => (
                  <tr 
                    key={r.filename + idx} 
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '10px 12px', opacity: 0.5 }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f8fafc' }}>
                      {r.filename}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{getCategoryBadge(r.groundTruth)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', opacity: 0.8 }}>
                      {r.imageWidth} × {r.imageHeight}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{getClassificationBadge(r.classification)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{r.numRawCandidates}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{r.numPostNmsDetections}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.detectedClasses && r.detectedClasses.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {r.detectedClasses.map((c, i) => (
                            <span key={i} style={{ background: 'rgba(51, 65, 85, 0.6)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', width: 'fit-content' }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ opacity: 0.4, fontStyle: 'italic' }}>None detected</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                      {r.maxConfidence !== null ? `${(r.maxConfidence * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', opacity: 0.7, fontSize: '0.8rem' }}>{r.inferenceTimeMs} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
