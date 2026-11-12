import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import CivicHealthPanel from './components/CivicHealthPanel';
import AIDetectionHub from './components/AIDetectionHub';
import RealImageValidationTool from './components/RealImageValidationTool';
import PredictorDashboard from './components/PredictorDashboard';
import MaintenancePlanner from './components/MaintenancePlanner';
import ReportGenerator from './components/ReportGenerator';
import { subscribeToOrchestration, getAllActiveIncidents } from './services/incidentOrchestrationService';
import { MOCK_NOTIFICATIONS, CHENNAI_HOTSPOTS, STUDY_AREAS } from './data/mockData';
import './App.css';

export default function App() {
  // Global States
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [selectedZone, setSelectedZone] = useState(null);
  const [currentStudyArea, setCurrentStudyArea] = useState(STUDY_AREAS.pallikaranai_velachery);
  const [visualDetections, setVisualDetections] = useState(null);
  const [centralIncidents, setCentralIncidents] = useState(getAllActiveIncidents());

  // Initialize theme attribute on load
  useEffect(() => {
    document.documentElement.setAttribute('theme', theme);
  }, [theme]);

  // Subscribe to central incident registry updates (Phase 17 Unified Pipeline)
  useEffect(() => {
    const unsubscribe = subscribeToOrchestration(({ incidents }) => {
      setCentralIncidents(incidents);
    });
    return unsubscribe;
  }, []);

  // Clear visual detections on study area change to prevent stale data bleed
  useEffect(() => {
    setVisualDetections(null);
  }, [currentStudyArea?.id]);

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
              currentStudyArea={currentStudyArea}
              setCurrentStudyArea={setCurrentStudyArea}
              visualDetections={visualDetections}
              centralIncidents={centralIncidents}
            />
          )}

          {activeTab === 'civichealth' && (
            <CivicHealthPanel 
              currentStudyArea={currentStudyArea}
              setCurrentStudyArea={setCurrentStudyArea}
              visualDetections={visualDetections}
              centralIncidents={centralIncidents}
            />
          )}
          
          {activeTab === 'detection' && (
            <AIDetectionHub 
              onVisualDetectionsChange={setVisualDetections}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'validation' && (
            <RealImageValidationTool />
          )}

          {activeTab === 'predictor' && (
            <PredictorDashboard 
              incidents={centralIncidents}
            />
          )}
          
          {activeTab === 'planner' && (
            <MaintenancePlanner 
              issues={centralIncidents.length > 0 ? centralIncidents : CHENNAI_HOTSPOTS}
            />
          )}
          
          {activeTab === 'reports' && (
            <ReportGenerator 
              issues={centralIncidents.length > 0 ? centralIncidents : CHENNAI_HOTSPOTS}
            />
          )}
        </div>
      </main>
    </div>
  );
}
