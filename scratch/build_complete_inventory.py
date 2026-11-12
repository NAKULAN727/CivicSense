import os
import hashlib
import json
import csv
from PIL import Image

flood_dir = "Real Test Datas/Flood"
files = sorted(os.listdir(flood_dir))

with open("scratch/phase8c6_94_raw_results.json", "r", encoding="utf-8") as f:
    p8c6 = {d["filename"]: d for d in json.load(f) if d.get("category") == "FLOOD"}

with open("scratch/phase16_detailed_audit.json", "r", encoding="utf-8") as f:
    p16 = {d["filename"]: d for d in json.load(f)}

# Categorization mapping based on physical ground-truth inspection:
# Categories to map:
# 1. Ground-level street flooding
# 2. Aerial flooding
# 3. Residential-area flooding
# 4. River flooding
# 5. Shallow waterlogging
# 6. Deep inundation
# 7. Wet roads and reflections

annotations = {
    "flood 1.jpg": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); low-res (250x175); turbid floodwater; false W50 waste candidate"
    },
    "flood 10.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); low-res (192x234); murky street flood with overcast tree reflections"
    },
    "flood 11.webp": {
        "primary": "Residential-area flooding",
        "secondary": ["Ground-level street flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Residential perimeter ground truth required; boundary delineation between curtilage and roadway"
    },
    "flood 12.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); dark turbid floodwater on roadway corridor"
    },
    "flood 13.webp": {
        "primary": "Shallow waterlogging",
        "secondary": ["Wet roads and reflections"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); shallow roadside drainage runoff requiring wet boundary delineation"
    },
    "flood 14.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Shallow waterlogging", "Wet roads and reflections"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); specular sky and curb reflection causing false W20 glass trigger"
    },
    "flood 15.jpg": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); low-res (289x174); turbulent muddy flood swirls"
    },
    "flood 16.jpg": {
        "primary": "Residential-area flooding",
        "secondary": ["Ground-level street flooding"],
        "needs_mask": True,
        "mask_reason": "Vertical aspect ratio (415x737); suburban street floodwater boundary along residential curbs"
    },
    "flood 17.jpg": {
        "primary": "Aerial flooding",
        "secondary": ["Residential-area flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Aerial oblique perspective; requires precise building footprint vs submerged street delineation"
    },
    "flood 18.jpg": {
        "primary": "Shallow waterlogging",
        "secondary": ["Ground-level street flooding", "Wet roads and reflections"],
        "needs_mask": True,
        "mask_reason": "High model divergence (SegFormer 42.0% vs V-Flood 6.2%); specular glare on wet asphalt"
    },
    "flood 19.jpg": {
        "primary": "Shallow waterlogging",
        "secondary": ["Wet roads and reflections"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); thin surface water sheen and damp asphalt runoff"
    },
    "flood 2": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); missing extension (WEBP bitstream); turbid standing road flood"
    },
    "flood 20.webp": {
        "primary": "Aerial flooding",
        "secondary": ["Residential-area flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "High-angle urban flood; mirror-like building reflections requiring structural separation"
    },
    "flood 21.webp": {
        "primary": "River flooding",
        "secondary": ["Aerial flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Elevated view of fluvial river overtopping; requires river channel vs road flood mask"
    },
    "flood 22.webp": {
        "primary": "Residential-area flooding",
        "secondary": ["Aerial flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Aerial view of flooded residential parcels; cadastral yard vs street water delineation needed"
    },
    "flood 23.webp": {
        "primary": "Shallow waterlogging",
        "secondary": ["Wet roads and reflections", "Ground-level street flooding"],
        "needs_mask": True,
        "mask_reason": "Sub-threshold gutter water (V-Flood 2.68% vs SegFormer 19.47%); roadside drainage boundary"
    },
    "flood 24.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Shallow waterlogging"],
        "needs_mask": True,
        "mask_reason": "Severe model divergence (SegFormer 3.97% vs V-Flood 51.77%); standing water pool on road lanes"
    },
    "flood 25.webp": {
        "primary": "River flooding",
        "secondary": ["Aerial flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Widespread river overbank inundation; floating cardboard/packaging litter requiring separation"
    },
    "flood 26.webp": {
        "primary": "Aerial flooding",
        "secondary": ["Residential-area flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Extreme model divergence (SegFormer 97.47% vs V-Flood 32.01%); aerial residential islanding"
    },
    "flood 27.webp": {
        "primary": "Wet roads and reflections",
        "secondary": ["Shallow waterlogging"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); post-flood receding damp pavement sheen vs active water"
    },
    "flood 28.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); turbid urban street inundation with floating paper litter"
    },
    "flood 29.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Shallow waterlogging"],
        "needs_mask": True,
        "mask_reason": "Vehicle wake and splash boundary; floating polythene bag requiring multi-modal separation"
    },
    "flood 3.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); deep road waterlogging corridor under overcast lighting"
    },
    "flood 30.webp": {
        "primary": "Aerial flooding",
        "secondary": ["Residential-area flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Elevated perspective of extensive suburban flooding; specular glint on water surface"
    },
    "flood 4.webp": {
        "primary": "Aerial flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Catastrophic model divergence (SegFormer 99.71% vs V-Flood 5.89%); massive sheet water mask needed"
    },
    "flood 5.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); dark asphalt waterlogging corridor under dark sky"
    },
    "flood 6.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); submerged street with building window reflections"
    },
    "flood 7.webp": {
        "primary": "River flooding",
        "secondary": ["Aerial flooding", "Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Aerial river overbank flood; natural channel bed vs submerged agricultural/rural road ground truth"
    },
    "flood 8.webp": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); genuine floating municipal waste and bottles requiring separate annotation"
    },
    "flood 9.webp": {
        "primary": "Aerial flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "Aerial landscape inundation; large-area continuous sheet water boundaries"
    },
    "flood.jpg": {
        "primary": "Ground-level street flooding",
        "secondary": ["Deep inundation"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); extreme low resolution (193x135, 26k px); murky water texture"
    },
    "puddles.jpg": {
        "primary": "Wet roads and reflections",
        "secondary": ["Shallow waterlogging"],
        "needs_mask": True,
        "mask_reason": "SegFormer failure (0.0% water); isolated rainwater puddle boundary vs wet asphalt and sky glare"
    }
}

inventory_rows = []

for idx, fname in enumerate(files, 1):
    fpath = os.path.join(flood_dir, fname)
    with open(fpath, "rb") as f:
        content = f.read()
    sha256 = hashlib.sha256(content).hexdigest()
    fsize_kb = round(len(content) / 1024, 2)
    fsize_bytes = len(content)
    
    im = Image.open(fpath)
    w, h = im.size
    fmt = im.format
    tot_pixels = w * h
    aspect_ratio = round(w / h, 2)
    
    det = p16.get(fname, {})
    p8 = p8c6.get(fname, {})
    
    seg_water = det.get("water_coverage_pct", 0.0)
    seg_topo = det.get("topology_ratio_pct", 0.0)
    vflood_water = p8.get("vflood_water_coverage_pct", 0.0)
    vflood_topo = p8.get("vflood_largest_comp_ratio_pct", 0.0)
    waste_cnt = det.get("waste_detections_count", 0)
    road_cnt = det.get("road_detections_count", 0)
    
    ann = annotations.get(fname, {
        "primary": "Ground-level street flooding",
        "secondary": [],
        "needs_mask": True,
        "mask_reason": "Ground truth segmentation mask required"
    })
    
    is_low_res = (w < 300) or (h < 200) or (tot_pixels < 60000)
    
    row = {
        "Index": idx,
        "Filename": fname,
        "Format": fmt,
        "Width": w,
        "Height": h,
        "AspectRatio": aspect_ratio,
        "TotalPixels": tot_pixels,
        "FileSizeBytes": fsize_bytes,
        "FileSizeKB": fsize_kb,
        "SHA256": sha256,
        "IsLowResolution": "YES" if is_low_res else "NO",
        "SegFormerWaterPct": seg_water,
        "SegFormerTopologyPct": seg_topo,
        "VFloodNetWaterPct": vflood_water,
        "VFloodNetTopologyPct": vflood_topo,
        "WasteDetectionsCount": waste_cnt,
        "RoadDetectionsCount": road_cnt,
        "PrimaryCategory": ann["primary"],
        "SecondaryCategories": "; ".join(ann["secondary"]),
        "NeedsManualSegmentationMask": "YES" if ann["needs_mask"] else "NO",
        "ManualMaskJustification": ann["mask_reason"]
    }
    inventory_rows.append(row)

# Save JSON
with open("scratch/phase16_complete_inventory.json", "w", encoding="utf-8") as f:
    json.dump(inventory_rows, f, indent=2)

print("Saved complete inventory with", len(inventory_rows), "items.")

