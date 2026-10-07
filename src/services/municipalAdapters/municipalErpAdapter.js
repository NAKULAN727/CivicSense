// CivicSense AI - Real Municipal ERP Adapter Contract (Phase 10)
// Architectural adapter contract for future enterprise municipal ERP integration.
// 
// CRITICAL SECURITY & GOVERNANCE REQUIREMENTS:
// 1. This adapter is DISABLED by default.
// 2. Default state: "ERP CONNECTOR: NOT CONFIGURED".
// 3. ZERO hardcoded API keys, passwords, client secrets, or private certificates.
// 4. In production, frontend clients must NEVER talk directly to municipal ERP backends with client-side secrets.
//    Instead, production dispatch must route through an authenticated backend proxy (/api/municipal-dispatch).
// 
// Report message:
// "Production ERP connector requires a secure backend integration layer."

export const MUNICIPAL_INTEGRATION_MODE = "ERP";

export const ERP_CONNECTOR_STATUS = {
  NOT_CONFIGURED: "ERP CONNECTOR: NOT CONFIGURED",
  BACKEND_REQUIRED: "Production ERP connector requires a secure backend integration layer.",
  CONNECTED: "CONNECTED"
};

/**
 * Configuration descriptor (populated only when a real backend proxy is connected).
 * Kept strictly unconfigured in the frontend repository to prevent credential leaks.
 */
let erpConfig = {
  isConfigured: false,
  endpointUrl: null,
  authHeaderPresent: false
};

/**
 * Returns the current connector status.
 */
export function getErpConnectorStatus() {
  if (!erpConfig.isConfigured || !erpConfig.endpointUrl) {
    return {
      status: ERP_CONNECTOR_STATUS.NOT_CONFIGURED,
      isAvailable: false,
      notice: ERP_CONNECTOR_STATUS.BACKEND_REQUIRED
    };
  }
  return {
    status: ERP_CONNECTOR_STATUS.CONNECTED,
    isAvailable: true,
    endpoint: erpConfig.endpointUrl
  };
}

/**
 * Adapter Contract Method: createWorkOrder
 * Dispatches an incident payload to the municipal ERP backend.
 */
export async function createWorkOrder(incident, options = {}) {
  const status = getErpConnectorStatus();
  if (!status.isAvailable) {
    const err = new Error(`${ERP_CONNECTOR_STATUS.NOT_CONFIGURED}. ${ERP_CONNECTOR_STATUS.BACKEND_REQUIRED}`);
    err.code = 'ERP_NOT_CONFIGURED';
    throw err;
  }

  // Future implementation will POST normalized payload to secure backend proxy
  throw new Error("UNIMPLEMENTED: Direct municipal ERP dispatch is disabled in frontend sandbox builds.");
}

/**
 * Adapter Contract Method: getWorkOrderStatus
 * Queries work order state from the municipal ERP backend.
 */
export async function getWorkOrderStatus(workOrderId) {
  const status = getErpConnectorStatus();
  if (!status.isAvailable) {
    const err = new Error(`${ERP_CONNECTOR_STATUS.NOT_CONFIGURED}. ${ERP_CONNECTOR_STATUS.BACKEND_REQUIRED}`);
    err.code = 'ERP_NOT_CONFIGURED';
    throw err;
  }
  throw new Error("UNIMPLEMENTED: Direct municipal ERP dispatch is disabled in frontend sandbox builds.");
}

/**
 * Adapter Contract Method: updateWorkOrder
 * Submits work order lifecycle updates to the municipal ERP backend.
 */
export async function updateWorkOrder(workOrderId, update) {
  const status = getErpConnectorStatus();
  if (!status.isAvailable) {
    const err = new Error(`${ERP_CONNECTOR_STATUS.NOT_CONFIGURED}. ${ERP_CONNECTOR_STATUS.BACKEND_REQUIRED}`);
    err.code = 'ERP_NOT_CONFIGURED';
    throw err;
  }
  throw new Error("UNIMPLEMENTED: Direct municipal ERP dispatch is disabled in frontend sandbox builds.");
}

/**
 * Adapter Contract Method: cancelWorkOrder
 * Requests work order cancellation from the municipal ERP backend.
 */
export async function cancelWorkOrder(workOrderId, reason) {
  const status = getErpConnectorStatus();
  if (!status.isAvailable) {
    const err = new Error(`${ERP_CONNECTOR_STATUS.NOT_CONFIGURED}. ${ERP_CONNECTOR_STATUS.BACKEND_REQUIRED}`);
    err.code = 'ERP_NOT_CONFIGURED';
    throw err;
  }
  throw new Error("UNIMPLEMENTED: Direct municipal ERP dispatch is disabled in frontend sandbox builds.");
}
