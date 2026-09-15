import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Info,
  Layers,
  Wrench,
  Siren,
  ListChecks
} from 'lucide-react';
import { generateActionRecommendations } from '../services/actionRecommendationService.js';
import { calculatePredictiveRisk } from '../services/predictiveRiskService.js';

export default function ActionRecommendationPanel({ currentStudyArea, riskAssessment, weatherData }) {
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    if (riskAssessment) {
      const pred = calculatePredictiveRisk(riskAssessment, weatherData);
      const rec = generateActionRecommendations({
        riskAssessment,
        prediction: pred,
        studyArea: currentStudyArea
      });
      setRecommendation(rec);
    } else {
      setRecommendation(null);
    }
  }, [currentStudyArea, riskAssessment, weatherData]);

  if (!recommendation) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock size={20} className="spin-icon" style={{ marginBottom: '8px' }} />
        <div>Initializing Action Recommendation & Intervention Intelligence...</div>
        <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--text-secondary)' }}>
          Awaiting telemetry stream from Phase 4 Risk Engine & Phase 6 Forecast...
        </div>
      </div>
    );
  }

  if (recommendation.error) {
    return (
      <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontWeight: '700' }}>
          <AlertTriangle size={20} />
          <span>Intervention Intelligence Notice</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          {recommendation.message}
        </p>
      </div>
    );
  }

  const {
    priority,
    priorityColor,
    responseWindow,
    departmentInfo,
    actions,
    reasoning,
    telemetrySummary,
    mode,
    formattedTime
  } = recommendation;

  const getActionTypeIcon = (type) => {
    switch (type) {
      case 'DISPATCH': return Siren;
      case 'INSPECTION': return ListChecks;
      case 'COORDINATION': return Building2;
      default: return Wrench;
    }
  };

  return (
    <div className="glass-card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '20px', 
      padding: '24px',
      border: '1px solid var(--border-card)'
    }}>

      {/* Header & Source Transparency Badges */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              ACTION RECOMMENDATION & INTERVENTION INTELLIGENCE
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Telemetry-Derived Departmental Action Planning & Response Time Window
            </p>
          </div>
        </div>

        {/* Source Badges */}
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
            color: '#10b981', 
            backgroundColor: 'rgba(16, 185, 129, 0.15)', 
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '2px 8px', 
            borderRadius: '99px' 
          }}>
            PROTOTYPE RECOMMENDATION
          </span>
        </div>
      </div>

      {/* Priority & Response Time Window Banner */}
      <div style={{
        backgroundColor: 'var(--bg-card-solid)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            padding: '8px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            border: `1.5px solid ${priorityColor}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Intervention Priority</span>
            <strong style={{ fontSize: '16px', fontWeight: '800', color: priorityColor, fontFamily: 'var(--font-header)', marginTop: '2px' }}>
              {priority} PRIORITY
            </strong>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Recommended Response Window</div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} style={{ color: 'var(--accent-blue)' }} />
              {responseWindow}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
          <div>Target Study Area</div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{currentStudyArea?.name || 'Selected Area'}</strong>
        </div>
      </div>

      {/* Department Routing Consistency Card */}
      <div style={{
        backgroundColor: 'rgba(0, 168, 255, 0.03)',
        border: '1px solid rgba(0, 168, 255, 0.15)',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        fontSize: '12px'
      }}>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Primary Department:</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{departmentInfo.primaryDepartment}</strong>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Field Response Category:</span>
          <strong style={{ color: 'var(--accent-purple)', fontSize: '12px' }}>{departmentInfo.fieldCategory}</strong>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Secondary Authority:</span>
          <span style={{ color: 'var(--text-secondary)' }}>{departmentInfo.secondaryDepartment}</span>
        </div>
      </div>

      {/* Recommended Intervention Actions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-blue)' }}>
          Recommended Departmental Interventions ({actions.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {actions.map((act) => {
            const IconComponent = getActionTypeIcon(act.type);
            return (
              <div 
                key={act.id}
                style={{
                  backgroundColor: 'var(--bg-card-solid)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px'
                }}
              >
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-card)',
                  color: 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <IconComponent size={18} />
                </div>

                <div style={{ flex: 1 }}>
                  <div className="flex-between" style={{ marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {act.title}
                    </h4>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      color: act.urgency === 'CRITICAL' ? '#f43f5e' : act.urgency === 'HIGH' ? '#ef4444' : '#f59e0b',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-card)'
                    }}>
                      {act.urgency}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {act.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transparent Reasoning Box */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed var(--border-card)',
        borderRadius: '10px',
        padding: '14px 16px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: '1.4'
      }}>
        <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
          Intervention Rationale & Telemetry Basis:
        </strong>
        {reasoning}
      </div>

      {/* Prototype Recommendation System Disclaimer */}
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
          <strong>Phase 7 — Decision-Support Prototype</strong>: Recommended interventions are derived deterministically from Phase 4 and Phase 6 telemetry. They serve as decision-support guidance and do not represent live emergency dispatches. Evaluated at {formattedTime}.
        </span>
      </div>

    </div>
  );
}
