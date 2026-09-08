import React, { useState, useEffect } from 'react';
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

export default function ReportGenerator({ issues = CHENNAI_HOTSPOTS }) {
  const [selectedWard, setSelectedWard] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileStage, setCompileStage] = useState('');
  const [reportGenerated, setReportGenerated] = useState(false);

  // Extract unique Wards
  const wards = ['All', ...new Set(issues.map(i => i.location.ward.split(' - ')[1] || i.location.ward))];

  const handleGenerate = () => {
    setIsCompiling(true);
    setCompileProgress(0);
    setReportGenerated(false);
    
    const stages = [
      { progress: 15, msg: 'Connecting to GIS spatial database...' },
      { progress: 45, msg: 'Aggregating computer vision YOLOv8 coordinates...' },
      { progress: 75, msg: 'Calculating Random Forest deterioration indices...' },
      { progress: 95, msg: 'Finalizing formal government letterhead layout...' },
      { progress: 100, msg: 'Report compilation completed successfully!' }
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
    }, 600);
  };

  // Filter issues based on choices
  const filteredIssues = issues.filter(issue => {
    const wardName = issue.location.ward.split(' - ')[1] || issue.location.ward;
    const matchesWard = selectedWard === 'All' || wardName === selectedWard;
    const matchesType = selectedType === 'All' || issue.type === selectedType;
    return matchesWard && matchesType;
  });

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

        {/* Defect selection */}
        <div className="slider-container">
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Defect Classification</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
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
            <option value="All">All Defects</option>
            <option value="Pothole">Potholes Only</option>
            <option value="Road Crack">Road Cracks Only</option>
            <option value="Waterlogging">Waterlogging Only</option>
            <option value="Garbage Accumulation">Garbage Only</option>
            <option value="Damaged Streetlight">Streetlights Only</option>
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
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> REPORT_COMPILED_SECURE_HASH_F821
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
                      <span style={{ fontSize: '16px', fontWeight: '800', tracking: '0.5px' }}>CIVICSENSE AI PORTAL</span>
                      <span style={{ fontSize: '9px', fontWeight: '500', color: '#64748b' }}>MINISTRY OF HOUSING & URBAN AFFAIRS</span>
                    </div>
                  </div>
                  <div className="report-meta">
                    <div>Document Ref: CS-REP-2026-8801</div>
                    <div>Date: {new Date().toLocaleDateString()}</div>
                    <div>Scope: {selectedWard === 'All' ? 'Metro-wide' : `${selectedWard} Ward`}</div>
                  </div>
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  Infrastructure Audit & Predictive Deterioration Summary
                </h2>
                <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', marginBottom: '20px' }}>
                  This document provides a compiled assessment of public infrastructure defects detected via automated computer vision (YOLOv8) models, alongside Random Forest calculated road pavement life indexes.
                </p>

                {/* KPI block in report */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Active Incidents</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{filteredIssues.filter(i => i.status !== 'Resolved').length} Cases</div>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Resolved/Archived</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{filteredIssues.filter(i => i.status === 'Resolved').length} Cases</div>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Total SLA Compliance</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      {filteredIssues.length > 0 ? Math.round((filteredIssues.filter(i => i.status === 'Resolved').length / filteredIssues.length) * 100) : 100}%
                    </div>
                  </div>
                </div>

                {/* Table of issues */}
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Detailed Incidents Log</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Incident ID</th>
                      <th>Defect Type</th>
                      <th>Location address</th>
                      <th>Severity</th>
                      <th>Assigned Agency</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue) => (
                      <tr key={issue.id}>
                        <td style={{ fontWeight: '600' }}>{issue.id}</td>
                        <td>{issue.type}</td>
                        <td>{issue.location.address}</td>
                        <td style={{ fontWeight: '600', color: issue.severity === 'Critical' ? '#dc2626' : issue.severity === 'High' ? '#d97706' : '#2563eb' }}>
                          {issue.severity}
                        </td>
                        <td>{issue.recommendedDept.split(' ')[0]}</td>
                        <td style={{ fontWeight: '600' }}>{issue.status}</td>
                      </tr>
                    ))}
                    {filteredIssues.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                          No defects matching filters reported in this scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Footer and signatures */}
                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={12} />
                    <span>Cryptographically certified by CivicSense AI Core</span>
                  </div>
                  <div>Report Hash: 52bf-a9d2-771c-f821</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <FileText size={48} style={{ color: 'var(--accent-blue)', margin: '0 auto 16px', display: 'block', opacity: 0.6 }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>No Report Compiled Yet</h3>
            <p style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
              Select your ward parameters and click the button to generate a structured government compliance summary.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
