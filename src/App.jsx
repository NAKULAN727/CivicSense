import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AIDetectionHub from './components/AIDetectionHub';
import GISMapExplorer from './components/GISMapExplorer';
import PredictorDashboard from './components/PredictorDashboard';
import MaintenancePlanner from './components/MaintenancePlanner';
import ReportGenerator from './components/ReportGenerator';
import { MOCK_NOTIFICATIONS, CHENNAI_HOTSPOTS } from './data/mockData';
import './App.css';

export default function App() {
  // Global States
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [selectedZone, setSelectedZone] = useState(null);

  // Initialize theme attribute on load
  useEffect(() => {
    document.documentElement.setAttribute('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Notification click handler
  const handleNotificationClick = (issueId) => {
    setActiveTab('dashboard');
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main Panel Area */}
      <main className="main-content">
        <Header 
          theme={theme} 
          toggleTheme={toggleTheme} 
          notifications={notifications}
          setNotifications={setNotifications}
          activeTab={activeTab}
          onNotificationClick={handleNotificationClick}
        />
        
        {/* Content Body */}
        <div className="content-body">
          {activeTab === 'dashboard' && (
            <DashboardView 
              theme={theme}
            />
          )}
          
          {activeTab === 'detection' && (
            <AIDetectionHub />
          )}
          
          {activeTab === 'map' && (
            <div style={{ height: 'calc(100vh - 120px)' }}>
              <GISMapExplorer 
                theme={theme}
                selectedZone={selectedZone}
                setSelectedZone={setSelectedZone}
              />
            </div>
          )}
          
          {activeTab === 'predictor' && (
            <PredictorDashboard />
          )}
          
          {activeTab === 'planner' && (
            <MaintenancePlanner />
          )}
          
          {activeTab === 'reports' && (
            <ReportGenerator />
          )}
        </div>
      </main>
    </div>
  );
}
