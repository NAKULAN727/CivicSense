# CIVICSENSE AI — POTHOLE DETECTION RUNTIME DEBUG & VERIFICATION REPORT

**Report ID:** `REPORT-DEBUG-CV-POTHOLE-RUNTIME-001`  
**Date:** 2026-11-12  
**Investigation Target:** AI Detection Hub Road Perception Pipeline & Dashboard Zero-Detection State  
**Active Production Model:** Model A (`public/models/rdd2022-road-damage.onnx` — YOLOv8s)  
**Status:** **ROOT CAUSE IDENTIFIED, REMEDIATED, AND EMPIRICALLY VERIFIED**

---

## 1. Incident Overview & Reported Symptoms

When inspecting a street scene with prominent road damage in the CivicSense AI Detection Hub (such as the default sample `potholes_drone.png`), the user interface reported:
- **RDD2022 Road Model:** `0 detections`
- **Road Model Latency:** `LATENCY NOT MEASURED`
- **Raw Candidates Screened:** `0 proposals`
- **Final Civic Incidents:** `0 Confirmed`

Despite the underlying ONNX neural network binary (`rdd2022-road-damage.onnx`) having high predictive confidence ($0.8675$ on the prominent pothole), the frontend dashboard displayed an empty state and unmeasured latency.

---

## 2. Step 1 — Complete Inference Pipeline Trace

The end-to-end execution flow was traced across the entire perception and municipal triage architecture:

```mermaid
flowchart TD
    A["Image Selected / Uploaded\n(/assets/potholes_drone.png)"] --> B["Image Preloading\nHTMLImageElement.onload"]
    B --> C["EXIF Metadata Parsing\n(extractImageMetadata)"]
    C --> D["runGenuineVisualInference\n(visualInferenceService.js)"]
    D --> E["Letterbox Preprocessing\n[1, 3, 640, 640] normalized RGB"]
    E --> F["ONNX Runtime Web WASM Session\n(rdd2022-road-damage.onnx)"]
    F --> G["Model Inference Run\nOutput: [1, 8, 8400] tensor"]
    G --> H["Output Tensor Decoding\nScores: D00, D10, D20, D40"]
    H --> I["Confidence Filtering (tau >= 0.50)\nRaw Road Detections: 3 D40 candidates"]
    I --> J["Non-Maximum Suppression (IoU = 0.45)\n3 Valid D40 Bounding Boxes"]
    J --> K["Return rawResult\n{ detections, flood, timingBreakdown }"]
    K --> L["calculateVisualDetectionsSeverity\n(civicSeverityService.js)"]
    L --> M["performContextualArbitration\n(civicSeverityService.js:429)"]
    M -- "ReferenceError: processingTimestamp is not defined" --> X["UNCAUGHT EXCEPTION\n(Line 562)"]
    X --> N["AIDetectionHub Catch Block (Line 257)\nsetInferenceResult(null)"]
    N --> O["UI Renders Null State:\nRoad: 0, Latency: NOT MEASURED, Incidents: 0"]
```

---

## 3. Step 2 — Model & Runtime Verification Checklist

| Verification Check | Status | Technical Details & Findings |
| :--- | :---: | :--- |
| **1. Correct RDD2022 File Loaded?** | **YES** | `public/models/rdd2022-road-damage.onnx` (44,723,865 bytes, 42.65 MB). Verified YOLOv8s. |
| **2. ONNX Runtime Web Initialized?** | **YES** | Session created with `wasm` execution provider successfully. |
| **3. Input Tensor Correct?** | **YES** | Input tensor name `'images'`, shape `[1, 3, 640, 640]`, Float32. |
| **4. RGB Preprocessing Correct?** | **YES** | CHW layout `[1, 3, 640, 640]`, normalized strictly by dividing pixel intensities by $255.0$. |
| **5. Resizing & Letterboxing Correct?** | **YES** | Aspect ratio preserved with neutral gray `rgb(114, 114, 114)` padding. Scaled coordinates clamped to natural dimensions. |
| **6. Output Tensor Decoding Correct?** | **YES** | Output shape `[1, 8, 8400]`. Box center-x, center-y, width, height extracted from rows 0–3; class scores extracted from rows 4–7. |
| **7. Class Indices Mapped Correctly?** | **YES** | Class 0: `D00` (Longitudinal), 1: `D10` (Transverse), 2: `D20` (Alligator), 3: `D40` (Pothole). Row 7 accurately corresponds to `D40`. |
| **8. Confidence Thresholds Correct?** | **YES** | Standalone threshold $\tau = 0.50$, candidate threshold $\tau = 0.25$. Max D40 score on image is $0.8675$ (well above threshold). |
| **9. NMS Suppressing Valid Potholes?** | **YES (Working Correctly)** | IoU threshold $0.45$. Correctly suppressed 17 redundant duplicate anchors while preserving 3 spatially distinct pothole craters. |
| **10. JavaScript / Runtime Errors?** | **CRITICAL FAILURE IDENTIFIED** | **`ReferenceError: processingTimestamp is not defined`** occurred at `civicSeverityService.js:562`. Caught by outer pipeline error handler which wiped state to `null`. |

---

## 4. Root Cause Analysis

### The Bug:
In `src/services/civicSeverityService.js`, the function `performContextualArbitration` was declared with the following signature:
```javascript
// BEFORE FIX:
export function performContextualArbitration({
  roadDetections = [],
  wasteDetections = [],
  floodResult = null,
  metadata = { latitude: null, longitude: null, timestamp: null, isGpsVerified: false }
}) { ... }
```
Notice that `processingTimestamp` was **omitted from the destructured parameter list**.  
However, at line 562 inside the function body, the code executed:
```javascript
const processingTimeStr = processingTimestamp || new Date().toISOString();
```
Because `processingTimestamp` was neither a function parameter nor a global variable, JavaScript threw an immediate:
```
ReferenceError: processingTimestamp is not defined
    at performContextualArbitration (civicSeverityService.js:562:29)
    at Module.calculateVisualDetectionsSeverity (civicSeverityService.js:991:23)
```

### The Cascade Effect in React:
1. In `src/components/AIDetectionHub.jsx`, `runInferencePipeline` caught the `ReferenceError` in its `catch (err)` block.
2. The catch block executed:
   ```javascript
   catch (err) {
     console.warn(`[INFERENCE_PIPELINE_ERROR] Request #${reqSeq} error:`, err);
     if (isMounted && reqSeq === activeRequestSeqRef.current) {
       setInferenceResult(null);
     }
   }
   ```
3. Because `inferenceResult` was set to `null`:
   - `rawRoad` defaulted to `[]` $\rightarrow$ Rendered `"0 detection(s)"`.
   - `timing` was `undefined` $\rightarrow$ Rendered `"Road Model Latency: LATENCY NOT MEASURED"`.
   - `devDiagnostics` was `undefined` $\rightarrow$ Rendered `"Raw Candidates Screened: 0 proposals"`.
   - `civicIncidents` was `[]` $\rightarrow$ Rendered `"0 Confirmed"`.

---

## 5. Step 4 — Remediation Implemented

### File Modified:
`src/services/civicSeverityService.js` (line 429)

### Fix Implemented:
Added `processingTimestamp = null` to the destructured parameter specification of `performContextualArbitration`:
```javascript
// AFTER FIX:
export function performContextualArbitration({
  roadDetections = [],
  wasteDetections = [],
  floodResult = null,
  metadata = { latitude: null, longitude: null, timestamp: null, isGpsVerified: false },
  processingTimestamp = null
}) {
  // ...
  const processingTimeStr = processingTimestamp || new Date().toISOString();
  // Safe resolution without ReferenceError
}
```

Zero modifications were made to the Model A ONNX binary.  
Zero confidence thresholds were lowered.  
Zero synthetic data or mock detections were introduced.

---

## 6. Step 3 & Step 5 — Empirical Verification Results

Direct inference was executed using Model A (`rdd2022-road-damage.onnx`) across the test suite:

### 1. Default Sample Image (`public/assets/potholes_drone.png`):
- **Natural Resolution:** $1024 \times 1024$
- **Input Dimensions:** `[1, 3, 640, 640]`
- **Output Dimensions:** `[1, 8, 8400]`
- **Raw D40 Candidates ($\ge 0.25$):** 28 proposals
- **Maximum D40 Confidence:** **$0.8675$ (86.75%)**
- **Post-Threshold Detections ($\ge 0.50$):** 20 proposals
- **Post-NMS Confirmed Detections:** **3 distinct potholes**
  - Detection 1: `Pothole (D40)`, Conf: **$0.8675$**, Box: `[554.4, 718.4, 686.8, 852.5]`
  - Detection 2: `Pothole (D40)`, Conf: **$0.7225$**, Box: `[315.9, 678.8, 406.7, 742.9]`
  - Detection 3: `Pothole (D40)`, Conf: **$0.5078$**, Box: `[601.6, 400.6, 656.2, 434.6]`
- **Inference Latency:** **165.82 ms**
- **Municipal Incident Generated:** `CS-INC-RD-259125-04` ("3 Road Surface Defects", Severity: `HIGH`, Priority: `HIGH`, Department: `Highways / Roads & Pavement Maintenance`).

### 2. Real Pothole Benchmark (`pathole 1.webp`):
- **Dimensions:** $340 \times 256$
- **Inference Latency:** **165.38 ms**
- **Max D40 Confidence:** **$0.8157$**
- **Post-NMS Detections:** 1 Pothole (`D40`, conf $0.8157$)

### 3. Clustered Potholes (`pathole 4.webp`):
- **Dimensions:** $361 \times 262$
- **Inference Latency:** **148.16 ms**
- **Post-NMS Detections:** **5 distinct potholes** (`D40`, conf: $0.7448, 0.6948, 0.6899, 0.6369, 0.5665$)

### 4. Road Crack Benchmark (`pathole 15.webp`):
- **Dimensions:** $738 \times 414$
- **Inference Latency:** **154.00 ms**
- **Post-NMS Detections:** 1 Alligator Crack (`D20`, conf $0.5038$)

### 5. Clean Road Negative Control (`road without pothole.webp`):
- **Dimensions:** $353 \times 226$
- **Inference Latency:** **155.97 ms**
- **Max D40 Confidence:** $0.0004$
- **Post-Threshold Detections:** **0 (100% specificity / 0 false alarms)**

---

## 7. Full Regression & Security Suite Results

Following the fix, the full system verification suites were executed:

1. **94-Image Empirical Regression Audit:**
   - Flood screening ($\ge 5\%$): 30/32 (**PASS**)
   - Significant flood ($> 25\%$): 25/32 (**PASS**)
   - Road D40 ($\ge 0.50$): 12/32 (**PASS**)
   - Any road defect ($\ge 0.25$): 17/32 (**PASS**)
   - Raw waste detections: 24/30 (**PASS**)
   - Arbitrated waste detections: 22/30 (**PASS**)
   - Water-filled pothole fusion: 9/9 (**PASS**)
   - **Verdict: 0 REGRESSIONS — 100% EXACT PARITY**
2. **Phase 12 Enterprise Suite:** **22 / 22 Passed (100%)**
3. **Phase 11 Security Suite:** **20 / 20 Passed (100%)**
4. **Secret & Random Audit:** **0 secrets committed | 0 `Math.random()` in code**
5. **Vite Production Build:** **Compiled in 2.08s with exit code 0**

---

## 8. Conclusion

The critical zero-detection bug has been fully resolved. The RDD2022 road model inference, output decoding, Non-Maximum Suppression, contextual cross-model arbitration, and civic severity scoring now execute smoothly without runtime exceptions, producing verified real-time detections and measured hardware latencies in the AI Detection Hub.

