// CivicSense AI - Phase 12 Municipal Adapter Facade
// Routes dispatch requests safely to Sandbox or configured Enterprise ERP.

import { config } from '../config/environment.js';
import { MUNICIPAL_INTEGRATION_MODES } from '../config/constants.js';
import * as sandboxAdapter from './sandboxAdapter.js';
import * as enterpriseErpAdapter from './enterpriseErpAdapter.js';

export function getActiveAdapter() {
  if (config.municipal.mode === MUNICIPAL_INTEGRATION_MODES.ERP) {
    return enterpriseErpAdapter;
  }
  return sandboxAdapter;
}

export function getAdapterMode() {
  return config.municipal.mode;
}

export async function createWorkOrder(tenantId, incident, options) {
  const adapter = getActiveAdapter();
  return adapter.createWorkOrder(tenantId, incident, options);
}

export async function getWorkOrder(tenantId, workOrderId) {
  const adapter = getActiveAdapter();
  if (adapter.getWorkOrder) {
    return adapter.getWorkOrder(tenantId, workOrderId);
  }
  return null;
}

export async function updateWorkOrder(tenantId, workOrderId, updates) {
  const adapter = getActiveAdapter();
  if (adapter.updateWorkOrder) {
    return adapter.updateWorkOrder(tenantId, workOrderId, updates);
  }
  return null;
}

export async function getAllWorkOrders(tenantId) {
  const adapter = getActiveAdapter();
  if (adapter.getAllWorkOrders) {
    return adapter.getAllWorkOrders(tenantId);
  }
  return [];
}
