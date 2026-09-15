// CivicSense AI - Action Recommendation & Intervention Intelligence Service (Phase 7)
// Deterministic Rule-Based Decision Support Engine
// Converts Phase 4 Flood Risk Index & Phase 6 Short-Term Forecast Telemetry into Actionable Interventions

import { getDepartmentMapping } from '../data/departmentData.js';

/**
 * Generates Deterministic Action Recommendations based on runtime risk telemetry
 * 
 * @param {Object} riskAssessment Phase 4 Current Risk Assessment Object
 * @param {Object} prediction Phase 6 Short-Term Predictive Risk Object
 * @param {Object} studyArea Target Study Area Object
 * @returns {Object} Deterministic Action Recommendation Payload
 */
export const generateActionRecommendations = ({ riskAssessment, prediction, studyArea }) => {
  if (!riskAssessment || typeof riskAssessment.score !== 'number') {
    return {
      error: true,
      mode: 'RECOMMENDATION UNAVAILABLE',
      message: 'Insufficient live risk telemetry to generate department action recommendations.'
    };
  }

  const score = riskAssessment.score;
  const level = riskAssessment.level || 'MODERATE';
  const studyAreaName = studyArea?.name || riskAssessment.studyArea || 'Pallikaranai–Velachery';
  const trend = prediction?.trend || 'STABLE';
  const predictedScore48h = typeof prediction?.predictedScore48h === 'number' ? prediction.predictedScore48h : score;

  // 1. Determine Intervention Priority
  let priority = 'ROUTINE';
  let priorityColor = '#10b981';
  
  if (score >= 81 || (score >= 70 && trend === 'INCREASING')) {
    priority = 'IMMEDIATE';
    priorityColor = '#f43f5e';
  } else if (score >= 61 || trend === 'INCREASING') {
    priority = 'HIGH';
    priorityColor = '#ef4444';
  } else if (score >= 31) {
    priority = 'MEDIUM';
    priorityColor = '#f59e0b';
  } else {
    priority = 'ROUTINE';
    priorityColor = '#10b981';
  }

  // 2. Determine Response Time Window
  let responseWindow = 'ROUTINE MONITORING (48–72 Hours)';
  if (priority === 'IMMEDIATE') {
    responseWindow = 'IMMEDIATE RESPONSE (Within 1–2 Hours)';
  } else if (priority === 'HIGH' && trend === 'INCREASING') {
    responseWindow = 'PRIORITY DISPATCH (Within 4–6 Hours)';
  } else if (priority === 'HIGH') {
    responseWindow = 'DISPATCH WITHIN 12 HOURS';
  } else if (priority === 'MEDIUM' && trend === 'INCREASING') {
    responseWindow = 'PREVENTIVE ACTION WITHIN 24 HOURS';
  } else if (priority === 'MEDIUM') {
    responseWindow = 'INSPECTION WITHIN 48 HOURS';
  }

  // 3. Department Routing from departmentData.js
  const category = 'FLOOD';
  const departmentInfo = getDepartmentMapping(category, studyArea || riskAssessment?.studyArea || studyAreaName);

  // 4. Generate Deterministic Action Items
  const actions = [];

  if (score >= 81 || (score >= 70 && trend === 'INCREASING')) {
    actions.push({
      id: 'ACT-01',
      title: 'Emergency Drainage Clearance & Pumping Deployment',
      description: `Deploy heavy-duty mobile dewatering sumps to primary arterial bottlenecks in ${studyAreaName}. Clear immediate blockage in storm-water feeder channels.`,
      type: 'DISPATCH',
      urgency: 'CRITICAL'
    });
    actions.push({
      id: 'ACT-02',
      title: 'Inter-Agency Emergency Command Activation',
      description: `Activate emergency response protocol with ${departmentInfo.secondaryDepartment}. Establish field communications and resource staging.`,
      type: 'COORDINATION',
      urgency: 'HIGH'
    });
    actions.push({
      id: 'ACT-03',
      title: 'Low-Lying Inundation Patrol & Public Safety Advisory',
      description: `Dispatch municipal field inspectors to low-elevation zones to monitor water accumulation and issue localized drainage safety warnings.`,
      type: 'INSPECTION',
      urgency: 'HIGH'
    });
  } else if (score >= 61 || trend === 'INCREASING') {
    actions.push({
      id: 'ACT-01',
      title: 'Priority Storm-Water Drainage Inspection',
      description: `Inspect primary culverts, drainage sluice gates, and feeder channels across ${studyAreaName} to remove silt and debris before peak rainfall.`,
      type: 'INSPECTION',
      urgency: 'HIGH'
    });
    actions.push({
      id: 'ACT-02',
      title: 'Standby Equipment & Dewatering Pump Readiness',
      description: `Verify operational readiness of municipal pumping stations and pre-stage backup generators at key low-lying sumps.`,
      type: 'DISPATCH',
      urgency: 'MEDIUM'
    });
    actions.push({
      id: 'ACT-03',
      title: 'Department Alert Routing Notice',
      description: `Issue structured alert notice to ${departmentInfo.primaryDepartment} field team for ${departmentInfo.fieldCategory}.`,
      type: 'COORDINATION',
      urgency: 'MEDIUM'
    });
  } else if (score >= 31) {
    actions.push({
      id: 'ACT-01',
      title: 'Routine Channel & Culvert Maintenance Review',
      description: `Schedule routine clearance of roadside gutters and secondary drainage outlets in ${studyAreaName}.`,
      type: 'MAINTENANCE',
      urgency: 'MEDIUM'
    });
    actions.push({
      id: 'ACT-02',
      title: 'Continuous Telemetry & NDWI Saturation Monitoring',
      description: `Monitor satellite NDWI water change and Open-Meteo precipitation forecasts over the 48-hour observation window.`,
      type: 'MONITORING',
      urgency: 'ROUTINE'
    });
  } else {
    actions.push({
      id: 'ACT-01',
      title: 'Standard Environmental & Drainage Surveillance',
      description: `Maintain standard baseline surveillance across ${studyAreaName}. No emergency intervention required under current conditions.`,
      type: 'MONITORING',
      urgency: 'ROUTINE'
    });
  }

  // 5. Transparent Telemetry Reasoning String
  const rainDetails = riskAssessment.components?.rainfall?.details || 'Precipitation telemetry normal';
  const elevDetails = riskAssessment.components?.elevation?.details || 'Elevation normal';
  
  let reasoning = `Current flood risk index is ${level} (${score}/100) for ${studyAreaName}. `;
  if (trend === 'INCREASING') {
    reasoning += `48-hour short-term projection indicates an INCREASING trend (estimated at ${predictedScore48h}/100). `;
  } else if (trend === 'DECREASING') {
    reasoning += `Short-term forecast indicates a DECREASING trend due to low precipitation pressure. `;
  } else {
    reasoning += `Short-term forecast indicates STABLE conditions over the 72h window. `;
  }
  reasoning += `Intervention is derived from rainfall telemetry (${rainDetails}) and terrain profile (${elevDetails}).`;

  return {
    error: false,
    studyAreaName,
    priority,
    priorityColor,
    responseWindow,
    category,
    departmentInfo,
    actions,
    reasoning,
    telemetrySummary: {
      currentScore: score,
      currentLevel: level,
      predictedScore48h,
      trend,
      rainfall: rainDetails,
      elevation: elevDetails
    },
    mode: 'PROTOTYPE RECOMMENDATION',
    timestamp: new Date().toISOString(),
    formattedTime: new Date().toLocaleTimeString('en-IN')
  };
};
