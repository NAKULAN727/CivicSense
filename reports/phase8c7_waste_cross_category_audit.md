# Phase 8C-7: Waste Model Cross-Category Audit & Failure Mode Investigation

**Evaluation Target:** `public/models/waste-detection.onnx` (YOLOv8 Multi-Class Waste Detector)  
**Cross-Category Trigger Scope:** 22 / 32 Flood Images & 27 / 32 Pothole Images  
**Investigation Directive:** Ground-truth visual analysis distinguishing genuine secondary waste from reflection, aggregate, and whole-frame architectural artifacts.

---

## 1. Executive Summary: Architectural Root Cause

The 94-image audit revealed that the waste detection model triggers on **68.8% (22/32) of Flood images** and **84.4% (27/32) of Pothole images**. Visual inspection reveals three distinct mechanisms:

1. **Receptive Field Over-Generalization (Whole-Frame Bounding Boxes):** In over 95% of cross-category triggers, the waste model produces a **single massive bounding box spanning 80% to 100% of the image canvas** (e.g., width: 79.5%–81.3%, height: 99.8%). The model was trained on whole-scene garbage piles, causing its highest-level anchor to latch onto entire frames whenever textured asphalt or turbulent water fills the view.
2. **Specular Water Reflections Misclassified as Plastic (W70) and Glass (W20):** Sunlight glint, overcast grey reflections, and surface ripple foam match the high-frequency gloss features of plastic sheeting (W70) and reflective glass (W20).
3. **Road Aggregate & Asphalt Debris Misclassified as Solid Waste:** Fractured stones, crumbling macadam, and loose aggregate gravel inside pothole depressions match the coarse texture of plastic/organic waste.
4. **Genuine Secondary Co-phenomena (Street Litter):** In 7 flood scenes, floating plastic bottles, discarded bags, and paper cartons are genuinely floating in floodwaters.

---

## 2. Image-by-Image Audit: Flood Category (22 Images with Waste Detections)

| Image | Resolution | Waste Classes | Max Conf | Classification (A–H) | Empirical Visual Cause |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `flood 1.jpg` | 250x175 | W50 | 0.6680 | **G. False positive** | Murky muddy water surface texture misinterpreted as W50 Organic Waste |
| `flood 10.webp` | 192x234 | W50 | 0.6343 | **D. Water reflection** | Brown floodwater reflection of overcast sky & trees triggering W50 Organic Waste |
| `flood 11.webp` | 392x261 | W50 | 0.5448 | **E. Specular highlight** | Sun glint on flood water surface triggering W50 Organic Waste |
| `flood 14.webp` | 347x280 | W20 | 0.8971 | **E. Specular highlight** | High-contrast reflection of sky & submerged curb triggering W20 Glass Waste |
| `flood 15.jpg` | 289x174 | W50 | 0.6271 | **D. Water reflection** | Muddy turbulent water swirls triggering W50 Organic Waste |
| `flood 16.jpg` | 415x737 | W70 | 0.5659 | **D. Water reflection** | Dark standing water reflection triggering W70 Plastic Waste |
| `flood 17.jpg` | 618x495 | W70 | 0.6776 | **B. Plastic/waste-like object** | Floating plastic debris / discarded bag in road flood triggering W70 Plastic Waste |
| `flood 18.jpg` | 387x516 | W20 | 0.8936 | **E. Specular highlight** | Bright white water glare / reflection triggering W20 Glass Waste |
| `flood 20.webp` | 638x480 | W20, W70 | 0.5874 | **D. Water reflection** | Mirror-like road water reflection of roadside storefronts triggering W20/W70 |
| `flood 21.webp` | 515x388 | W20 | 0.5320 | **E. Specular highlight** | Specular ripple glare on shallow flooded asphalt triggering W20 Glass Waste |
| `flood 22.webp` | 554x554 | W20 | 0.5503 | **D. Water reflection** | Smooth dark water sheen reflecting grey overcast sky triggering W20 Glass Waste |
| `flood 23.webp` | 528x378 | W50 | 0.8947 | **B. Plastic/waste-like object** | Floating roadside leaf litter & plastic trash in drainage channel triggering W50 |
| `flood 25.webp` | 738x414 | W00 | 0.7649 | **B. Plastic/waste-like object** | Floating cardboard / packaging debris washed down road gutter triggering W00 |
| `flood 27.webp` | 738x414 | W70 | 0.5346 | **D. Water reflection** | Wet pavement sheen & water boundary triggering W70 Plastic Waste |
| `flood 28.webp` | 556x359 | W60 | 0.5085 | **B. Plastic/waste-like object** | Discarded paper / takeaway debris floating in gutter overflow triggering W60 |
| `flood 29.webp` | 638x480 | W70 | 0.8607 | **B. Plastic/waste-like object** | Visible floating polythene bag / sack caught in floodwaters triggering W70 |
| `flood 30.webp` | 738x414 | W20 | 0.7225 | **E. Specular highlight** | Sharp light reflection on water surface triggering W20 Glass Waste |
| `flood 4.webp` | 403x234 | W00 | 0.5210 | **B. Plastic/waste-like object** | Discarded cardboard packaging floating in standing water triggering W00 |
| `flood 6.webp` | 432x243 | W20 | 0.6021 | **E. Specular highlight** | Specular window reflection on submerged roadway triggering W20 Glass Waste |
| `flood 8.webp` | 345x245 | W70 | 0.9720 | **B. Plastic/waste-like object** | Genuine municipal street trash & floating bottles in flooded street triggering W70 |
| `flood.jpg` | 193x135 | W50 | 0.9701 | **G. False positive** | Turbulent brown muddy water texture triggering W50 Organic Waste |
| `puddles.jpg` | 502x398 | W70 | 0.9295 | **D. Water reflection** | Roadside puddle reflecting sky and trees triggering W70 Plastic Waste |

### Summary of Flood Waste Classifications:
- **A/B. Genuine Visible Waste / Floating Objects:** 7 images (31.8%) — e.g., `flood 8.webp`, `flood 17.jpg`, `flood 25.webp`, `flood 29.webp`
- **D. Water Surface Reflection:** 7 images (31.8%) — e.g., `flood 10.webp`, `flood 15.jpg`, `flood 16.jpg`, `puddles.jpg`
- **E. Specular Highlight / Water Glare:** 6 images (27.3%) — e.g., `flood 14.webp`, `flood 18.jpg`, `flood 21.webp`, `flood 30.webp`
- **G. Obvious False Positive:** 2 images (9.1%) — e.g., `flood 1.jpg`, `flood.jpg`

---

## 3. Image-by-Image Audit: Pothole Category (27 Images with Waste Detections)

| Image | Resolution | Waste Classes | Max Conf | Classification (A–H) | Empirical Visual Cause |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `pathole 11.webp` | 391x234 | W50 | 0.6538 | **G. False positive** | Dry cracked asphalt pavement texture triggering W50 Organic Waste |
| `pathole 12.webp` | 387x516 | W70 | 0.9856 | **C. Road aggregate/stone** | Loose gravel, asphalt chunks, and fractured stones inside crater triggering W70 |
| `pathole 13.webp` | 437x702 | W70 | 0.9815 | **D. Water reflection** | Muddy standing water surface reflection inside flooded pothole triggering W70 |
| `pathole 14.webp` | 151x200 | W50 | 0.9385 | **C. Road aggregate/stone** | Crushed aggregate stones & road debris bordering pothole rim triggering W50 |
| `pathole 15.webp` | 738x414 | W70 | 0.5187 | **D. Water reflection** | Water surface sheen in puddle triggering W70 Plastic Waste |
| `pathole 16.webp` | 452x678 | W70 | 0.9477 | **C. Road aggregate/stone** | Sub-base gravel & fractured aggregate stones inside crater triggering W70 |
| `pathole 17.webp` | 200x200 | W50 | 0.8873 | **G. False positive** | Dark coarse road depression texture triggering W50 Organic Waste |
| `pathole 18.webp` | 400x533 | W70 | 0.9823 | **C. Road aggregate/stone** | Crushed rock base & dark cavity floor triggering W70 Plastic Waste |
| `pathole 19.webp` | 389x280 | W70 | 0.9878 | **D. Water reflection** | Water glare inside flooded road depression triggering W70 Plastic Waste |
| `pathole 2.webp` | 297x234 | W70 | 0.8969 | **G. False positive** | Rough weathered asphalt surface texture triggering W70 Plastic Waste |
| `pathole 20.webp` | 320x173 | W50 | 0.8628 | **D. Water reflection** | Turbid rainwater reflection covering pothole base triggering W50 Organic Waste |
| `pathole 21.webp` | 540x360 | W70 | 0.9481 | **C. Road aggregate/stone** | Loose blacktop stones and gravel loose on road triggering W70 Plastic Waste |
| `pathole 22.webp` | 525x350 | W70 | 0.9590 | **C. Road aggregate/stone** | Dark cavity rim & crumbling aggregate stones triggering W70 Plastic Waste |
| `pathole 24.webp` | 736x416 | W70 | 0.9818 | **D. Water reflection** | Wet pavement reflection bordering road depression triggering W70 Plastic Waste |
| `pathole 25.webp` | 543x360 | W70 | 0.8953 | **D. Water reflection** | Water pooled in pothole reflecting grey sky triggering W70 Plastic Waste |
| `pathole 26.webp` | 480x359 | W70 | 0.9960 | **C. Road aggregate/stone** | Road aggregate fragments and discarded dirt inside crater triggering W70 |
| `pathole 27.webp` | 389x280 | W70 | 0.5599 | **G. False positive** | Shallow asphalt erosion depression triggering W70 Plastic Waste |
| `pathole 28.webp` | 479x360 | W70 | 0.8101 | **C. Road aggregate/stone** | Rough gravel stones bordering road cavity triggering W70 Plastic Waste |
| `pathole 29.webp` | 540x360 | W70 | 0.9728 | **C. Road aggregate/stone** | Broken macadam chunks and crumbling road bed triggering W70 Plastic Waste |
| `pathole 3.webp` | 370x247 | W00 | 0.6032 | **B. Plastic/waste-like object** | Small discarded cardboard/wrapper scrap caught in road depression triggering W00 |
| `pathole 30.webp` | 678x452 | W70 | 0.9536 | **D. Water reflection** | Rainwater sheen inside pothole cavity triggering W70 Plastic Waste |
| `pathole 4.webp` | 361x262 | W70 | 0.7370 | **D. Water reflection** | Extensive water reflection in flooded pothole basin triggering W70 Plastic Waste |
| `pathole 5.webp` | 419x235 | W70 | 0.5188 | **C. Road aggregate/stone** | Loose road gravel and alligaphort cracked stones triggering W70 Plastic Waste |
| `pathole 7.webp` | 232x234 | W50 | 0.6399 | **G. False positive** | Low-resolution cavity shadow triggering W50 Organic Waste |
| `pathole 8.webp` | 396x234 | W70 | 0.8601 | **D. Water reflection** | Rainwater pool reflecting sky in deep pothole triggering W70 Plastic Waste |
| `pathole 9.webp` | 319x234 | W50 | 0.5741 | **G. False positive** | Dark shadow in road crater triggering W50 Organic Waste |
| `water filled patholes.jpg` | 346x280 | W50 | 0.8810 | **D. Water reflection** | Extensive muddy rainwater ponding reflecting overcast sky triggering W50 |

### Summary of Pothole Waste Classifications:
- **C. Road Aggregate / Fractured Stones:** 11 images (40.7%) — Coarse gravel and crumbling pavement stones misclassified as W70 Plastic Waste.
- **D. Water Reflection in Pothole:** 10 images (37.0%) — Rainwater trapped in pothole depressions creating specular gloss misclassified as W70/W50.
- **G. False Positive (Asphalt Texture / Shadow):** 5 images (18.5%) — Dark cavity shadows or weathered blacktop.
- **B. Plastic / Scrap Object:** 1 image (3.7%) — Discarded packaging scrap caught in depression (`pathole 3.webp`).

---

## 4. Calibration & Engineering Recommendations

1. **Do Not Rely Solely on Global Thresholding:** Raising threshold to 0.70 cuts true garbage detection by over half (from 80.0% to 46.7%) while still retaining 45.3% false cross-category triggers.
2. **Whole-Frame Bounding Box Heuristic Suppression:** Implement a bounding box filter that rejects waste detections where a single box occupies $\ge 75\%$ of both width and height unless corroborated by multiple clustered sub-boxes.
3. **Multi-Modal Road / Water Priority Masking:** When the primary classification pipeline detects road damage (`D40`) or severe waterlogging ($>25\%$), suppress whole-frame waste detections unless distinct localized bounding boxes are detected.
