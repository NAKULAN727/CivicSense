import json

with open("scratch/vfloodnet_spatial_analysis.json") as f:
    d = json.load(f)

for x in d:
    fname = x.get('filename', '')
    src = x.get('source_folder', '')
    w_pct = x.get('water_coverage_pct', 0.0)
    topo = x.get('spatial_topology', '')
    print(f"{fname:<18} | {src:<12} | Water: {w_pct:>5.2f}% | Topo: {topo}")

