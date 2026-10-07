import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Send, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  User, 
  Activity, 
  Database,
  FileText,
  Layers,
  ChevronDown,
  ChevronUp,
  XCircle,
  HelpCircle,
  Hash
} from 'lucide-react';
import { 
  getIntegrationMode, 
  INTEGRATION_MODES, 
  getOfflineQueue, 
  getOfflineQueueStats, 
  syncOfflineQueue, 
  clearOfflineQueue,
  getTelemetryEvents
} from '../services/municipalIntegrationService';
import { 
  getAllSandboxWorkOrders, 
  clearSandboxWorkOrders, 
  updateWorkOrder 
} from '../services/municipalAdapters/sandboxMunicipalAdapter';
import { 
  getCurrentSession, 
  switchActiveSession, 
  DEMO_ACCOUNTS, 
  AUTH_ROLES, 
  hasPermission,
  AUTH_TYPE
} from '../services/authService';

export default function MunicipalOperationsPanel() {
  const [session, setSession] = useState(getCurrentSession());
  const [integrationMode, setIntegrationModeState] = useState(getIntegrationMode());
  const [stats, setStats] = useState(getOfflineQueueStats());
  const [queueItems, setQueueItems] = useState(getOfflineQueue());
  const [workOrders, setWorkOrders] = useState(getAllSandboxWorkOrders());
  const [telemetry, setTelemetry] = useState(getTelemetryEvents());
  const [isSyncing, setIsSyncing] = useState(false);
  const [simulateOutage, setSimulateOutage] = useState(false);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'queue' | 'telemetry'
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const refreshState = () => {
    setStats(getOfflineQueueStats());
    setQueueItems(getOfflineQueue());
    setWorkOrders(getAllSandboxWorkOrders());
    setTelemetry(getTelemetryEvents());
    setSession(getCurrentSession());
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchAccount = (userId) => {
    const newSession = switchActiveSession(userId);
    setSession(newSession);
    setStatusMessage(`Switched active session to: ${newSession.displayName} (${newSession.role})`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setStatusMessage("Synchronizing offline queue with Municipal Sandbox...");
    try {
      const res = await syncOfflineQueue({
        simulateNetworkFailure: simulateOutage
      });
      refreshState();
      setStatusMessage(`Sync complete: ${res.syncedCount} synced, ${res.failedCount} failed, ${res.conflictsCount} conflicts.`);
    } catch (e) {
      setStatusMessage(`Sync encountered error: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleStatusTransition = async (workOrderId, newStatus) => {
    if (!hasPermission('UPDATE_ADVANCED_LIFECYCLE', session) && (newStatus === 'COMPLETED' || newStatus === 'IN_PROGRESS')) {
      setStatusMessage(`Action Restricted: Role '${session.role}' cannot transition work order to '${newStatus}'. Supervisor approval required.`);
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    try {
      const res = await updateWorkOrder(workOrderId, {
        status: newStatus,
        actor: `${session.displayName} (${session.role})`,
        notes: `Manual status transition by ${session.displayName}`
      });
      refreshState();
      if (res.conflict) {
        setStatusMessage(`Conflict Detected on ${workOrderId}: ${res.message}`);
      } else {
        setStatusMessage(`Work order ${workOrderId} updated to: ${newStatus}`);
      }
    } catch (e) {
      setStatusMessage(`Update error: ${e.message}`);
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header & Integration Badge */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={20} style={{ color: 'var(--accent-blue)' }} />
            MUNICIPAL OPERATIONS & FIELD TELEMETRY DISPATCH
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Multi-Department Dispatch • Offline Resilient Queue • Idempotent Work-Order Lifecycle
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-blue" style={{ fontSize: '11px', padding: '6px 12px', fontWeight: '700' }}>
            MUNICIPAL INTEGRATION: {integrationMode}
          </span>
          <span className="badge badge-purple" style={{ fontSize: '11px', padding: '6px 12px' }}>
            {AUTH_TYPE}
          </span>
        </div>
      </div>

      {/* Operator Session & Role Selection Bar */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-card)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={16} style={{ color: 'var(--accent-blue)' }} />
          <span>
            <strong>Active Operator:</strong> {session.displayName} •{' '}
            <span style={{ 
              color: session.role === AUTH_ROLES.ADMIN ? '#10b981' : session.role === AUTH_ROLES.SUPERVISOR ? '#c084fc' : '#38bdf8',
              fontWeight: '700'
            }}>
              [{session.role}]
            </span>
          </span>
        </div>

        {/* Demo Account Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Switch Role:</span>
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.userId}
              onClick={() => handleSwitchAccount(acc.userId)}
              className="btn btn-secondary"
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                borderColor: session.userId === acc.userId ? 'var(--accent-blue)' : 'var(--border-card)',
                backgroundColor: session.userId === acc.userId ? 'rgba(0,168,255,0.1)' : 'transparent',
                color: session.userId === acc.userId ? 'var(--accent-blue)' : 'var(--text-secondary)'
              }}
            >
              {acc.role.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Status Notice Banner if present */}
      {statusMessage && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 168, 255, 0.08)',
          border: '1px solid rgba(0, 168, 255, 0.3)',
          borderRadius: '6px',
          color: 'var(--accent-blue)',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Activity size={14} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 5 Dynamic Metric Counters (Section 22) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.04)', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PENDING SYNC</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: stats.pendingSyncCount > 0 ? '#f59e0b' : 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.pendingSyncCount}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Local field queue</span>
        </div>

        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.04)', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SYNCED INCIDENTS</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: stats.syncedCount > 0 ? '#10b981' : 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.syncedCount}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Dispatched to sandbox</span>
        </div>

        <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.04)', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SYNC FAILED</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: stats.failedCount > 0 ? '#f43f5e' : 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.failedCount}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Retained for retry</span>
        </div>

        <div style={{ backgroundColor: 'rgba(0, 168, 255, 0.04)', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>WORK ORDERS</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: stats.workOrdersCount > 0 ? '#00a8ff' : 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.workOrdersCount}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sandbox records</span>
        </div>

        <div style={{ backgroundColor: 'rgba(192, 132, 252, 0.04)', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>HIGH PRIORITY</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: stats.highPriorityCount > 0 ? '#c084fc' : 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.highPriorityCount}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Urgent dispatch</span>
        </div>

      </div>

      {/* Network Outage Simulator & Sync Action Controls */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: simulateOutage ? '#f43f5e' : 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={simulateOutage} 
              onChange={(e) => setSimulateOutage(e.target.checked)} 
            />
            {simulateOutage ? <WifiOff size={14} color="#f43f5e" /> : <Wifi size={14} color="#10b981" />}
            <strong>Simulate Network Outage (Offline Queue Test)</strong>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-primary"
            onClick={handleSyncNow}
            disabled={isSyncing}
            style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin-icon' : ''} />
            {isSyncing ? 'Synchronizing...' : 'Sync Offline Queue'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs for Details */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-card)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('orders')}
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          Municipal Work Orders ({workOrders.length})
        </button>
        <button
          className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('queue')}
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          Offline Incident Queue ({queueItems.length})
        </button>
        <button
          className={`btn ${activeTab === 'telemetry' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('telemetry')}
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          Operational Telemetry ({telemetry.length})
        </button>
      </div>

      {/* TAB CONTENT 1: Municipal Work Orders */}
      {activeTab === 'orders' && (
        <div>
          {workOrders.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--border-card)' }}>
              No municipal work orders generated. Triage and dispatch incidents from the <strong>AI Detection Hub</strong>.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {workOrders.map((wo) => (
                <div 
                  key={wo.workOrderId}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '12px'
                  }}
                >
                  <div className="flex-between" style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{wo.title}</strong>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {wo.workOrderId} • Incident: {wo.incidentId}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={`badge ${wo.severity === 'HIGH' || wo.severity === 'CRITICAL' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                        {wo.severity}
                      </span>
                      <span className={`badge ${wo.status === 'COMPLETED' ? 'badge-green' : wo.status === 'IN_PROGRESS' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '10px' }}>
                        {wo.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <div><strong>Department:</strong> {wo.department}</div>
                    <div><strong>Ward:</strong> {wo.ward?.status || 'WARD ASSIGNMENT UNAVAILABLE'}</div>
                    <div><strong>Location:</strong> {wo.location?.status === 'AVAILABLE' ? `${wo.location.latitude}, ${wo.location.longitude}` : 'LOCATION UNAVAILABLE'}</div>
                    <div><strong>Operator Decision:</strong> {wo.operator?.decision}</div>
                  </div>

                  {wo.secondaryDepartment && (
                    <div style={{ fontSize: '11px', color: '#38bdf8' }}>
                      <strong>Secondary Advisory:</strong> {wo.secondaryDepartment}
                    </div>
                  )}

                  {/* Lifecycle Transitions for Work Order */}
                  <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Transition Status:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
                        <button
                          key={st}
                          className="btn btn-secondary"
                          onClick={() => handleStatusTransition(wo.workOrderId, st)}
                          style={{
                            padding: '3px 6px',
                            fontSize: '10px',
                            borderColor: wo.status === st ? 'var(--accent-blue)' : 'var(--border-card)',
                            color: wo.status === st ? 'var(--accent-blue)' : 'var(--text-secondary)'
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: Offline Incident Queue */}
      {activeTab === 'queue' && (
        <div>
          {queueItems.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--border-card)' }}>
              Offline queue is empty. Incidents pending synchronization will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {queueItems.map((item) => (
                <div 
                  key={item.queueId}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-card)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '11px'
                  }}
                >
                  <div>
                    <strong>{item.incidentPayload?.title || item.queueId}</strong>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Queued: {new Date(item.queuedAt).toLocaleTimeString()} • Attempts: {item.syncAttempts}
                    </div>
                    {item.lastError && (
                      <div style={{ color: '#f43f5e', fontSize: '10px', marginTop: '2px' }}>
                        Error: {item.lastError}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={`badge ${item.syncState === 'SYNCED' ? 'badge-green' : item.syncState === 'SYNC_FAILED' ? 'badge-red' : item.syncState === 'CONFLICT_REQUIRES_REVIEW' ? 'badge-purple' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                      {item.syncState}
                    </span>
                    {item.workOrderId && (
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {item.workOrderId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: Operational Telemetry Stream */}
      {activeTab === 'telemetry' && (
        <div>
          {telemetry.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--border-card)' }}>
              No telemetry events recorded yet. Perform image inference or sync operations to populate the stream.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
              {telemetry.slice().reverse().map((evt) => (
                <div 
                  key={evt.eventId}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-card)',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div className="flex-between">
                    <span style={{ fontWeight: '700', color: 'var(--accent-blue)' }}>{evt.eventType}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>EVENT TIME: {new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                    ID: {evt.eventId} • Operator: {evt.operatorId} • Mode: {evt.integrationMode}
                  </div>
                  {evt.notes && <div style={{ fontSize: '10px', color: 'var(--text-primary)' }}>{evt.notes}</div>}
                  {evt.error && <div style={{ fontSize: '10px', color: '#f43f5e' }}>{evt.error}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
