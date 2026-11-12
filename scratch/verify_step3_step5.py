import onnxruntime as ort
import numpy as np
from PIL import Image
import time
import os

model_path = "public/models/rdd2022-road-damage.onnx"

print("=" * 60)
print("CIVICSENSE AI — STEP 3 & STEP 5 MODEL A DIRECT INFERENCE VERIFICATION")
print("=" * 60)

# Check model file exists
assert os.path.exists(model_path), f"Model file not found: {model_path}"
model_size_mb = os.path.getsize(model_path) / (1024 * 1024)
print(f"Model File: {model_path} ({model_size_mb:.2f} MB)")

# 1. Load Model
session = ort.InferenceSession(model_path)
inputs = session.get_inputs()
outputs = session.get_outputs()
print(f"Model Load Status: SUCCESS (VERIFIED)")
print(f"Input Name: '{inputs[0].name}', Shape: {inputs[0].shape}, Type: {inputs[0].type}")
print(f"Output Name: '{outputs[0].name}', Shape: {outputs[0].shape}, Type: {outputs[0].type}")
print("-" * 60)

CLASS_MAP = {
    0: ("D00", "Longitudinal Crack"),
    1: ("D10", "Transverse Crack"),
    2: ("D20", "Alligator Crack"),
    3: ("D40", "Pothole")
}

def calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    if inter == 0:
        return 0.0
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0

def run_inference_on_image(img_path, conf_thresh=0.50, iou_thresh=0.45):
    if not os.path.exists(img_path):
        return {"error": f"File not found: {img_path}"}
    
    img = Image.open(img_path).convert("RGB")
    orig_w, orig_h = img.size
    
    # Preprocess (letterbox 640x640)
    scale = min(640 / orig_w, 640 / orig_h)
    nw = int(round(orig_w * scale))
    nh = int(round(orig_h * scale))
    resized = img.resize((nw, nh), Image.Resampling.BILINEAR)
    
    pad_x = (640 - nw) / 2.0
    pad_y = (640 - nh) / 2.0
    canvas = Image.new("RGB", (640, 640), (114, 114, 114))
    canvas.paste(resized, (int(round(pad_x)), int(round(pad_y))))
    
    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    tensor = np.expand_dims(arr, 0)
    
    # Run inference with timing
    t0 = time.perf_counter()
    out = session.run(["output0"], {"images": tensor})[0]
    t1 = time.perf_counter()
    latency_ms = (t1 - t0) * 1000.0
    
    raw_data = out[0] # [8, 8400]
    num_detections = 8400
    
    raw_d40_candidates = 0
    max_d40_conf = 0.0
    post_thresh_candidates = []
    
    for i in range(num_detections):
        cx = raw_data[0, i]
        cy = raw_data[1, i]
        w = raw_data[2, i]
        h = raw_data[3, i]
        
        x1_canvas = cx - w / 2.0
        y1_canvas = cy - h / 2.0
        x2_canvas = cx + w / 2.0
        y2_canvas = cy + h / 2.0
        
        x1_orig = (x1_canvas - pad_x) / scale
        y1_orig = (y1_canvas - pad_y) / scale
        x2_orig = (x2_canvas - pad_x) / scale
        y2_orig = (y2_canvas - pad_y) / scale
        
        x1_clamped = max(0.0, min(orig_w, x1_orig))
        y1_clamped = max(0.0, min(orig_h, y1_orig))
        x2_clamped = max(0.0, min(orig_w, x2_orig))
        y2_clamped = max(0.0, min(orig_h, y2_orig))
        
        d40_score = float(raw_data[7, i])
        if d40_score > max_d40_conf:
            max_d40_conf = d40_score
        if d40_score >= 0.25:
            raw_d40_candidates += 1
            
        # Check all 4 classes
        scores = [float(raw_data[4 + c, i]) for c in range(4)]
        best_c = int(np.argmax(scores))
        best_score = scores[best_c]
        
        if best_score >= conf_thresh:
            post_thresh_candidates.append({
                "class_idx": best_c,
                "class_code": CLASS_MAP[best_c][0],
                "class_name": CLASS_MAP[best_c][1],
                "confidence": best_score,
                "box": [x1_clamped, y1_clamped, x2_clamped, y2_clamped]
            })
            
    # Apply NMS
    post_thresh_candidates.sort(key=lambda x: x["confidence"], reverse=True)
    nms_detections = []
    
    pool = list(post_thresh_candidates)
    while len(pool) > 0:
        current = pool.pop(0)
        nms_detections.append(current)
        pool = [d for d in pool if d["class_code"] != current["class_code"] or calculate_iou(current["box"], d["box"]) <= iou_thresh]
        
    return {
        "image": os.path.basename(img_path),
        "orig_dims": f"{orig_w}x{orig_h}",
        "latency_ms": round(latency_ms, 2),
        "raw_d40_candidates_025": raw_d40_candidates,
        "max_d40_conf": round(max_d40_conf, 4),
        "post_thresh_count": len(post_thresh_candidates),
        "post_nms_count": len(nms_detections),
        "post_nms_detections": nms_detections
    }

# Test Suite Images
test_images = [
    ("Currently Displayed Hub Image", "public/assets/potholes_drone.png"),
    ("Real Pothole 1", "Real Test Datas/Pathole/pathole 1.webp"),
    ("Real Pothole 4 (Cluster)", "Real Test Datas/Pathole/pathole 4.webp"),
    ("Real Road Crack D20", "Real Test Datas/Pathole/pathole 10.webp"),
    ("Real Road Crack D00", "Real Test Datas/Pathole/pathole 15.webp"),
    ("Clean Road Negative Control", "Real Test Datas/Pathole/road without pothole.webp"),
]

for label, img_path in test_images:
    res = run_inference_on_image(img_path)
    print(f"\n--- {label}: {res.get('image')} ---")
    if "error" in res:
        print("  Error:", res["error"])
        continue
    print(f"  Dimensions: {res['orig_dims']}")
    print(f"  Latency: {res['latency_ms']} ms")
    print(f"  Raw D40 Candidates (>= 0.25): {res['raw_d40_candidates_025']}")
    print(f"  Max D40 Confidence: {res['max_d40_conf']}")
    print(f"  Post-Threshold Detections (>= 0.50): {res['post_thresh_count']}")
    print(f"  Post-NMS Detections: {res['post_nms_count']}")
    for d in res['post_nms_detections']:
        b = [round(x, 1) for x in d['box']]
        print(f"    * {d['class_name']} ({d['class_code']}): conf={d['confidence']:.4f}, box={b}")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETED")
print("=" * 60)
