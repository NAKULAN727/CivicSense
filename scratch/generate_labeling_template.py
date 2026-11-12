import os
import json
import csv
from PIL import Image

base_dir = "Real Test Datas"

# Load phase8c6 raw results if available
p8c6_map = {}
if os.path.exists("scratch/phase8c6_94_raw_results.json"):
    with open("scratch/phase8c6_94_raw_results.json", "r", encoding="utf-8") as f:
        for x in json.load(f):
            p8c6_map[x["filename"]] = x

# Load phase16 inventory if available
p16_map = {}
if os.path.exists("scratch/phase16_complete_inventory.json"):
    with open("scratch/phase16_complete_inventory.json", "r", encoding="utf-8") as f:
        for x in json.load(f):
            p16_map[x["Filename"]] = x

rows = []
idx = 1

for folder in ["Flood", "Garbage", "Pathole"]:
    fpath_dir = os.path.join(base_dir, folder)
    files = sorted(os.listdir(fpath_dir))
    for fname in files:
        full_p = os.path.join(fpath_dir, fname)
        im = Image.open(full_p)
        w, h = im.size
        fmt = im.format
        is_low_res = (w < 300) or (h < 200) or (w * h < 60000)
        
        # Determine category
        cat = folder.upper()
        if fname == "road without pothole.webp":
            cat = "OTHER"
            specific_type = "CLEAN_ROAD"
            scene_type = "NEGATIVE"
            verification_needed = False
            notes = "Clean undamaged asphalt road; negative class for pothole"
        elif folder == "Flood":
            p16_item = p16_map.get(fname, {})
            prim_cat = p16_item.get("PrimaryCategory", "")
            if "Residential" in prim_cat:
                specific_type = "F02_RESIDENTIAL_INUNDATION"
                verification_needed = True
                notes = "Requires municipal cadastral zoning verification"
            elif "River" in prim_cat:
                specific_type = "F04_RIVER_OVERFLOW"
                verification_needed = True
                notes = "Requires hydrographic river GIS vector verification"
            elif "Aerial" in prim_cat:
                specific_type = "F05_LARGE_AREA_INUNDATION"
                verification_needed = False
                notes = "Large-area landscape water sheet"
            elif "Shallow" in prim_cat or "Wet" in prim_cat:
                specific_type = "F00_NO_SIGNIFICANT_WATER" if p16_item.get("VFloodNetWaterPct", 0) < 5.0 else "F01_ROAD_WATERLOGGING"
                verification_needed = False
                notes = "Shallow waterlogging / damp road surface"
            else:
                specific_type = "F01_ROAD_WATERLOGGING"
                verification_needed = False
                notes = "Submerged roadway corridor"
            scene_type = prim_cat
        elif folder == "Garbage":
            # Map garbage scene type and dominant class
            p8 = p8c6_map.get(fname, {})
            classes = p8.get("waste_classes", [])
            dom_class = classes[0] if classes else "W70"
            if fname in ["garbage 8.webp", "garbage 13.jpg", "garbage 24.jpg"]:
                scene_type = "FLOATING_LITTER"
            elif int(fname.split()[1].split('.')[0]) in [1, 2, 5, 7, 11, 16, 17, 18, 19, 21, 25, 28, 30]:
                scene_type = "DUMP_PILE"
            else:
                scene_type = "SCATTERED_LITTER"
            specific_type = f"{dom_class}_{scene_type}"
            verification_needed = False
            notes = f"Dominant class: {dom_class}, scene: {scene_type}"
        elif folder == "Pathole":
            if fname == "water filled patholes.jpg" or fname in ["pathole 1.webp", "pathole 10.webp", "pathole 13.webp", "pathole 14.webp", "pathole 25.webp", "pathole 26.webp", "pathole 4.webp", "pathole 8.webp"]:
                specific_type = "WATER_FILLED_POTHOLE"
                scene_type = "POTHOLE_WITH_WATER"
                notes = "Standing water pooled inside asphalt depression"
            elif fname in ["pathole 5.webp", "pathole 11.webp"]:
                specific_type = "D20_ALLIGATOR_CRACK"
                scene_type = "STRUCTURAL_FATIGUE"
                notes = "Interconnected fatigue cracking"
            else:
                specific_type = "D40_POTHOLE"
                scene_type = "ASPHALT_CAVITY"
                notes = "Asphalt cavity / crater"
            verification_needed = False

        rows.append({
            "Index": idx,
            "Folder": folder,
            "Filename": fname,
            "Width": w,
            "Height": h,
            "Format": fmt,
            "IsLowResolution": "YES" if is_low_res else "NO",
            "Category": cat,
            "SpecificType": specific_type,
            "SceneType": scene_type,
            "NeedsOperatorVerification": "YES" if verification_needed else "NO",
            "Notes": notes
        })
        idx += 1

csv_path = "reports/dataset_labels_template.csv"
fieldnames = ["Index", "Folder", "Filename", "Width", "Height", "Format", "IsLowResolution", "Category", "SpecificType", "SceneType", "NeedsOperatorVerification", "Notes"]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)

print(f"Generated {csv_path} with {len(rows)} entries.")

