import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

ARBITRATED_8C9 = r"e:\CivicSenseAI\scratch\phase8c9_arbitrated_records.json"

with open(ARBITRATED_8C9, 'r', encoding='utf-8') as f:
    data = json.load(f)

records = data['records']
metrics = data['metrics']

print("=== PHASE 9 REGRESSION VALIDATION AGAINST PHASE 8C-10 ===")
print(f"Total Evaluated Real Images: {len(records)}")

# 1. Flood Screening & Significant Flood
flood_recs = [r for r in records if r['category'] == 'FLOOD']
flood_screened = sum(1 for r in flood_recs if r['water_coverage_pct'] >= 5.0)
flood_significant = sum(1 for r in flood_recs if r['is_significant_flood'])

print(f"\n1. FLOOD WATER ANALYSIS (32 Images):")
print(f"   Flood Screening (>=5% water): {flood_screened}/32 (Target: 30/32)")
print(f"   Significant Flood (>25% & comp>=60%): {flood_significant}/32 (Target: 25/32)")
assert flood_screened == 30, f"Expected 30/32, got {flood_screened}"
assert flood_significant == 25, f"Expected 25/32, got {flood_significant}"

# 2. Road Damage & D40
pothole_recs = [r for r in records if r['category'] == 'POTHOLE']
road_d40_conf050 = sum(1 for r in pothole_recs if any(c == 'D40' and conf >= 0.50 for c, conf in zip(r.get('road_classes', []), r.get('road_confidences', []))))
road_any = sum(1 for r in pothole_recs if r['has_road_damage'])

print(f"\n2. ROAD DAMAGE INFERENCE (32 Images):")
print(f"   Road D40 Pothole (conf >= 0.50): {road_d40_conf050}/32 (Target: 12/32)")
print(f"   Any Road Defect: {road_any}/32 (Target: 17/32)")
assert road_d40_conf050 == 12, f"Expected 12/32, got {road_d40_conf050}"
assert road_any == 17, f"Expected 17/32, got {road_any}"

# 3. Waste Inference & Contextual Arbitration
garbage_recs = [r for r in records if r['category'] == 'GARBAGE']
raw_waste = sum(1 for r in garbage_recs if r['raw_waste_count'] > 0)
acc_waste = sum(1 for r in garbage_recs if r['accepted_waste_count'] > 0)

print(f"\n3. WASTE DETECTION & ARBITRATION (30 Images):")
print(f"   Raw Waste Detections: {raw_waste}/30 (Target: 24/30)")
print(f"   Arbitrated Accepted Waste: {acc_waste}/30 (Target: 22/30)")
assert raw_waste == 24, f"Expected 24/30, got {raw_waste}"
assert acc_waste == 22, f"Expected 22/30, got {acc_waste}"

# 4. Cross-Category Waste Suppression
flood_waste_acc = sum(1 for r in flood_recs if r['accepted_waste_count'] > 0)
pothole_waste_acc = sum(1 for r in pothole_recs if r['accepted_waste_count'] > 0)

print(f"\n4. CROSS-CATEGORY FALSE-ALARM SUPPRESSION:")
print(f"   Flood Cross-Category Waste: {flood_waste_acc}/32 (Target: ~5/32)")
print(f"   Pothole Cross-Category Waste: {pothole_waste_acc}/32 (Target: ~10/32)")
assert flood_waste_acc == 5, f"Expected 5/32, got {flood_waste_acc}"
assert pothole_waste_acc == 10, f"Expected 10/32, got {pothole_waste_acc}"

# 5. Multi-Modal Water-Filled Pothole Fusion
wfp_count = sum(1 for r in records if r['is_water_filled_pothole'])
print(f"\n5. MULTI-MODAL WATER-FILLED POTHOLE FUSION:")
print(f"   WFP Benchmark Cases: {wfp_count} (Target: 9 benchmark cases)")
assert wfp_count == 9, f"Expected 9, got {wfp_count}"

print("\n=======================================================")
print("✅ ALL PHASE 8C-10 REGRESSION CRITERIA CONFIRMED 100% PASS")
print("=======================================================")
