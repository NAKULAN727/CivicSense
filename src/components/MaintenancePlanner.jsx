import React from 'react';
import confetti from 'canvas-confetti';
import { 
  Check, 
  ArrowRight, 
  MapPin, 
  Clock, 
  Briefcase, 
  TrendingUp, 
  Award,
  AlertTriangle
} from 'lucide-react';

import { CHENNAI_HOTSPOTS } from '../data/mockData';

export default function MaintenancePlanner({ issues = CHENNAI_HOTSPOTS, updateIssueStatus = () => {} }) {
  // Categorize issues by status
  const pendingIssues = issues.filter(i => i.status === 'Pending Review');
  const inProgressIssues = issues.filter(i => i.status === 'Assigned / In Progress');
  const resolvedIssues = issues.filter(i => i.status === 'Resolved');

  const handleStatusTransition = (id, newStatus) => {
    updateIssueStatus(id, newStatus);
    if (newStatus === 'Resolved') {
      // Fire confetti animation
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#00a8ff', '#10b981', '#7c3aed']
      });
    }
  };

  const getPriorityColor = (severity) => {
    switch (severity) {
      case 'Critical': return '#ef4444';
      case 'High': return '#f59e0b';
      default: return '#00a8ff';
    }
  };

  const renderCard = (issue) => {
    const priorityColor = getPriorityColor(issue.severity);
    
    return (
      <div key={issue.id} className="kanban-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span className="card-tag" style={{ backgroundColor: 'rgba(var(--accent-blue-rgb), 0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
            {issue.id}
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
            {issue.severity}
          </span>
        </div>
        
        <h4 className="card-title">{issue.title}</h4>
        <p className="card-desc">{issue.description}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} style={{ color: 'var(--accent-blue)' }} />
            <span>{issue.location.address}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} style={{ color: 'var(--warning)' }} />
            <span>SLA: {issue.slaHours} hrs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Briefcase size={12} style={{ color: 'var(--accent-purple)' }} />
            <span>Route: {issue.recommendedDept.split(' ')[0]}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
          {issue.status === 'Pending Review' && (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '6px', fontSize: '11px' }}
              onClick={() => handleStatusTransition(issue.id, 'Assigned / In Progress')}
            >
              Dispatch Crew <ArrowRight size={12} style={{ marginLeft: '4px' }} />
            </button>
          )}
          
          {issue.status === 'Assigned / In Progress' && (
            <button 
              className="btn" 
              style={{ width: '100%', padding: '6px', fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
              onClick={() => handleStatusTransition(issue.id, 'Resolved')}
            >
              <Check size={12} style={{ marginRight: '4px' }} /> Resolve Defect
            </button>
          )}

          {issue.status === 'Resolved' && (
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
              <Award size={14} /> Compliance Verified
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
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pending Verification</div>
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
            <span>Pending Review</span>
            <span className="column-count" style={{ color: 'var(--danger)' }}>{pendingIssues.length}</span>
          </div>
          <div className="kanban-list">
            {pendingIssues.map(renderCard)}
            {pendingIssues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No pending reviews.
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
