import onnxruntime as ort
import numpy as np
from PIL import Image
import os
import json

img_path = 'Real Test Datas/Flood/flood 1.jpg'
img = Image.open(img_path).convert('RGB')
w_orig, h_orig = img.size
print(f"Image: {img_path}, Size: {w_orig}x{h_orig}")

# 1. WASTE MODEL
waste_sess = ort.InferenceSession('public/models/waste-detection.onnx', providers=['CPUExecutionProvider'])
scale = min(640.0 / w_orig, 640.0 / h_orig)
nw = int(round(w_orig * scale))
nh = int(round(h_orig * scale))
pad_x = (640.0 - nw) / 2.0
pad_y = (640.0 - nh) / 2.0

img_resized = img.resize((nw, nh), Image.BILINEAR)
canvas = Image.new('RGB', (640, 640), (114, 114, 114))
canvas.paste(img_resized, (int(pad_x), int(pad_y)))
arr = np.array(canvas, dtype=np.float32) / 255.0
arr = np.transpose(arr, (2, 0, 1))
inp = np.expand_dims(arr, axis=0)

waste_out = waste_sess.run(None, {waste_sess.get_inputs()[0].name: inp})[0][0] # shape [12, 8400]
print(f"Waste output shape: {waste_out.shape}")

waste_classes = {
    0: 'W00 Cardboard',
    1: 'W10 E-Waste',
    2: 'W20 Glass',
    3: 'W30 Medical',
    4: 'W40 Metal',
    5: 'W50 Organic',
    6: 'W60 Paper',
    7: 'W70 Plastic'
}

raw_candidates = []
for i in range(8400):
    scs = waste_out[4:12, i]
    cls_idx = int(np.argmax(scs))
    sc = float(scs[cls_idx])
    if sc >= 0.20:
        cx_lb, cy_lb, w_lb, h_lb = waste_out[0:4, i]
        x1_orig = max(0.0, min(float(w_orig), (cx_lb - w_lb/2.0 - pad_x) / scale))
        y1_orig = max(0.0, min(float(h_orig), (cy_lb - h_lb/2.0 - pad_y) / scale))
        x2_orig = max(0.0, min(float(w_orig), (cx_lb + w_lb/2.0 - pad_x) / scale))
        y2_orig = max(0.0, min(float(h_orig), (cy_lb + h_lb/2.0 - pad_y) / scale))
        w_box = x2_orig - x1_orig
        h_box = y2_orig - y1_orig
        raw_candidates.append({
            'idx': i,
            'classCode': f"W{cls_idx}0",
            'className': waste_classes[cls_idx],
            'confidence': sc,
            'x': round(x1_orig / w_orig * 100, 2),
            'y': round(y1_orig / h_orig * 100, 2),
            'width': round(w_box / w_orig * 100, 2),
            'height': round(h_box / h_orig * 100, 2),
            'cov_pct': round((w_box * h_box) / (w_orig * h_orig) * 100, 2)
        })

print(f"Total raw waste candidates (conf >= 0.20): {len(raw_candidates)}")
raw_candidates.sort(key=lambda x: x['confidence'], reverse=True)
for c in raw_candidates[:10]:
    print(f"  {c['classCode']} {c['className']} | Conf: {c['confidence']:.4f} | Box: [x={c['x']}%, y={c['y']}%, w={c['width']}%, h={c['height']}%] | Cov: {c['cov_pct']}%")

# NMS
def iou(b1, b2):
    xa, ya = max(b1['x'], b2['x']), max(b1['y'], b2['y'])
    xb, yb = min(b1['x'] + b1['width'], b2['x'] + b2['width']), min(b1['y'] + b1['height'], b2['y'] + b2['height'])
    inter = max(0, xb - xa) * max(0, yb - ya)
    a1, a2 = b1['width'] * b1['height'], b2['width'] * b2['height']
    return inter / (a1 + a2 - inter + 1e-6)

nms_candidates = []
for c in [x for x in raw_candidates if x['confidence'] >= 0.50]:
    keep = True
    for s in nms_candidates:
        if s['classCode'] == c['classCode'] and iou(s, c) > 0.45:
            keep = False
            break
    if keep:
        nms_candidates.append(c)

print(f"\nPost-NMS detections (conf >= 0.50): {len(nms_candidates)}")
for c in nms_candidates:
    print(f"  Accepted NMS: {c['classCode']} | Conf: {c['confidence']:.4f} | Box: [x={c['x']}%, y={c['y']}%, w={c['width']}%, h={c['height']}%]")

# 2. FLOOD MODEL
flood_sess = ort.InferenceSession('public/models/flood-water-segmentation.onnx', providers=['CPUExecutionProvider'])
flood_img = img.resize((512, 512), Image.BILINEAR)
flood_arr = np.array(flood_img, dtype=np.float32) / 255.0
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
flood_arr = (flood_arr - mean) / std
flood_arr = np.transpose(flood_arr, (2, 0, 1))
flood_inp = np.expand_dims(flood_arr, axis=0)

flood_out = flood_sess.run(None, {flood_sess.get_inputs()[0].name: flood_inp})[0]
print(f"\nFlood output shape: {flood_out.shape}")
pred_mask = np.argmax(flood_out[0], axis=0) # [128, 128]
total_px = 128 * 128
flood_classes_map = {
    0: 'Background',
    1: 'Flooded Building',
    2: 'Non-Flooded Building',
    3: 'Flooded Road',
    4: 'Non-Flooded Road',
    5: 'Water',
    6: 'Tree',
    7: 'Vehicle',
    8: 'Pool',
    9: 'Grass'
}
unique, counts = np.unique(pred_mask, return_counts=True)
flood_water_px = 0
for u, cnt in zip(unique, counts):
    is_water = u in (1, 3, 5)
    if is_water:
        flood_water_px += cnt
    print(f"  Class {u} ({flood_classes_map.get(u, 'Unknown')}): {cnt} px ({cnt/total_px*100:.2f}%) {'[WATER]' if is_water else ''}")

print(f"Total flood water pixels (1, 3, 5): {flood_water_px} ({flood_water_px/total_px*100:.2f}%)")
