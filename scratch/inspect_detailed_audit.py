import json
import csv

with open('scratch/phase16_detailed_audit.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

print(f"Loaded {len(records)} detailed audit records.")

# Print all records
for i, r in enumerate(records):
    print(f"{i+1:2d}. {r['filename']:<16} | Res: {r['width']}x{r['height']:<5} | Water: {r['water_coverage_pct']:>5.1f}% | Comp: {r['topology_ratio_pct']:>5.1f}% | RoadDet: {r['road_detections_count']} | WasteDet: {r['waste_detections_count']}")

