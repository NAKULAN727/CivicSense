import json
import sys

RAW_PATH = r"e:\CivicSenseAI\scratch\phase8c6_94_raw_results.json"
ARB_PATH = r"e:\CivicSenseAI\scratch\phase8c9_arbitrated_records.json"

with open(RAW_PATH, 'r', encoding='utf-8') as f:
    raw_records = json.load(f)

with open(ARB_PATH, 'r', encoding='utf-8') as f:
    arb_data = json.load(f)
    arb_records = arb_data['records']

print("==================================================")
print("CIVICSENSE AI — 94-IMAGE EMPIRICAL REGRESSION AUDIT")
print("==================================================")

# 1. Flood Screening: 30/32
flood_records = [r for r in arb_records if r['category'] == 'FLOOD']
flood_screening = [r for r in flood_records if r['water_coverage_pct'] >= 5.0]

# 2. Significant flood: 25/32
significant_flood = [r for r in flood_records if r['flood_classification'] == 'SIGNIFICANT WATERLOGGING']

# 3. Road D40: 12/32
pothole_records = [r for r in raw_records if r['category'] == 'POTHOLE']
road_d40_conf050 = [r for r in pothole_records if any(d.get('classCode') == 'D40' and d.get('confidence', 0) >= 0.50 for d in r.get('road_detections', []))]

# 4. Any road defect: 17/32
any_road_defect = [r for r in pothole_records if r.get('road_post_nms_count', 0) > 0]

# 5. Raw waste: 24/30
garbage_records = [r for r in arb_records if r['category'] == 'GARBAGE']
raw_waste = [r for r in garbage_records if r['raw_waste_count'] > 0]

# 6. Arbitrated waste: 22/30
arbitrated_waste = [r for r in garbage_records if r['accepted_waste_count'] > 0]

# 7. Flood cross-category waste: 5/32
flood_cross_waste = [r for r in flood_records if r['accepted_waste_count'] > 0]

# 8. Pothole cross-category waste: 10/32
pothole_arb_records = [r for r in arb_records if r['category'] == 'POTHOLE']
pothole_cross_waste = [r for r in pothole_arb_records if r['accepted_waste_count'] > 0]

# 9. Water-filled pothole: 9/9 targeted benchmark cases
water_filled_potholes = [r for r in pothole_arb_records if r['is_water_filled_pothole']]

metrics = [
    ("Flood screening (>= 5%)", len(flood_screening), 30, len(flood_records), 32),
    ("Significant flood (> 25% + 60% comp)", len(significant_flood), 25, len(flood_records), 32),
    ("Road D40 (conf >= 0.50)", len(road_d40_conf050), 12, len(pothole_records), 32),
    ("Any road defect (conf >= 0.25)", len(any_road_defect), 17, len(pothole_records), 32),
    ("Raw waste detections", len(raw_waste), 24, len(garbage_records), 30),
    ("Arbitrated waste detections", len(arbitrated_waste), 22, len(garbage_records), 30),
    ("Flood cross-category waste", len(flood_cross_waste), 5, len(flood_records), 32),
    ("Pothole cross-category waste", len(pothole_cross_waste), 10, len(pothole_records), 32),
    ("Water-filled pothole fusion", len(water_filled_potholes), 9, 9, 9)
]

all_passed = True
for name, measured_num, expected_num, measured_denom, expected_denom in metrics:
    is_match = (measured_num == expected_num and measured_denom == expected_denom)
    status = "[PASS]" if is_match else "[FAIL]"
    if not is_match: all_passed = False
    print(f"{status} {name:<38}: {measured_num}/{measured_denom} (Expected: {expected_num}/{expected_denom})")

print("==================================================")
if all_passed:
    print("94-IMAGE REGRESSION VERDICT: 0 REGRESSIONS — 100% EXACT PARITY")
else:
    print("94-IMAGE REGRESSION VERDICT: REGRESSION DETECTED!")
    sys.exit(1)
print("==================================================")
