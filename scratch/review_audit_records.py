import os
import json
import hashlib
from PIL import Image

flood_dir = "Real Test Datas/Flood"
files = sorted(os.listdir(flood_dir))

with open("scratch/phase16_detailed_audit.json", "r") as f:
    detailed_audit = {item["filename"]: item for item in json.load(f)}

with open("scratch/phase16_raw_file_audit.json", "r") as f:
    raw_audit = {item["filename"]: item for item in json.load(f)}

print(f"Total files discovered: {len(files)}")
for i, fname in enumerate(files, 1):
    raw = raw_audit.get(fname, {})
    det = detailed_audit.get(fname, {})
    print(f"{i:2d}. {fname:<16} | {raw.get('format')} {raw.get('width')}x{raw.get('height')} | Size: {raw.get('filesize_kb')} KB | Water: {det.get('water_coverage_pct', 0.0):.2f}% | Waste: {det.get('waste_detections_count', 0)}")

