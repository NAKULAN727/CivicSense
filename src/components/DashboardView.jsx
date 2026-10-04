import React, { useState } from 'react';
import GISMapExplorer from './GISMapExplorer';
import SatelliteAnalysisPanel from './SatelliteAnalysisPanel';
import AIRiskEngine from './AIRiskEngine';
import PredictiveRiskPanel from './PredictiveRiskPanel';
import ActionRecommendationPanel from './ActionRecommendationPanel';
import EnvironmentalDataPanel from './EnvironmentalDataPanel';
import DepartmentAlertPanel from './DepartmentAlertPanel';
import CommunityPulse from './CommunityPulse';
import { 
  Activity, 
  Clock, 
  RefreshCw, 
  MapPin
} from 'lucide-react';
import { STUDY_AREAS } from '../data/mockData';

export default function DashboardView({ 
  theme, 
  currentStudyArea: propCurrentStudyArea, 
  setCurrentStudyArea: propSetCurrentStudyArea,
  visualDetections = null 
}) {
  // Central Study Area State (Default: Pallikaranai–Velachery)
  const [localStudyArea, setLocalStudyArea] = useState(STUDY_AREAS.pallikaranai_velachery);
  const currentStudyArea = propCurrentStudyArea || localStudyArea;
  const setCurrentStudyArea = propSetCurrentStudyArea || setLocalStudyArea;
  const [selectedZone, setSelectedZone] = useState(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [waterAnalysisData, setWaterAnalysisData] = useState(null);

  // Trigger alert modal / panel focusing on selected zone or study area
  const handleSendAlertClick = (zone) => {
    setActiveAlert({
      area: zone ? zone.name : currentStudyArea.name,
      riskScore: zone ? zone.riskScore : 84,
      riskLevel: zone ? zone.riskLevel : "HIGH",
      reason: zone ? zone.supportingData : `Satellite-detected water extent expansion and heavy rainfall risk over ${currentStudyArea.name}.`,
      responsibleDept: zone ? zone.responsibleDept : "Municipal Drainage / Disaster Management"
    });
  };

  const handleRefreshData = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastAnalysisTime(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Top Banner / System Metadata Bar */}
      <div className="glass-card" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(0, 168, 255, 0.3)'
          }}>
            <Activity size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-header)' }}>
              CivicSense AI – Predictive Community Intelligence Platform
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Metropolitan Spatial Analytics & Early Warning Command Center •</span>
              <MapPin size={12} style={{ color: 'var(--accent-blue)' }} />
              <strong style={{ color: 'var(--text-primary)' }}>Active Study Area: {currentStudyArea.name} ({currentStudyArea.region})</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-card-solid)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
            <Clock size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>Analysis Last Updated: <strong style={{ color: 'var(--text-primary)' }}>{lastAnalysisTime}</strong></span>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} /> Refresh Stream
          </button>
        </div>
      </div>

      {/* Narrative Pipeline Flow Indicator Banner */}
      <div style={{
        backgroundColor: 'rgba(0, 168, 255, 0.03)',
        border: '1px solid var(--border-card)',
        borderRadius: '12px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        fontSize: '11px',
        fontWeight: '700'
      }}>
        <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Intelligence Pipeline:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: '#38bdf8' }}>🛰️ Satellite NDWI Data ({currentStudyArea.name})</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#38bdf8' }}>🌤️ Weather & Elevation Feeds</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#c084fc' }}>🤖 AI Multi-Modal Fusion</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#facc15' }}>🔍 Risk Detection</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#f43f5e' }}>📊 Risk Score</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#c084fc' }}>📈 Predictive 72h Forecast</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#10b981' }}>🛡️ Action Recommendation</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#fb923c' }}>🏢 Dept Identification</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#f43f5e' }}>🚨 Alert</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#10b981' }}>✅ Recommended Action</span>
        </div>
      </div>

      {/* SECTION 1: Interactive GIS Map & Command Center */}
      <div style={{ height: '620px' }}>
        <GISMapExplorer 
          theme={theme}
          currentStudyArea={currentStudyArea}
          setCurrentStudyArea={setCurrentStudyArea}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          onSendAlertClick={handleSendAlertClick}
        />
      </div>

      {/* SECTION 2: Two Column Grid - Satellite Analysis & AI Risk Engine */}
      <div className="grid-2" style={{ gap: '24px', marginBottom: 0 }}>
        {/* Left Column: Satellite Change Detection (Passes currentStudyArea) */}
        <SatelliteAnalysisPanel 
          currentStudyArea={currentStudyArea}
          onWaterAnalysisComplete={(wData) => {
            setWaterAnalysisData(wData);
          }}
        />

        {/* Right Column: AI Risk Engine Preview */}
        <AIRiskEngine 
          currentStudyArea={currentStudyArea}
          waterAnalysisData={waterAnalysisData}
          onAnalysisComplete={(assessment, time) => {
            setRiskAssessment(assessment);
            setLastAnalysisTime(time);
          }}
        />
      </div>

      {/* SECTION 3: Phase 3 Environmental Data Section */}
      <EnvironmentalDataPanel 
        currentStudyArea={currentStudyArea}
      />

      {/* SECTION 4: Phase 6 Predictive Flood Risk & Forecast Panel */}
      <PredictiveRiskPanel 
        currentStudyArea={currentStudyArea}
        riskAssessment={riskAssessment}
      />

      {/* SECTION 5: Phase 7 Action Recommendation & Intervention Panel */}
      <ActionRecommendationPanel 
        currentStudyArea={currentStudyArea}
        riskAssessment={riskAssessment}
        visualDetections={visualDetections}
      />

      {/* SECTION 6: Two Column Grid - Department Alert Panel & Community Pulse */}
      <div className="grid-2" style={{ gap: '24px', marginBottom: 0 }}>
        {/* Left Column: Automatic Department Alert Panel */}
        <DepartmentAlertPanel 
          currentStudyArea={currentStudyArea}
          riskAssessment={riskAssessment}
        />

        {/* Right Column: Community Pulse & Recommendation */}
        <CommunityPulse 
          currentStudyArea={currentStudyArea}
        />
      </div>

    </div>
  );
}
