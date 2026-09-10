import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Send, 
  CheckCircle2, 
  Clock, 
  Building2, 
  FileText, 
  Code, 
  Mail, 
  MessageSquare, 
  AlertTriangle,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { INITIAL_DEPARTMENT_ALERT } from '../data/mockData';

export default function DepartmentAlertPanel({ currentStudyArea, activeAlertData, onAlertSent }) {
  const alertData = activeAlertData || INITIAL_DEPARTMENT_ALERT;

  const [alertSent, setAlertSent] = useState(false);
  const [sentDetails, setSentDetails] = useState(null);
  const [showApiModal, setShowApiModal] = useState(false);

  const handleSendAlert = () => {
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const details = {
      alertId: `CSAI-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      department: alertData.responsibleDept || "Municipal Drainage Department",
      time: currentTime,
      status: "Sent",
      targetEmail: "disaster.response@gcc.tn.gov.in",
      targetSMS: "+91 44 2561 9000 (GCC Emergency Command)"
    };

    setSentDetails(details);
    setAlertSent(true);

    if (onAlertSent) {
      onAlertSent(details);
    }
  };

  const handleResetAlert = () => {
    setAlertSent(false);
    setSentDetails(null);
  };

  return (
    <div className="glass-card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '20px', 
      padding: '24px',
      border: alertSent ? '1px solid var(--success)' : '1px solid rgba(244, 63, 94, 0.4)',
      boxShadow: alertSent ? '0 0 20px rgba(16, 185, 129, 0.15)' : '0 0 20px rgba(244, 63, 94, 0.15)'
    }}>
      
      {/* Header */}
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: alertSent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: alertSent ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {alertSent ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              Automatic Department Alert System
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Automated threshold trigger for critical urban risk incidents
            </span>
          </div>
        </div>

        <button 
          onClick={() => setShowApiModal(!showApiModal)}
          style={{
            background: 'rgba(0,168,255,0.06)',
            border: '1px solid var(--border-card)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            color: 'var(--accent-blue)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: '600'
          }}
        >
          <Code size={13} /> View API Payload
        </button>
      </div>

      {!alertSent ? (
        /* Pre-dispatch Active Risk State */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Main Emergency Banner */}
          <div style={{
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '12px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '800', color: '#f43f5e' }}>
              🚨 HIGH FLOOD RISK DETECTED
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Area:</span> <br/>
                <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{alertData.area || "Pallikaranai–Velachery"}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Risk Score:</span> <br/>
                <strong style={{ color: '#f43f5e', fontSize: '16px' }}>{alertData.riskScore || 84}/100</strong> (HIGH)
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Reason:</strong> {alertData.reason || "Heavy rainfall + low elevation + historical flood pattern + satellite-detected water expansion."}
            </div>

            <div style={{ fontSize: '12px', padding: '8px 12px', backgroundColor: 'var(--bg-card-solid)', borderRadius: '6px', border: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={15} style={{ color: 'var(--accent-purple)' }} />
              <span>Responsible Department: <strong style={{ color: 'var(--accent-purple)' }}>{alertData.responsibleDept || "Municipal Drainage / Disaster Management"}</strong></span>
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            className="btn btn-primary"
            onClick={handleSendAlert}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              boxShadow: '0 6px 20px rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none'
            }}
          >
            <Send size={16} /> Send Department Alert
          </button>
        </div>
      ) : (
        /* Post-dispatch Confirmation State */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '800', color: 'var(--success)' }}>
              <CheckCircle2 size={24} /> Alert Sent Successfully
            </div>

            <div style={{ height: '1px', backgroundColor: 'rgba(16, 185, 129, 0.2)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Department:</span> <br/>
                <strong style={{ color: 'var(--text-primary)' }}>{sentDetails.department}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Alert ID:</span> <br/>
                <strong style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{sentDetails.alertId}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Time:</span> <br/>
                <strong style={{ color: 'var(--text-primary)' }}>{sentDetails.time}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Status:</span> <br/>
                <span style={{ 
                  backgroundColor: 'rgba(16, 185, 129, 0.2)', 
                  color: 'var(--success)', 
                  fontWeight: '800', 
                  padding: '2px 8px', 
                  borderRadius: '99px',
                  fontSize: '11px'
                }}>
                  {sentDetails.status}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--bg-card-solid)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={12} style={{ color: 'var(--accent-blue)' }} /> Emailed to: <strong>{sentDetails.targetEmail}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={12} style={{ color: 'var(--success)' }} /> SMS dispatched to: <strong>{sentDetails.targetSMS}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary"
              onClick={handleResetAlert}
              style={{ flex: 1, padding: '10px', fontSize: '12px' }}
            >
              Simulate New Alert Cycle
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowApiModal(true)}
              style={{ padding: '10px 14px', fontSize: '12px' }}
            >
              <Code size={14} /> Payload
            </button>
          </div>
        </div>
      )}

      {/* Interactive REST API Webhook Code Modal */}
      {showApiModal && (
        <div style={{
          backgroundColor: '#050a14',
          border: '1px solid var(--accent-blue)',
          borderRadius: '10px',
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#38bdf8'
        }}>
          <div className="flex-between" style={{ color: '#fff', fontWeight: '700', marginBottom: '8px' }}>
            <span>// REST Webhook Payload Structure (Twilio / SendGrid Ready)</span>
            <button onClick={() => setShowApiModal(false)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>✕</button>
          </div>
          <pre style={{ overflowX: 'auto', color: '#a7f3d0', margin: 0 }}>
{`POST /api/v1/alerts/dispatch
Headers: { "Authorization": "Bearer CSAI_SECRET_TOKEN" }
Payload: {
  "alertId": "${sentDetails?.alertId || 'CSAI-2026-X94B'}",
  "location": "Pallikaranai–Velachery",
  "riskType": "Flood Risk",
  "score": 84,
  "department": "Municipal Drainage / Disaster Management",
  "recommendedAction": "Inspect drainage and prepare flood response resources",
  "channels": ["EMAIL", "SMS", "PUSH_NOTIFICATION"],
  "timestamp": "${new Date().toISOString()}"
}`}
          </pre>
        </div>
      )}

      {/* Note about real system integration */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
        * Prototype simulation: Architecture is structured for direct REST integration with SMS gateways, municipal email distribution, and emergency worker dispatch push APIs.
      </div>

    </div>
  );
}
