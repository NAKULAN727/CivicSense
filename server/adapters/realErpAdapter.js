// CivicSense AI - Phase 11 Real Municipal ERP Adapter
// Strictly disabled by default. Protected against accidental mock dispatch.

import { config } from '../config/environment.js';
import { ERROR_CODES } from '../config/constants.js';

export const ERP_CONNECTOR_STATUS = {
  NOT_CONFIGURED: 'ERP CONNECTOR: NOT CONFIGURED',
  CONNECTED: 'CONNECTED',
  DISABLED: 'DISABLED'
};

/**
 * Returns current live ERP connector status.
 */
export function getErpConnectorStatus() {
  const isConfigured = Boolean(
    config.municipal.erpBaseUrl && 
    config.municipal.erpClientId && 
    config.municipal.erpClientSecret
  );

  if (!isConfigured) {
    return {
      status: ERP_CONNECTOR_STATUS.NOT_CONFIGURED,
      isAvailable: false,
      message: 'Real municipal ERP connector is not configured. Enterprise institutional authorization required.'
    };
  }

  return {
    status: ERP_CONNECTOR_STATUS.CONNECTED,
    isAvailable: true,
    endpoint: config.municipal.erpBaseUrl
  };
}

/**
 * Validates external ERP work-order response schema.
 */
export function validateErpResponse(response) {
  if (!response || typeof response !== 'object') {
    return { isValid: false, reason: 'Empty or non-object response from ERP' };
  }

  const { workOrderId, status, department, timestamp } = response;

  if (!workOrderId || typeof workOrderId !== 'string') {
    return { isValid: false, reason: "Missing or invalid 'workOrderId' in ERP response" };
  }
  if (!status || typeof status !== 'string') {
    return { isValid: false, reason: "Missing or invalid 'status' in ERP response" };
  }
  if (!department || typeof department !== 'string') {
    return { isValid: false, reason: "Missing or invalid 'department' in ERP response" };
  }
  if (!timestamp) {
    return { isValid: false, reason: "Missing 'timestamp' in ERP response" };
  }

  return { isValid: true };
}

/**
 * Sends a work-order dispatch request to an external municipal ERP.
 * Strictly throws ERP_NOT_CONFIGURED if not configured.
 */
export async function createWorkOrder(tenantId, incident, options = {}) {
  const status = getErpConnectorStatus();
  if (!status.isAvailable) {
    const err = new Error(`${ERP_CONNECTOR_STATUS.NOT_CONFIGURED}. Live municipal dispatch requires authorized institutional infrastructure.`);
    err.status = 503;
    err.code = ERROR_CODES.ERP_NOT_CONFIGURED;
    throw err;
  }

  // Bounded retry loop for transient network/5xx failures
  const maxRetries = config.municipal.erpMaxRetries;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.municipal.erpTimeoutMs);

      const response = await fetch(`${config.municipal.erpBaseUrl}/work-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': config.municipal.erpClientId,
          'Authorization': `Bearer ${config.municipal.erpClientSecret}`,
          'X-Tenant-Id': tenantId,
          'X-Idempotency-Key': options.idempotencyKey
        },
        body: JSON.stringify({
          incidentId: incident.id,
          tenantId,
          department: incident.recommendedDepartment,
          severity: incident.severity,
          priority: incident.priority,
          location: incident.location,
          approvedBy: options.approvedBy
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle non-transient 4xx errors - DO NOT RETRY
      if (response.status >= 400 && response.status < 500) {
        const clientErr = new Error(`ERP rejected request with status ${response.status}`);
        clientErr.status = response.status;
        clientErr.code = 'ERP_REQUEST_REJECTED';
        throw clientErr;
      }

      if (!response.ok) {
        throw new Error(`ERP returned HTTP ${response.status}`);
      }

      const json = await response.json();
      const validation = validateErpResponse(json);

      if (!validation.isValid) {
        const malformedErr = new Error(`ERP response malformed: ${validation.reason}`);
        malformedErr.status = 502;
        malformedErr.code = ERROR_CODES.ERP_RESPONSE_INVALID;
        throw malformedErr;
      }

      return json;
    } catch (e) {
      lastError = e;
      // Do not retry 4xx errors
      if (e.status >= 400 && e.status < 500) {
        throw e;
      }
      if (attempt === maxRetries) {
        break;
      }
    }
  }

  const failureErr = new Error(`Failed to dispatch to ERP after ${maxRetries} attempts: ${lastError?.message}`);
  failureErr.status = 502;
  failureErr.code = ERROR_CODES.ERP_TIMEOUT;
  throw failureErr;
}

