import json

with open("scratch/vfloodnet_spatial_analysis.json") as f:
    d = json.load(f)

print(f"{'Filename':<30} | {'Category':<8} | {'Resolution':<10} | {'Total Pixels':<12} | {'Coverage':<8} | {'Warning'}")
print("-" * 85)
for r in sorted(d, key=lambda x: x['orig_width'] * x['orig_height']):
    area = r['orig_width'] * r['orig_height']
    # A standard threshold for LOW RESOLUTION is width < 300 or height < 200 or area < 65000 (roughly thumbnail/sub-VGA)
    is_low_res = r['orig_width'] < 300 or r['orig_height'] < 200 or area < 60000
    warn = "LOW RESOLUTION" if is_low_res else "NORMAL"
    print(f"{r['filename']:<30} | {r['category']:<8} | {r['orig_resolution']:<10} | {area:>12} | {r['water_coverage_pct']:>6.1f}% | {warn}")
