// CivicSense AI — Phase 16 SegFormer B0 Flood Segmentation Service
// Implements genuine browser/runtime inference for the trained SegFormer B0 model
// Primary ONNX Model: public/models/flood_segmentation.onnx
// Input: pixel_values [1, 3, 512, 512] float32 (ImageNet normalized)
// Output: logits [1, 2, 128, 128] float32 (Classes: 0 = BACKGROUND, 1 = FLOODWATER)

import * as ort from 'onnxruntime-web';

/**
 * Binary Flood Segmentation Classes
 * 0 = BACKGROUND / Non-water surface
 * 1 = FLOODWATER / Standing water, inundation, roadway flooding
 */
export const FLOOD_CLASSES = {
  0: { code: 'BACKGROUND', name: 'BACKGROUND', label: 'Background / Dry Surface', isWater: false },
  1: { code: 'FLOODWATER', name: 'FLOODWATER', label: 'Floodwater', isWater: true }
};

/**
 * Preprocesses an HTML Image Element into a normalized Float32 CHW ONNX Tensor [1, 3, 512, 512]
 * matching the Hugging Face SegformerImageProcessor configuration:
 * - RGB image conversion
 * - Resizing to 512x512 with bilinear interpolation
 * - Normalization using ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225]
 * - NCHW tensor layout: [1, 3, 512, 512]
 */
export function preprocessImageForFlood(img, targetWidth = 512, targetHeight = 512) {
  const originalWidth = img.naturalWidth || img.width || targetWidth;
  const originalHeight = img.naturalHeight || img.height || targetHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Use high-quality bilinear interpolation for resizing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData; // RGBA values [0-255]

  const channelSize = targetWidth * targetHeight;
  const float32Data = new Float32Array(3 * channelSize);

  // ImageNet standard normalization parameters
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let i = 0; i < channelSize; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // NCHW Layout: [1, 3, 512, 512]
    float32Data[i] = (r - mean[0]) / std[0];                   // Channel 0 (Red)
    float32Data[channelSize + i] = (g - mean[1]) / std[1];       // Channel 1 (Green)
    float32Data[2 * channelSize + i] = (b - mean[2]) / std[2];   // Channel 2 (Blue)
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
 * Resizes raw output logits [1, 2, 128, 128] to the original image dimensions [originalHeight, originalWidth]
 * using bilinear interpolation (align_corners=False), matching Hugging Face post_process_semantic_segmentation,
 * and generates the pixel-accurate binary segmentation mask.
 * 
 * @param {Float32Array} logitsData - Raw logits array of length 2 * inW * inH
 * @param {number} inW - Logit width (128)
 * @param {number} inH - Logit height (128)
 * @param {number} origW - Original image width
 * @param {number} origH - Original image height
 * @returns {Object} Resized mask and coverage metrics
 */
export function resizeLogitsAndGenerateMask(logitsData, inW = 128, inH = 128, origW, origH) {
  const spatialIn = inW * inH;
  const l0 = logitsData.subarray(0, spatialIn);
  const l1 = logitsData.subarray(spatialIn, 2 * spatialIn);

  const totalPixels = origW * origH;
  const mask = new Uint8Array(totalPixels);

  const scaleY = inH / origH;
  const scaleX = inW / origW;

  // Precompute X coordinate mappings and interpolation weights
  const x0_arr = new Int32Array(origW);
  const x1_arr = new Int32Array(origW);
  const wx_arr = new Float32Array(origW);

  for (let x = 0; x < origW; x++) {
    let in_x = (x + 0.5) * scaleX - 0.5;
    if (in_x < 0) in_x = 0;
    if (in_x > inW - 1) in_x = inW - 1;
    const x0 = Math.floor(in_x);
    const x1 = Math.min(x0 + 1, inW - 1);
    x0_arr[x] = x0;
    x1_arr[x] = x1;
    wx_arr[x] = in_x - x0;
  }

  let floodCount = 0;
  let idx = 0;

  for (let y = 0; y < origH; y++) {
    let in_y = (y + 0.5) * scaleY - 0.5;
    if (in_y < 0) in_y = 0;
    if (in_y > inH - 1) in_y = inH - 1;
    const y0 = Math.floor(in_y);
    const y1 = Math.min(y0 + 1, inH - 1);
    const wy = in_y - y0;
    const inv_wy = 1 - wy;

    const y0_offset = y0 * inW;
    const y1_offset = y1 * inW;

    for (let x = 0; x < origW; x++) {
      const x0 = x0_arr[x];
      const x1 = x1_arr[x];
      const wx = wx_arr[x];
      const inv_wx = 1 - wx;

      // Bilinear interpolation for Class 0 (BACKGROUND) logit
      const top0 = l0[y0_offset + x0] * inv_wx + l0[y0_offset + x1] * wx;
      const bot0 = l0[y1_offset + x0] * inv_wx + l0[y1_offset + x1] * wx;
      const val0 = top0 * inv_wy + bot0 * wy;

      // Bilinear interpolation for Class 1 (FLOODWATER) logit
      const top1 = l1[y0_offset + x0] * inv_wx + l1[y0_offset + x1] * wx;
      const bot1 = l1[y1_offset + x0] * inv_wx + l1[y1_offset + x1] * wx;
      const val1 = top1 * inv_wy + bot1 * wy;

      // Argmax across resized logits: 1 if FLOODWATER logit > BACKGROUND logit, else 0
      if (val1 > val0) {
        mask[idx] = 1;
        floodCount++;
      }
      idx++;
    }
  }

  const floodedAreaRatio = totalPixels > 0 ? Number((floodCount / totalPixels).toFixed(6)) : 0;
  const floodedAreaPercent = Number((floodedAreaRatio * 100).toFixed(2));

  return {
    mask,
    floodCount,
    totalPixels,
    floodedAreaRatio,
    floodedAreaPercent,
    classPixelCounts: {
      0: totalPixels - floodCount,
      1: floodCount
    }
  };
}

/**
 * Calculates Connected Components on a binary mask using BFS (4-connectivity).
 * Used for topological flood analysis and continuous water body detection.
 */
export function calculateFloodConnectedComponents(binaryMask, width = 128, height = 128) {
  if (!binaryMask || binaryMask.length < width * height) {
    return { totalWaterPixels: 0, largestComponentPixels: 0, numComponents: 0, largestCompRatioPct: 0 };
  }

  const visited = new Uint8Array(width * height);
  let totalWaterPixels = 0;
  let largestComponentPixels = 0;
  let numComponents = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 1 && visited[idx] === 0) {
        numComponents++;
        let compSize = 0;
        const queue = [idx];
        visited[idx] = 1;
        let head = 0;

        while (head < queue.length) {
          const curr = queue[head++];
          compSize++;
          const cy = Math.floor(curr / width);
          const cx = curr % width;

          // 4-neighborhood
          const neighbors = [
            cy > 0 ? (cy - 1) * width + cx : -1,
            cy < height - 1 ? (cy + 1) * width + cx : -1,
            cx > 0 ? cy * width + (cx - 1) : -1,
            cx < width - 1 ? cy * width + (cx + 1) : -1
          ];

          for (let n = 0; n < 4; n++) {
            const nIdx = neighbors[n];
            if (nIdx !== -1 && binaryMask[nIdx] === 1 && visited[nIdx] === 0) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }

        totalWaterPixels += compSize;
        if (compSize > largestComponentPixels) {
          largestComponentPixels = compSize;
        }
      }
    }
  }

  const largestCompRatioPct = totalWaterPixels > 0
    ? Number(((largestComponentPixels / totalWaterPixels) * 100).toFixed(2))
    : 0.0;

  return { totalWaterPixels, largestComponentPixels, numComponents, largestCompRatioPct };
}

// Cached Inference Session and Single-Flight Execution Mutex
let cachedFloodSession = null;
let cachedModelUrl = null;
let floodInferenceMutex = Promise.resolve();
let requestCounter = 0;

/**
 * Executes genuine ONNX flood water segmentation on an image element.
 * Primary model: public/models/flood_segmentation.onnx
 * 
 * @param {Object} options
 * @param {HTMLImageElement|ImageBitmap} options.imageElement - The source image
 * @param {string} [options.modelUrl] - Optional model URL override (defaults to /models/flood_segmentation.onnx)
 * @returns {Promise<Object>} Standardized flood inference result
 */
export async function runFloodSegmentationInference({
  imageElement,
  modelUrl = '/models/flood_segmentation.onnx'
}) {
  const reqId = ++requestCounter;
  const originalWidth = imageElement.naturalWidth || imageElement.width || 512;
  const originalHeight = imageElement.naturalHeight || imageElement.height || 512;

  let sessionInitTimeMs = 0;
  let inferenceTimeMs = 0;
  let postprocessTimeMs = 0;

  return new Promise((resolve) => {
    floodInferenceMutex = floodInferenceMutex.then(async () => {
      try {
        const targetUrl = modelUrl || '/models/flood_segmentation.onnx';

        // 1. Session initialization / caching
        const sessionStart = performance.now();
        if (!cachedFloodSession || cachedModelUrl !== targetUrl) {
          cachedFloodSession = await ort.InferenceSession.create(targetUrl, { executionProviders: ['wasm'] });
          cachedModelUrl = targetUrl;
        }
        sessionInitTimeMs = Number((performance.now() - sessionStart).toFixed(1));

        // 2. Preprocessing matching SegformerImageProcessor
        const preprocessResult = preprocessImageForFlood(imageElement, 512, 512);
        const inputName = cachedFloodSession.inputNames[0] || 'pixel_values';
        const feeds = {};
        feeds[inputName] = preprocessResult.tensor;

        // 3. Model Execution
        const runStart = performance.now();
        const results = await cachedFloodSession.run(feeds);
        inferenceTimeMs = Number((performance.now() - runStart).toFixed(1));

        // 4. Extract output logits
        const postStart = performance.now();
        const outputName = cachedFloodSession.outputNames[0] || 'logits';
        const outputTensor = results[outputName];
        const rawLogits = outputTensor.data; // Float32Array [1, 2, 128, 128]
        const dims = outputTensor.dims; // [1, 2, 128, 128]

        const maskH = dims[2] || 128;
        const maskW = dims[3] || 128;

        // 5. Resize output logits to original image dimensions before generating mask
        const resized = resizeLogitsAndGenerateMask(
          rawLogits,
          maskW,
          maskH,
          originalWidth,
          originalHeight
        );

        // 6. Fast topological connected components on 128x128 feature mask
        const spatialIn = maskW * maskH;
        const l0 = rawLogits.subarray(0, spatialIn);
        const l1 = rawLogits.subarray(spatialIn, 2 * spatialIn);
        const mask128 = new Uint8Array(spatialIn);
        for (let i = 0; i < spatialIn; i++) {
          if (l1[i] > l0[i]) mask128[i] = 1;
        }
        const comps128 = calculateFloodConnectedComponents(mask128, maskW, maskH);

        postprocessTimeMs = Number((performance.now() - postStart).toFixed(1));

        const isWaterDetected = resized.floodedAreaPercent > 1.0;
        const spatialTopology = comps128.largestCompRatioPct >= 60.0 ? 'CONTINUOUS_WATER_BODY' : 'DISPERSED_WATER';

        resolve({
          type: "flood",
          model: "flood_segmentation.onnx",
          modelPath: targetUrl,
          modelStatus: "VERIFIED_ONNX",
          inferenceStatus: "SUCCESS",
          detected: isWaterDetected,
          floodedAreaRatio: resized.floodedAreaRatio,
          floodedAreaPercent: resized.floodedAreaPercent,
          floodPixelsCount: resized.floodCount,
          totalMaskPixels: resized.totalPixels,
          maskWidth: originalWidth,
          maskHeight: originalHeight,
          maskClassArray: resized.mask,
          classPixelCounts: resized.classPixelCounts,
          connectedComponents: comps128,
          largest_comp_ratio_pct: comps128.largestCompRatioPct,
          spatialTopology,
          classes: FLOOD_CLASSES,
          sessionInitTimeMs,
          inferenceTimeMs,
          postprocessTimeMs,
          confidence: null, // Confidence is null for segmentation per spec
          source: "RGB_FLOOD_SEGFORMER_B0",
          isFloodModelVerified: true,
          floodModelProvenance: "VERIFIED_ONNX_SEGFORMER_B0",
          requestSequence: reqId,
          requestId: `FLOOD-REQ-${reqId}-${originalWidth}x${originalHeight}`
        });
      } catch (err) {
        console.warn(`[FLOOD_INFERENCE_ERROR] Request #${reqId}:`, err);
        resolve({
          type: "flood",
          model: "flood_segmentation.onnx",
          modelPath: modelUrl,
          modelStatus: "MODEL_UNAVAILABLE",
          inferenceStatus: "FAILED",
          detected: false,
          floodedAreaRatio: 0,
          floodedAreaPercent: 0,
          floodPixelsCount: 0,
          totalMaskPixels: originalWidth * originalHeight,
          maskWidth: originalWidth,
          maskHeight: originalHeight,
          maskClassArray: null,
          classPixelCounts: { 0: originalWidth * originalHeight, 1: 0 },
          connectedComponents: { totalWaterPixels: 0, largestComponentPixels: 0, numComponents: 0, largestCompRatioPct: 0 },
          largest_comp_ratio_pct: 0,
          spatialTopology: 'DISPERSED_WATER',
          classes: FLOOD_CLASSES,
          sessionInitTimeMs,
          inferenceTimeMs: 0,
          postprocessTimeMs: 0,
          confidence: null,
          source: "RGB_FLOOD_SEGFORMER_B0",
          isFloodModelVerified: false,
          floodModelProvenance: "FLOOD MODEL UNAVAILABLE",
          requestSequence: reqId,
          requestId: `FLOOD-REQ-${reqId}-${originalWidth}x${originalHeight}`,
          error: String(err)
        });
      }
    });
  });
}
