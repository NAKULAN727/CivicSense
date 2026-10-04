import onnxruntime as ort
import numpy as np
from PIL import Image, ImageDraw
import os
import json

print("=== RUNNING PHASE 8C-4B MODEL VALIDATION TESTS ===")

model_path = "public/models/rdd2022-road-damage.onnx"
session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])

input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

class_names = {
    0: "D00 (Longitudinal Crack)",
    1: "D10 (Transverse Crack)",
    2: "D20 (Alligator Crack)",
    3: "D40 (Pothole)"
}

def preprocess_pil_image(pil_img):
    img_resized = pil_img.resize((640, 640))
    arr = np.array(img_resized, dtype=np.float32) / 255.0  # HWC [0..1]
    if arr.shape[-1] == 4:
        arr = arr[:, :, :3]  # Drop alpha if RGBA
    arr = np.transpose(arr, (2, 0, 1))  # CHW
    arr = np.expand_dims(arr, axis=0)  # [1, 3, 640, 640]
    return arr

def run_inference(image_path_or_img, conf_thresh=0.40, iou_thresh=0.45):
    if isinstance(image_path_or_img, str):
        img = Image.open(image_path_or_img).convert('RGB')
    else:
        img = image_path_or_img.convert('RGB')
    
    inp = preprocess_pil_image(img)
    outputs = session.run([output_name], {input_name: inp})[0]  # [1, 8, 8400]
    
    raw_data = outputs[0]  # [8, 8400]
    num_anchors = raw_data.shape[1]
    
    boxes = []
    for i in range(num_anchors):
        cx = raw_data[0, i] * (100.0 / 640.0)
        cy = raw_data[1, i] * (100.0 / 640.0)
        w  = raw_data[2, i] * (100.0 / 640.0)
        h  = raw_data[3, i] * (100.0 / 640.0)
        
        x1 = max(0.0, cx - w / 2.0)
        y1 = max(0.0, cy - h / 2.0)
        
        if x1 < 0 or y1 < 0 or w <= 0 or h <= 0 or (x1 + w) > 100 or (y1 + h) > 100:
            continue
            
        scores = raw_data[4:8, i]
        best_cls = np.argmax(scores)
        max_score = float(scores[best_cls])
        
        if max_score >= conf_thresh:
            boxes.append({
                'class_idx': int(best_cls),
                'class_code': class_names[int(best_cls)],
                'confidence': round(max_score, 4),
                'box': [round(x1, 2), round(y1, 2), round(w, 2), round(h, 2)]
            })
            
    # Simple NMS
    boxes.sort(key=lambda x: x['confidence'], reverse=True)
    selected = []
    for b in boxes:
        keep = True
        for s in selected:
            if s['class_idx'] == b['class_idx']:
                # IoU check
                b1 = b['box']
                b2 = s['box']
                xa = max(b1[0], b2[0])
                ya = max(b1[1], b2[1])
                xb = min(b1[0]+b1[2], b2[0]+b2[2])
                yb = min(b1[1]+b1[3], b2[1]+b2[3])
                inter = max(0, xb - xa) * max(0, yb - ya)
                area1 = b1[2] * b1[3]
                area2 = b2[2] * b2[3]
                iou = inter / (area1 + area2 - inter + 1e-6)
                if iou > iou_thresh:
                    keep = False
                    break
        if keep:
            selected.push(b) if hasattr(selected, 'push') else selected.append(b)
            
    return selected

print("\n--- TEST A: Potholes Drone Image (potholes_drone.png) ---")
test_a = run_inference("public/assets/potholes_drone.png")
print(f"Detections count: {len(test_a)}")
for d in test_a:
    print(f"  - {d['class_code']}: confidence={d['confidence']} (MODEL CONFIDENCE), box={d['box']}")

print("\n--- TEST B: Garbage Accumulation Image (garbage_drone.png) ---")
test_b = run_inference("public/assets/garbage_drone.png")
print(f"Detections count: {len(test_b)}")
for d in test_b:
    print(f"  - {d['class_code']}: confidence={d['confidence']} (MODEL CONFIDENCE), box={d['box']}")

print("\n--- TEST C: Flooding Scene (flooding_drone.png) ---")
test_c = run_inference("public/assets/flooding_drone.png")
print(f"Detections count: {len(test_c)}")
for d in test_c:
    print(f"  - {d['class_code']}: confidence={d['confidence']} (MODEL CONFIDENCE), box={d['box']}")

print("\n--- TEST D: Buildings & Satellite Image (satellite_recent.jpg) ---")
test_d = run_inference("public/assets/satellite_recent.jpg")
print(f"Detections count: {len(test_d)}")
for d in test_d:
    print(f"  - {d['class_code']}: confidence={d['confidence']} (MODEL CONFIDENCE), box={d['box']}")

print("\n--- TEST E: Pure Synthetic Clean Sky/Trees Image ---")
img_trees = Image.new('RGB', (640, 640), color=(34, 139, 34))  # Solid green
test_e = run_inference(img_trees)
print(f"Detections count: {len(test_e)}")
for d in test_e:
    print(f"  - {d['class_code']}: confidence={d['confidence']} (MODEL CONFIDENCE), box={d['box']}")

print("\n--- TEST F: Real-Life Photo False Positive Comparison ---")
# On non-road images (garbage/water/buildings/trees), test if un-road-related clutter triggers high-confidence fake detections
print(f"Previous behavior: Heuristic analyzer reported false positive D00 ~93%, D40 ~96%, WASTE ~95% on non-road assets.")
print(f"Real ONNX model behavior on garbage_drone.png: {len(test_b)} road damage detections.")
print(f"Real ONNX model behavior on flooding_drone.png: {len(test_c)} road damage detections.")
print(f"Real ONNX model behavior on green background: {len(test_e)} road damage detections.")
