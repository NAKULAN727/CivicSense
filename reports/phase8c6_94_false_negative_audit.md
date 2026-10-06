# Phase 8C-6: False-Negative Audit & Zero-Detection Analysis (94 Real Images)

## Overview

This audit identifies images in the primary target folders where the model pipeline failed to produce a relevant category detection at standard production thresholds (Confidence >= 0.50 for Road/Waste, Water Coverage >= 5.0% for V-FloodNet).

### Zero-Detection Rates by Category

- **Flood Category (32 images):** 2 missed (< 5.0% coverage) = 6.25% zero-detection rate
- **Pothole Category (32 images):** 15 missed (0 road detections) = 46.88% zero-detection rate
- **Garbage Category (30 images):** 6 missed (0 waste detections) = 20.0% zero-detection rate

## Detailed Zero-Detection / Missed Defect Table

| Image | Category | Resolution | Model Output | Probable Root Cause | Recommended Mitigation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `flood 23.webp` | Flood | 528x378 | Water=2.68% | Subtle shallow puddles or dark pavement absorbing reflection | Inspect image resolution and illumination |
| `flood 27.webp` | Flood | 738x414 | Water=2.46% | Subtle shallow puddles or dark pavement absorbing reflection | Inspect image resolution and illumination |
| `pathole 17.webp` | Pothole | 200x200 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 19.webp` | Pothole | 389x280 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 2.webp` | Pothole | 297x234 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 20.webp` | Pothole | 320x173 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 22.webp` | Pothole | 525x350 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 23.webp` | Pothole | 678x452 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 24.webp` | Pothole | 736x416 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 27.webp` | Pothole | 389x280 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 28.webp` | Pothole | 479x360 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 3.webp` | Pothole | 370x247 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 30.webp` | Pothole | 678x452 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 6.webp` | Pothole | 334x250 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `pathole 9.webp` | Pothole | 319x234 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `road without pothole.webp` | Pothole | 353x226 | 0 road detections | Negative sample (expected clean) | Confirm as true negative |
| `water filled patholes.jpg` | Pothole | 346x280 | 0 road detections | Low contrast / oblique perspective / sub-threshold score | Evaluate lowering threshold to 0.40 or data augmentation |
| `garbage 10.jpg` | Garbage | 678x452 | 0 waste detections | Distant dump / blended organic textures / atypical bag colors | Expand multi-scale tiling or lower confidence threshold to 0.40 |
| `garbage 23.jpg` | Garbage | 678x452 | 0 waste detections | Distant dump / blended organic textures / atypical bag colors | Expand multi-scale tiling or lower confidence threshold to 0.40 |
| `garbage 28.jpg` | Garbage | 678x452 | 0 waste detections | Distant dump / blended organic textures / atypical bag colors | Expand multi-scale tiling or lower confidence threshold to 0.40 |
| `garbage 3.webp` | Garbage | 431x234 | 0 waste detections | Distant dump / blended organic textures / atypical bag colors | Expand multi-scale tiling or lower confidence threshold to 0.40 |
| `garbage 4.webp` | Garbage | 357x257 | 0 waste detections | Distant dump / blended organic textures / atypical bag colors | Expand multi-scale tiling or lower confidence threshold to 0.40 |
| `garbage 8.webp` | Garbage | 358x234 | 0 waste detections | Distant dump / blended organic textures / atypical bag colors | Expand multi-scale tiling or lower confidence threshold to 0.40 |

## Analytical Insights on False Negatives

1. **RDD2022 Pothole Sensitivity:** The YOLOv8 RDD2022 model is highly specific to distinct cavity rims on asphalt. Images with shallow depressions, unpaved gravel roads, or low illumination frequently fall below the 0.50 threshold.
2. **YOLOv8 Waste Detector Texture Invariance:** Garbage piles consisting of homogeneous dirt/decayed organic waste without distinct geometric packaging (cans, bottles, boxes) exhibit lower confidence.
3. **V-FloodNet Waterlogging Robustness:** V-FloodNet maintains an outstanding detection screening rate on street flood scenes across varied lighting and angles.
