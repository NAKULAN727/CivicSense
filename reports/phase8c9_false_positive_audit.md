# Phase 8C-9: False-Positive & Cross-Category Reduction Audit

**Baseline Comparison:** Phase 8C-6 Raw Detection vs Phase 8C-9 Contextually Arbitrated Pipeline  
**Dataset Census:** 94 Real-World Municipal Images

---

## 1. Cross-Category False-Positive Reduction Summary

| Category Audited | Phase 8C-6 Raw Waste Triggers | Phase 8C-9 Arbitrated Waste Triggers | False Alarms Eliminated | Relative Reduction |
| :--- | :---: | :---: | :---: | :---: |
| **Flood (32 Images)** | 22 / 32 (68.8%) | **5 / 32 (15.6%)** | **-17 false alarms** | **-77.3%** |
| **Pothole (32 Images)** | 27 / 32 (84.4%) | **10 / 32 (31.2%)** | **-17 false alarms** | **-63.0%** |
| **Total Non-Garbage (64 Images)** | 49 / 64 (76.6%) | **15 / 64 (23.4%)** | **-34 false alarms** | **-69.4%** |

---

## 2. Analysis of the Remaining Accepted Waste in Non-Garbage Folders

### A. The 5 Retained Waste Cases in Flood Folder:
1. `flood 18.jpg` (Water=6.21%): Standing puddle on street; waste model detected W20 box.
2. `flood 23.webp` (Water=2.68%): Verified roadside leaf litter & plastic debris in drain channel.
3. `flood 27.webp` (Water=2.46%): Receded damp runoff; packaging scrap on curb.
4. `flood 29.webp` (Water=21.10%): Verified large floating plastic bag/sack caught in floodwaters.
5. `flood 4.webp` (Water=5.89%): Verified floating cardboard packaging in road puddle.

*Finding: All 5 images have water coverage $\le 21.1\%$ (below the $25\%$ significant flood ceiling), and 3 of them contain physical visible trash floating in the water.*

### B. The 10 Retained Waste Cases in Pothole Folder:
- In `pathole 30.webp`, `WATER-FILLED POTHOLE` takes top priority, so the waste detection does not cause incorrect dispatch.
- In `pathole 3.webp`, a genuine packaging scrap is physically lodged inside the pothole depression.
- In the remaining 8 images (`pathole 17`, `2`, `20`, `22`, `24`, `27`, `28`, `9`), the road model missed the shallow depression, leaving no conflicting road hazard to trigger contextual arbitration. When road detection is absent, the standalone monolithic box is preserved for human review rather than silently discarded.

---

## 3. Zero Degradation of Road Specificity
- Road damage false positives on Flood: **0 / 32 (0.0%)**
- Road damage false positives on Garbage: **0 / 30 (0.0%)**
- Road damage specificity on Clean Road (`road without pothole.webp`): **0 detections (100% specificity pass)**.
