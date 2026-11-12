import os
import hashlib
import json
from PIL import Image
import numpy as np

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

with open("scratch/phase16_detailed_audit.json") as f:
    detailed = {x["filename"]: x for x in json.load(f)}

# Let's inspect each image
image_info = []

for idx, fname in enumerate(files, 1):
    fpath = os.path.join(folder, fname)
    with open(fpath, "rb") as f:
        data = f.read()
    sha256 = hashlib.sha256(data).hexdigest()
    filesize_kb = round(len(data) / 1024, 2)
    
    im = Image.open(fpath)
    w, h = im.size
    fmt = im.format
    arr = np.array(im.convert("RGB"))
    
    det = detailed.get(fname, {})
    water_cov = det.get("water_coverage_pct", 0.0)
    topo_ratio = det.get("topology_ratio_pct", 0.0)
    waste_cnt = det.get("waste_detections_count", 0)
    road_cnt = det.get("road_detections_count", 0)
    
    image_info.append({
        "index": idx,
        "filename": fname,
        "filesize_kb": filesize_kb,
        "format": fmt,
        "width": w,
        "height": h,
        "total_pixels": w * h,
        "aspect_ratio": round(w / h, 2),
        "sha256": sha256,
        "water_coverage_pct": water_cov,
        "topology_ratio_pct": topo_ratio,
        "waste_cnt": waste_cnt,
        "road_cnt": road_cnt
    })

print(f"Loaded {len(image_info)} images.")

