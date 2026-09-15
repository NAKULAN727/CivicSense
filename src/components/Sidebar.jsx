import React from 'react';
import { 
  LayoutDashboard, 
  Eye, 
  Map, 
  TrendingUp, 
  ClipboardList, 
  FileSpreadsheet,
  Activity,
  HeartPulse
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'civichealth', label: 'Civic Health', icon: HeartPulse },
    { id: 'detection', label: 'AI Detection Hub', icon: Eye },
    { id: 'map', label: 'Smart City GIS Map', icon: Map },
    { id: 'predictor', label: 'Predictive Analytics', icon: TrendingUp },
    { id: 'planner', label: 'Maintenance Planner', icon: ClipboardList },
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
            >
              <Icon size={18} />
              <span>{item.label}</span>
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
