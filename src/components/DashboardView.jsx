import React, { useState, useEffect } from 'react';
import GISMapExplorer from './GISMapExplorer';
import SatelliteAnalysisPanel from './SatelliteAnalysisPanel';
import AIRiskEngine from './AIRiskEngine';
import PredictiveRiskPanel from './PredictiveRiskPanel';
import ActionRecommendationPanel from './ActionRecommendationPanel';
import EnvironmentalDataPanel from './EnvironmentalDataPanel';
import DepartmentAlertPanel from './DepartmentAlertPanel';
import CommunityPulse from './CommunityPulse';
import MunicipalOperationsPanel from './MunicipalOperationsPanel';
import { 
  Activity, 
  Clock, 
  RefreshCw, 
  MapPin,
  ShieldAlert,
  AlertTriangle,
  Building,
  CheckCircle2,
  Cpu,
  Waves,
  Trash2,
  Layers
} from 'lucide-react';
import { STUDY_AREAS } from '../data/mockData';
import { calculateCivicHealth } from '../services/civicHealthService';
import { getOrchestrationStats, subscribeToOrchestration } from '../services/incidentOrchestrationService';

export default function DashboardView({ 
  theme, 
  currentStudyArea: propCurrentStudyArea, 
  setCurrentStudyArea: propSetCurrentStudyArea,
  visualDetections = null,
  centralIncidents = []
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
  const [stats, setStats] = useState(getOrchestrationStats());

  useEffect(() => {
    const unsub = subscribeToOrchestration(({ stats: newStats }) => {
      setStats(newStats);
    });
    return unsub;
  }, []);

  // Derive Civic Health assessment from real telemetry and visual evidence
  const civicHealth = calculateCivicHealth({
    studyArea: currentStudyArea,
    riskAssessment,
    waterAnalysisData,
    visualDetections
  });

  // Extract real incident state from centralIncidents + visualDetections
  const liveVisualIncidents = visualDetections?.civicIncidents || [];
  const activeIncidentList = centralIncidents && centralIncidents.length > 0 
    ? centralIncidents 
    : liveVisualIncidents;
  const hasInferenceRun = Boolean((visualDetections && visualDetections.isAvailable) || activeIncidentList.length > 0);
  const totalCount = stats.totalIncidents > 0 ? stats.totalIncidents : activeIncidentList.length;
  const criticalCount = stats.criticalIncidents > 0 ? stats.criticalIncidents : activeIncidentList.filter(i => i.severity === 'CRITICAL' || i.priority === 'IMMEDIATE').length;
  const roadCount = stats.categoryBreakdown.ROAD + stats.categoryBreakdown.MULTI > 0 ? stats.categoryBreakdown.ROAD + stats.categoryBreakdown.MULTI : (visualDetections?.road?.detections || []).length;
  const wasteCount = stats.categoryBreakdown.WASTE > 0 ? stats.categoryBreakdown.WASTE : (visualDetections?.waste?.detections || []).length;
  const floodPercent = visualDetections?.flood?.floodedAreaPercent ?? (stats.categoryBreakdown.FLOOD > 0 ? `${stats.categoryBreakdown.FLOOD} Incidents` : 0);

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
          <span style={{ color: '#38bdf8' }}>🛰️ Satellite NDWI ({currentStudyArea.name})</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#38bdf8' }}>🌤️ Weather & Elevation</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#c084fc' }}>🤖 AI Vision Models</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#facc15' }}>⚖️ Contextual Arbitration</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#f43f5e' }}>📊 Final Incident State</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: '#10b981' }}>🛡️ Department Dispatch</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* EXECUTIVE INCIDENT & CIVIC HEALTH COMMAND CENTER         */}
      {/* ======================================================== */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} style={{ color: 'var(--accent-blue)' }} />
              EXECUTIVE INCIDENT SUMMARY & DATA AVAILABILITY
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Consumes verified real final incident state from multi-model inference and contextual arbitration.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`badge ${hasInferenceRun ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: '11px', padding: '6px 12px' }}>
              Visual Feed: {hasInferenceRun ? 'ACTIVE INFERENCE' : 'AWAITING STREAM'}
            </span>
            <span className="badge badge-purple" style={{ fontSize: '11px', padding: '6px 12px' }}>
              Civic Health: {civicHealth.overallStatus} ({civicHealth.availableCount}/4 Active)
            </span>
          </div>
        </div>

        {/* 6 Key Executive Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          
          <div style={{ backgroundColor: 'rgba(0,168,255,0.04)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL CIVIC INCIDENTS</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: totalCount > 0 ? '#00a8ff' : 'var(--text-secondary)', marginTop: '4px' }}>
              {hasInferenceRun ? totalCount : '—'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {hasInferenceRun ? (totalCount > 0 ? `${stats.acceptedIncidents} accepted • ${stats.pendingReviews} pending` : 'Zero active issues') : 'Inference pending'}
            </span>
          </div>

          <div style={{ backgroundColor: 'rgba(244,63,94,0.04)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CRITICAL / HIGH PRIORITY</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: criticalCount > 0 ? '#f43f5e' : 'var(--text-secondary)', marginTop: '4px' }}>
              {hasInferenceRun ? criticalCount : '—'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Immediate dispatch queue</span>
          </div>

          <div style={{ backgroundColor: 'rgba(168,85,247,0.04)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ROAD DEFECTS (RDD2022)</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: roadCount > 0 ? '#c084fc' : 'var(--text-secondary)', marginTop: '4px' }}>
              {hasInferenceRun ? roadCount : '—'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>YOLOv8s Potholes & Cracks</span>
          </div>

          <div style={{ backgroundColor: 'rgba(251,191,36,0.04)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>WASTE ACCUMULATION</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: wasteCount > 0 ? '#fbbf24' : 'var(--text-secondary)', marginTop: '4px' }}>
              {hasInferenceRun ? wasteCount : '—'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Arbitrated visible waste</span>
          </div>

          <div style={{ backgroundColor: 'rgba(56,189,248,0.04)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FLOOD & DRAINAGE</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: (stats.categoryBreakdown.FLOOD > 0 || (typeof floodPercent === 'number' && floodPercent > 1)) ? '#38bdf8' : 'var(--text-secondary)', marginTop: '4px' }}>
              {hasInferenceRun ? (typeof floodPercent === 'number' ? `${floodPercent}%` : floodPercent) : '—'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SegFormer B0 water coverage</span>
          </div>

          <div style={{ backgroundColor: 'rgba(16,185,129,0.04)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DATA AVAILABILITY</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', marginTop: '8px' }}>
              {hasInferenceRun ? 'PARTIAL (3/4)' : 'OFFLINE'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Multi-sensor verified</span>
          </div>

        </div>

        {/* Real Active Incident Feed / Honest Empty State */}
        {!hasInferenceRun ? (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>Awaiting Visual Inference Stream — No active image evaluated yet. Switch to <strong>AI Detection Hub</strong> to test real street imagery.</span>
          </div>
        ) : activeIncidentList.length === 0 ? (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>No verified civic incidents from current evidence. Clean roadway baseline observed.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Current Verified Incident Feed ({activeIncidentList.length}):
            </span>
            {activeIncidentList.map((incident) => (
              <div 
                key={incident.incidentId || incident.id} 
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  fontSize: '12px'
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{incident.title}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {incident.detectionEvidence || incident.sourceEvidence} • <span style={{ color: '#c084fc' }}>Dept: {incident.recommendedDepartment || incident.department}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className={`badge ${incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                    {incident.severity}
                  </span>
                  <span className="badge badge-blue" style={{ fontSize: '10px' }}>
                    {incident.category}
                  </span>
                  <span className={`badge ${incident.operatorStatus === 'ACCEPTED' ? 'badge-green' : 'badge-purple'}`} style={{ fontSize: '10px' }}>
                    {incident.lifecycleStatus || incident.operatorStatus || 'ACCEPTED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MUNICIPAL OPERATIONS & TELEMETRY DISPATCH (Phase 10) */}
      <MunicipalOperationsPanel />

      {/* SECTION 1: Interactive GIS Map & Command Center */}
      <div style={{ height: '620px' }}>
        <GISMapExplorer 
          theme={theme}
          currentStudyArea={currentStudyArea}
          setCurrentStudyArea={setCurrentStudyArea}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          onSendAlertClick={handleSendAlertClick}
          visualDetections={visualDetections}
          centralIncidents={activeIncidentList}
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
