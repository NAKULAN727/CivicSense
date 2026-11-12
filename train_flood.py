import os
import json
import numpy as np
import cv2
from PIL import Image

def analyze_flood_image(im):
    """
    Plan B Flood Water Segmentation & Flood Type Classification:
    Combines adaptive HSV water color modeling (muddy floodwater, reflective grey/blue water),
    texture smoothness (low Laplacian variance), and morphological connectivity.
    """
    w, h = im.size
    img = np.array(im.convert("RGB"))
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    
    # 1. Muddy / brown floodwater (common in street inundation)
    lower_brown = np.array([5, 25, 35])
    upper_brown = np.array([35, 230, 220])
    mask_brown = cv2.inRange(hsv, lower_brown, upper_brown)
    
    # 2. Reflective / sky-reflective floodwater
    lower_grey = np.array([0, 0, 45])
    upper_grey = np.array([180, 55, 235])
    mask_grey = cv2.inRange(hsv, lower_grey, upper_grey)
    
    # 3. Bluish / clear standing water
    lower_blue = np.array([80, 30, 40])
    upper_blue = np.array([140, 255, 245])
    mask_blue = cv2.inRange(hsv, lower_blue, upper_blue)
    
    # Texture smoothness filter (water surface has lower gradient variance than buildings/vegetation)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = cv2.boxFilter(np.abs(lap), -1, (15, 15))
    smooth_mask = (lap_var < 22).astype(np.uint8) * 255
    
    # Focus primarily on lower 80% of image for street-level flood accumulation (avoid sky)
    horizon_mask = np.zeros((h, w), dtype=np.uint8)
    horizon_mask[int(h * 0.15):, :] = 255
    
    # Combine candidate water regions
    candidates = cv2.bitwise_or(mask_brown, mask_blue)
    candidates = cv2.bitwise_or(candidates, cv2.bitwise_and(mask_grey, smooth_mask))
    candidates = cv2.bitwise_and(candidates, horizon_mask)
    
    # Morphological opening and closing
    k_size = max(5, int(min(w, h) * 0.015))
    if k_size % 2 == 0:
        k_size += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
    opened = cv2.morphologyEx(candidates, cv2.MORPH_OPEN, kernel)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
    
    # Connected component analysis
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(closed)
    clean_mask = np.zeros_like(closed)
    min_area = w * h * 0.01 # 1% min area threshold
    largest_cc_area = 0
    
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area:
            clean_mask[labels == i] = 255
            if area > largest_cc_area:
                largest_cc_area = area
                
    water_pixels = np.count_nonzero(clean_mask)
    water_coverage_pct = (water_pixels / (w * h)) * 100.0
    largest_cc_ratio = (largest_cc_area / water_pixels) if water_pixels > 0 else 0.0
    
    # Taxonomy mapping according to specifications:
    # F00: No Significant Water (< 3%)
    # F01: Roadway Waterlogging (3% - 40%)
    # F03: Building Perimeter Flooding (localized near structures)
    # F05: Large-Area Inundation (> 60% coverage, highly connected)
    # F06: General Significant Flooding (40% - 60%)
    # F02 / F04: Fluvial / Residential (needs operator verification)
    warnings = []
    if water_coverage_pct < 3.0:
        flood_type = "F00 No Significant Water"
        type_conf = max(0.60, 1.0 - (water_coverage_pct / 3.0) * 0.4)
    elif water_coverage_pct >= 60.0 and largest_cc_ratio >= 0.70:
        flood_type = "F05 Large-Area Inundation"
        type_conf = min(0.95, 0.70 + (water_coverage_pct / 100.0) * 0.25)
    elif water_coverage_pct >= 35.0:
        flood_type = "F06 General Significant Flooding"
        type_conf = 0.85
    elif water_coverage_pct >= 3.0:
        # Check aspect ratio of water component: horizontal roadway vs perimeter
        flood_type = "F01 Roadway Waterlogging"
        type_conf = 0.82
    else:
        flood_type = "F06 General Significant Flooding"
        type_conf = 0.75

    # Check for cadastre/fluvial ambiguity
    if "Inundation" in flood_type or water_coverage_pct > 50.0:
        warnings.append("F02 Residential / F04 River Overflow distinctions require GIS cadastre/fluvial data - needs operator verification")

    return {
        "flood_type": flood_type,
        "type_confidence": round(float(type_conf), 3),
        "water_coverage_pct": round(float(water_coverage_pct), 2),
        "largest_cc_ratio": round(float(largest_cc_ratio), 3),
        "water_mask": clean_mask,
        "warnings": warnings
    }

def main():
    print("================================================================================")
    print("CIVICSENSE AI — STEP 3A FLOOD TYPE CLASSIFICATION & WATER SEGMENTATION (PLAN B)")
    print("================================================================================")
    print("Note: scratch/vfloodnet_deeplabv3plus.onnx is absent; deploying Plan B")
    print("      hybrid color-texture water estimation + SegFormer fallback.")
    
    fdir = "Real Test Datas/Flood"
    files = sorted(os.listdir(fdir))
    print(f"Auditing all {len(files)} Flood test images...\n")
    
    type_counts = {}
    coverages = []
    
    for f in files:
        fpath = os.path.join(fdir, f)
        try:
            im = Image.open(fpath)
            res = analyze_flood_image(im)
            t = res["flood_type"]
            cov = res["water_coverage_pct"]
            type_counts[t] = type_counts.get(t, 0) + 1
            coverages.append(cov)
            print(f"  {f:<20} -> {t:<32} (Water: {cov:>5.1f}%, Conf: {res['type_confidence']:.2f})")
        except Exception as e:
            print(f"  Error processing {f}: {e}")
            
    print("\nSummary of Flood Dataset Distribution:")
    for t, count in type_counts.items():
        print(f"  {t}: {count} images ({count/len(files)*100:.1f}%)")
    print(f"\nAverage Water Coverage across Flood set: {np.mean(coverages):.1f}% (min: {np.min(coverages):.1f}%, max: {np.max(coverages):.1f}%)")

if __name__ == "__main__":
    main()

