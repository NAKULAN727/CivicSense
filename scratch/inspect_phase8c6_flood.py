import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)

flood_raw = [r for r in raw if r['category'] == 'FLOOD']
print(f"Total flood in phase8c6: {len(flood_raw)}")
for r in flood_raw:
    fn = r.get('filename')
    w_cov = r.get('vflood_water_coverage_pct', 0.0)
    stat = r.get('vflood_waterlogging_status', '')
    topo = r.get('vflood_spatial_topology', '')
    waste = r.get('waste_classes', [])
    print(f"{fn:<16} | cov={w_cov:>5.1f}% | stat={stat:<25} | topo={topo:<30} | waste={waste}")

