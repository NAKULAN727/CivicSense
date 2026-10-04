import json
import numpy as np

with open(r"e:\CivicSenseAI\scratch\raw_cross_category_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Loaded {len(data)} image records.")

flood_recs = [d for d in data if d['source_folder'] == 'Flood']
pothole_recs = [d for d in data if d['source_folder'] == 'Pathole']
garbage_recs = [d for d in data if d['source_folder'] == 'Garbage']

print(f"Flood: {len(flood_recs)} images")
print(f"Pothole: {len(pothole_recs)} images")
print(f"Garbage: {len(garbage_recs)} images")

for cat, recs in [('FLOOD', flood_recs), ('POTHOLE', pothole_recs), ('GARBAGE', garbage_recs)]:
    water_pcts = [r['raw_water_pct'] for r in recs]
    probs = [r['mean_water_prob'] for r in recs]
    diffs = [r['logit_diff'] for r in recs]
    print(f"\n--- {cat} ---")
    print(f"Water Pct: Mean={np.mean(water_pcts):.2f}%, Min={np.min(water_pcts):.2f}%, Max={np.max(water_pcts):.2f}%")
    print(f"Mean Prob: Mean={np.mean(probs):.4f}, Min={np.min(probs):.4f}, Max={np.max(probs):.4f}")
    print(f"Logit Diff: Mean={np.mean(diffs):.4f}, Min={np.min(diffs):.4f}, Max={np.max(diffs):.4f}")
