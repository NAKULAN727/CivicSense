import json

for path in ["scratch/phase8c8_metrics.json", "scratch/phase8c9_arbitrated_records.json"]:
    try:
        with open(path) as f:
            d = json.load(f)
        print(f"{path}: length={len(d)}")
        if isinstance(d, list) and len(d) > 0:
            print("Keys:", list(d[0].keys()))
            flood_items = [x for x in d if "flood" in str(x.get("filename", "")).lower() or "puddle" in str(x.get("filename", "")).lower()]
            print(f"Flood items in {path}: {len(flood_items)}")
    except Exception as e:
        print(f"Error {path}: {e}")

