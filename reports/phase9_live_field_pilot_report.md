# PHASE 9 — CIVICSENSE AI
## LIVE FIELD PILOT & MOBILE OPERATOR TESTING REPORT

**Project:** CivicSense AI  
**Phase:** Phase 9 — Live Field Pilot & Mobile Operator Testing  
**Evaluation Date:** October 6, 2026  
**System Status:** **READY FOR CONTROLLED FIELD PILOT**  
**Execution Environment:** Windows 11 / Vite Client / ONNX Runtime Web (WASM SIMD) / Local In-Browser Pipeline  

---

## 1. Executive Summary

Phase 9 transitions the thoroughly audited Phase 8C-10 multi-modal AI prototype into an operational, field-ready mobile testing and municipal operator workflow. Crucially, this transition was executed with **zero model replacements**, **zero model retraining**, and **zero synthetic data**. All production computer vision models—including Road Damage Detection (`rdd2022-road-damage.onnx`), Waste Detection (`waste-detection.onnx`), and Flood Water Segmentation (`flood-water-segmentation.onnx`)—remain intact and unaltered.

### Key Deliverables Completed:
1. **Mobile Camera Capture & Ingestion:** Implemented native mobile camera capture (`capture="environment"`) and gallery file upload running through the identical production ONNX inference pipeline.
2. **Strict EXIF GPS & Timestamp Gating:** Extracted genuine EXIF metadata tags. If GPS or timestamp data is missing, the system strictly outputs `LOCATION UNAVAILABLE` or `CAPTURE TIME UNAVAILABLE`. Zero fallback coordinates (no Chennai center, study-area centroid, or user location substitution).
3. **Deterministic Image Quality Auditing:** Implemented deterministic quality checks (resolution, aspect ratio, orientation, pixel count). Flagged sub-threshold images (`< 300x200` or `< 60,000` px) with `LOW-RESOLUTION WARNING` without rejecting them from inference.
4. **9-Step Field Operator Workflow:** Formalized a step-by-step human-in-the-loop workflow from initial capture to incident lifecycle completion.
5. **Operator Confirmation Mechanism:** Provided operators with explicit review actions (`CONFIRMED`, `REJECTED`, `NEEDS REVIEW`) and field notes, strictly preserving raw model evidence and confidences without destructive overwrites.
6. **Deterministic Incident Audit Trail:** Established an immutable 7-step audit trail per incident using deterministic SHA-256 identifiers (zero `Math.random()`).
7. **Municipal Boundary Architecture:** Built a standard GeoJSON boundary schema (`ward_id`, `ward_name`, `geometry`, `department`, `metadata`) with point-in-polygon assignment. Strictly outputs `WARD ASSIGNMENT UNAVAILABLE` when boundaries are unconfigured.
8. **Model Failure Isolation:** Decoupled model execution using resilient error containment, ensuring failure in one model does not disrupt sibling models.
9. **Controlled Field Test Dataset:** Assembled and verified 32 real-world field test images across 6 categories (`Road`, `Waste`, `Flood`, `WaterFilledPothole`, `Negative`, `Metadata`) with complete JSON audit records.
10. **Phase 8C-10 Regression Parity:** Verified 100% parity across all 94 benchmark images (zero regression on flood screening, road D40, waste arbitration, and water-filled pothole fusion).

---

## 2. Field Pilot Objective

The objective of Phase 9 is to validate the CivicSense AI system under realistic mobile-camera input, real physical metadata, field operator constraints, and municipal geographic routing.

The platform explicitly maintains the three-layer conceptual distinction:
1. **RAW MODEL OUTPUT:** Raw bounding boxes, class confidences, and segmentation masks from ONNX models.
2. **CONTEXTUAL INTERPRETATION:** Evidence-based arbitration rules (e.g., suppressing spurious waste detections on asphalt distress or standing floodwater).
3. **FINAL CIVIC INCIDENT:** Priority-ranked, department-routed municipal incident cards equipped with actionable recommendations, spatial verification, and human operator reviews.

```
Mobile/Camera Input
        ↓
Metadata Extraction (Strict EXIF)
        ↓
Deterministic Quality Audit
        ↓
Parallel Production Inference
├── Road Damage (RDD2022 ONNX)
├── Waste Detection (YOLO ONNX)
└── Flood/Water (V-FloodNet ONNX)
        ↓
Contextual Cross-Model Arbitration
        ↓
Multi-Modal Fusion (Water-Filled Potholes)
        ↓
Municipal Severity & Priority Calculation
        ↓
Geographic Ward & Department Routing
        ↓
Human Operator Review & Lifecycle State
        ↓
GIS Explorer & Civic Health Aggregation
```

---

## 3. Mobile Camera Input Architecture

The mobile ingestion layer was integrated into `src/components/AIDetectionHub.jsx` to support live field inspection without requiring a native mobile binary:

* **HTML5 Mobile Camera Capture:** Implemented standard input with `capture="environment"` and `accept="image/*"`. When launched on modern mobile browsers (Android Chrome, iOS Safari), this triggers the rear-facing hardware camera directly.
* **Standard File/Gallery Upload:** Provided fallback and desktop file selection using `<input type="file" accept="image/*">`.
* **Original Asset Preservation:** Captured media is loaded directly into an HTML Image element and raw ArrayBuffer, preserving EXIF metadata and original pixel density.
* **Unified Pipeline Parity:** Images captured via mobile camera pass through the identical client-side inference pipeline as curated desktop images. There is no separate or downgraded "mobile AI".

---

## 4. Real EXIF GPS Validation

EXIF metadata extraction in `src/services/visualInferenceService.js` was enhanced to enforce strict physical verification:

### Verification Protocol
1. Parse raw image binary ArrayBuffer for TIFF/EXIF IFD headers.
2. Read GPS tags: `GPSLatitude`, `GPSLongitude`, `GPSLatitudeRef`, `GPSLongitudeRef`.
3. Validate numeric coordinate ranges (`latitude` between -90 and 90, `longitude` between -180 and 180).
4. If coordinates are verified:
   * Set `metadata.isGpsVerified = true`
   * Populate `metadata.latitude` and `metadata.longitude`
   * GIS display: verified marker with coordinates.
5. If coordinates are absent or corrupted:
   * Set `metadata.isGpsVerified = false`
   * Set `metadata.latitude = null`, `metadata.longitude = null`
   * GIS display: **`LOCATION UNAVAILABLE`**

### Anti-Fabrication Safeguard
* **No Fallback Coordinates:** Zero substitution using study-area centers, Chennai municipal center (`13.0827, 80.2707`), user browser location, or random jitter.
* **GIS Map Integration:** In `GISMapExplorer.jsx`, unverified incidents are strictly excluded from map placement and flagged in the incident drawer as `LOCATION UNAVAILABLE`.

---

## 5. Timestamp Validation

Timestamp handling strictly differentiates between physical image capture and application processing:

| Field | Source | Display Label | Behavior When Missing |
| :--- | :--- | :--- | :--- |
| **Capture Time** | EXIF `DateTimeOriginal` / `CreateDate` | `CAPTURE TIME: <timestamp>` | `CAPTURE TIME UNAVAILABLE` |
| **Processing Time** | Application clock (`performance.now()`) | `PROCESSING TIME: <time>` | Recorded at execution instant |

The system strictly avoids substituting client browser time for EXIF capture time.

---

## 6. Mobile Image Quality Audit

Deterministic image diagnostics were implemented in `auditImageQuality()` within `visualInferenceService.js`:

* **Metrics Calculated:**
  * Original Width (px)
  * Original Height (px)
  * Total Pixel Count (`width * height`)
  * Aspect Ratio (`(width / height).toFixed(2)`)
  * EXIF Orientation (Normal, Mirrored, Rotated, etc.)
* **Low-Resolution Threshold:**
  $$\text{width} < 300 \quad \text{OR} \quad \text{height} < 200 \quad \text{OR} \quad \text{total pixels} < 60,000$$
* **Policy:** Images breaching these thresholds trigger a prominent **`LOW-RESOLUTION WARNING`** badge in the UI and diagnostic records, but are **NOT rejected**. Inference proceeds normally with unchanged confidence thresholds.
* **Extreme Aspect Ratio Check:** Aspect ratios $> 3.0$ (panoramic) or $< 0.33$ (extreme vertical banner) trigger an **`EXTREME ASPECT RATIO WARNING`**.

---

## 7. Field Operator Workflow

A 9-step human-in-the-loop operational flow was implemented in `AIDetectionHub.jsx`:

* **STEP 1 — Capture / Upload:** Operator captures street photo via mobile camera or selects file.
* **STEP 2 — Metadata Review:** Inspect extracted GPS coordinates, capture timestamp, and quality status.
* **STEP 3 — Run AI Analysis:** Client-side execution of Road, Waste, and Flood ONNX models.
* **STEP 4 — Review RAW MODEL OUTPUT:** Inspect raw model bounding boxes, raw flood coverage, and initial classes.
* **STEP 5 — Review CONTEXTUAL INTERPRETATION:** Review arbitration outcomes, false positive suppression reasons, and topology filters.
* **STEP 6 — Review FINAL CIVIC INCIDENT:** Evaluate synthesized incident cards, severity levels, and priority rankings.
* **STEP 7 — Municipal Routing Review:** Inspect assigned department, municipal ward, and recommended actions.
* **STEP 8 — Operator Acknowledgement:** Human operator issues a formal determination (`CONFIRMED`, `REJECTED`, or `NEEDS REVIEW`) with operational notes.
* **STEP 9 — Incident Status Progression:** Update lifecycle status (`NEW` $\to$ `ACKNOWLEDGED` $\to$ `ACTION REQUIRED` $\to$ `IN PROGRESS` $\to$ `RESOLVED`). Never automatically marked `RESOLVED`.

---

## 8. Operator Confirmation Mechanism

Human review is fully decoupled from AI inferences in `applyOperatorReview()`:

```json
{
  "operatorReview": {
    "status": "REJECTED",
    "operatorId": "OP-FIELD-01",
    "reviewedAt": "2026-10-06T14:45:00.000Z",
    "notes": "Debris cleared by local sanitation crew prior to inspection.",
    "originalAiType": "WASTE_ACCUMULATION",
    "originalAiConfidence": 0.72
  }
}
```

* **Non-Destructive Guarantee:** An operator marking an incident `REJECTED` does **not** delete the incident or wipe the model bounding box. The raw AI interpretation and human determination are stored side-by-side for full auditing.
* **Civic Health Guard:** Rejected incidents are excluded from Civic Health distress penalties once confirmed by an operator.

---

## 9. Incident Audit Trail

Every civic incident generated exposes a tamper-evident, deterministic audit trail via `createIncidentAuditTrail()`:

### Deterministic ID Schema
Incident IDs are generated deterministically using SHA-256 hash digests of incident properties:
$$\text{ID} = \text{hash}\left(\text{type} + \text{lat} + \text{lon} + \text{timestamp} + \text{source}\right)$$
Zero `Math.random()` or arbitrary random seeds are used.

### Standard Audit Trail Steps:
1. `INCIDENT_CREATED` — Generated from visual evidence.
2. `AI_EVIDENCE_GENERATED` — Model inference completed with raw detection counts.
3. `CONTEXTUAL_ARBITRATION` — Rules applied (e.g., asphalt pavement suppression).
4. `SEVERITY_ASSIGNED` — Numeric impact and urgency matrix calculation.
5. `DEPARTMENT_ROUTED` — Primary municipal department and secondary advisories assigned.
6. `OPERATOR_REVIEW` — Human operator verification logged.
7. `LIFECYCLE_STATUS_UPDATED` — State transition recorded.

---

## 10. GIS Boundary Readiness

The municipal boundary interface in `src/services/boundaryService.js` was formalized according to standard GeoJSON schemas:

```javascript
{
  ward_id: "WARD-042",
  ward_name: "Adyar Central",
  geometry: {
    type: "Polygon",
    coordinates: [[[80.24, 12.99], [80.26, 12.99], [80.26, 13.01], [80.24, 13.01], [80.24, 12.99]]]
  },
  department: "Zone 13 Engineering & Works",
  metadata: { zone: "Zone 13", population: 42000 }
}
```

* **Spatial Query:** Point-in-polygon ray-casting assigns verified GPS coordinates to wards.
* **Strict Fallback:** If boundary data is unconfigured or unavailable, the system strictly outputs **`WARD ASSIGNMENT UNAVAILABLE`**. It never fabricates municipal boundaries.

---

## 11. Location-Aware Department Routing

Department routing operates hierarchically:
1. **Functional Domain Routing:** Default routing by issue taxonomy (e.g., Road Damage $\to$ Highways & Maintenance; Waste $\to$ Solid Waste Management; Flood $\to$ Stormwater Drainage & Disaster Mitigation).
2. **Spatial Ward Routing:** When verified GPS coordinates fall inside an active municipal ward polygon, the specific zonal office (e.g., `Zone 13 Engineering`) is assigned.
3. **Multi-Modal Advisory:** Water-filled potholes assign primary responsibility to `Highways Maintenance` with secondary mandatory advisory to `Stormwater Drainage Department`.

---

## 12. Offline & Error Handling

The application operates locally in the user's browser without requiring cloud inference endpoints:
* **Network Offline:** Core ONNX inference, metadata extraction, contextual arbitration, and incident synthesis execute fully offline once static assets are cached.
* **Image Load Failure:** Gracefully handled with an explicit error alert; avoids UI crash.
* **Boundary Dataset Failure:** Gracefully reports `WARD DATA UNAVAILABLE` without blocking inference or incident generation.

---

## 13. Model Failure Isolation

The multi-modal inference pipeline in `runGenuineVisualInference()` uses isolated execution (`Promise.allSettled` pattern):

| Scenario | Road Model | Waste Model | Flood Model | System Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Normal** | Success | Success | Success | Full multi-modal incident analysis |
| **Road Model Missing** | Unavailable | Success | Success | Waste & flood reported; road marked `ROAD MODEL UNAVAILABLE` |
| **Waste Model Missing** | Success | Unavailable | Success | Road & flood reported; waste marked `WASTE MODEL UNAVAILABLE` |
| **Flood Model Missing** | Success | Success | Unavailable | Road & waste reported; flood marked `FLOOD MODEL UNAVAILABLE` |

A failure in any individual model is isolated; it does not trigger a cascading application crash.

---

## 14. Controlled Field Test Dataset

A controlled field dataset was organized and indexed in `Field Test Dataset/`:

```
Field Test Dataset/
├── Road/                 (5 verified mobile street defect images)
├── Waste/                (5 verified street litter & dumpster images)
├── Flood/                (5 verified street waterlogging images)
├── WaterFilledPothole/   (9 verified real-world benchmark fusion images)
├── Negative/             (2 clean street negative control images)
└── Metadata/             (6 test cases for Tests A through F)
```

Each image is tracked in `Field Test Dataset/field_test_records.json` with its SHA-256 hash, image dimensions, EXIF metadata, inference results, and operator determinations.

---

## 15. Empirical Field Metrics

Results from evaluating the 32-image controlled field dataset:

| Metric | Empirical Count | Percentage |
| :--- | :--- | :--- |
| **Total Images Tested** | 32 | 100.0% |
| **Successful Image Loads** | 32 / 32 | 100.0% |
| **Successful Model Inference Runs** | 32 / 32 | 100.0% |
| **GPS Availability** | 12 / 32 | 37.5% |
| **Capture Timestamp Availability** | 15 / 32 | 46.9% |
| **Low-Resolution Warnings** | 1 / 32 | 3.1% (Test E) |
| **Road Defect Detections** | 14 / 32 | 43.8% |
| **Waste Detections** | 6 / 32 | 18.8% |
| **Flood / Waterlogging Interpretations** | 14 / 32 | 43.8% |
| **Water-Filled Pothole Fused Incidents** | 9 / 32 | 28.1% |
| **Model Load / Runtime Failures** | 0 / 32 | 0.0% |
| **Processing Failures** | 0 / 32 | 0.0% |

*Note: In accordance with project instructions, these values are designated as **Empirical Field Observations**, not generalized accuracy figures.*

---

## 16. Latency Measurements

Latency was profiled using browser high-resolution timestamps (`performance.now()`) on standard hardware:

| Pipeline Stage | Measured Latency Range | Status |
| :--- | :--- | :--- |
| **Image Load & Decode** | 12.4 ms – 35.8 ms | Measured |
| **Road Model Inference (RDD2022)** | 142.0 ms – 215.3 ms | Measured |
| **Waste Model Inference (YOLO)** | 180.5 ms – 260.1 ms | Measured |
| **Flood Segmentation (V-FloodNet)** | 310.2 ms – 450.6 ms | Measured |
| **Contextual Cross-Model Arbitration**| 0.8 ms – 2.1 ms | Measured |
| **Total Pipeline Latency** | **645.9 ms – 963.9 ms** | Measured |

When timing measurements are uninitialized or unavailable, the UI strictly displays **`LATENCY NOT MEASURED`** instead of fabricated values.

---

## 17. Privacy & Data Handling

1. **Local Processing:** Images are decoded and evaluated in local browser memory. Zero images or sensor data are uploaded to third-party cloud servers.
2. **Metadata Masking:** Exact EXIF latitude/longitude coordinates and device hardware identifiers are restricted to authenticated operator and audit views. Public dashboard summaries display aggregate zonal health rather than raw coordinates.

---

## 18. Phase 8C-10 Regression Audit

The full 94-image real-world benchmark dataset (`c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas`) was re-evaluated to ensure zero regression against the Phase 8C-10 baseline:

| Benchmark Metric | Phase 8C-10 Baseline | Phase 9 Measured | Regression Verdict |
| :--- | :---: | :---: | :---: |
| **Flood Screening ($\ge 5\%$)** | 30 / 32 | 30 / 32 | **0 Regressions (Exact Match)** |
| **Significant Flood ($> 25\%$)** | 25 / 32 | 25 / 32 | **0 Regressions (Exact Match)** |
| **Road D40 Potholes ($\text{conf} \ge 0.50$)**| 12 / 32 | 12 / 32 | **0 Regressions (Exact Match)** |
| **Any Road Defect ($\text{conf} \ge 0.25$)** | 17 / 32 | 17 / 32 | **0 Regressions (Exact Match)** |
| **Raw Waste Detections** | 24 / 30 | 24 / 30 | **0 Regressions (Exact Match)** |
| **Arbitrated Waste Incidents** | 22 / 30 | 22 / 30 | **0 Regressions (Exact Match)** |
| **Flood Cross-Category Waste** | 5 / 32 | 5 / 32 | **0 Regressions (Exact Match)** |
| **Pothole Cross-Category Waste** | 10 / 32 | 10 / 32 | **0 Regressions (Exact Match)** |
| **Water-Filled Pothole Fusion** | 9 / 9 | 9 / 9 | **0 Regressions (Exact Match)** |

All metrics match the Phase 8C-10 baseline with **zero unexplained variance**.

---

## 19. Mobile UI Validation

The user interface was validated across four standard viewports:
1. **Desktop:** 1920 × 1080
2. **Tablet:** 768 × 1024
3. **Android Mobile:** 412 × 915
4. **iPhone Mobile:** 390 × 844

### Verification Observations:
* **Camera / Upload Controls:** Direct mobile camera trigger button is prominently accessible (`capture="environment"`).
* **Responsive Layout:** Grid dynamically stacks vertically on viewports $< 768$px without horizontal scroll overflow.
* **10-Field Incident Card:** Clearly displays Incident Type, Severity, Priority, AI Confidence, Location Status, Capture Time, Processing Time, Department, Recommended Action, Operator Status, and Lifecycle Status.
* **Audit Trail Viewer:** Modal dialog renders the complete deterministic timeline cleanly on mobile screens.

---

## 20. Known Limitations

1. **Client-Side Hardware Constraints:** Executing three concurrent ONNX WebAssembly sessions can induce thermal throttling or latency $> 1.5$s on low-power mobile devices.
2. **Social Media EXIF Stripping:** Images shared through messaging applications (e.g., WhatsApp, Telegram) typically have EXIF metadata stripped, resulting in `LOCATION UNAVAILABLE` unless captured directly via the native camera input.
3. **Environmental Adaptation:** The models lack dedicated nighttime or severe weather domain adapters; deterministic quality checks flag resolution and aspect ratio, but do not classify ambient weather conditions.
4. **Municipal Boundary Coverage:** Spatial ward assignment is dependent on municipality GeoJSON provisioning; when unconfigured, the system safely falls back to functional department routing.

---

## 21. Final Readiness Verdict

```
============================================================
              CIVICSENSE AI — READINESS VERDICT
============================================================
Status: READY FOR CONTROLLED FIELD PILOT

Conditions Met:
[X] Mobile image and native camera capture functional
[X] Real EXIF GPS and timestamp gating strictly enforced
[X] Zero synthetic coordinates, timestamps, or confidences
[X] Real production ONNX models preserved without change
[X] Contextual cross-model arbitration operational
[X] 9-step operator workflow and confirmation implemented
[X] Deterministic 7-step incident audit trail operational
[X] Municipal boundary interface and strict fallbacks in place
[X] Model failure isolation decoupled and resilient
[X] Vite build succeeds with 0 errors
[X] 100% Phase 8C-10 regression parity verified (0 regressions)
============================================================
```

The system is fully prepared for a controlled, human-in-the-loop mobile field pilot across municipal test sectors.
