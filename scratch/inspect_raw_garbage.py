import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)

garb = [r for r in raw if r['category'] == 'GARBAGE']
print(f"Total garbage in phase8c6: {len(garb)}")
for r in garb:
    raw_cnt = r.get('waste_post_nms_count', 0)
    w_cov = r.get('water_coverage_pct', r.get('vflood_water_coverage_pct', 0.0))
    road_cnt = r.get('road_post_nms_count', 0)
    print(f"{r['filename']:<16}: raw_waste={raw_cnt}, road_cnt={road_cnt}, water={w_cov}%")

