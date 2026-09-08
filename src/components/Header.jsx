import React, { useState } from 'react';
import { 
  Sun, 
  Moon, 
  Bell, 
  Search, 
  ShieldAlert, 
  AlertTriangle, 
  Info,
  CheckCircle2
} from 'lucide-react';

export default function Header({ 
  theme, 
  toggleTheme, 
  notifications, 
  setNotifications, 
  activeTab,
  onNotificationClick
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.length;

  const tabTitles = {
    dashboard: 'Predictive Intelligence Command Center',
    detection: 'Satellite & Aerial Computer Vision (Sentinel-2)',
    map: 'Interactive GIS Spatial Risk Explorer (Chennai Metro)',
    predictor: 'Multi-Modal Risk Matrix & Prediction Engine',
    planner: 'Smart Department Dispatch & Emergency Response',
    reports: 'Government Compliance & Risk Intelligence Reports',
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <ShieldAlert size={16} />;
      case 'high':
        return <AlertTriangle size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const handleClearNotifications = (e) => {
    e.stopPropagation();
    setNotifications([]);
  };

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="header-title">{tabTitles[activeTab]}</h2>
        <div className="sys-badge">
          System Live
        </div>
      </div>

      <div className="header-right">
        <div className="search-bar">
          <Search size={16} className="text-muted" />
          <input type="text" placeholder="Search Pallikaranai, Velachery, alert IDs..." />
        </div>

        {/* Theme Toggle */}
        <button className="action-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications Icon */}
        <div style={{ position: 'relative' }}>
          <button 
            className="action-btn" 
            onClick={() => setShowNotifications(!showNotifications)}
            title="System Alert Center"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="badge-dot"></span>}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <span>Alert Center ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--accent-blue)', 
                      fontSize: '11px', 
                      fontWeight: '600',
                      cursor: 'pointer' 
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 8px', display: 'block' }} />
                    All systems nominal. No alerts.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`notification-item ${notif.severity}`}
                      onClick={() => {
                        if (onNotificationClick) onNotificationClick(notif.issueId);
                        setShowNotifications(false);
                      }}
                    >
                      <div className="notification-icon-wrapper">
                        {getSeverityIcon(notif.severity)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notification-title">{notif.title}</div>
                        <div className="notification-desc">{notif.description}</div>
                        <div className="notification-time">{notif.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile */}
        <div className="user-profile">
          <div className="avatar">C</div>
          <div className="user-info">
            <span className="user-name">Disaster Controller</span>
            <span className="user-role">GCC Command Center</span>
          </div>
        </div>
      </div>
    </header>
  );
}
