import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Eye, 
  TrendingUp, 
  ClipboardList, 
  FileSpreadsheet,
  Activity,
  HeartPulse,
  ShieldCheck
} from 'lucide-react';
import { subscribeToOrchestration, getOrchestrationStats } from '../services/incidentOrchestrationService.js';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [stats, setStats] = useState(getOrchestrationStats());

  useEffect(() => {
    const unsubscribe = subscribeToOrchestration(({ stats: newStats }) => {
      setStats(newStats);
    });
    return unsubscribe;
  }, []);

  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Executive Dashboard', 
      icon: LayoutDashboard,
      badge: stats.criticalIncidents > 0 ? stats.criticalIncidents : null,
      badgeColor: '#ef4444' // Critical alert
    },
    { id: 'civichealth', label: 'Civic Health', icon: HeartPulse },
    { 
      id: 'detection', 
      label: 'AI Detection Hub', 
      icon: Eye,
      badge: stats.pendingReviews > 0 ? stats.pendingReviews : null,
      badgeColor: '#00a8ff' // Pending review
    },
    { id: 'validation', label: 'Real Image Validation', icon: ShieldCheck },
    { id: 'predictor', label: 'Predictive Analytics', icon: TrendingUp },
    { 
      id: 'planner', 
      label: 'Maintenance Planner', 
      icon: ClipboardList,
      badge: stats.totalIncidents > 0 ? stats.totalIncidents : null,
      badgeColor: '#10b981' // Active work items
    },
    { id: 'reports', label: 'Report Generator', icon: FileSpreadsheet },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon">
          <Activity size={20} />
        </div>
        <div className="logo-text">CivicSense AI</div>
      </div>
      
      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span style={{
                  backgroundColor: item.badgeColor || '#00a8ff',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <div>SECURE GOVT PORTAL</div>
        <div style={{ marginTop: '4px', opacity: 0.6 }}>v2.4-RELEASE</div>
      </div>
    </div>
  );
}
