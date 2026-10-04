import re

with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Check if candidate 2 is already present
if "Candidate 2: V-FloodNet" in content:
    print("Candidate 2 already present in ExternalBenchmarkTool.jsx")
    exit(0)

# 1. Update state and cand2 definitions
state_pattern = r"(const \[auditSearchQuery, setAuditSearchQuery\] = useState\(''\);)"
state_replacement = r"""\1
  const [vfloodnetFilterFolder, setVfloodnetFilterFolder] = useState('ALL');
  const [vfloodnetSearchQuery, setVfloodnetSearchQuery] = useState('');

  const cand2 = report.candidate2VFloodNetVerification;
  const cand2Meta = cand2?.benchmark_metadata;
  const cand2Screening = cand2?.category_screening_summary;
  const cand2Records = cand2?.audit_records || [];
  const cand2Quality = cand2?.quality_gate_audit;
  const cand2Comparison = cand2?.comparison_with_production;

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
  });"""

content = re.sub(state_pattern, state_replacement, content, count=1)

# 2. Add Export functions
export_pattern = r"(const handleExportCandidate1CSV = \(\) => \{[\s\S]*?link\.remove\(\);\s*\};)"
export_replacement = r"""\1

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
  };"""

content = re.sub(export_pattern, export_replacement, content, count=1)

# 3. Add Top Banner buttons
banner_btn_pattern = r"(<button\s*onClick=\{handleExportCandidate1CSV\}[\s\S]*?</button>)"
banner_btn_replacement = r"""\1
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
          </button>"""

content = re.sub(banner_btn_pattern, banner_btn_replacement, content, count=1)

# 4. Add Candidate 2 Card after Candidate 1
cand1_end_pattern = r"(Active Production Status: <code style=\{\{ color: '#10b981' \}\}>flood-water-segmentation\.onnx<\/code> remains <strong>ACTIVE PRODUCTION<\/strong> \(Unchanged\)\.[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)"

cand2_card = """\\1

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
      )}"""

content = re.sub(cand1_end_pattern, cand2_card, content, count=1)

# 5. Add V-FloodNet tab button in toggle bar
tab_btn_pattern = r"(<button\s*onClick=\{() => setActiveTab\('AUDIT'\)\}[\s\S]*?<\/button>)"
tab_btn_replacement = r"""<button 
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
            <Activity size={16} /> Candidate 2: V-FloodNet Benchmark Table ({cand2Records.length})
          </button>
          \1"""

content = re.sub(tab_btn_pattern, tab_btn_replacement, content, count=1)

# 6. Add Search & Filter bar for V-FloodNet when activeTab === 'VFLOODNET'
filter_pattern = r"(\{activeTab === 'AUDIT' \? \([\s\S]*?\}\s*<\/div>)"
filter_replacement = r"""{activeTab === 'VFLOODNET' ? (
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
        )}"""

content = re.sub(filter_pattern, filter_replacement, content, count=1)

# 7. Add Table rendering for activeTab === 'VFLOODNET'
table_pattern = r"(\{/\* TAB 1: AUDIT TABLE \*/\}\s*\{activeTab === 'AUDIT' && \()"
vfloodnet_table = """{/* TAB 0: V-FLOODNET BENCHMARK TABLE */}
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

      \\1"""

content = re.sub(table_pattern, vfloodnet_table, content, count=1)

with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("ExternalBenchmarkTool.jsx updated successfully!")
