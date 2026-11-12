import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    p8c6 = json.load(f)

with open('scratch/phase16_detailed_audit.json', 'r', encoding='utf-8') as f:
    p16 = {x['filename']: x for x in json.load(f)}

flood_items = [d for d in p8c6 if d.get('category') == 'FLOOD']

print(f"{'Idx':<3} | {'Filename':<16} | {'Dims':<10} | {'LowRes':<6} | {'V-Flood%':<9} | {'SegFormer%':<11} | {'Topology':<26} | {'Waste':<10}")
print("-" * 105)

for idx, d in enumerate(flood_items, 1):
    fname = d['filename']
    w, h = d['width'], d['height']
    low_res = "YES" if d['lowResolutionWarning'] else "NO"
    vflood_pct = d.get('vflood_water_coverage_pct', 0.0)
    seg_pct = p16.get(fname, {}).get('water_coverage_pct', 0.0)
    topo = d.get('vflood_spatial_topology', 'N/A')
    waste_classes = ",".join(d.get('waste_classes', [])) or "None"
    
    print(f"{idx:<3} | {fname:<16} | {w}x{h:<7} | {low_res:<6} | {vflood_pct:>7.2f}% | {seg_pct:>9.2f}% | {topo:<26} | {waste_classes:<10}")

