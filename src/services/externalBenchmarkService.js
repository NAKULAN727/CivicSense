// CivicSense AI - External Model Benchmark Adapter Service
// Security & API Relay Adapter for External Vision Models
//
// BENCHMARK RULES & STATUS CONSTANTS:
// - CONNECTED: Endpoint active and verified
// - NOT_CONNECTED: No endpoint configured
// - API_ERROR: HTTP or API protocol error
// - INVALID_RESPONSE: Payload format mismatch
// - TIMEOUT: Request timed out
// - DETECTION: External model detected category issue
// - NO_DETECTION: External model did not produce valid detection
// - REQUIRES_PROXY: Security requirement for secret key relay

export const BENCHMARK_STATUS = {
  CONNECTED: 'CONNECTED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  API_ERROR: 'API_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  DETECTION: 'DETECTION',
  NO_DETECTION: 'NO_DETECTION',
  REQUIRES_PROXY: 'EXTERNAL API REQUIRES BACKEND PROXY'
};

/**
 * Phase 1: External Pothole Model Adapter
 * Preferred Candidate: Roboflow Pothole Detection Workflow (pothole-detection-v2)
 * Endpoint configuration: VITE_EXTERNAL_POTHOLE_API_URL
 */
export async function evaluateExternalPotholeModel(imageElementOrFile) {
  const startTime = performance.now();
  const endpointUrl = import.meta.env.VITE_EXTERNAL_POTHOLE_API_URL;

  if (!endpointUrl) {
    return {
      isConnected: false,
      status: BENCHMARK_STATUS.REQUIRES_PROXY,
      candidateModel: "Roboflow Pothole Detection Model (pothole-detection-v2)",
      endpoint: "https://detect.roboflow.com/pothole-detection-v2/1",
      detectionResult: BENCHMARK_STATUS.NOT_CONNECTED,
      detectedClasses: [],
      confidence: null,
      boundingBoxes: [],
      latencyMs: Number((performance.now() - startTime).toFixed(1)),
      error: "Secrets/API keys must remain server-side/backend-proxied. No secret API key exposed in frontend code."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        task: 'POTHOLE_DETECTION'
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        isConnected: false,
        status: BENCHMARK_STATUS.API_ERROR,
        candidateModel: "Roboflow Pothole Detection Model",
        endpoint: endpointUrl,
        detectionResult: BENCHMARK_STATUS.API_ERROR,
        detectedClasses: [],
        confidence: null,
        boundingBoxes: [],
        latencyMs: Number((performance.now() - startTime).toFixed(1)),
        error: `HTTP Error ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    const endTime = performance.now();

    if (!data || typeof data !== 'object') {
      return {
        isConnected: true,
        status: BENCHMARK_STATUS.INVALID_RESPONSE,
        candidateModel: "Roboflow Pothole Detection Model",
        endpoint: endpointUrl,
        detectionResult: BENCHMARK_STATUS.INVALID_RESPONSE,
        detectedClasses: [],
        confidence: null,
        boundingBoxes: [],
        latencyMs: Number((endTime - startTime).toFixed(1)),
        error: "Invalid JSON response payload received from external API"
      };
    }

    const predictions = data.predictions || data.detections || [];
    const hasDetections = Array.isArray(predictions) && predictions.length > 0;

    return {
      isConnected: true,
      status: BENCHMARK_STATUS.CONNECTED,
      candidateModel: data.modelName || "Roboflow Pothole Detection Model",
      endpoint: endpointUrl,
      detectionResult: hasDetections ? BENCHMARK_STATUS.DETECTION : BENCHMARK_STATUS.NO_DETECTION,
      detectedClasses: predictions.map(p => p.class || p.label || 'Pothole'),
      confidence: hasDetections ? Math.max(...predictions.map(p => p.confidence || p.score || 0)) : null,
      boundingBoxes: predictions.map(p => ({ x: p.x, y: p.y, width: p.width, height: p.height })),
      latencyMs: Number((endTime - startTime).toFixed(1)),
      error: null
    };

  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      isConnected: false,
      status: isTimeout ? BENCHMARK_STATUS.TIMEOUT : BENCHMARK_STATUS.API_ERROR,
      candidateModel: "Roboflow Pothole Detection Model",
      endpoint: endpointUrl,
      detectionResult: isTimeout ? BENCHMARK_STATUS.TIMEOUT : BENCHMARK_STATUS.API_ERROR,
      detectedClasses: [],
      confidence: null,
      boundingBoxes: [],
      latencyMs: Number((performance.now() - startTime).toFixed(1)),
      error: isTimeout ? "External API request timed out (10,000ms)" : (err.message || "Network error reaching external API")
    };
  }
}

/**
 * Phase 2: External Street-Level Flood Model Adapter
 * Target Candidate: Street-Level Urban Waterlogging Detection API
 * Endpoint configuration: VITE_EXTERNAL_FLOOD_API_URL
 */
export async function evaluateExternalFloodModel(imageElementOrFile) {
  const startTime = performance.now();
  const endpointUrl = import.meta.env.VITE_EXTERNAL_FLOOD_API_URL;

  if (!endpointUrl) {
    return {
      isConnected: false,
      status: BENCHMARK_STATUS.REQUIRES_PROXY,
      candidateModel: "Street-Level Urban Waterlogging Detection API",
      endpoint: "Configurable via VITE_EXTERNAL_FLOOD_API_URL",
      detectionResult: BENCHMARK_STATUS.NOT_CONNECTED,
      floodedAreaPercent: null,
      confidence: null,
      latencyMs: Number((performance.now() - startTime).toFixed(1)),
      error: "Secrets/API keys must remain server-side/backend-proxied. No secret API key exposed in frontend code."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        task: 'STREET_FLOOD_SEGMENTATION'
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        isConnected: false,
        status: BENCHMARK_STATUS.API_ERROR,
        candidateModel: "Street-Level Urban Waterlogging API",
        endpoint: endpointUrl,
        detectionResult: BENCHMARK_STATUS.API_ERROR,
        floodedAreaPercent: null,
        confidence: null,
        latencyMs: Number((performance.now() - startTime).toFixed(1)),
        error: `HTTP Error ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    const endTime = performance.now();

    if (!data || typeof data !== 'object') {
      return {
        isConnected: true,
        status: BENCHMARK_STATUS.INVALID_RESPONSE,
        candidateModel: "Street-Level Urban Waterlogging API",
        endpoint: endpointUrl,
        detectionResult: BENCHMARK_STATUS.INVALID_RESPONSE,
        floodedAreaPercent: null,
        confidence: null,
        latencyMs: Number((endTime - startTime).toFixed(1)),
        error: "Invalid JSON payload format"
      };
    }

    const isDetected = Boolean(data.isFloodDetected || data.detected || (data.floodedAreaPercent && data.floodedAreaPercent > 1.0));

    return {
      isConnected: true,
      status: BENCHMARK_STATUS.CONNECTED,
      candidateModel: data.modelName || "Street-Level Urban Waterlogging API",
      endpoint: endpointUrl,
      detectionResult: isDetected ? BENCHMARK_STATUS.DETECTION : BENCHMARK_STATUS.NO_DETECTION,
      floodedAreaPercent: data.floodedAreaPercent !== undefined ? data.floodedAreaPercent : null,
      confidence: data.confidence !== undefined ? data.confidence : null,
      latencyMs: Number((endTime - startTime).toFixed(1)),
      error: null
    };

  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      isConnected: false,
      status: isTimeout ? BENCHMARK_STATUS.TIMEOUT : BENCHMARK_STATUS.API_ERROR,
      candidateModel: "Street-Level Urban Waterlogging API",
      endpoint: endpointUrl,
      detectionResult: isTimeout ? BENCHMARK_STATUS.TIMEOUT : BENCHMARK_STATUS.API_ERROR,
      floodedAreaPercent: null,
      confidence: null,
      latencyMs: Number((performance.now() - startTime).toFixed(1)),
      error: isTimeout ? "External API request timed out (10,000ms)" : (err.message || "Network error reaching external API")
    };
  }
}
