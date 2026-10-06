import json
import numpy as np

with open(r"e:\CivicSenseAI\scratch\vfloodnet_raw_results.json", "r", encoding="utf-8") as f:
    records = json.load(f)

flood_recs = [r for r in records if r['source_folder'] == 'Flood']
pothole_recs = [r for r in records if r['source_folder'] == 'Pathole']
garbage_recs = [r for r in records if r['source_folder'] == 'Garbage']
non_flood_recs = pothole_recs + garbage_recs

thresholds = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]

print(f"{'Threshold':<10} | {'Flood (14)':<14} | {'Pothole (12)':<14} | {'Garbage (12)':<14} | {'Non-Flood (24)':<16} | {'Flood Det Rate':<16} | {'Non-Flood Screen Rate':<22}")
print("-" * 115)

threshold_table = []

for t in thresholds:
    f_det = sum(1 for r in flood_recs if r['water_coverage_percentage'] >= t)
    p_det = sum(1 for r in pothole_recs if r['water_coverage_percentage'] >= t)
    g_det = sum(1 for r in garbage_recs if r['water_coverage_percentage'] >= t)
    nf_det = sum(1 for r in non_flood_recs if r['water_coverage_percentage'] >= t)
    
    f_rate = (f_det / len(flood_recs)) * 100
    nf_rate = (nf_det / len(non_flood_recs)) * 100
    
    threshold_table.append({
        'threshold_pct': t,
        'flood_detected': f_det,
        'flood_total': len(flood_recs),
        'flood_screening_rate_pct': round(f_rate, 2),
        'pothole_detected': p_det,
        'pothole_total': len(pothole_recs),
        'pothole_screening_rate_pct': round((p_det / len(pothole_recs)) * 100, 2),
        'garbage_detected': g_det,
        'garbage_total': len(garbage_recs),
        'garbage_screening_rate_pct': round((g_det / len(garbage_recs)) * 100, 2),
        'combined_non_flood_detected': nf_det,
        'combined_non_flood_total': len(non_flood_recs),
        'combined_non_flood_screening_rate_pct': round(nf_rate, 2)
    })
    
    print(f"{str(t)+'%':<10} | {f_det:>2}/14 ({f_rate:5.1f}%) | {p_det:>2}/12 ({(p_det/12)*100:5.1f}%) | {g_det:>2}/12 ({(g_det/12)*100:5.1f}%) | {nf_det:>2}/24 ({nf_rate:5.1f}%)   | {f_rate:5.1f}%          | {nf_rate:5.1f}%")

print("\n--- Detailed Coverages ---")
print("Flood Coverages:")
for r in sorted(flood_recs, key=lambda x: x['water_coverage_percentage']):
    print(f"  {r['filename']:<28}: {r['water_coverage_percentage']:>5.2f}%")

print("\nPothole Coverages:")
for r in sorted(pothole_recs, key=lambda x: x['water_coverage_percentage']):
    print(f"  {r['filename']:<28}: {r['water_coverage_percentage']:>5.2f}%")

print("\nGarbage Coverages:")
for r in sorted(garbage_recs, key=lambda x: x['water_coverage_percentage']):
    print(f"  {r['filename']:<28}: {r['water_coverage_percentage']:>5.2f}%")
