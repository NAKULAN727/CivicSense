// CivicSense AI - Real Visual Inference & EXIF Processing Service (Phase 8C-1, 8C-4D, 8C-5, 8C-6 & 8C-6B)
// Uses ONNX Runtime Web and ExifReader for real street-level civic issue detection.
// Powered by verified RDD2022 YOLOv8 Road Damage model, Multi-Class Waste Detection ONNX model,
// and SegFormer FloodNet Flood/Water Segmentation ONNX model binaries.

import * as ort from 'onnxruntime-web';
import ExifReader from 'exifreader';

// Configure ONNX Runtime Web WASM CDN paths for Vite compatibility
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

/**
 * Class code mappings strictly defined per RDD2022 standard specification.
 */
export const ROAD_DAMAGE_CLASSES = {
  0: { code: 'D00', name: 'Longitudinal Crack', label: 'Longitudinal Crack' },
  1: { code: 'D10', name: 'Transverse Crack', label: 'Transverse Crack' },
  2: { code: 'D20', name: 'Alligator Crack', label: 'Alligator Crack' },
  3: { code: 'D40', name: 'Pothole', label: 'Pothole' }
};

/**
 * Waste Class code mappings strictly defined per multi-class waste model.
 */
export const WASTE_CLASSES = {
  0: { code: 'W00', name: 'Cardboard Waste', label: 'Cardboard' },
  1: { code: 'W10', name: 'E-Waste', label: 'E-Waste' },
  2: { code: 'W20', name: 'Glass Waste', label: 'Glass' },
  3: { code: 'W30', name: 'Medical Waste', label: 'Medical Waste' },
  4: { code: 'W40', name: 'Metal Waste', label: 'Metal' },
  5: { code: 'W50', name: 'Organic Waste', label: 'Organic Waste' },
  6: { code: 'W60', name: 'Paper Waste', label: 'Paper' },
  7: { code: 'W70', name: 'Plastic Waste', label: 'Plastic' }
};

/**
 * Flood / Water Class code mappings per CVPR FloodNet SegFormer dataset specification.
 */
export const FLOOD_CLASSES = {
  0: { code: 'F00', name: 'background', label: 'Background', isWater: false },
  1: { code: 'F10', name: 'building flooded', label: 'Flooded Building', isWater: true },
  2: { code: 'F20', name: 'building non-flooded', label: 'Non-Flooded Building', isWater: false },
  3: { code: 'F30', name: 'road flooded', label: 'Flooded Road', isWater: true },
  4: { code: 'F40', name: 'road non-flooded', label: 'Non-Flooded Road', isWater: false },
  5: { code: 'F50', name: 'water', label: 'Water Body / Flood Water', isWater: true },
  6: { code: 'F60', name: 'tree', label: 'Tree / Vegetation', isWater: false },
  7: { code: 'F70', name: 'vehicle', label: 'Vehicle', isWater: false },
  8: { code: 'F80', name: 'pool', label: 'Pool', isWater: false },
  9: { code: 'F90', name: 'grass', label: 'Grass', isWater: false }
};

/**
 * Extracts verified EXIF metadata (GPS Latitude, Longitude, Capture Timestamp, Orientation) from an Image File or ArrayBuffer.
 */
export async function extractImageMetadata(fileOrBuffer) {
  try {
    let arrayBuffer;
    if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    } else {
      arrayBuffer = fileOrBuffer;
    }

    const tags = ExifReader.load(arrayBuffer, { expanded: true });

    let latitude = null;
    let longitude = null;
    let timestamp = null;
    let orientation = null;

    if (tags.gps && typeof tags.gps.Latitude === 'number' && typeof tags.gps.Longitude === 'number') {
      latitude = Number(tags.gps.Latitude.toFixed(6));
      longitude = Number(tags.gps.Longitude.toFixed(6));
    }

    if (tags.exif && tags.exif.DateTimeOriginal && tags.exif.DateTimeOriginal.description) {
      timestamp = tags.exif.DateTimeOriginal.description;
    } else if (tags.exif && tags.exif.DateTime && tags.exif.DateTime.description) {
      timestamp = tags.exif.DateTime.description;
    }

    if (tags.exif && tags.exif.Orientation && tags.exif.Orientation.description) {
      orientation = tags.exif.Orientation.description;
    } else if (tags.exif && tags.exif.Orientation && tags.exif.Orientation.value) {
      orientation = String(tags.exif.Orientation.value);
    }

    return {
      latitude,
      longitude,
      timestamp,
      captureTimestamp: timestamp,
      isGpsVerified: latitude !== null && longitude !== null,
      orientation: orientation || "Normal"
    };
  } catch (err) {
    return {
      latitude: null,
      longitude: null,
      timestamp: null,
      captureTimestamp: null,
      isGpsVerified: false,
      orientation: "Normal"
    };
  }
}

/**
 * Deterministic Mobile Image Quality Diagnostics (Phase 9 Specification).
 * Reports: width, height, total pixels, aspect ratio, orientation, low-res warning.
 * Thresholds:
 * LOW RESOLUTION: width < 300 OR height < 200 OR total pixels < 60,000.
 * EXTREME ASPECT RATIO: aspect ratio > 3.0 OR < 0.33.
 * Strictly NO fake environmental condition detection (no fake nighttime/glare/rain/fog/motion blur).
 */
export function auditImageQuality({ width, height, orientation = 'Normal' }) {
  const originalWidth = typeof width === 'number' && width > 0 ? width : 640;
  const originalHeight = typeof height === 'number' && height > 0 ? height : 640;
  const totalPixels = originalWidth * originalHeight;
  const aspectRatio = originalHeight > 0 ? Number((originalWidth / originalHeight).toFixed(2)) : 1.0;

  const isLowResolution = originalWidth < 300 || originalHeight < 200 || totalPixels < 60000;
  const isExtremeAspectRatio = aspectRatio > 3.0 || aspectRatio < 0.33;

  const observations = [];
  let lowResWarning = null;
  let extremeAspectWarning = null;

  if (isLowResolution) {
    lowResWarning = `LOW-RESOLUTION WARNING: Image resolution (${originalWidth} × ${originalHeight}, ${totalPixels.toLocaleString()} px) is below recommended threshold (<300×200 or <60,000 px). Inference will proceed.`;
    observations.push("LOW RESOLUTION");
  }

  if (isExtremeAspectRatio) {
    extremeAspectWarning = `EXTREME ASPECT RATIO: Aspect ratio (${aspectRatio}:1) is unusually elongated.`;
    observations.push("EXTREME ASPECT RATIO");
  }

  if (observations.length === 0) {
    observations.push("STANDARD QUALITY");
  }

  return {
    originalWidth,
    originalHeight,
    totalPixels,
    aspectRatio,
    orientation: orientation || 'Normal',
    isLowResolution,
    isExtremeAspectRatio,
    lowResWarning,
    extremeAspectWarning,
    observations
  };
}

/**
 * Preprocesses an HTML Image Element into a normalized Float32 CHW ONNX Tensor [1, 3, height, width]
 * using aspect-preserving letterbox padding with neutral gray background RGB(114, 114, 114).
 */
export function preprocessImage(img, targetWidth = 640, targetHeight = 640) {
  const originalWidth = img.naturalWidth || img.width || 640;
  const originalHeight = img.naturalHeight || img.height || 640;

  const scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
  const resizedWidth = Math.round(originalWidth * scale);
  const resizedHeight = Math.round(originalHeight * scale);

  const padX = (targetWidth - resizedWidth) / 2;
  const padY = (targetHeight - resizedHeight) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(114, 114, 114)';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, padX, padY, resizedWidth, resizedHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData;

  const float32Data = new Float32Array(3 * targetWidth * targetHeight);
  const channelSize = targetWidth * targetHeight;

  for (let i = 0; i < channelSize; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    float32Data[i] = r;
    float32Data[channelSize + i] = g;
    float32Data[2 * channelSize + i] = b;
  }

  const tensor = new ort.Tensor('float32', float32Data, [1, 3, targetHeight, targetWidth]);
  
  const isLowResolution = originalWidth < targetWidth || originalHeight < targetHeight;
  const lowResWarning = isLowResolution
    ? `Source image resolution (${originalWidth} × ${originalHeight}) is below model input size (${targetWidth} × ${targetHeight}). Detection performance may be reduced.`
    : null;

  return {
    tensor,
    originalWidth,
    originalHeight,
    resizedWidth,
    resizedHeight,
    scale,
    padX,
    padY,
    isLowResolution,
    lowResWarning
  };
}

/**
 * Preprocesses an HTML Image Element for SegFormer FloodNet model [1, 3, 512, 512]
 * using standard ImageNet mean and std normalization.
 */
export function preprocessImageForFlood(img, targetWidth = 512, targetHeight = 512) {
  const originalWidth = img.naturalWidth || img.width || 512;
  const originalHeight = img.naturalHeight || img.height || 512;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData;

  const float32Data = new Float32Array(3 * targetWidth * targetHeight);
  const channelSize = targetWidth * targetHeight;

  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let i = 0; i < channelSize; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // Formula: (pixel/255.0 - mean) / std (CHW layout)
    float32Data[i] = (r - mean[0]) / std[0];
    float32Data[channelSize + i] = (g - mean[1]) / std[1];
    float32Data[2 * channelSize + i] = (b - mean[2]) / std[2];
  }

  const tensor = new ort.Tensor('float32', float32Data, [1, 3, targetHeight, targetWidth]);
  const isLowResolution = originalWidth < targetWidth || originalHeight < targetHeight;

  return {
    tensor,
    originalWidth,
    originalHeight,
    isLowResolution
  };
}

/**
 * Calculates IoU (Intersection over Union) for Non-Maximum Suppression (NMS).
 */
function calculateIoU(boxA, boxB) {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  if (interArea === 0) return 0;

  const boxAArea = boxA.width * boxA.height;
  const boxBArea = boxB.width * boxB.height;

  return interArea / (boxAArea + boxBArea - interArea);
}

/**
 * Performs Non-Maximum Suppression on raw detection candidates.
 */
export function applyNMS(boxes, iouThreshold = 0.45) {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const selected = [];

  while (sorted.length > 0) {
    const current = sorted.shift();
    selected.push(current);

    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].classCode === current.classCode && calculateIoU(current.boundingBox, sorted[i].boundingBox) > iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }

  return selected;
}

/**
 * Generates a deterministic detection ID based on class, confidence, bounding box coordinates, and index.
 * Strictly avoids Math.random().
 */
export function generateDeterministicId(domain, classCode, index, confidence, box) {
  const str = `${domain}-${classCode}-${index}-${Math.round(confidence * 10000)}-${Math.round(box.x)}-${Math.round(box.y)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `det-${domain}-${classCode.toLowerCase()}-${index}-${hex}`;
}

/**
 * Cached Inference Sessions & Single-Flight Execution Mutexes
 */
let roadModelSession = null;
let cachedRoadUrl = null;
let roadInferenceMutex = Promise.resolve();

let wasteModelSession = null;
let cachedWasteUrl = null;
let wasteInferenceMutex = Promise.resolve();

let floodModelSession = null;
let cachedFloodUrl = null;
let floodInferenceMutex = Promise.resolve();

let globalFloodRequestSequence = 0;

/**
 * Runs genuine computer-vision inference on an image element for road damage, waste, and flood water segmentation.
 * Benchmarks execution time with performance.now().
 * NO HEURISTIC FALLBACK — returns explicit error state if model fails to load.
 */
export async function runGenuineVisualInference({
  imageElement,
  metadata = { latitude: null, longitude: null, timestamp: null },
  imageSourceType = 'USER-UPLOADED IMAGE',
  confidenceThreshold = 0.50,
  imageLoadTimeMs = null,
  roadModelUrl = '/models/rdd2022-road-damage.onnx',
  wasteModelUrl = '/models/waste-detection.onnx',
  floodModelUrl = '/models/flood-water-segmentation.onnx?v=phase8c6d'
}) {
  const totalStartTime = performance.now();

  const preprocessMeta = preprocessImage(imageElement, 640, 640);
  const { tensor, originalWidth, originalHeight, resizedWidth, resizedHeight, scale, padX, padY, isLowResolution, lowResWarning, qualityAudit } = preprocessMeta;

  const rawDetections = {
    road: [],
    waste: []
  };

  let activeRoadModelName = "RDD2022 YOLOv8s Road Damage Detector";
  let isRoadModelVerified = false;
  let roadModelProvenance = "ROAD MODEL UNAVAILABLE";
  let roadOutputShapeStr = "None";
  let rawRoadCountTotal = 0;
  let roadInferenceTimeMs = 0;

  let activeWasteModelName = "YOLOv8 Multi-Class Waste Detector";
  let isWasteModelVerified = false;
  let wasteModelProvenance = "WASTE MODEL UNAVAILABLE";
  let wasteOutputShapeStr = "None";
  let rawWasteCountTotal = 0;
  let wasteInferenceTimeMs = 0;

  // 1. EXECUTE ROAD DAMAGE MODEL INFERENCE (SERIALIZED SINGLE-FLIGHT)
  await (roadInferenceMutex = roadInferenceMutex.then(async () => {
    try {
      const targetRoadUrl = roadModelUrl || '/models/rdd2022-road-damage.onnx';
      if (!roadModelSession || cachedRoadUrl !== targetRoadUrl) {
        roadModelSession = await ort.InferenceSession.create(targetRoadUrl, { executionProviders: ['wasm'] });
        cachedRoadUrl = targetRoadUrl;
      }

      if (roadModelSession) {
        isRoadModelVerified = true;
        roadModelProvenance = "VERIFIED ONNX MODEL SESSION";
        
        const inputName = roadModelSession.inputNames[0] || 'images';
        const feeds = {};
        feeds[inputName] = tensor;

        const roadRunStart = performance.now();
        const results = await roadModelSession.run(feeds);
        const roadRunEnd = performance.now();
        roadInferenceTimeMs = Number((roadRunEnd - roadRunStart).toFixed(1));

        const outputName = roadModelSession.outputNames[0] || 'output0';
        const outputTensor = results[outputName];
        
        const rawData = outputTensor.data;
        const dims = outputTensor.dims;
        roadOutputShapeStr = JSON.stringify(dims);
        
        const numDetections = dims.length === 3 ? (dims[1] === 8400 ? dims[1] : dims[2]) : 0;
        
        for (let i = 0; i < numDetections; i++) {
          const cxCanvas = rawData[0 * numDetections + i];
          const cyCanvas = rawData[1 * numDetections + i];
          const wCanvas = rawData[2 * numDetections + i];
          const hCanvas = rawData[3 * numDetections + i];

          const x1Canvas = cxCanvas - wCanvas / 2;
          const y1Canvas = cyCanvas - hCanvas / 2;
          const x2Canvas = cxCanvas + wCanvas / 2;
          const y2Canvas = cyCanvas + hCanvas / 2;

          const x1Original = (x1Canvas - padX) / scale;
          const y1Original = (y1Canvas - padY) / scale;
          const x2Original = (x2Canvas - padX) / scale;
          const y2Original = (y2Canvas - padY) / scale;

          const x1Clamped = Math.max(0, Math.min(originalWidth, x1Original));
          const y1Clamped = Math.max(0, Math.min(originalHeight, y1Original));
          const x2Clamped = Math.max(0, Math.min(originalWidth, x2Original));
          const y2Clamped = Math.max(0, Math.min(originalHeight, y2Original));

          const wOriginal = x2Clamped - x1Clamped;
          const hOriginal = y2Clamped - y1Clamped;

          if (wOriginal <= 0 || hOriginal <= 0) continue;

          const xPercent = (x1Clamped / originalWidth) * 100;
          const yPercent = (y1Clamped / originalHeight) * 100;
          const widthPercent = (wOriginal / originalWidth) * 100;
          const heightPercent = (hOriginal / originalHeight) * 100;

          let maxScore = 0;
          let bestClassIdx = -1;
          for (let c = 0; c < 4; c++) {
            const score = rawData[(4 + c) * numDetections + i];
            if (score > maxScore) {
              maxScore = score;
              bestClassIdx = c;
            }
          }

          if (maxScore >= confidenceThreshold && bestClassIdx !== -1) {
            rawRoadCountTotal++;
            const classInfo = ROAD_DAMAGE_CLASSES[bestClassIdx];
            const bbox = {
              x: Number(xPercent.toFixed(2)),
              y: Number(yPercent.toFixed(2)),
              width: Number(widthPercent.toFixed(2)),
              height: Number(heightPercent.toFixed(2))
            };

            rawDetections.road.push({
              type: classInfo.name,
              classCode: classInfo.code,
              confidence: Number(maxScore.toFixed(4)),
              boundingBox: bbox
            });
          }
        }
      }
    } catch (err) {
      console.error("ONNX Runtime execution error for Road Damage model:", err);
      isRoadModelVerified = false;
      roadModelProvenance = "MODEL LOAD FAILED";
      activeRoadModelName = "MODEL LOAD FAILED";
    }
  }).catch(err => console.error("Road inference mutex error:", err)));

  // 2. EXECUTE WASTE DETECTION MODEL INFERENCE (SERIALIZED SINGLE-FLIGHT)
  await (wasteInferenceMutex = wasteInferenceMutex.then(async () => {
    try {
      const targetWasteUrl = wasteModelUrl || '/models/waste-detection.onnx';
      if (!wasteModelSession || cachedWasteUrl !== targetWasteUrl) {
        wasteModelSession = await ort.InferenceSession.create(targetWasteUrl, { executionProviders: ['wasm'] });
        cachedWasteUrl = targetWasteUrl;
      }

      if (wasteModelSession) {
        isWasteModelVerified = true;
        wasteModelProvenance = "VERIFIED ONNX MODEL SESSION";
        
        const inputName = wasteModelSession.inputNames[0] || 'images';
        const feeds = {};
        feeds[inputName] = tensor;

        const wasteRunStart = performance.now();
        const results = await wasteModelSession.run(feeds);
        const wasteRunEnd = performance.now();
        wasteInferenceTimeMs = Number((wasteRunEnd - wasteRunStart).toFixed(1));

        const outputName = wasteModelSession.outputNames[0] || 'output0';
        const outputTensor = results[outputName];
        
        const rawData = outputTensor.data;
        const dims = outputTensor.dims;
        wasteOutputShapeStr = JSON.stringify(dims);
        
        const numDetections = dims.length === 3 ? (dims[1] === 8400 ? dims[1] : dims[2]) : 0;
        const numClasses = dims.length === 3 ? (dims[1] === 8400 ? dims[2] - 4 : dims[1] - 4) : 8;
        
        for (let i = 0; i < numDetections; i++) {
          const cxCanvas = rawData[0 * numDetections + i];
          const cyCanvas = rawData[1 * numDetections + i];
          const wCanvas = rawData[2 * numDetections + i];
          const hCanvas = rawData[3 * numDetections + i];

          const x1Canvas = cxCanvas - wCanvas / 2;
          const y1Canvas = cyCanvas - hCanvas / 2;
          const x2Canvas = cxCanvas + wCanvas / 2;
          const y2Canvas = cyCanvas + hCanvas / 2;

          const x1Original = (x1Canvas - padX) / scale;
          const y1Original = (y1Canvas - padY) / scale;
          const x2Original = (x2Canvas - padX) / scale;
          const y2Original = (y2Canvas - padY) / scale;

          const x1Clamped = Math.max(0, Math.min(originalWidth, x1Original));
          const y1Clamped = Math.max(0, Math.min(originalHeight, y1Original));
          const x2Clamped = Math.max(0, Math.min(originalWidth, x2Original));
          const y2Clamped = Math.max(0, Math.min(originalHeight, y2Original));

          const wOriginal = x2Clamped - x1Clamped;
          const hOriginal = y2Clamped - y1Clamped;

          if (wOriginal <= 0 || hOriginal <= 0) continue;

          const xPercent = (x1Clamped / originalWidth) * 100;
          const yPercent = (y1Clamped / originalHeight) * 100;
          const widthPercent = (wOriginal / originalWidth) * 100;
          const heightPercent = (hOriginal / originalHeight) * 100;

          let maxScore = 0;
          let bestClassIdx = -1;
          for (let c = 0; c < Math.min(8, numClasses); c++) {
            const score = rawData[(4 + c) * numDetections + i];
            if (score > maxScore) {
              maxScore = score;
              bestClassIdx = c;
            }
          }

          if (maxScore >= confidenceThreshold && bestClassIdx !== -1) {
            rawWasteCountTotal++;
            const classInfo = WASTE_CLASSES[bestClassIdx] || { code: `W${bestClassIdx}0`, name: 'Detected Waste', label: 'Waste' };
            const bbox = {
              x: Number(xPercent.toFixed(2)),
              y: Number(yPercent.toFixed(2)),
              width: Number(widthPercent.toFixed(2)),
              height: Number(heightPercent.toFixed(2))
            };

            rawDetections.waste.push({
              type: classInfo.name,
              classCode: classInfo.code,
              confidence: Number(maxScore.toFixed(4)),
              boundingBox: bbox
            });
          }
        }
      }
    } catch (err) {
      console.warn("ONNX Runtime execution notice for Waste model:", err);
      isWasteModelVerified = false;
      wasteModelProvenance = "WASTE MODEL UNAVAILABLE";
      activeWasteModelName = "WASTE MODEL UNAVAILABLE";
    }
  }).catch(err => console.error("Waste inference mutex error:", err)));

  // 3. EXECUTE FLOOD WATER SEGMENTATION MODEL INFERENCE (SINGLE-FLIGHT MUTEX)
  let isFloodModelVerified = false;
  let floodModelProvenance = "FLOOD MODEL UNAVAILABLE";
  let activeFloodModelName = "SegFormer FloodNet Water Segmenter";
  let floodOutputShapeStr = "None";
  let floodedAreaRatio = 0;
  let floodedAreaPercent = 0;
  let floodPixelsCount = 0;
  const totalMaskPixels = 128 * 128; // 16,384
  let maskClassArray = null;
  const classPixelCounts = {};
  let floodSessionInitTimeMs = 0;
  let floodInferenceTimeMs = 0;
  let floodPostprocessTimeMs = 0;

  const currentReqSeq = ++globalFloodRequestSequence;
  const reqId = `FLOOD-REQ-${currentReqSeq}-${originalWidth}x${originalHeight}`;
  console.log(`[FLOOD_INFERENCE_START] Sequence: #${currentReqSeq}, RequestID: ${reqId}, ImageRes: ${originalWidth}×${originalHeight}, Time: ${new Date().toISOString()}`);

  await (floodInferenceMutex = floodInferenceMutex.then(async () => {
    try {
      const targetFloodUrl = (floodModelUrl || '/models/flood-water-segmentation.onnx') + 
        (floodModelUrl?.includes('?') ? '' : '?v=phase8c6d');

      console.log(`[FLOOD_INFERENCE_RUN] Sequence: #${currentReqSeq}, RequestID: ${reqId}, TargetURL: ${targetFloodUrl}`);
      
      const sessionStart = performance.now();
      if (!floodModelSession || cachedFloodUrl !== targetFloodUrl) {
        floodModelSession = await ort.InferenceSession.create(targetFloodUrl, { executionProviders: ['wasm'] });
        cachedFloodUrl = targetFloodUrl;
      }
      const sessionEnd = performance.now();
      floodSessionInitTimeMs = Number((sessionEnd - sessionStart).toFixed(1));

      if (floodModelSession) {
        isFloodModelVerified = true;
        floodModelProvenance = "VERIFIED_ONNX";

        const floodPre = preprocessImageForFlood(imageElement, 512, 512);
        const inputName = floodModelSession.inputNames[0] || 'images';
        const feeds = {};
        feeds[inputName] = floodPre.tensor;

        const floodStart = performance.now();
        const results = await floodModelSession.run(feeds);
        const floodEnd = performance.now();
        floodInferenceTimeMs = Number((floodEnd - floodStart).toFixed(1));

        const postStart = performance.now();
        const outputName = floodModelSession.outputNames[0] || 'output0';
        const outputTensor = results[outputName];

        const rawData = outputTensor.data; // Float32Array of shape [1, 10, 128, 128]
        const dims = outputTensor.dims;
        floodOutputShapeStr = JSON.stringify(dims);

        const numClasses = dims[1]; // 10
        const maskH = dims[2]; // 128
        const maskW = dims[3]; // 128
        const spatialSize = maskH * maskW;

        // Calculate raw output statistics (Min, Max, Mean)
        let minLogit = Infinity;
        let maxLogitVal = -Infinity;
        let sumLogits = 0;
        for (let k = 0; k < rawData.length; k++) {
          const val = rawData[k];
          if (val < minLogit) minLogit = val;
          if (val > maxLogitVal) maxLogitVal = val;
          sumLogits += val;
        }
        const meanLogit = sumLogits / rawData.length;

        maskClassArray = new Uint8Array(spatialSize);

        for (let i = 0; i < spatialSize; i++) {
          let maxLogit = -Infinity;
          let bestClass = 0;
          for (let c = 0; c < numClasses; c++) {
            const logit = rawData[c * spatialSize + i];
            if (logit > maxLogit) {
              maxLogit = logit;
              bestClass = c;
            }
          }
          maskClassArray[i] = bestClass;
          classPixelCounts[bestClass] = (classPixelCounts[bestClass] || 0) + 1;

          // Target flood water classes: 1 ('building flooded'), 3 ('road flooded'), 5 ('water')
          if (bestClass === 1 || bestClass === 3 || bestClass === 5) {
            floodPixelsCount++;
          }
        }

        floodedAreaRatio = Number((floodPixelsCount / totalMaskPixels).toFixed(6));
        floodedAreaPercent = Number((floodedAreaRatio * 100).toFixed(2));
        const postEnd = performance.now();
        floodPostprocessTimeMs = Number((postEnd - postStart).toFixed(1));

        console.log(`[FLOOD_INFERENCE_COMPLETE] Sequence: #${currentReqSeq}, RequestID: ${reqId}, Output: ${floodOutputShapeStr}, SessionInit: ${floodSessionInitTimeMs}ms, RunDuration: ${floodInferenceTimeMs}ms, PostProcess: ${floodPostprocessTimeMs}ms, MinLogit: ${minLogit.toFixed(4)}, MaxLogit: ${maxLogitVal.toFixed(4)}, MeanLogit: ${meanLogit.toFixed(4)}, WaterClass5: ${classPixelCounts[5] || 0}px, TotalFloodPixels: ${floodPixelsCount}/${spatialSize} (${floodedAreaPercent}%)`);
        
        console.log(`=== FLOOD MODEL ARGMAX COUNTS (CLASSES 0-9) - Sequence #${currentReqSeq} ===`);
        for (let c = 0; c < 10; c++) {
          const count = classPixelCounts[c] || 0;
          const desc = FLOOD_CLASSES[c]?.name || `class ${c}`;
          console.log(`  class ${c} (${desc}): ${count} pixels`);
        }
      }
    } catch (err) {
      console.warn(`[FLOOD_INFERENCE_ERROR] Sequence: #${currentReqSeq}, RequestID: ${reqId}, Error:`, err);
      isFloodModelVerified = false;
      floodModelProvenance = "FLOOD MODEL UNAVAILABLE";
      activeFloodModelName = "FLOOD MODEL UNAVAILABLE";
    }
  }).catch(err => console.error("Flood inference mutex error:", err)));

  // Apply Non-Maximum Suppression (NMS) for detection models
  const nmsRoad = applyNMS(rawDetections.road, 0.45);
  const nmsWaste = applyNMS(rawDetections.waste, 0.45);

  // Format final detections with deterministic IDs and verified EXIF metadata
  const finalRoad = nmsRoad.map((det, index) => ({
    id: generateDeterministicId('road', det.classCode, index, det.confidence, det.boundingBox),
    type: det.type,
    classCode: det.classCode,
    confidence: det.confidence,
    boundingBox: det.boundingBox,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    source: 'REAL MODEL INFERENCE',
    timestamp: metadata.timestamp
  }));

  const finalWaste = nmsWaste.map((det, index) => ({
    id: generateDeterministicId('waste', det.classCode, index, det.confidence, det.boundingBox),
    type: det.type,
    classCode: det.classCode,
    confidence: det.confidence,
    boundingBox: det.boundingBox,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    source: 'REAL MODEL INFERENCE',
    timestamp: metadata.timestamp
  }));

  const floodResult = {
    type: "flood",
    model: "flood-water-segmentation.onnx",
    modelStatus: isFloodModelVerified ? "VERIFIED_ONNX" : "MODEL_UNAVAILABLE",
    inferenceStatus: isFloodModelVerified ? "SUCCESS" : "FAILED",
    detected: isFloodModelVerified && floodedAreaPercent > 1.0,
    floodedAreaRatio: isFloodModelVerified ? floodedAreaRatio : 0,
    floodedAreaPercent: isFloodModelVerified ? floodedAreaPercent : 0,
    maskWidth: 128,
    maskHeight: 128,
    sessionInitTimeMs: floodSessionInitTimeMs,
    inferenceTimeMs: floodInferenceTimeMs,
    postprocessTimeMs: floodPostprocessTimeMs,
    confidence: null, // Confidence is null per spec (no fabricated confidence for segmentation logits)
    source: "RGB_FLOOD_MODEL",
    maskClassArray,
    classPixelCounts,
    floodPixelsCount,
    totalMaskPixels,
    isFloodModelVerified,
    floodModelProvenance,
    requestSequence: currentReqSeq,
    requestId: reqId
  };

  const totalEndTime = performance.now();
  const inferenceTimeMs = Number((totalEndTime - totalStartTime).toFixed(1));

  const devDiagnostics = {
    model: "RDD2022 Road Damage + YOLOv8 Waste + SegFormer Flood Model",
    roadModelFile: roadModelUrl || '/models/rdd2022-road-damage.onnx',
    roadModelLoaded: isRoadModelVerified ? "YES" : "NO",
    wasteModelFile: wasteModelUrl || '/models/waste-detection.onnx',
    wasteModelLoaded: isWasteModelVerified ? "YES" : "NO",
    floodModelFile: floodModelUrl || '/models/flood-water-segmentation.onnx?v=phase8c6d',
    floodModelLoaded: isFloodModelVerified ? "YES" : "NO",
    inputShape: "images [1, 3, 640, 640] (Flood: [1, 3, 512, 512])",
    roadOutputShape: roadOutputShapeStr,
    wasteOutputShape: wasteOutputShapeStr,
    floodOutputShape: floodOutputShapeStr,
    naturalResolution: `${originalWidth} × ${originalHeight}`,
    letterboxResolution: `${resizedWidth} × ${resizedHeight}`,
    scale: Number(scale.toFixed(4)),
    padding: `${padX.toFixed(1)} × ${padY.toFixed(1)}`,
    isLowResolution,
    lowResWarning,
    roadClasses: ROAD_DAMAGE_CLASSES,
    wasteClasses: WASTE_CLASSES,
    floodClasses: FLOOD_CLASSES,
    confidenceThreshold,
    rawCandidates: rawRoadCountTotal + rawWasteCountTotal,
    rawRoadCandidates: rawRoadCountTotal,
    rawWasteCandidates: rawWasteCountTotal,
    postNmsDetections: finalRoad.length + finalWaste.length,
    postNmsRoadDetections: finalRoad.length,
    postNmsWasteDetections: finalWaste.length,
    maskDimensions: "128 × 128",
    floodPixels: floodPixelsCount,
    totalPixels: totalMaskPixels,
    floodedAreaRatio,
    floodSessionInitTimeMs,
    floodInferenceTimeMs,
    floodPostprocessTimeMs,
    postprocessingStatus: isFloodModelVerified ? "COMPLETED" : "UNAVAILABLE",
    isModelVerified: isRoadModelVerified,
    modelProvenance: roadModelProvenance,
    isWasteModelVerified,
    wasteModelProvenance,
    isFloodModelVerified,
    floodModelProvenance,
    requestSequence: currentReqSeq,
    requestId: reqId
  };

  // Developer Console Diagnostics Log
  console.log(`=== CIVICSENSE AI VISUAL INFERENCE DIAGNOSTICS (Req #${currentReqSeq}) ===`);
  console.log(`Road Model Status: ${isRoadModelVerified ? 'VERIFIED' : 'LOAD FAILED'} (${devDiagnostics.roadModelFile})`);
  console.log(`Waste Model Status: ${isWasteModelVerified ? 'VERIFIED' : 'UNAVAILABLE'} (${devDiagnostics.wasteModelFile})`);
  console.log(`Flood Model Status: ${isFloodModelVerified ? 'VERIFIED ONNX' : 'UNAVAILABLE'} (${devDiagnostics.floodModelFile})`);
  console.log(`Natural Resolution: ${devDiagnostics.naturalResolution}`);
  console.log(`Letterbox Resolution: ${devDiagnostics.letterboxResolution} (Scale: ${devDiagnostics.scale}, Pad: ${devDiagnostics.padding})`);
  if (devDiagnostics.isLowResolution) {
    console.warn(`WARNING: ${devDiagnostics.lowResWarning}`);
  }
  console.log(`Confidence Threshold: ${confidenceThreshold}`);
  console.log(`Post-NMS Detections: Road = ${finalRoad.length}, Waste = ${finalWaste.length}`);
  console.log(`Flood Water Coverage: ${floodedAreaPercent}% (${floodPixelsCount}/${totalMaskPixels} pixels, Latency: session=${floodSessionInitTimeMs}ms, infer=${floodInferenceTimeMs}ms, post=${floodPostprocessTimeMs}ms)`);
  console.log("Class Argmax Pixel Distribution:", classPixelCounts);
  console.log("==================================================");

  const qualityAuditResult = preprocessMeta.qualityAudit || auditImageQuality({ 
    width: originalWidth, 
    height: originalHeight, 
    orientation: metadata?.orientation 
  });

  return {
    detections: {
      road: finalRoad,
      waste: finalWaste
    },
    flood: floodResult,
    inferenceTimeMs,
    timingBreakdown: {
      imageLoadTimeMs: typeof imageLoadTimeMs === 'number' ? imageLoadTimeMs : null,
      roadInferenceTimeMs,
      wasteInferenceTimeMs,
      floodInferenceTimeMs,
      arbitrationTimeMs: null, // Populated post-arbitration
      totalProcessingTimeMs: inferenceTimeMs
    },
    qualityAudit: qualityAuditResult,
    processingTimestamp: new Date().toISOString(),
    modelStatuses: {
      road: isRoadModelVerified ? "VERIFIED_ONNX" : "ROAD MODEL UNAVAILABLE",
      waste: isWasteModelVerified ? "VERIFIED_ONNX" : "WASTE MODEL UNAVAILABLE",
      flood: isFloodModelVerified ? "VERIFIED_ONNX" : "FLOOD MODEL UNAVAILABLE"
    },
    modelName: isRoadModelVerified ? activeRoadModelName : "ROAD MODEL UNAVAILABLE",
    wasteModelName: isWasteModelVerified ? activeWasteModelName : "WASTE MODEL UNAVAILABLE",
    floodModelName: isFloodModelVerified ? activeFloodModelName : "FLOOD MODEL UNAVAILABLE",
    metadata,
    source: imageSourceType,
    devDiagnostics,
    isModelVerified: isRoadModelVerified,
    modelProvenance: roadModelProvenance,
    isWasteModelVerified,
    wasteModelProvenance,
    isFloodModelVerified,
    floodModelProvenance,
    requestSequence: currentReqSeq,
    requestId: reqId
  };
}

