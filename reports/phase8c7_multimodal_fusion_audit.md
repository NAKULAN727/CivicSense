# Phase 8C-7: Multi-Modal Fusion Audit (`WATER-FILLED POTHOLE`)

**Evaluated Fusion Policy:**  
$$\text{Road Damage } (D40 \text{ confidence} \ge 0.25) \quad \text{AND} \quad \text{V-FloodNet Water Coverage } \ge 5.0\% \implies \textbf{WATER-FILLED POTHOLE}$$

---

## 1. Explicit Target Benchmark Evaluations (10 Samples)

| Benchmark Sample | Road Detection (D40) | D40 Confidence | Water Coverage | Final Fusion Result | Visual Interpretation & Municipal Routing |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `pathole 1.webp` | 1 D40 box | 0.8157 | **51.08%** | **`WATER-FILLED POTHOLE`** | Severe road crater filled with rainwater. High road hazard. |
| `pathole 4.webp` | 5 D40 boxes | 0.7448 | **83.22%** | **`WATER-FILLED POTHOLE`** | Massive flooded road sector with 5 severe craters holding water. |
| `pathole 8.webp` | 1 D40 box | 0.6068 | **32.34%** | **`WATER-FILLED POTHOLE`** | Isolated deep asphalt cavity trapping rainwater. |
| `pathole 10.webp` | 1 D40 box | 0.5403 | **29.02%** | **`WATER-FILLED POTHOLE`** | Asphalt pothole rim exposed with internal standing water. |
| `pathole 13.webp` | 1 D40 box | 0.5194 | **78.78%** | **`WATER-FILLED POTHOLE`** | Flooded road section with transverse crack and pothole cavity. |
| `pathole 14.webp` | 0 D40 at 0.50 (conf=0.284 in candidate pool) | 0.2840 | **7.51%** | **`WATER-FILLED POTHOLE`** | Cracked depression with localized puddle captured via candidate pooling. |
| `pathole 25.webp` | 1 D40 box | 0.5457 | **45.19%** | **`WATER-FILLED POTHOLE`** | Submerged road crater with distinct cavity rim. |
| `pathole 26.webp` | 4 D40 boxes | 0.7539 | **15.75%** | **`WATER-FILLED POTHOLE`** | Cluster of 4 potholes holding shallow rainwater. |
| `pathole 30.webp` | 0 D40 at 0.50 (conf=0.3429 in candidate pool) | 0.3429 | **11.69%** | **`WATER-FILLED POTHOLE`** | Rainwater in shallow road cavity captured via candidate pooling. |
| `water filled patholes.jpg` | 0 D40 boxes (0 in candidate pool >= 0.25) | None (< 0.25) | **77.59%** | **`SIGNIFICANT WATERLOGGING`** | Depression fully submerged under 77.6% water. Correctly flagged as major water hazard. |

---

## 2. Key Multi-Modal Findings

1. **Successful Fusion Rate:** **9 out of 10 targeted benchmark cases** successfully triggered the multi-modal `WATER-FILLED POTHOLE` policy.
2. **Benefit of Secondary Candidate Pooling ($\ge 0.25$):**
   - In `pathole 14.webp` (conf=0.284) and `pathole 30.webp` (conf=0.3429), the road model scored below the production threshold ($0.50$), but candidate pooling rescued the true road defect and paired it with water segmentation.
   - This validates the two-tier architectural strategy: keep production threshold at 0.50 for standalone reports, but inspect candidates down to 0.25 for multi-modal fusion.
3. **Behavior on Completely Submerged Potholes (`water filled patholes.jpg`):**
   - When standing water covers $>75\%$ of the frame and is muddy, the optical rim of the pothole is invisible from above.
   - The road model honestly produced 0 detections (no hallucination).
   - V-FloodNet captured the scene as **`SIGNIFICANT WATERLOGGING (77.59%)`**, ensuring municipal drainage crews are dispatched immediately.
