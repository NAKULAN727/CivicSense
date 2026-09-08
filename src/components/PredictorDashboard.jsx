import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  Sliders, 
  Activity, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  TrendingDown,
  Wrench,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { predictDeteriorationCurve } from '../data/mockData';

export default function PredictorDashboard() {
  // Simulator input parameters
  const [trafficVolume, setTrafficVolume] = useState(6); // 1-10 scale
  const [annualRainfall, setAnnualRainfall] = useState(1500); // 500-3000 mm
  const [roadAge, setRoadAge] = useState(2); // 0-10 years
  const [asphaltQuality, setAsphaltQuality] = useState('Standard Bitumen');

  // Compute curve data dynamically using useMemo for performance
  const data = useMemo(() => {
    return predictDeteriorationCurve(trafficVolume, annualRainfall, roadAge, asphaltQuality);
  }, [trafficVolume, annualRainfall, roadAge, asphaltQuality]);

  // Find when the road drops below 50 (Critical Threshold)
  const criticalYearInfo = useMemo(() => {
    const failurePoint = data.find(d => d.health <= 50);
    if (failurePoint) {
      return {
        year: failurePoint.year,
        ageAtFailure: failurePoint.predictedAge,
        exists: true
      };
    }
    return { exists: false };
  }, [data]);

  // Dynamic calculations for maintenance metrics
  const maintenanceMetrics = useMemo(() => {
    let degradationSpeed = 'Normal';
    const finalHealth = data[data.length - 1].health;
    const initialHealth = data[0].health;
    const totalDeduction = initialHealth - finalHealth;

    if (totalDeduction > 65) {
      degradationSpeed = 'Accelerated (High Risk)';
    } else if (totalDeduction < 35) {
      degradationSpeed = 'Extended Lifetime (Excellent)';
    } else {
      degradationSpeed = 'Linear / Expected';
    }

    // Cost calculations
    // Delaying maintenance results in 4.5x higher cost (resurfacing vs sealing)
    const baseSealingCost = 150000;
    const baseResurfacingCost = 720000;
    
    // Scaling costs with traffic and rainfall factors
    const costMultiplier = (1 + (trafficVolume - 5) * 0.1) * (1 + (annualRainfall - 1000) * 0.0002);
    const preventativeCost = Math.round(baseSealingCost * costMultiplier);
    const correctiveCost = Math.round(baseResurfacingCost * costMultiplier);
    const potentialSaving = correctiveCost - preventativeCost;

    // Recommended maintenance timeframe
    let optimalWindow = 'Immediate Action Required';
    if (criticalYearInfo.exists) {
      const windowYears = Math.max(0.5, criticalYearInfo.year - 2);
      optimalWindow = `Within ${windowYears.toFixed(1)} years (Before Year ${criticalYearInfo.year})`;
    } else {
      optimalWindow = 'Scheduled Routine Review (in 4-5 years)';
    }

    return {
      degradationSpeed,
      preventativeCost,
      correctiveCost,
      potentialSaving,
      optimalWindow,
      totalDeduction
    };
  }, [data, trafficVolume, annualRainfall, criticalYearInfo]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview Intro */}
      <div className="glass-card" style={{ padding: '16px 24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} style={{ color: 'var(--accent-blue)' }} /> Random Forest Regression Deterioration Model
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          This simulator models surface degradation (Pavement Condition Index - PCI) based on a Random Forest regressor trained on 15,000 km of road inspection history. Adjust parameters below to run real-time predictive cycles.
        </p>
      </div>

      <div className="grid-2-1" style={{ alignItems: 'start' }}>
        {/* Left Side: Sliders Controls */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={16} /> Environmental & Design Inputs
          </h4>
          
          <div style={{ height: '1px', background: 'var(--border-card)' }} />

          <div className="slider-group">
            {/* Traffic Slider */}
            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Traffic Load Index</span>
                <span className="slider-value">{trafficVolume}/10 ({Math.round(trafficVolume * 4500)} vehicles/day)</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={trafficVolume} 
                onChange={(e) => setTrafficVolume(parseInt(e.target.value))} 
                className="custom-range"
              />
            </div>

            {/* Rainfall Slider */}
            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Annual Rainfall</span>
                <span className="slider-value">{annualRainfall} mm</span>
              </div>
              <input 
                type="range" 
                min="500" 
                max="3000" 
                step="100" 
                value={annualRainfall} 
                onChange={(e) => setAnnualRainfall(parseInt(e.target.value))} 
                className="custom-range"
              />
            </div>

            {/* Road Age Slider */}
            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Current Road Age</span>
                <span className="slider-value">{roadAge} Years</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                value={roadAge} 
                onChange={(e) => setRoadAge(parseInt(e.target.value))} 
                className="custom-range"
              />
            </div>

            {/* Material Grade Selection */}
            <div className="slider-container">
              <div className="slider-header">
                <span className="slider-label">Asphalt / Material Grade</span>
              </div>
              <select 
                value={asphaltQuality} 
                onChange={(e) => setAsphaltQuality(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-card-solid)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none',
                  marginTop: '4px'
                }}
              >
                <option value="Eco-Mix Asphalt">Eco-Mix Asphalt (Recycled Binder)</option>
                <option value="Standard Bitumen">Standard Bitumen (VG-30/40 Grade)</option>
                <option value="Polymer Modified Asphalt">Polymer Modified Asphalt (PMA - Premium)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: Diagnostics Metrics */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '360px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Activity size={16} style={{ color: 'var(--accent-purple)' }} /> Predictive Analysis
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-card)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Degradation Rate</span>
                <span style={{ fontWeight: '700', color: maintenanceMetrics.degradationSpeed.includes('High') ? 'var(--danger)' : 'var(--success)' }}>
                  {maintenanceMetrics.degradationSpeed}
                </span>
              </div>
              
              <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-card)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Failure Risk Threshold (&lt;50)</span>
                <span style={{ fontWeight: '700' }}>
                  {criticalYearInfo.exists ? `In ${criticalYearInfo.year} years (Age ${criticalYearInfo.ageAtFailure})` : 'Not within 10 years'}
                </span>
              </div>

              <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-card)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Optimal Sealing Window</span>
                <span style={{ fontWeight: '700', color: 'var(--warning)' }}>
                  {maintenanceMetrics.optimalWindow}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            {/* ROI Cost saving banner */}
            <div style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start'
            }}>
              <DollarSign size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Preventative Action Cost Benefit</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4' }}>
                  Sealing now costs <strong>₹{maintenanceMetrics.preventativeCost.toLocaleString()}</strong>, saving 
                  <strong style={{ color: 'var(--success)' }}> ₹{maintenanceMetrics.potentialSaving.toLocaleString()}</strong> compared to complete repaving (₹{maintenanceMetrics.correctiveCost.toLocaleString()}) later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Line Chart */}
      <div className="glass-card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: '700' }}>10-Year Pavement Degradation Index (PCI) Prediction</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Simulating road health deterioration curve under current parameters</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} /> Safe (&gt;80)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} /> Warning (50-80)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} /> Critical (&lt;50)
            </span>
          </div>
        </div>

        <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" />
              <XAxis 
                dataKey="year" 
                stroke="var(--text-secondary)" 
                fontSize={11}
                label={{ value: 'Simulation Timeline (Years into Future)', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)', fontSize: 11 }}
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="var(--text-secondary)" 
                fontSize={11}
                label={{ value: 'Health Index (PCI %)', angle: -90, position: 'insideLeft', offset: 5, fill: 'var(--text-secondary)', fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card-solid)', 
                  borderColor: 'var(--border-card)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value) => [`${value}%`, 'Predicted PCI']}
                labelFormatter={(label) => `Year +${label}`}
              />
              {/* Reference threshold lines */}
              <ReferenceLine y={50} stroke="var(--danger)" strokeDasharray="3 3" label={{ value: 'Critical Failure Level (50%)', fill: 'var(--danger)', fontSize: 10, position: 'top' }} />
              <Line 
                type="monotone" 
                dataKey="health" 
                stroke="var(--accent-blue)" 
                strokeWidth={3} 
                dot={{ r: 5, fill: 'var(--bg-card-solid)', stroke: 'var(--accent-blue)', strokeWidth: 2 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
