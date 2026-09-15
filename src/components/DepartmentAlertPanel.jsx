import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  Database, 
  Info,
  Radio,
  FileCheck
} from 'lucide-react';
import { 
  generateDepartmentAlert, 
  updateAlertStatus, 
  getNextAllowedStatuses,
  checkLocalStorageAvailability 
} from '../services/departmentAlertService.js';

export default function DepartmentAlertPanel({ currentStudyArea, riskAssessment }) {
  const [alert, setAlert] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [persistenceNotice, setPersistenceNotice] = useState(null);

  // Generate or update alert whenever riskAssessment or currentStudyArea changes
  useEffect(() => {
    try {
      setErrorState(null);

      // Check localStorage availability upfront
      const isStorageOk = checkLocalStorageAvailability();
      if (!isStorageOk) {
        setPersistenceNotice("Local persistence unavailable — prototype session only.");
      } else {
        setPersistenceNotice(null);
      }

      if (riskAssessment) {
        const generated = generateDepartmentAlert(riskAssessment, currentStudyArea);
        if (generated.error) {
          setErrorState(generated.message);
        } else {
          setAlert(generated);
        }
      } else {
        // Await live Phase 4 Risk Assessment telemetry from AIRiskEngine
        setAlert(null);
      }
    } catch (err) {
      console.error("DepartmentAlertPanel generation error:", err);
      setErrorState("Alert generation encountered an error. Risk result preserved.");
    }
  }, [currentStudyArea, riskAssessment]);

  const handleStatusChange = (newStatus) => {
    if (!alert) return;
    try {
      const updated = updateAlertStatus(alert, newStatus);
      setAlert(updated);
      if (updated.persistenceNotice) {
        setPersistenceNotice(updated.persistenceNotice);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'NEW':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' };
      case 'ACKNOWLEDGED':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' };
      case 'ACTION REQUIRED':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' };
      case 'IN PROGRESS':
        return { bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc', border: 'rgba(192, 132, 252, 0.4)' };
      case 'RESOLVED':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.4)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.4)' };
    }
  };

  const getAlertTypeStyle = (type) => {
    switch (type) {
      case 'URGENT':
        return { bg: 'rgba(244, 63, 94, 0.2)', text: '#f43f5e', border: '#f43f5e' };
      case 'ACTION REQUIRED':
        return { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b', border: '#f59e0b' };
      case 'MONITORING':
        return { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', border: '#38bdf8' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#10b981' };
    }
  };

  if (errorState) {
    return (
      <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f43f5e', fontWeight: '700' }}>
          <AlertTriangle size={20} />
          <span>Department Alert System Warning</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          {errorState}
        </p>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock size={20} className="spin-icon" style={{ marginBottom: '8px' }} />
        <div>Initializing Department Alert & Response System...</div>
        <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--text-secondary)' }}>Awaiting telemetry stream from Phase 4 AI Flood Risk Engine...</div>
      </div>
    );
  }

  const statusStyle = getStatusBadgeStyle(alert.status);
  const alertTypeStyle = getAlertTypeStyle(alert.alertType);
  const nextActions = getNextAllowedStatuses(alert.status);

  return (
    <div className="glass-card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '20px', 
      padding: '24px',
      border: '1px solid var(--border-card)',
      position: 'relative'
    }}>

      {/* Header & Source Transparency Badges */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: alertTypeStyle.bg,
            border: `1px solid ${alertTypeStyle.border}`,
            color: alertTypeStyle.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              DEPARTMENT ALERT & RESPONSE SYSTEM
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Automated Civic Department Routing & Incident Status Management
            </p>
          </div>
        </div>

        {/* Mode Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '800', 
            color: '#38bdf8', 
            backgroundColor: 'rgba(56, 189, 248, 0.12)', 
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '2px 8px', 
            borderRadius: '99px' 
          }}>
            LIVE DATA
          </span>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '800', 
            color: '#f59e0b', 
            backgroundColor: 'rgba(245, 158, 11, 0.12)', 
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '2px 8px', 
            borderRadius: '99px' 
          }}>
            HISTORICAL REFERENCE
          </span>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '800', 
            color: '#c084fc', 
            backgroundColor: 'rgba(192, 132, 252, 0.15)', 
            border: '1px solid rgba(192, 132, 252, 0.4)',
            padding: '2px 8px', 
            borderRadius: '99px' 
          }}>
            PROTOTYPE WORKFLOW
          </span>
        </div>
      </div>

      {/* LocalStorage Persistence Warning Banner if needed */}
      {persistenceNotice && (
        <div style={{ 
          fontSize: '11px', 
          backgroundColor: 'rgba(245, 158, 11, 0.1)', 
          border: '1px dashed rgba(245, 158, 11, 0.3)', 
          color: '#f59e0b', 
          padding: '8px 12px', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Info size={14} /> {persistenceNotice}
        </div>
      )}

      {/* Main Alert Card Box */}
      <div style={{
        backgroundColor: 'var(--bg-card-solid)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>

        {/* Top Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Alert ID:</span>
            <strong style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontSize: '14px' }}>
              {alert.id}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Location:</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
              {alert.location}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Risk Score & Level:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ color: alertTypeStyle.text, fontSize: '14px' }}>
                {alert.riskScore} / 100
              </strong>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: alertTypeStyle.text,
                backgroundColor: alertTypeStyle.bg,
                border: `1px solid ${alertTypeStyle.border}`,
                padding: '2px 8px',
                borderRadius: '99px'
              }}>
                {alert.riskLevel}
              </span>
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Alert Type:</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              color: alertTypeStyle.text,
              backgroundColor: alertTypeStyle.bg,
              padding: '2px 8px',
              borderRadius: '6px',
              display: 'inline-block'
            }}>
              {alert.alertType}
            </span>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-card)' }} />

        {/* Department Routing Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Responsible Department:</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
              {alert.department}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Field Category:</span>
            <strong style={{ color: 'var(--accent-purple)', fontSize: '12px' }}>
              {alert.fieldCategory}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Trigger Mechanism:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {alert.trigger}
            </span>
          </div>
        </div>

        {/* Alert Reason Box */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-card)',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.4'
        }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Alert Rationale:</strong>
          {alert.reason}
        </div>

        {/* Evidence Checklist */}
        <div style={{
          backgroundColor: 'rgba(0, 168, 255, 0.03)',
          border: '1px solid rgba(0, 168, 255, 0.15)',
          borderRadius: '8px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Supporting Risk Evidence Telemetry
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '11px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>• NDWI water change:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{alert.evidence.ndwiWaterChange}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>• Recent water area:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{alert.evidence.recentWaterArea}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>• Baseline water area:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{alert.evidence.baselineWaterArea}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>• Flood risk score:</span>{' '}
              <strong style={{ color: alertTypeStyle.text }}>{alert.evidence.floodRiskScore}</strong>
            </div>
          </div>
        </div>

        {/* Status & Mode Footer Bar */}
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Status:</span>
            <span style={{
              fontSize: '12px',
              fontWeight: '800',
              color: statusStyle.text,
              backgroundColor: statusStyle.bg,
              border: `1px solid ${statusStyle.border}`,
              padding: '3px 12px',
              borderRadius: '99px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusStyle.text }} />
              {alert.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>System Mode: <strong style={{ color: 'var(--text-primary)' }}>{alert.mode}</strong></span>
            <span>•</span>
            <span>Timestamp: <strong style={{ color: 'var(--text-primary)' }}>{alert.createdAt}</strong></span>
          </div>
        </div>

      </div>

      {/* Prototype Workflow Controls */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed var(--border-card)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileCheck size={16} style={{ color: 'var(--accent-blue)' }} />
            Prototype Response Workflow Actions
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            * Simulated departmental action tracking
          </span>
        </div>

        {/* Buttons for Logically Valid Next Statuses */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {nextActions.map((act) => (
            <button
              key={act.status}
              className={`btn ${act.buttonClass || 'btn-primary'}`}
              onClick={() => handleStatusChange(act.status)}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {act.status === 'ACKNOWLEDGED' && <CheckCircle2 size={16} />}
              {act.status === 'ACTION REQUIRED' && <AlertTriangle size={16} />}
              {act.status === 'IN PROGRESS' && <Clock size={16} />}
              {act.status === 'RESOLVED' && <CheckCircle2 size={16} />}
              {act.status === 'NEW' && <RotateCcw size={16} />}
              {act.label}
              {act.status !== 'NEW' && <ArrowRight size={14} />}
            </button>
          ))}
        </div>

        {/* Status History Trail if available */}
        {alert.statusHistory && alert.statusHistory.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Workflow Audit Log:</span>{' '}
            {alert.statusHistory.map((h, i) => (
              <span key={i} style={{ marginRight: '10px' }}>
                [{h.timestamp}] {h.from} → <strong style={{ color: 'var(--text-primary)' }}>{h.to}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Explicit Disclaimer for No Fake Government Integration */}
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        borderTop: '1px solid var(--border-card)',
        paddingTop: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Info size={13} style={{ flexShrink: 0, color: 'var(--accent-blue)' }} />
        <span>
          <strong>Phase 5 — Department Alert & Response Prototype</strong>: System generates deterministic alerts and simulates departmental resolution workflows. No real emails, SMS messages, or government dispatches are sent.
        </span>
      </div>

    </div>
  );
}
