# Phase 8C-8: Changed Cases & Sensitivity Trade-Off Audit

**Purpose:** Comprehensive inventory of every image whose classification changes between the Phase 8C-6 Baseline and Phase 8C-8 Candidate Calibrations.

---

## 1. Flood Topology Guard (Largest Component Ratio >= 60%)

### Candidate Rule Evaluated:
$$\text{SIGNIFICANT WATERLOGGING} \iff \text{Water Coverage} > 25.0\% \quad \text{AND} \quad \text{Largest Component Ratio} \ge 60.0\%$$

### Empirical Result:
- **Total Images Evaluated:** 94
- **Images with Water Coverage $> 25.0\%$:** 37 (Flood: 25, Garbage: 2, Pothole: 10)
- **Changed Images Count:** **0**
- **Reason:** Every single image in the dataset exceeding $25.0\%$ water coverage possesses a monolithic component ratio between **$79.83\%$ and $100.00\%$** (well above the $60.0\%$ threshold).
- **Safety Verdict:** **100% False-Negative Preservation.** The $60.0\%$ topology guard does not degrade a single genuine flood scene.

---

## 2. Waste Geometric Guard (Single Monolithic Box >= 75% x 75%)

### Candidate Rule Evaluated:
$$\text{IF single waste detection AND box width } \ge 75.0\% \text{ AND box height } \ge 75.0\% \implies \textbf{FLAG MONOLITHIC / SUPPRESS}$$

### Impact on Non-Garbage Categories (Beneficial Suppression):
- **Flood Category:** **21 out of 22 cross-category triggers suppressed (95.5%)**. (Only `flood 20.webp` with 2 detections is retained).
- **Pothole Category:** **26 out of 27 cross-category triggers suppressed (96.3%)**. (Only `pathole 16.webp` with lower box height is retained).
- **Total False Positives Removed:** **47 / 49 (95.9%)**.

### Catastrophic Impact on True Garbage Category (Severe False Negatives):
- **Raw Garbage Detections:** 24 / 30 (80.0%)
- **Filtered Garbage Detections:** **1 / 30 (3.3%)** (`garbage 14.jpg` with 2 boxes)
- **Legitimate Garbage Images Suppressed:** **23 images (95.8% destruction of true garbage recall)**

---

## 3. Inventory of the 23 Suppressed Genuine Garbage Images

Every one of the 23 suppressed images was manually reviewed against physical ground truth:

| Filename | Waste Class | Confidence | Box Dimensions | Ground Truth Classification | Visual Cause of Suppression |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `garbage 1.webp` | W50 | 0.8237 | 79.86000061035156% x 99.69999694824219% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 11.jpg` | W20 | 0.5380 | 81.08999633789062% x 99.80999755859375% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 12.jpg` | W70 | 0.7155 | 100.0% x 79.79000091552734% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 13.jpg` | W20 | 0.6942 | 81.3499984741211% x 100.0% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 15.jpg` | W70 | 0.5536 | 76.63999938964844% x 99.8499984741211% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 16.jpg` | W70 | 0.5634 | 80.4000015258789% x 100.0% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 17.jpg` | W70 | 0.7362 | 79.5% x 100.0% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 18.jpg` | W70 | 0.9585 | 78.9800033569336% x 99.94000244140625% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 19.jpg` | W70 | 0.9179 | 79.95999908447266% x 99.5999984741211% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 2.webp` | W70 | 0.7223 | 77.91999816894531% x 99.8499984741211% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 20.jpg` | W70 | 0.5635 | 79.41999816894531% x 99.87000274658203% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 21.jpg` | W70 | 0.8601 | 78.55999755859375% x 99.86000061035156% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 22.jpg` | W70 | 0.6832 | 83.05999755859375% x 99.9800033569336% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 24.jpg` | W70 | 0.8126 | 78.88999938964844% x 76.9800033569336% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 25.jpg` | W70 | 0.8472 | 79.08999633789062% x 100.0% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 26.jpg` | W70 | 0.5850 | 79.29000091552734% x 99.8499984741211% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 27.jpg` | W70 | 0.5170 | 79.55999755859375% x 100.0% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 29.jpg` | W20 | 0.5377 | 79.43000030517578% x 99.97000122070312% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 30.jpg` | W70 | 0.9617 | 79.37000274658203% x 99.8499984741211% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 5.webp` | W70 | 0.8748 | 77.9800033569336% x 99.73999786376953% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 6.webp` | W20 | 0.8162 | 76.33000183105469% x 99.88999938964844% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 7.webp` | W70 | 0.8455 | 79.26000213623047% x 100.0% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |
| `garbage 9.webp` | W70 | 0.9036 | 78.55000305175781% x 99.56999969482422% | **A. Genuine garbage incorrectly suppressed** | YOLOv8 whole-frame anchor latched onto full dump scene |

---

## 4. Architectural Finding & Conclusion

1. **Failure of Naive Geometric Suppression:** Because `waste-detection.onnx` generates whole-frame bounding boxes for *both* genuine garbage piles and textured non-garbage scenes, applying a hard geometric filter creates **23 catastrophic false negatives**.
2. **Contextual Routing is Required:** The monolithic flag (`MONOLITHIC_SCENE_DETECTION`) must **never be used as an unconditional deletion filter**. It should only be used as a conditional suppressor when a conflicting primary hazard (Road Damage or Severe Flooding) is simultaneously detected.
