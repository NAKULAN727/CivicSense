import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)

print(f"Total raw records: {len(raw)}")
monolithic = []
for r in raw:
    w_dets = r.get('waste_detections', [])
    for d in w_dets:
        box = d.get('boundingBox', {})
        w = box.get('width', 0)
        h = box.get('height', 0)
        cov = (w * h) / 100.0
        if w >= 70 and h >= 70:
            monolithic.append({
                'filename': r['filename'],
                'category': r['category'],
                'res': f"{r['width']}x{r['height']}",
                'lowRes': r.get('lowResolutionWarning', False),
                'class': d['classCode'],
                'conf': d['confidence'],
                'w': w,
                'h': h,
                'cov': cov
            })

print(f"Total monolithic waste detections (w>=70 & h>=70): {len(monolithic)}")
for m in monolithic:
    print(f"  {m['filename']} [{m['category']}] ({m['res']}, lowRes={m['lowRes']}): {m['class']} conf={m['conf']:.3f}, box={m['w']:.1f}%x{m['h']:.1f}% (cov={m['cov']:.1f}%)")
