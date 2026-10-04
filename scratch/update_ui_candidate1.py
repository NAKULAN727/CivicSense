import re

tool_path = r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx"

with open(tool_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add handlers for Candidate 1
handlers = """  const handleExportCandidate1JSON = () => {
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
    ].join('\\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'flood_yolov8seg_benchmark.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return ("""

content = content.replace("  return (", handlers, 1)

# 2. Add header export buttons
target_btn = """<button 
            onClick={handleExportAuditCSV}"""
replacement_btn = """<button 
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
            onClick={handleExportAuditCSV}"""

content = content.replace(target_btn, replacement_btn, 1)

# 3. Add Candidate 1 verification block right after candidate audit report
target_block = """          </div>
        </div>
      )}

      {/* VIEW TOGGLE BAR */}"""

candidate1_section = """          </div>
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

      {/* VIEW TOGGLE BAR */}"""

content = content.replace(target_block, candidate1_section, 1)

with open(tool_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated ExternalBenchmarkTool.jsx successfully.")
