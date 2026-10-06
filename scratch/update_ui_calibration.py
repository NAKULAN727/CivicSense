import re

with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add calibration variables and export handlers
calib_state_pattern = r"(const cand2Comparison = cand2\?\.comparison_with_production;)"
calib_state_replacement = r"""\1

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
  });"""

content = re.sub(calib_state_pattern, calib_state_replacement, content, count=1)

# 2. Add Export Calibration handlers
calib_export_pattern = r"(const handleExportCandidate2CSV = \(\) => \{[\s\S]*?link\.remove\(\);\s*\};)"
calib_export_replacement = r"""\1

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
  };"""

content = re.sub(calib_export_pattern, calib_export_replacement, content, count=1)

# 3. Add Top banner buttons for Calibration
banner_btn_pattern = r"(<button\s*onClick=\{handleExportCandidate2CSV\}[\s\S]*?</button>)"
banner_btn_replacement = r"""\1
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
          </button>"""

content = re.sub(banner_btn_pattern, banner_btn_replacement, content, count=1)

# 4. Add Tab Button for Calibration
tab_btn_pattern = r"(<button\s*onClick=\{() => setActiveTab\('VFLOODNET'\)\}[\s\S]*?<\/button>)"
tab_btn_replacement = r"""<button 
            onClick={() => setActiveTab('CALIBRATION')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: activeTab === 'CALIBRATION' ? '1px solid rgba(14, 165, 233, 0.6)' : '1px solid rgba(255,255,255,0.1)', 
              background: activeTab === 'CALIBRATION' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(30, 41, 59, 0.5)', 
              color: activeTab === 'CALIBRATION' ? '#38bdf8' : '#94a3b8', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.85rem' 
            }}
          >
            <SlidersHorizontal size={16} /> V-FloodNet Calibration & Policy ({calibRecords.length})
          </button>
          \1"""

content = re.sub(tab_btn_pattern, tab_btn_replacement, content, count=1)

# 5. Add search filter dropdown for CALIBRATION tab
filter_pattern = r"(\{activeTab === 'VFLOODNET' \? \()"
filter_replacement = r"""{activeTab === 'CALIBRATION' ? (
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
        ) : \1"""

content = re.sub(filter_pattern, filter_replacement, content, count=1)

# 6. Add CALIBRATION TAB VIEW
calib_view_block = """{/* TAB -1: V-FLOODNET CALIBRATION & PRODUCTION READINESS VIEW */}
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

      {/* TAB 0: V-FLOODNET BENCHMARK TABLE */}"""

calib_view_pattern = r"(\{/\* TAB 0: V-FLOODNET BENCHMARK TABLE \*/\})"
content = re.sub(calib_view_pattern, calib_view_block, content, count=1)

with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("ExternalBenchmarkTool.jsx updated with Calibration & Production Readiness section successfully!")
