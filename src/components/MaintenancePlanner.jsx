import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Check, 
  ArrowRight, 
  MapPin, 
  Clock, 
  Briefcase, 
  TrendingUp, 
  Award,
  AlertTriangle,
  DollarSign,
  ShieldCheck
} from 'lucide-react';

import { CHENNAI_HOTSPOTS } from '../data/mockData';
import { 
  getAllIncidents, 
  subscribeToOrchestration, 
  updateIncidentLifecycle 
} from '../services/incidentOrchestrationService';

export default function MaintenancePlanner({ issues: propIssues, updateIssueStatus = () => {} }) {
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

  // Normalizer helper for status categorization
  const isPending = (i) => {
    const s = (i.lifecycleStatus || i.status || '').toUpperCase();
    return s.includes('PENDING') || s === 'DETECTED' || s === 'AWAITING_REVIEW' || s === 'ACCEPTED' || s === 'FILED';
  };

  const isInProgress = (i) => {
    const s = (i.lifecycleStatus || i.status || '').toUpperCase();
    return s.includes('PROGRESS') || s === 'DEPARTMENT_ASSIGNED' || s === 'IN_PROGRESS';
  };

  const isResolved = (i) => {
    const s = (i.lifecycleStatus || i.status || '').toUpperCase();
    return s.includes('RESOLVED') || s === 'VERIFIED' || s === 'CLOSED';
  };

  // Categorize issues by status
  const pendingIssues = activeIssues.filter(isPending);
  const inProgressIssues = activeIssues.filter(isInProgress);
  const resolvedIssues = activeIssues.filter(isResolved);

  const handleStatusTransition = (id, newStatus) => {
    // Determine canonical lifecycle status
    const targetLifecycle = newStatus === 'Resolved' ? 'RESOLVED' : 'IN_PROGRESS';
    
    // Update central orchestration registry
    updateIncidentLifecycle(id, targetLifecycle);

    // Call legacy prop if provided
    updateIssueStatus(id, newStatus);

    // Update local state fallback
    setActiveIssues(prev => prev.map(item => {
      if (item.id === id || item.incidentId === id) {
        return {
          ...item,
          status: newStatus,
          lifecycleStatus: targetLifecycle
        };
      }
      return item;
    }));

    if (newStatus === 'Resolved') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#00a8ff', '#10b981', '#7c3aed']
      });
    }
  };

  const getPriorityColor = (severity) => {
    const sev = (severity || '').toUpperCase();
    switch (sev) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f59e0b';
      case 'MEDIUM': return '#00a8ff';
      default: return '#10b981';
    }
  };

  const renderCard = (issue) => {
    const id = issue.incidentId || issue.id;
    const priorityColor = getPriorityColor(issue.severity || issue.priority);
    const title = issue.title || issue.incidentType || 'Civic Issue';
    const desc = issue.description || issue.sourceEvidence || issue.recommendations?.primaryAction || 'Scheduled municipal task';
    
    const address = typeof issue.location === 'object' 
      ? (issue.location?.address || (issue.location?.latitude ? `${issue.location.latitude.toFixed(4)}, ${issue.location.longitude.toFixed(4)}` : issue.ward || 'Chennai Metro Zone'))
      : (issue.location || issue.ward || 'Chennai Metro Zone');

    const sla = issue.slaHours || issue.recommendations?.slaHours || (issue.severity === 'CRITICAL' ? 4 : issue.severity === 'HIGH' ? 12 : 24);
    const dept = issue.department || issue.recommendedDepartment || issue.recommendedDept || 'Highways / Public Works';
    const tier = issue.recommendations?.workOrderTier || 'Tier 1 Dispatch';
    const cost = issue.recommendations?.estimatedCostInr ? `₹${issue.recommendations.estimatedCostInr.toLocaleString()}` : null;

    const currentLifecycle = issue.lifecycleStatus || issue.status || 'FILED';

    return (
      <div key={id} className="kanban-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span className="card-tag" style={{ backgroundColor: 'rgba(var(--accent-blue-rgb), 0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-card)', fontSize: '10px' }}>
            {id}
          </span>
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            fontSize: '11px', 
            fontWeight: '700',
            color: priorityColor
          }}>
            <span className="priority-dot" style={{ backgroundColor: priorityColor }} />
            {issue.severity || issue.priority || 'MEDIUM'}
          </span>
        </div>
        
        <h4 className="card-title" style={{ fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>{title}</h4>
        <p className="card-desc" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>{desc}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <span>SLA: <strong>{sla} hrs</strong> • Tier: <strong>{tier}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={12} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept}</span>
          </div>
          {cost && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span>Est Budget: <strong>{cost}</strong></span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
          {isPending(issue) && (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '6px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              onClick={() => handleStatusTransition(id, 'Assigned / In Progress')}
            >
              Dispatch Crew <ArrowRight size={12} />
            </button>
          )}
          
          {isInProgress(issue) && (
            <button 
              className="btn" 
              style={{ width: '100%', padding: '6px', fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              onClick={() => handleStatusTransition(id, 'Resolved')}
            >
              <Check size={12} /> Resolve Defect
            </button>
          )}

          {isResolved(issue) && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '4px', 
              color: 'var(--success)', 
              fontSize: '11px', 
              fontWeight: '700',
              width: '100%',
              padding: '4px 0'
            }}>
              <Award size={14} /> Municipal SLA Verified
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* SLA summary stats bar */}
      <div className="grid-3" style={{ marginBottom: '0px' }}>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', width: '40px', height: '40px', borderRadius: '8px' }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pending Dispatch</div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>{pendingIssues.length} Incidents</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning)', width: '40px', height: '40px', borderRadius: '8px' }}>
            <Clock size={18} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active in Dispatch</div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>{inProgressIssues.length} Work Orders</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)', width: '40px', height: '40px', borderRadius: '8px' }}>
            <Check size={18} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Resolved Target</div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>{resolvedIssues.length} Closed</div>
          </div>
        </div>
      </div>

      {/* Main Kanban Columns */}
      <div className="kanban-board">
        {/* Column 1: Pending */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <span>Pending Dispatch / Assigned</span>
            <span className="column-count" style={{ color: 'var(--danger)' }}>{pendingIssues.length}</span>
          </div>
          <div className="kanban-list">
            {pendingIssues.map(renderCard)}
            {pendingIssues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No pending work orders.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <span>Assigned / In Progress</span>
            <span className="column-count" style={{ color: 'var(--warning)' }}>{inProgressIssues.length}</span>
          </div>
          <div className="kanban-list">
            {inProgressIssues.map(renderCard)}
            {inProgressIssues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No active work orders.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Resolved */}
        <div className="kanban-column">
          <div className="kanban-column-header">
            <span>Resolved</span>
            <span className="column-count" style={{ color: 'var(--success)' }}>{resolvedIssues.length}</span>
          </div>
          <div className="kanban-list">
            {resolvedIssues.map(renderCard)}
            {resolvedIssues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No issues resolved in this shift.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
