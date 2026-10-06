# Phase 8C-8: 94-Image Real-World Regression Test & Calibration Report

**Execution Date:** 2026-10-06  
**Scope:** Complete 94-Image Real-World Municipal Street Dataset  
**Baseline:** Phase 8C-6 Baseline Audit vs Phase 8C-8 Evidence-Based Calibrated Candidate  
**Integrity Guarantee:** Zero `Math.random()`, zero synthetic fallbacks, 100% deterministic ONNX execution.

---

## 1. Executive Summary & Verdict

### Final Calibration Verdict:
# **B. CALIBRATION PARTIALLY SUCCESSFUL — KEEP SHADOW MODE**

### Before vs After Comparative Metrics:

| Performance Metric | Phase 8C-6 Baseline | Phase 8C-8 Calibrated Candidate | Net Delta | Architectural Impact |
| :--- | :---: | :---: | :---: | :--- |
| **Flood Screening Rate ($\ge 5\%$)** | 30 / 32 (93.8%) | 30 / 32 (93.8%) | 0.0% | 100% sensitivity preserved |
| **Significant Flood Rate ($> 25\%$)** | 25 / 32 (78.1%) | 25 / 32 (78.1%) | 0.0% | Zero legitimate flood scenes lost |
| **Topology Guard Safety (Ratio $\ge 60\%$)** | N/A | 25 / 25 retained (100.0%) | 0 lost | 100% safety on major inundations |
| **Road Pothole (D40) Detection Rate** | 12 / 32 (37.5%) | 12 / 32 (37.5%) | 0.0% | 0.50 threshold preserved |
| **Any Road Defect Detection Rate** | 17 / 32 (53.1%) | 17 / 32 (53.1%) | 0.0% | D00–D40 baseline preserved |
| **Water-Filled Pothole Fusion Count** | 9 cases | 9 cases | 0 lost | Multi-modal hazard capture fully validated |
| **Raw Waste Screening Rate** | 24 / 30 (80.0%) | 24 / 30 (80.0%) | 0.0% | Baseline model unchanged |
| **Waste Cross-Triggers on Flood** | 22 / 32 (68.8%) | 1 / 32 (3.1%) *(with 75% filter)* | **-65.7%** | Water ripple artifacts eliminated |
| **Waste Cross-Triggers on Pothole** | 27 / 32 (84.4%) | 1 / 32 (3.1%) *(with 75% filter)* | **-81.3%** | Road gravel artifacts eliminated |
| **Waste Detection on True Garbage** | 24 / 30 (80.0%) | 1 / 30 (3.3%) *(with naive filter)* | **-76.7%** | **CATASTROPHIC (Proves naive deletion must not be used)** |

---

## 2. Detailed Category-by-Category Findings

### A. Flood Model & Topology Guard
- **30 / 32 (93.75%)** of flood images screened successfully.
- The 2 missed cases (`flood 23.webp` at 2.68% and `flood 27.webp` at 2.46%) were verified as localized shallow gutter water and receded runoff, appropriately scoring below the 5.0% navigational significance floor.
- The $60.0\%$ monolithic topology continuity guard retained **100% of significant flood scenes** (25/25), demonstrating zero penalty on genuine urban inundation.

### B. Road Damage Model
- **12 / 32 (37.5%)** detected D40 potholes at production threshold ($\ge 0.50$).
- **17 / 32 (53.1%)** detected structural road defects (including 5 severe D20 Alligator Crack networks).
- Negative control sample `road without pothole.webp` produced exactly **0 detections** (100% specificity pass).
- Submerged pothole benchmark `water filled patholes.jpg` (77.59% water) honestly produced 0 road detections because cavity rims are completely underwater, and was correctly prioritized by V-FloodNet as Significant Waterlogging.

### C. Waste Model & Geometric Sweep
- Sweep across 6 thresholds ($60\% 	imes 60\%$ to $85\% 	imes 85\%$) proved that naive geometric filtering acts as a blunt instrument.
- While it eliminates 47 out of 49 cross-category false positives, it simultaneously destroys 23 out of 24 legitimate garbage detections because `waste-detection.onnx` generates whole-scene boxes natively.
- **Recommended Solution:** Contextual Cross-Model Arbitration (suppress whole-frame waste *only* when Road or Flood defects are actively present).

### D. Multi-Modal Fusion Verification
- Verified on all 10 target benchmark samples:
  - 9 out of 10 triggered `WATER-FILLED POTHOLE` fusion (`pathole 1`, `4`, `8`, `10`, `13`, `14`, `25`, `26`, `30`).
  - 1 sample (`water filled patholes.jpg`) was prioritized as `SIGNIFICANT WATERLOGGING`.

---

## 3. Production Safety & Model Preservation

- `public/models/rdd2022-road-damage.onnx` — **100% Preserved & Active**
- `public/models/waste-detection.onnx` — **100% Preserved & Active**
- `public/models/flood-water-segmentation.onnx` — **100% Preserved & Active**
- `scratch/vfloodnet_deeplabv3plus.onnx` — **Maintained in Shadow Mode**
- All 94 images in `Real Test Datas` — **100% Unchanged & Intact**
