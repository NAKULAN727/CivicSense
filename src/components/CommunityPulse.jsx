import React from 'react';
import { 
  Activity, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  Clock,
  Compass
} from 'lucide-react';
import { COMMUNITY_PULSE_DATA } from '../data/mockData';

export default function CommunityPulse({ currentStudyArea, pulseData }) {
  const data = pulseData || COMMUNITY_PULSE_DATA;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
      
      {/* Header */}
      <div className="flex-between">
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={17} style={{ color: 'var(--accent-blue)' }} />
            Community Pulse – {currentStudyArea?.name || data.location}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Real-time status indicators • Updated {data.updatedAt}
          </span>
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: '800',
          color: 'var(--success)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '2px 8px',
          borderRadius: '99px',
          textTransform: 'uppercase'
        }}>
          LIVE PULSE
        </span>
      </div>

      {/* Pulse Status Indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.indicators.map((item, idx) => (
          <div 
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card-solid)',
              border: '1px solid var(--border-card)',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px' }}>{item.color}</span>
              <span style={{ color: 'var(--text-primary)' }}>{item.text}</span>
            </div>

            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              color: item.level === 'critical' ? '#f43f5e' : item.level === 'high' ? '#ea580c' : item.level === 'moderate' ? '#eab308' : '#10b981',
              textTransform: 'uppercase'
            }}>
              {item.level}
            </span>
          </div>
        ))}
      </div>

      {/* AI Recommendation Box */}
      <div style={{
        backgroundColor: 'rgba(0, 168, 255, 0.06)',
        border: '1px solid rgba(0, 168, 255, 0.25)',
        borderRadius: '10px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: 'var(--accent-blue)' }}>
          <Sparkles size={15} style={{ color: 'var(--accent-purple)' }} />
          AI Recommendation
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4', fontWeight: '500' }}>
          “{data.aiRecommendation}”
        </p>
      </div>

    </div>
  );
}
