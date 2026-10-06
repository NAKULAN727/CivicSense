# Phase 8C-9: Contextual Arbitration Changed Cases Audit

**Total Changed Images:** 36 out of 94  
**Arbitration Rule:** Monolithic waste box ($\ge 75\% \times 75\%$) suppressed *only* when primary conflicting hazard (`hasRoadDamage` OR `isSignificantFlood`) is co-present.

---

## 1. Summary by Category

- **Flood Category Changed:** 17 / 32 images (Monolithic waste false alarms suppressed due to Significant Flood)
- **Pothole Category Changed:** 17 / 32 images (Monolithic waste false alarms suppressed due to Road Damage or Flood)
- **Garbage Category Changed:** 2 / 30 images (`garbage 13.jpg` and `garbage 24.jpg` prioritized as Significant Flood)

---

## 2. Complete Inventory of All 36 Changed Cases

| Filename | Category | Water % | Road Defect | Conflicting Hazard | Raw Waste Detection | Arbitration Action & Reason |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `flood 1.jpg` | FLOOD | 49.59% | 0 | Flood (49.59%) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 10.webp` | FLOOD | 66.42% | 0 | Flood (66.42%) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 11.webp` | FLOOD | 43.28% | 0 | Flood (43.28%) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 14.webp` | FLOOD | 27.48% | 0 | Flood (27.48%) | W20 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 15.jpg` | FLOOD | 37.83% | 0 | Flood (37.83%) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 16.jpg` | FLOOD | 27.7% | 0 | Flood (27.7%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 17.jpg` | FLOOD | 48.8% | 0 | Flood (48.8%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 20.webp` | FLOOD | 56.1% | 0 | Flood (56.1%) | W20; W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 21.webp` | FLOOD | 34.68% | 0 | Flood (34.68%) | W20 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 22.webp` | FLOOD | 61.06% | 0 | Flood (61.06%) | W20 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 25.webp` | FLOOD | 54.82% | 0 | Flood (54.82%) | W00 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 28.webp` | FLOOD | 47.21% | 0 | Flood (47.21%) | W60 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 30.webp` | FLOOD | 45.79% | 0 | Flood (45.79%) | W20 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 6.webp` | FLOOD | 51.17% | 0 | Flood (51.17%) | W20 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood 8.webp` | FLOOD | 60.73% | 0 | Flood (60.73%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `flood.jpg` | FLOOD | 39.49% | 0 | Flood (39.49%) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `puddles.jpg` | FLOOD | 40.85% | 0 | Flood (40.85%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `garbage 13.jpg` | GARBAGE | 32.99% | 0 | Flood (32.99%) | W20 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `garbage 24.jpg` | GARBAGE | 91.2% | 0 | Flood (91.2%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 11.webp` | POTHOLE | 0.19% | 1 | Road (D20) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 12.webp` | POTHOLE | 0.45% | 6 | Road (D40, D40, D40, D40, D40, D40) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 13.webp` | POTHOLE | 78.78% | 2 | Road (D10, D40) & Flood (78.78%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 14.webp` | POTHOLE | 7.51% | 1 | Road (D20) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 15.webp` | POTHOLE | 48.26% | 1 | Road (D20) & Flood (48.26%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 16.webp` | POTHOLE | 2.46% | 2 | Road (D20, D20) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 18.webp` | POTHOLE | 0.0% | 1 | Road (D40) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 19.webp` | POTHOLE | 74.64% | 0 | Flood (74.64%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 21.webp` | POTHOLE | 3.24% | 1 | Road (D40) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 25.webp` | POTHOLE | 45.19% | 1 | Road (D40) & Flood (45.19%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 26.webp` | POTHOLE | 15.75% | 4 | Road (D40, D40, D40, D40) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 29.webp` | POTHOLE | 0.0% | 2 | Road (D40, D40) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 4.webp` | POTHOLE | 83.22% | 5 | Road (D40, D40, D40, D40, D40) & Flood (83.22%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 5.webp` | POTHOLE | 18.43% | 1 | Road (D20) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 7.webp` | POTHOLE | 1.84% | 1 | Road (D40) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `pathole 8.webp` | POTHOLE | 32.34% | 1 | Road (D40) & Flood (32.34%) | W70 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |
| `water filled patholes.jpg` | POTHOLE | 77.59% | 0 | Flood (77.59%) | W50 | **SUPPRESSED** (Monolithic box suppressed; primary hazard prioritized) |

---

## 3. Preservation of Legitimate Garbage

Unlike naive geometric filtering (which destroyed 23/24 legitimate garbage detections), contextual arbitration successfully preserves **22 out of 24 legitimate garbage detections (91.7%)**. The only two garbage images where the waste layer was subordinated (`garbage 13.jpg` and `garbage 24.jpg`) are scenes dominated by open stormwater canals and rivers, where the flood management system rightfully took primary dispatch priority.
