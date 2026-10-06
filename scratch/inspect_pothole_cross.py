import json

with open("src/data/realValidationReport.json", "r", encoding="utf-8") as f:
    d = json.load(f)

potholes = [x for x in d['perImageResults'] if x['groundTruth'] == 'POTHOLE']
print(f"{'Filename':<28} | {'Road Damage Detected':<22} | {'Class':<22} | {'Conf':<6}")
print("-" * 85)
for p in potholes:
    rd = p.get('roadDamage', {})
    det = rd.get('detected', False)
    cls_name = rd.get('primaryClass', 'None')
    conf = rd.get('confidence', 0.0)
    print(f"{p['filename']:<28} | {str(det):<22} | {str(cls_name):<22} | {conf}")
