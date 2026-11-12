import os
import json
import hashlib
from PIL import Image
import numpy as np

base_dir = "datasets/flood_v2"
manifest_path = os.path.join(base_dir, "dataset_manifest.json")
with open(manifest_path, "r", encoding="utf-8") as f:
    manifest = json.load(f)

print("================================================================================")
print("CIVICSENSE AI — PHASE 16B STEP 4 MASK VALIDATION SUITE")
print("================================================================================")

errors = []
passes = 0
permitted_classes = {0, 1, 2, 3, 4, 255}

# Original directory
orig_dir = "Real Test Datas/Flood"

for item in manifest["images"]:
    fname = item["filename"]
    mask_fname = item["mask_filename"]
    split = item["split"]
    w = item["width"]
    h = item["height"]
    
    orig_path = os.path.join(orig_dir, fname)
    split_img_path = os.path.join(base_dir, "images", split, fname)
    mask_path = os.path.join(base_dir, "masks", split, mask_fname)
    ann_path = os.path.join(base_dir, "annotations", f"{fname}.json")
    
    # 1. Original image unchanged check (hash check)
    with open(orig_path, "rb") as f_orig, open(split_img_path, "rb") as f_split:
        h_orig = hashlib.sha256(f_orig.read()).hexdigest()
        h_split = hashlib.sha256(f_split.read()).hexdigest()
        if h_orig != h_split:
            errors.append(f"{fname}: Hash mismatch between original and dataset split image.")
            
    # 2. Reopen mask file
    if not os.path.exists(mask_path):
        errors.append(f"{fname}: Mask file missing at {mask_path}")
        continue
    
    try:
        mask_im = Image.open(mask_path)
        mask_w, mask_h = mask_im.size
        mask_mode = mask_im.mode
    except Exception as e:
        errors.append(f"{fname}: Failed to reopen mask file: {e}")
        continue
        
    # Check dimensions
    if (mask_w, mask_h) != (w, h):
        errors.append(f"{fname}: Mask dimensions ({mask_w}x{mask_h}) do not match image ({w}x{h})")
        
    if mask_mode != "L":
        errors.append(f"{fname}: Mask mode is {mask_mode}, expected 'L' (8-bit grayscale single channel)")
        
    # 3. Check pixel values (only permitted class IDs)
    mask_arr = np.array(mask_im)
    unique_vals = set(np.unique(mask_arr))
    invalid_classes = unique_vals - permitted_classes
    if invalid_classes:
        errors.append(f"{fname}: Invalid class IDs detected: {invalid_classes}")
        
    # 4. Check non-empty mask (foreground pixels > 0)
    fg_pixels = np.sum(mask_arr != 0)
    if fg_pixels == 0:
        errors.append(f"{fname}: Unintended empty mask (0 foreground pixels).")
        
    # 5. Check polygon boundaries valid
    for poly in item["polygons"]:
        pts = poly["points"]
        if len(pts) < 3:
            errors.append(f"{fname}: Polygon {poly['id']} has fewer than 3 vertices ({len(pts)})")
        for pt in pts:
            if pt["x"] < 0 or pt["x"] > w or pt["y"] < 0 or pt["y"] > h:
                # allow small float rounding up to 1px
                if pt["x"] < -1 or pt["x"] > w + 1 or pt["y"] < -1 or pt["y"] > h + 1:
                    errors.append(f"{fname}: Polygon vertex {pt} out of bounds for ({w}x{h})")

    # 6. Check individual annotation JSON file
    if not os.path.exists(ann_path):
        errors.append(f"{fname}: Annotation JSON missing at {ann_path}")
    else:
        with open(ann_path, "r", encoding="utf-8") as f_ann:
            ann_data = json.load(f_ann)
            if ann_data["mask_validation"]["status"] != "PASS":
                errors.append(f"{fname}: Annotation validation status is {ann_data['mask_validation']['status']}")

    passes += 1

print(f"Validation complete across {len(manifest['images'])} images.")
print(f"Passed: {passes} / {len(manifest['images'])}")
print(f"Errors detected: {len(errors)}")

if errors:
    print("\nError details:")
    for err in errors[:10]:
        print(f"  - {err}")
else:
    print("\nALL 6 MASK VALIDATION CHECKS PASSED WITH ZERO DISCREPANCIES (100% PASS RATE).")

print(f"\nGlobal Class Pixel Distribution:")
for k, v in manifest["global_pixel_distribution"].items():
    pct = manifest["global_pixel_percentages"][k]
    print(f"  Class {k:<15}: {v:>10,} pixels ({pct:>5.2f}%)")

