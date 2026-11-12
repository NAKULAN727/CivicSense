import os
import sys
import time
import json
import numpy as np
from PIL import Image
import onnxruntime as ort

print("=" * 70)
print("CIVICSENSE AI - COMPREHENSIVE MULTI-MODEL PIPELINE AUDIT & VERIFICATION")
print("=" * 70)

# Paths
MODELS = {
    "road": "public/models/rdd2022-road-damage.onnx",
    "waste": "public/models/waste-detection.onnx",
    "flood": "public/models/flood_segmentation.onnx",
}

TEST_IMAGES = {
    "pothole_drone": "public/assets/potholes_drone.png",
    "pothole_real": "Real Test Datas/Pathole/pathole 1.webp",
    "garbage_drone": "public/assets/garbage_drone.png",
    "garbage_real": "Real Test Datas/Garbage/garbage 1.webp",
    "flood_drone": "public/assets/flooding_drone.png",
    "flood_real": "Real Test Datas/Flood/flood 14.webp",
    "dry_clean_road": "Real Test Datas/Pathole/road without pothole.webp"
}

# STEP 2 - MODEL LOADING AUDIT
print("\n--- STEP 2: MODEL LOADING AUDIT ---")
sessions = {}
model_latencies = {}

for name, path in MODELS.items():
    if not os.path.exists(path):
        print(f"ERROR: Model file not found: {path}")
        continue
    file_size_mb = os.path.getsize(path) / (1024 * 1024)
    start_t = time.perf_counter()
    sess = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    end_t = time.perf_counter()
    init_ms = (end_t - start_t) * 1000
    model_latencies[name] = init_ms
    sessions[name] = sess

    inputs = [f"{inp.name}: {inp.shape} ({inp.type})" for inp in sess.get_inputs()]
    outputs = [f"{out.name}: {out.shape} ({out.type})" for out in sess.get_outputs()]

    print(f"[{name.upper()} MODEL]")
    print(f"  File: {path} ({file_size_mb:.2f} MB)")
    print(f"  Session Load Time: {init_ms:.2f} ms")
    print(f"  Execution Provider: {sess.get_providers()}")
    print(f"  Inputs: {', '.join(inputs)}")
    print(f"  Outputs: {', '.join(outputs)}")

# Taxonomies
ROAD_CLASSES = [
    {"code": "D00", "name": "Longitudinal Crack"},
    {"code": "D10", "name": "Transverse Crack"},
    {"code": "D20", "name": "Alligator Crack"},
    {"code": "D40", "name": "Pothole"}
]

WASTE_CLASSES = [
    {"code": "W00", "name": "Cardboard Waste"},
    {"code": "W10", "name": "E-Waste"},
    {"code": "W20", "name": "Glass Waste"},
    {"code": "W30", "name": "Medical Waste"},
    {"code": "W40", "name": "Metal Waste"},
    {"code": "W50", "name": "Organic Waste"},
    {"code": "W60", "name": "Paper Waste"},
    {"code": "W70", "name": "Plastic Waste"}
]

# Preprocessing helpers matching visualInferenceService.js exactly
def preprocess_yolo(img, target_w=640, target_h=640):
    orig_w, orig_h = img.size
    scale = min(target_w / orig_w, target_h / orig_h)
    new_w = int(round(orig_w * scale))
    new_h = int(round(orig_h * scale))
    pad_x = (target_w - new_w) / 2.0
    pad_y = (target_h - new_h) / 2.0

    img_rgb = img.convert('RGB')
    resized = img_rgb.resize((new_w, new_h), Image.Resampling.BILINEAR)

    canvas = Image.new('RGB', (target_w, target_h), (114, 114, 114))
    canvas.paste(resized, (int(round(pad_x)), int(round(pad_y))))

    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))  # HWC to CHW
    tensor = np.expand_dims(arr, axis=0)  # [1, 3, 640, 640]
    return tensor, orig_w, orig_h, scale, pad_x, pad_y

def preprocess_segformer(img, target_w=512, target_h=512):
    orig_w, orig_h = img.size
    img_rgb = img.convert('RGB').resize((target_w, target_h), Image.Resampling.BILINEAR)
    arr = np.array(img_rgb, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    norm = (arr - mean) / std
    norm = np.transpose(norm, (2, 0, 1))
    tensor = np.expand_dims(norm, axis=0)  # [1, 3, 512, 512]
    return tensor, orig_w, orig_h

def nms(boxes, iou_thresh=0.45):
    if not boxes:
        return []
    boxes_sorted = sorted(boxes, key=lambda b: b['confidence'], reverse=True)
    kept = []
    while boxes_sorted:
        best = boxes_sorted.pop(0)
        kept.append(best)
        remaining = []
        for cand in boxes_sorted:
            # calculate IoU
            b1 = best['bbox_orig']
            b2 = cand['bbox_orig']
            x1 = max(b1[0], b2[0])
            y1 = max(b1[1], b2[1])
            x2 = min(b1[2], b2[2])
            y2 = min(b1[3], b2[3])
            inter = max(0, x2 - x1) * max(0, y2 - y1)
            a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
            a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
            union = a1 + a2 - inter
            iou = inter / union if union > 0 else 0
            if iou < iou_thresh:
                remaining.append(cand)
        boxes_sorted = remaining
    return kept

# Test inference pipeline on each image
print("\n--- STEP 3, 4, 5: MULTI-MODEL INFERENCE ON BENCHMARK DATASET ---")

for label, img_path in TEST_IMAGES.items():
    if not os.path.exists(img_path):
        print(f"Skipping missing: {img_path}")
        continue
    print(f"\n=======================================================")
    print(f"TESTING IMAGE: {label} ({img_path})")
    print(f"=======================================================")

    img = Image.open(img_path)
    orig_w, orig_h = img.size
    print(f"Original Dimensions: {orig_w}x{orig_h}")

    # 1. Road Inference
    t0 = time.perf_counter()
    yolo_tensor, _, _, scale, pad_x, pad_y = preprocess_yolo(img, 640, 640)
    t_pre_yolo = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    road_out = sessions["road"].run(None, {"images": yolo_tensor})[0]
    t_infer_road = (time.perf_counter() - t0) * 1000

    # Decode road YOLOv8 [1, 8, 8400]
    road_candidates = []
    # dims: [1, 8, 8400]
    num_dets = road_out.shape[2]
    for i in range(num_dets):
        cx = road_out[0, 0, i]
        cy = road_out[0, 1, i]
        w = road_out[0, 2, i]
        h = road_out[0, 3, i]
        x1_canvas = cx - w / 2.0
        y1_canvas = cy - h / 2.0
        x2_canvas = cx + w / 2.0
        y2_canvas = cy + h / 2.0

        x1_orig = max(0, min(orig_w, (x1_canvas - pad_x) / scale))
        y1_orig = max(0, min(orig_h, (y1_canvas - pad_y) / scale))
        x2_orig = max(0, min(orig_w, (x2_canvas - pad_x) / scale))
        y2_orig = max(0, min(orig_h, (y2_canvas - pad_y) / scale))

        scores = road_out[0, 4:8, i]
        best_cls = int(np.argmax(scores))
        best_score = float(scores[best_cls])

        if best_score >= 0.25:
            road_candidates.append({
                "type": ROAD_CLASSES[best_cls]["name"],
                "classCode": ROAD_CLASSES[best_cls]["code"],
                "confidence": round(best_score, 4),
                "bbox_orig": [x1_orig, y1_orig, x2_orig, y2_orig]
            })

    # Filter at confidence 0.50 (production) and 0.25 (screening)
    road_screened_025 = [c for c in road_candidates if c["confidence"] >= 0.25]
    road_prod_050 = [c for c in road_candidates if c["confidence"] >= 0.50]
    nms_road_050 = nms(road_prod_050, 0.45)
    nms_road_025 = nms(road_screened_025, 0.45)

    print(f"\n[ROAD DAMAGE MODEL (RDD2022 YOLOv8s)]")
    print(f"  Latency: {t_infer_road:.2f} ms")
    print(f"  Raw Candidates (>=0.25): {len(road_screened_025)}")
    print(f"  Post-NMS (conf >= 0.50): {len(nms_road_050)}")
    print(f"  Post-NMS (conf >= 0.25): {len(nms_road_025)}")
    for d in nms_road_025[:5]:
        print(f"    - {d['classCode']} ({d['type']}) conf: {d['confidence']*100:.1f}%")

    # 2. Waste Inference
    t0 = time.perf_counter()
    waste_out = sessions["waste"].run(None, {"images": yolo_tensor})[0]
    t_infer_waste = (time.perf_counter() - t0) * 1000

    waste_candidates = []
    num_dets_w = waste_out.shape[2]
    for i in range(num_dets_w):
        cx = waste_out[0, 0, i]
        cy = waste_out[0, 1, i]
        w = waste_out[0, 2, i]
        h = waste_out[0, 3, i]
        x1_canvas = cx - w / 2.0
        y1_canvas = cy - h / 2.0
        x2_canvas = cx + w / 2.0
        y2_canvas = cy + h / 2.0

        x1_orig = max(0, min(orig_w, (x1_canvas - pad_x) / scale))
        y1_orig = max(0, min(orig_h, (y1_canvas - pad_y) / scale))
        x2_orig = max(0, min(orig_w, (x2_canvas - pad_x) / scale))
        y2_orig = max(0, min(orig_h, (y2_canvas - pad_y) / scale))

        scores = waste_out[0, 4:12, i]
        best_cls = int(np.argmax(scores))
        best_score = float(scores[best_cls])

        if best_score >= 0.25:
            waste_candidates.append({
                "type": WASTE_CLASSES[best_cls]["name"],
                "classCode": WASTE_CLASSES[best_cls]["code"],
                "confidence": round(best_score, 4),
                "bbox_orig": [x1_orig, y1_orig, x2_orig, y2_orig]
            })

    waste_screened_025 = [c for c in waste_candidates if c["confidence"] >= 0.25]
    waste_prod_050 = [c for c in waste_candidates if c["confidence"] >= 0.50]
    nms_waste_050 = nms(waste_prod_050, 0.45)
    nms_waste_025 = nms(waste_screened_025, 0.45)

    print(f"\n[WASTE DETECTION MODEL (YOLOv8)]")
    print(f"  Latency: {t_infer_waste:.2f} ms")
    print(f"  Raw Candidates (>=0.25): {len(waste_screened_025)}")
    print(f"  Post-NMS (conf >= 0.50): {len(nms_waste_050)}")
    print(f"  Post-NMS (conf >= 0.25): {len(nms_waste_025)}")
    for d in nms_waste_025[:5]:
        print(f"    - {d['classCode']} ({d['type']}) conf: {d['confidence']*100:.1f}%")

    # 3. Flood Inference
    t0 = time.perf_counter()
    flood_tensor, _, _ = preprocess_segformer(img, 512, 512)
    t_pre_flood = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    flood_out = sessions["flood"].run(None, {"pixel_values": flood_tensor})[0]
    t_infer_flood = (time.perf_counter() - t0) * 1000

    # Flood logits: [1, 2, 128, 128]
    # Argmax over class axis (axis 1)
    t0 = time.perf_counter()
    pred_mask_128 = np.argmax(flood_out[0], axis=0).astype(np.uint8) # [128, 128]
    # Resize mask to original image dimensions using nearest neighbor
    mask_pil = Image.fromarray(pred_mask_128).resize((orig_w, orig_h), Image.Resampling.NEAREST)
    pred_mask_orig = np.array(mask_pil)
    total_px = orig_w * orig_h
    flood_px = int(np.sum(pred_mask_orig == 1))
    flood_pct = round((flood_px / total_px) * 100.0, 2)
    t_post_flood = (time.perf_counter() - t0) * 1000

    print(f"\n[FLOOD WATER SEGMENTATION (SegFormer B0)]")
    print(f"  Logits Shape: {flood_out.shape}")
    print(f"  Inference Latency: {t_infer_flood:.2f} ms")
    print(f"  Postprocess Latency: {t_post_flood:.2f} ms")
    print(f"  Floodwater Pixels: {flood_px} / {total_px} ({flood_pct}%)")
    print(f"  Water Detected (>1%): {'YES' if flood_pct > 1.0 else 'NO'}")

    # Summary of Total Pipeline Latency
    total_pipe_ms = t_pre_yolo + t_infer_road + t_infer_waste + t_pre_flood + t_infer_flood + t_post_flood
    print(f"\n[TOTAL MEASURED LATENCY BREAKDOWN]")
    print(f"  YOLO Preprocess:    {t_pre_yolo:.1f} ms")
    print(f"  Road Inference:     {t_infer_road:.1f} ms")
    print(f"  Waste Inference:    {t_infer_waste:.1f} ms")
    print(f"  Flood Preprocess:   {t_pre_flood:.1f} ms")
    print(f"  Flood Inference:    {t_infer_flood:.1f} ms")
    print(f"  Flood Postprocess:  {t_post_flood:.1f} ms")
    print(f"  TOTAL DURATION:     {total_pipe_ms:.1f} ms")

print("\n" + "=" * 70)
print("AUDIT & VERIFICATION COMPLETE")
print("=" * 70)

