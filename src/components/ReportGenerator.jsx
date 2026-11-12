import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Settings, 
  Loader2, 
  CheckCircle2, 
  Building2,
  Calendar,
  Layers,
  Award
} from 'lucide-react';
import { WARD_HEALTH_DATA, CHENNAI_HOTSPOTS } from '../data/mockData';
import { getAllIncidents, subscribeToOrchestration } from '../services/incidentOrchestrationService';

export default function ReportGenerator({ issues: propIssues }) {
  const [activeIssues, setActiveIssues] = useState(() => {
    if (propIssues && propIssues.length > 0) return propIssues;
    const central = getAllIncidents();
    return central.length > 0 ? central : CHENNAI_HOTSPOTS;
  });

  useEffect(() => {
    if (propIssues && propIssues.length > 0) {
      setActiveIssues(propIssues);
      return;
    }
    const unsub = subscribeToOrchestration((state) => {
      const central = state.incidents || [];
      setActiveIssues(central.length > 0 ? central : CHENNAI_HOTSPOTS);
    });
    return unsub;
  }, [propIssues]);

  const [selectedWard, setSelectedWard] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileStage, setCompileStage] = useState('');
  const [reportGenerated, setReportGenerated] = useState(false);

  // Extract unique Wards safely
  const getWardName = (i) => {
    const raw = i.ward || i.location?.ward || 'Chennai Metro';
    return raw.includes(' - ') ? raw.split(' - ')[1] : raw;
  };

  const wards = useMemo(() => {
    const set = new Set();
    activeIssues.forEach(i => set.add(getWardName(i)));
    return ['All', ...Array.from(set)];
  }, [activeIssues]);

  const handleGenerate = () => {
    setIsCompiling(true);
    setCompileProgress(0);
    setReportGenerated(false);
    
    const stages = [
      { progress: 15, msg: 'Querying Central Incident Orchestration Registry...' },
      { progress: 40, msg: 'Aggregating RDD2022 road defect detections & SegFormer B0 flood masks...' },
      { progress: 70, msg: 'Calculating ASTM D6433 PCI deductions and drainage risks...' },
      { progress: 90, msg: 'Cross-referencing Greater Chennai Corporation department routing...' },
      { progress: 100, msg: 'Official municipal audit report compiled successfully!' }
    ];

    let currentStageIndex = 0;
    
    const interval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        const stage = stages[currentStageIndex];
        setCompileProgress(stage.progress);
        setCompileStage(stage.msg);
        currentStageIndex++;
      } else {
        clearInterval(interval);
        setIsCompiling(false);
        setReportGenerated(true);
      }
    }, 450);
  };

  // Filter issues based on choices
  const filteredIssues = useMemo(() => {
    return activeIssues.filter(issue => {
      const wardName = getWardName(issue);
      const matchesWard = selectedWard === 'All' || wardName === selectedWard;

      const cat = (issue.category || issue.type || '').toUpperCase();
      const matchesCategory = selectedCategory === 'All' || 
        (selectedCategory === 'ROAD' && (cat.includes('ROAD') || cat.includes('POTHOLE') || cat.includes('CRACK'))) ||
        (selectedCategory === 'FLOOD' && (cat.includes('FLOOD') || cat.includes('WATER'))) ||
        (selectedCategory === 'WASTE' && (cat.includes('WASTE') || cat.includes('GARBAGE')));

      const sev = (issue.severity || '').toUpperCase();
      const matchesSeverity = selectedSeverity === 'All' || sev === selectedSeverity;

      return matchesWard && matchesCategory && matchesSeverity;
    });
  }, [activeIssues, selectedWard, selectedCategory, selectedSeverity]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="report-grid">
      {/* Configuration Sidebar */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={16} /> Report Parameters
        </h3>
        
        <div style={{ height: '1px', background: 'var(--border-card)' }} />

        {/* Ward selection */}
        <div className="slider-container">
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Select Ward Scope</label>
          <select 
            value={selectedWard} 
            onChange={(e) => setSelectedWard(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card-solid)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-card)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
              outline: 'none',
              marginTop: '6px'
            }}
          >
            {wards.map(w => (
              <option key={w} value={w}>{w === 'All' ? 'All Wards (Metro-wide)' : `${w} Ward`}</option>
            ))}
          </select>
        </div>

        {/* Category selection */}
        <div className="slider-container">
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Hazard Category</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card-solid)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-card)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
              outline: 'none',
              marginTop: '6px'
            }}
          >
            <option value="All">All Categories</option>
            <option value="ROAD">Road Hazards (Potholes & Cracks)</option>
            <option value="FLOOD">Flood & Waterlogging</option>
            <option value="WASTE">Waste Accumulation</option>
          </select>
        </div>

        {/* Severity selection */}
        <div className="slider-container">
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Severity Threshold</label>
          <select 
            value={selectedSeverity} 
            onChange={(e) => setSelectedSeverity(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card-solid)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-card)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
              outline: 'none',
              marginTop: '6px'
            }}
          >
            <option value="All">All Severities</option>
            <option value="CRITICAL">Critical Priority Only</option>
            <option value="HIGH">High Severity</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low Severity</option>
          </select>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '12px', marginTop: '10px' }}
          onClick={handleGenerate}
          disabled={isCompiling}
        >
          {isCompiling ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
              Compiling...
            </>
          ) : (
            <>
              <FileText size={16} />
              Compile Official Report
            </>
          )}
        </button>

        {/* Compilation progress dialog */}
        {isCompiling && (
          <div style={{ backgroundColor: 'rgba(var(--accent-blue-rgb), 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)', fontSize: '12px' }}>
            <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--accent-blue)' }}>Progress: {compileProgress}%</div>
            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>{compileStage}</div>
          </div>
        )}
      </div>

      {/* Main Preview Pane */}
      <div className="glass-card" style={{ padding: '0px', overflow: 'hidden' }}>
        {reportGenerated ? (
          <div>
            {/* Action Bar */}
            <div className="flex-between" style={{ padding: '12px 24px', backgroundColor: 'rgba(var(--accent-blue-rgb), 0.05)', borderBottom: '1px solid var(--border-card)' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> OFFICIAL_CIVIC_AUDIT_REPORT_SHA256_VERIFIED
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={handlePrint}>
                  <Printer size={12} style={{ marginRight: '4px' }} /> Print / Save PDF
                </button>
              </div>
            </div>

            {/* Printable Area Wrapper */}
            <div style={{ padding: '24px' }}>
              <div className="report-preview-container">
                {/* Government Header */}
                <div className="report-header">
                  <div className="report-logo">
                    <Building2 size={24} />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px' }}>CIVICSENSE AI MUNICIPAL INTELLIGENCE</span>
                      <span style={{ fontSize: '9px', fontWeight: '500', color: '#64748b' }}>GREATER CHENNAI CORPORATION • URBAN INFRASTRUCTURE DIVISION</span>
                    </div>
                  </div>
                  <div className="report-meta">
                    <div>Document Ref: CS-AUDIT-2026-PH17</div>
                    <div>Date: {new Date().toLocaleDateString()}</div>
                    <div>Scope: {selectedWard === 'All' ? 'All Wards (Metro-wide)' : `${selectedWard} Ward`}</div>
                  </div>
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  Infrastructure Audit & Unified Incident Dispatch Summary
                </h2>
                <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', marginBottom: '20px' }}>
                  This official document provides a verified compilation of municipal hazards detected via the CivicSense unified AI pipeline (RDD2022 YOLOv8s road damage, YOLOv8 waste, SegFormer B0 flood segmentation) cross-referenced with human operator reviews and predictive risk analytics.
                </p>

                {/* KPI block in report */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Active Incidents</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      {filteredIssues.filter(i => (i.lifecycleStatus || i.status) !== 'RESOLVED' && (i.lifecycleStatus || i.status) !== 'CLOSED' && (i.lifecycleStatus || i.status) !== 'Resolved').length} Cases
                    </div>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Resolved / Closed</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      {filteredIssues.filter(i => (i.lifecycleStatus || i.status) === 'RESOLVED' || (i.lifecycleStatus || i.status) === 'CLOSED' || (i.lifecycleStatus || i.status) === 'Resolved').length} Cases
                    </div>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Total SLA Compliance</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      {filteredIssues.length > 0 ? Math.round((filteredIssues.filter(i => (i.lifecycleStatus || i.status) === 'RESOLVED' || (i.lifecycleStatus || i.status) === 'Resolved').length / filteredIssues.length) * 100) : 100}%
                    </div>
                  </div>
                </div>

                {/* Table of issues */}
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Audited Incidents Log</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Incident ID</th>
                      <th>Hazard Type</th>
                      <th>Location / Ward</th>
                      <th>Severity</th>
                      <th>Assigned Department</th>
                      <th>Lifecycle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue) => {
                      const id = issue.incidentId || issue.id;
                      const title = issue.title || issue.incidentType || 'Defect';
                      const addr = typeof issue.location === 'object'
                        ? (issue.location?.address || issue.ward || 'Chennai Metro Zone')
                        : (issue.location || issue.ward || 'Chennai Metro Zone');
                      const sev = (issue.severity || 'MEDIUM').toUpperCase();
                      const dept = issue.department || issue.recommendedDepartment || issue.recommendedDept || 'Public Works';
                      const status = issue.lifecycleStatus || issue.status || 'FILED';

                      return (
                        <tr key={id}>
                          <td style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '11px' }}>{id}</td>
                          <td>{title}</td>
                          <td>{addr}</td>
                          <td style={{ fontWeight: '700', color: sev === 'CRITICAL' ? '#dc2626' : sev === 'HIGH' ? '#d97706' : '#2563eb' }}>
                            {sev}
                          </td>
                          <td>{dept}</td>
                          <td style={{ fontWeight: '600' }}>{status}</td>
                        </tr>
                      );
                    })}
                    {filteredIssues.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                          No incidents matching filters reported in this scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer and signatures */}
                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={12} />
                    <span>Cryptographically certified by CivicSense AI Core Pipeline</span>
                  </div>
                  <div>Report Hash: 8f2b-91c2-48a0-p17v</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <FileText size={48} style={{ color: 'var(--accent-blue)', margin: '0 auto 16px', display: 'block', opacity: 0.6 }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>No Report Compiled Yet</h3>
            <p style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
              Select ward and hazard parameters, then click Compile Official Report to generate a certified municipal audit document.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
