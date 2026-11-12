import json
import glob
import os
import onnxruntime as ort
import numpy as np
from PIL import Image

print("================================================================================")
print("CIVICSENSE AI — RECORDING PHASE 15 PRE-IMPLEMENTATION BASELINES")
print("================================================================================")

# 1. Load 94-image benchmark datasets
with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw_records = json.load(f)

with open('scratch/phase8c9_arbitrated_records.json', 'r', encoding='utf-8') as f:
    arb_data = json.load(f)
    arb_records = arb_data['records']

# 2. Extract Road Metrics
pothole_raw = [r for r in raw_records if r['category'] == 'POTHOLE']
pothole_arb = [r for r in arb_records if r['category'] == 'POTHOLE']

road_d40_conf050 = sum(1 for r in pothole_raw if any(d.get('classCode') == 'D40' and d.get('confidence', 0) >= 0.50 for d in r.get('road_detections', [])))
road_d40_total = sum(sum(1 for d in r.get('road_detections', []) if d.get('classCode') == 'D40') for r in pothole_raw)
road_d00_total = sum(sum(1 for d in r.get('road_detections', []) if d.get('classCode') == 'D00') for r in pothole_raw)
road_d10_total = sum(sum(1 for d in r.get('road_detections', []) if d.get('classCode') == 'D10') for r in pothole_raw)
road_d20_total = sum(sum(1 for d in r.get('road_detections', []) if d.get('classCode') == 'D20') for r in pothole_raw)
any_road_defect = sum(1 for r in pothole_raw if r.get('road_post_nms_count', 0) > 0)

# 3. Extract Waste Metrics
garbage_arb = [r for r in arb_records if r['category'] == 'GARBAGE']
raw_waste_count = sum(1 for r in garbage_arb if r.get('raw_waste_count', 0) > 0)
accepted_waste_count = sum(1 for r in garbage_arb if r.get('accepted_waste_count', 0) > 0)

# Count waste classes across 94 images
waste_class_counts = {f"W{i}0": 0 for i in range(8)}
for r in arb_records:
    for cls in r.get('raw_waste_classes', []):
        if cls in waste_class_counts:
            waste_class_counts[cls] += 1

# 4. Water-Filled Pothole count
wfp_count = sum(1 for r in pothole_arb if r.get('is_water_filled_pothole', False))

baseline_data = {
    'total_94_benchmark_images': len(raw_records),
    'road': {
        'pothole_records_count': len(pothole_raw),
        'road_d40_conf050_images': road_d40_conf050,
        'road_d40_total_detections': road_d40_total,
        'road_d00_total_detections': road_d00_total,
        'road_d10_total_detections': road_d10_total,
        'road_d20_total_detections': road_d20_total,
        'any_road_defect_images': any_road_defect
    },
    'waste': {
        'garbage_records_count': len(garbage_arb),
        'raw_waste_images': raw_waste_count,
        'accepted_waste_images': accepted_waste_count,
        'waste_class_counts': waste_class_counts
    },
    'fusion': {
        'water_filled_pothole_count': wfp_count
    }
}

print(json.dumps(baseline_data, indent=2))

with open('scratch/phase15_pre_baseline.json', 'w', encoding='utf-8') as f:
    json.dump(baseline_data, f, indent=2)

print("\n[SUCCESS] Baseline saved to scratch/phase15_pre_baseline.json")

