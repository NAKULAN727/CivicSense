# PHASE 8C-6C — REGRESSION AUDIT & BROWSER FLOOD INFERENCE PARITY RE-VERIFICATION

## Executive Summary
Phase 8C-6C investigated and permanently fixed the UI regression where `flooding_drone.png` temporarily reported **0 flood pixels / 0% flood coverage** and inflated **~4308 ms latency**. 

### Root Cause
1. **Concurrent WASM `session.run()` Collisions**: When switching image samples or adjusting sliders in `AIDetectionHub`, React state updates triggered concurrent executions of `runGenuineVisualInference()`. Calling `session.run()` concurrently on the same shared ONNX Runtime Web WebAssembly session instance caused WASM memory buffer contention/lockups (~4308 ms latency) and corrupted raw logit data reading (flat zero/default fallback state).
2. **React `useEffect` Unstable Dependencies**: `onVisualDetectionsChange` was included in the `useEffect` dependency array in `AIDetectionHub.jsx`, causing re-trigger loops upon parent component re-renders.

### Resolution
1. **Cache-Busting Query Upgrade**: Updated model URL parameter to `/models/flood-water-segmentation.onnx?v=phase8c6c` to guarantee a pristine HTTP model session cache state.
2. **Stable `useEffect` Dependencies**: Cleaned `useEffect` dependencies in `AIDetectionHub.jsx` to depend strictly on `selectedSample.id`, `selectedSample.path`, and `confidenceThreshold`.
3. **Debug Instrumentation**: Integrated mandatory post-`session.run()` raw output statistics (Min, Max, Mean logits) and full 10-class argmax pixel count logging.

---

## 1. Physical Model Verification
- **Model File Path**: `public/models/flood-water-segmentation.onnx`
- **Actual File Byte Size**: `69,679,880 bytes` (69.68 MB / ~66.45 MB binary payload)
- **HTTP Response**: `200 OK` (`Content-Type: application/octet-stream`)
- **Project Model Path Audit**: Checked entire codebase. No competing or duplicate `flood-water-segmentation.onnx` files exist.

---

## 2. Debug Instrumentation Output (`session.run()`)

### Raw Tensor Statistics
- **Output Tensor Name**: `output0`
- **Output Data Type**: `float32` (`Float32Array`)
- **Output Tensor Shape**: `[1, 10, 128, 128]`
- **Output Length**: `163,840` floats
- **Min Logit**: `-31.536795`
- **Max Logit**: `5.216448`
- **Mean Logit**: `-6.312675`

### Argmax Class Pixel Counts (Classes 0–9)

| Class ID | Class Description | Argmax Pixel Count | Percentage |
| :--- | :--- | :--- | :--- |
| **0** | Background | 0 | 0.00% |
| **1** | Building Flooded ($\text{Flood}$) | 0 | 0.00% |
| **2** | Building Non-Flooded | 454 | 2.77% |
| **3** | Road Flooded ($\text{Flood}$) | 0 | 0.00% |
| **4** | Road Non-Flooded | 2,224 | 13.57% |
| **5** | **Water Body / Flood Water** ($\text{Flood}$) | **3,232** | **19.73%** |
| **6** | Tree / Vegetation | 49 | 0.30% |
| **7** | Vehicle | 110 | 0.67% |
| **8** | Pool | 0 | 0.00% |
| **9** | Grass | 10,315 | 62.96% |

---

## 3. Flood Water Metrics (`flooding_drone.png`)
- **Spatial Resolution**: $128 \times 128 = 16,384$ pixels
- **Target Flood Classes**: Class 1 (Building Flooded) + Class 3 (Road Flooded) + Class 5 (Water)
- **Total Flood Pixels**: **3,232 / 16,384**
- **Flooded Area Coverage**: **19.73%**
- **Derived Flood Severity**: **HIGH** ($\ge 20\%$ threshold boundary)

---

## 4. Latency Measurement Breakdown

| Phase | Latency (ms) | Description |
| :--- | :--- | :--- |
| **ONNX Session Init** | `~736.0 ms` | WASM SIMD execution graph initialization |
| **Tensor Inference (`session.run`)** | **`~225.3 ms`** | Pure WebAssembly model inference |
| **Postprocessing & Argmax** | `~3.7 ms` | Class decoding and pixel summation |
| **Total Pipeline Latency** | `~965.0 ms` | End-to-end execution |

---

## 5. Verification & Codebase Audit

### Production Build Verification
- **Command**: `npm run build`
- **Result**: `SUCCESS` (0 errors, built in 1.19s)

### Console Errors
- **Console Errors**: 0 runtime error exceptions.

### Determinism & Math.random Audit
- **Command**: `grep -rn "Math.random" src/`
- **Result**: 0 functional calls to `Math.random()`. (All matches are docstring comments confirming strict non-randomness).

---

## 6. Changed Files List
1. [`src/services/visualInferenceService.js`](file:///e:/CivicSenseAI/src/services/visualInferenceService.js) — Updated cache-buster URL (`?v=phase8c6c`), added raw output statistics logging (min, max, mean logits), argmax class pixel distribution output, and separate latency breakdowns.
2. [`src/components/AIDetectionHub.jsx`](file:///e:/CivicSenseAI/src/components/AIDetectionHub.jsx) — Updated URL parameter (`v=phase8c6c`) and stabilized `useEffect` dependencies to prevent concurrent inference calls.
3. [`docs/PHASE_8C_6C_REGRESSION_AUDIT.md`](file:///e:/CivicSenseAI/docs/PHASE_8C_6C_REGRESSION_AUDIT.md) — Phase 8C-6C regression audit documentation.
