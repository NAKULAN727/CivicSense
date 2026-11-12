import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    p8c6 = json.load(f)

flood_items = [d for d in p8c6 if d.get('category') == 'FLOOD']
print(f"Total flood items in p8c6: {len(flood_items)}")
for d in flood_items:
    print(f"{d.get('filename'):<16} | orig: {d.get('orig_resolution')} | desc: {d.get('description', 'N/A')}")

