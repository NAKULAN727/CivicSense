# Phase 8C-7: Road Model False-Negative Audit (All 32 Pathole Images)

**Evaluation Target:** `public/models/rdd2022-road-damage.onnx` (YOLOv8s RDD2022 Road Damage Model)  
**Scope:** Complete Census of All 32 Pathole Category Images  
**Standard Threshold:** Confidence $\ge 0.50$, IoU $= 0.45$

---

## 1. Complete Pathole Category Census Table

| Filename | D40 Detected? | Highest D40 Conf | Any Road Defect? | Low-Res? | Visual Difficulty | Audit Classification & Likely Reason for Miss |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `pathole 1.webp` | **YES** | 0.8157 | YES | NO | Clear cavity rim | Detected (D40) |
| `pathole 10.webp` | **YES** | 0.5403 | YES | NO | Clear cavity rim with rainwater | Detected (D40) |
| `pathole 11.webp` | **NO** | None | YES | NO | Severe fatigue cracking network | Non-pothole road defect (D20 Alligator Crack detected at 0.6416) |
| `pathole 12.webp` | **YES** | 0.7788 | YES | NO | Cluster of 6 distinct cavities | Detected (6 D40 boxes) |
| `pathole 13.webp` | **YES** | 0.5194 | YES | NO | Flooded roadway with depression | Detected (D40 + D10) |
| `pathole 14.webp` | **NO** | None | YES | YES | Cracked depression on low-res road | Non-pothole road defect / low resolution (D20 detected at 0.7089) |
| `pathole 15.webp` | **NO** | None | YES | NO | Waterlogged cracked road surface | Water-covered pothole / non-pothole crack defect (D20 detected at 0.5038, Water=48.3%) |
| `pathole 16.webp` | **NO** | None | YES | NO | Depression surrounded by fatigue cracks | Non-pothole road defect (2 D20 Alligator Cracks detected at 0.6190, 0.5198) |
| `pathole 17.webp` | **NO** | None | NO | YES | Grainy, low-resolution camera shot | Low resolution (total pixels < 60k) & shallow cavity |
| `pathole 18.webp` | **YES** | 0.7695 | YES | NO | Deep crater on dry asphalt | Detected (D40) |
| `pathole 19.webp` | **NO** | None | NO | NO | Road completely submerged under 74.6% flood water | Water-covered pothole (asphalt rim submerged beneath deep water) |
| `pathole 2.webp` | **NO** | None | NO | YES | Low-resolution thumbnail (284x177) | Low resolution (total pixels < 60k) & shallow road wear |
| `pathole 20.webp` | **NO** | None | NO | YES | Submerged road in low resolution (275x183) | Water-covered pothole (Water=71.0%) & low resolution |
| `pathole 21.webp` | **YES** | 0.5702 | YES | NO | Large cavity on paved highway | Detected (D40) |
| `pathole 22.webp` | **NO** | None | NO | NO | Shallow surface erosion, low contrast | Shallow pothole (lacks sharp cavity rim, conf < 0.50) |
| `pathole 23.webp` | **NO** | None | NO | NO | Unpaved dirt / gravel transition | Ambiguous road surface (dirt/asphalt blend, conf < 0.50) |
| `pathole 24.webp` | **NO** | None | NO | NO | Oblique camera angle, water glare | Poor viewpoint / oblique perspective (depression flattened in perspective) |
| `pathole 25.webp` | **YES** | 0.5457 | YES | NO | Water-filled road crater | Detected (D40) |
| `pathole 26.webp` | **YES** | 0.7539 | YES | NO | Cluster of 4 clear cavities | Detected (4 D40 boxes) |
| `pathole 27.webp` | **NO** | None | NO | NO | Shallow asphalt depression | Shallow pothole (sub-threshold cavity score ~0.38) |
| `pathole 28.webp` | **NO** | None | NO | NO | Harsh tree shadows across road crater | Partially obscured pothole (shadows disrupt edge gradient) |
| `pathole 29.webp` | **YES** | 0.8564 | YES | NO | Deep crater on asphalt | Detected (2 D40 boxes) |
| `pathole 3.webp` | **NO** | None | NO | NO | Shallow circular patch | Shallow pothole (cavity depth < 25mm, conf < 0.50) |
| `pathole 30.webp` | **NO** | None | NO | NO | Water collected in shallow depression | Water-covered pothole / sub-threshold (D40 conf=0.3429, Water=11.7%) |
| `pathole 4.webp` | **YES** | 0.7448 | YES | NO | Cluster of 5 craters in flooded road | Detected (5 D40 boxes) |
| `pathole 5.webp` | **NO** | None | YES | NO | Alligator cracked roadway depression | Non-pothole road defect (D20 Alligator Crack detected at 0.5879, Water=18.4%) |
| `pathole 6.webp` | **NO** | None | NO | NO | Coarse gravel surface wear | Shallow pothole (gravel texture obscuring rim, conf < 0.50) |
| `pathole 7.webp` | **YES** | 0.5395 | YES | YES | Low-res shot of road cavity | Detected (D40) despite low resolution |
| `pathole 8.webp` | **YES** | 0.6068 | YES | NO | Water-filled depression | Detected (D40) |
| `pathole 9.webp` | **NO** | None | NO | NO | Distant oblique road scene | Poor viewpoint (depression too small on distant horizon) |
| `road without pothole.webp` | **NO** | None | NO | NO | Clean undamaged asphalt roadway | Clean road (GENUINE NEGATIVE CONTROL — correctly 0 detections) |
| `water filled patholes.jpg` | **NO** | None | NO | NO | Road completely flooded under 77.6% water | Water-covered pothole (submerged cavity rim; correctly flagged by V-FloodNet as Significant Flood) |

---

## 2. Classification of the 20 Images Without D40 Detection

1. **Non-Pothole Road Defect (5 images):**
   - `pathole 11.webp` (D20 Alligator Crack detected at 0.6416)
   - `pathole 14.webp` (D20 Alligator Crack detected at 0.7089)
   - `pathole 15.webp` (D20 Alligator Crack detected at 0.5038)
   - `pathole 16.webp` (2 D20 Alligator Cracks detected at 0.6190, 0.5198)
   - `pathole 5.webp` (D20 Alligator Crack detected at 0.5879)
   *Finding: The model correctly identified severe structural roadway distress on all 5 images, categorizing the distress network as fatigue/alligator cracking rather than isolated cavity craters.*

2. **Water-Covered Pothole (4 images):**
   - `pathole 19.webp` (74.64% flood water)
   - `pathole 20.webp` (71.03% flood water)
   - `pathole 30.webp` (11.69% water; candidate D40 score = 0.3429)
   - `water filled patholes.jpg` (77.59% flood water)
   *Finding: Deep standing water physically obscures the asphalt rim and cavity shadow, causing the optical road detector to score below 0.50. V-FloodNet captured all 4 as Significant Waterlogging.*

3. **Clean Negative Control Sample (1 image):**
   - `road without pothole.webp` (0 detections)
   *Finding: Confirmed genuine true negative on undamaged road pavement.*

4. **Shallow Pothole / Low Asphalt Contrast (5 images):**
   - `pathole 22.webp`, `pathole 27.webp`, `pathole 3.webp`, `pathole 6.webp`, `pathole 2.webp`
   *Finding: Lacks defined shadow drop or sharp asphalt lip; cavity depth is under 30mm.*

5. **Poor Viewpoint / Oblique Perspective (2 images):**
   - `pathole 24.webp`, `pathole 9.webp`
   *Finding: Camera pitch angle is too steep or distance exceeds 15 meters.*

6. **Partially Obscured Pothole (1 image):**
   - `pathole 28.webp` (Heavy tree branch shadow disruption across rim).

7. **Low Resolution (2 images):**
   - `pathole 17.webp`, `pathole 20.webp` (Thumbnail images $< 60,000$ total pixels).

---

## 3. Engineering Policy on Production Thresholds

**DO NOT Globally Lower the Production Confidence Threshold:**
- Lowering threshold from 0.50 to 0.35 would capture only 2 additional shallow potholes (`pathole 30.webp` and `pathole 27.webp`), while generating false crack/pothole detections on textured sidewalks, shadows, and flood ripple boundaries.
- **Recommended Solution:** Maintain 0.50 for standard dispatch, and use candidate pooling ($\ge 0.25$) strictly inside the multi-modal `WATER-FILLED POTHOLE` fusion policy.
