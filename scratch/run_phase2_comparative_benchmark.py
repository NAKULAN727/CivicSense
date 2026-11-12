import os
import glob
import json
import csv
import time
import numpy as np
from PIL import Image
import onnxruntime as ort

DATASET_DIR = "Real Test Datas"
MODEL_A_PATH = "public/models/rdd2022-road-damage.onnx"
MODEL_B_ONNX_PATH = "scratch/incoming_models/pathole/y8best.onnx"

CONF_THRESHOLDS = [0.25, 0.50]
NMS_IOU_THRESH = 0.45

ROAD_CLASSES_A = {
    0: {'code': 'D00', 'name': 'Longitudinal Crack'},
    1: {'code': 'D10', 'name': 'Transverse Crack'},
    2: {'code': 'D20', 'name': 'Alligator Crack'},
    3: {'code': 'D40', 'name': 'Pothole'}
}

CLASSES_B = {
    0: {'code': 'BAD_BILLBOARD', 'name': 'Bad Billboard'},
    1: {'code': 'BROKEN_SIGNAGE', 'name': 'Broken Signage'},
    2: {'code': 'CLUTTER_SIDEWALK', 'name': 'Clutter Sidewalk'},
    3: {'code': 'CONSTRUCTION_ROAD', 'name': 'Construction Road'},
    4: {'code': 'FADED_SIGNAGE', 'name': 'Faded Signage'},
    5: {'code': 'GARBAGE', 'name': 'Garbage'},
    6: {'code': 'GRAFFITI', 'name': 'Graffiti'},
    7: {'code': 'POTHOLES', 'name': 'Potholes'},
    8: {'code': 'SAND_ON_ROAD', 'name': 'Sand on Road'},
    9: {'code': 'UNKEPT_FACADE', 'name': 'Unkept Facade'}
}

def preprocess_yolo(pil_img, target_w=640, target_h=640):
    orig_w, orig_h = pil_img.size
    scale = min(target_w / orig_w, target_h / orig_h)
    resized_w = int(round(orig_w * scale))
    resized_h = int(round(orig_h * scale))
    
    pad_x = (target_w - resized_w) / 2.0
    pad_y = (target_h - resized_h) / 2.0
    
    img_resized = pil_img.resize((resized_w, resized_h), Image.BILINEAR)
    canvas = Image.new('RGB', (target_w, target_h), (114, 114, 114))
    canvas.paste(img_resized, (int(round(pad_x)), int(round(pad_y))))
    
    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1)) # CHW
    tensor = np.expand_dims(arr, axis=0)
    return tensor, orig_w, orig_h, scale, pad_x, pad_y

def calculate_iou(boxA, boxB):
    xA = max(boxA['x'], boxB['x'])
    yA = max(boxA['y'], boxB['y'])
    xB = min(boxA['x'] + boxA['width'], boxB['x'] + boxB['width'])
    yB = min(boxA['y'] + boxA['height'], boxB['y'] + boxB['height'])
    
    interArea = max(0, xB - xA) * max(0, yB - yA)
    if interArea == 0:
        return 0
    boxAArea = boxA['width'] * boxA['height']
    boxBArea = boxB['width'] * boxB['height']
    return interArea / float(boxAArea + boxBArea - interArea)

def apply_nms(boxes, iou_thresh=0.45):
    sorted_boxes = sorted(boxes, key=lambda x: x['confidence'], reverse=True)
    selected = []
    while len(sorted_boxes) > 0:
        curr = sorted_boxes.pop(0)
        selected.append(curr)
        for i in range(len(sorted_boxes) - 1, -1, -1):
            if sorted_boxes[i]['class_id'] == curr['class_id'] and calculate_iou(curr['bbox_pixels'], sorted_boxes[i]['bbox_pixels']) > iou_thresh:
                sorted_boxes.pop(i)
    return selected

def decode_yolov8_output(output, num_classes, class_names_map, scale, pad_x, pad_y, orig_w, orig_h, conf_thresh=0.25):
    # output shape: [1, 4 + num_classes, 8400]
    out = output[0] if output.ndim == 3 else output # [4 + num_classes, 8400]
    num_proposals = out.shape[1]
    
    candidates = []
    for i in range(num_proposals):
        cx = out[0, i]
        cy = out[1, i]
        w = out[2, i]
        h = out[3, i]
        
        # Class probabilities
        scores = out[4:4 + num_classes, i]
        max_class_id = int(np.argmax(scores))
        max_score = float(scores[max_class_id])
        
        if max_score >= conf_thresh:
            # Convert letterbox coordinates to original image coordinates
            x1_c = cx - w / 2.0
            y1_c = cy - h / 2.0
            x2_c = cx + w / 2.0
            y2_c = cy + h / 2.0
            
            x1_o = max(0, (x1_c - pad_x) / scale)
            y1_o = max(0, (y1_c - pad_y) / scale)
            x2_o = min(orig_w, (x2_c - pad_x) / scale)
            y2_o = min(orig_h, (y2_c - pad_y) / scale)
            
            w_o = max(0, x2_o - x1_o)
            h_o = max(0, y2_o - y1_o)
            
            class_info = class_names_map.get(max_class_id, {'name': f'Class_{max_class_id}', 'code': f'C{max_class_id}'})
            
            candidates.append({
                'class_id': max_class_id,
                'class_name': class_info.get('name', str(max_class_id)),
                'class_code': class_info.get('code', str(max_class_id)),
                'confidence': round(max_score, 4),
                'bbox_pixels': {
                    'x': round(float(x1_o), 1),
                    'y': round(float(y1_o), 1),
                    'width': round(float(w_o), 1),
                    'height': round(float(h_o), 1)
                },
                'bbox_norm': {
                    'x': round(float(x1_o / orig_w), 4),
                    'y': round(float(y1_o / orig_h), 4),
                    'width': round(float(w_o / orig_w), 4),
                    'height': round(float(h_o / orig_h), 4)
                }
            })
            
    return apply_nms(candidates, NMS_IOU_THRESH)

def run_benchmark():
    print("=" * 70)
    print("PHASE 2: FAIR COMPARATIVE BENCHMARK ON 94 REAL-WORLD STREET IMAGES")
    print("=" * 70)
    
    print("\nLoading ONNX inference sessions...")
    session_a = ort.InferenceSession(MODEL_A_PATH, providers=['CPUExecutionProvider'])
    input_a_name = session_a.get_inputs()[0].name
    out_a_shape = session_a.get_outputs()[0].shape
    num_classes_a = out_a_shape[1] - 4 # 8 - 4 = 4 classes
    print(f"Model A loaded: input '{input_a_name}', shape {out_a_shape}, {num_classes_a} classes (RDD2022).")
    
    session_b = ort.InferenceSession(MODEL_B_ONNX_PATH, providers=['CPUExecutionProvider'])
    input_b_name = session_b.get_inputs()[0].name
    out_b_shape = session_b.get_outputs()[0].shape
    num_classes_b = out_b_shape[1] - 4 # 14 - 4 = 10 classes
    print(f"Model B loaded: input '{input_b_name}', shape {out_b_shape}, {num_classes_b} classes (Visual Pollution).")
    print(f"Model B Pothole Class: index 7 -> '{CLASSES_B[7]['code']}'")
    
    records = []
    latencies_a = []
    latencies_b = []
    
    categories = ['Flood', 'Garbage', 'Pathole']
    image_count = 0
    
    for cat in categories:
        cat_dir = os.path.join(DATASET_DIR, cat)
        files = sorted(os.listdir(cat_dir))
        print(f"\nProcessing category '{cat}' ({len(files)} images)...")
        
        for f in files:
            img_path = os.path.join(cat_dir, f)
            try:
                pil_img = Image.open(img_path).convert('RGB')
            except Exception as e:
                print(f"  Warning: skipping unreadable file {f}: {e}")
                continue
                
            image_count += 1
            tensor_np, orig_w, orig_h, scale, pad_x, pad_y = preprocess_yolo(pil_img, 640, 640)
            
            # --- Model A Inference ---
            t0 = time.perf_counter()
            out_a = session_a.run(None, {input_a_name: tensor_np})[0]
            lat_a = (time.perf_counter() - t0) * 1000
            latencies_a.append(lat_a)
            
            dets_a_025 = decode_yolov8_output(out_a, num_classes_a, ROAD_CLASSES_A, scale, pad_x, pad_y, orig_w, orig_h, 0.25)
            dets_a_050 = [d for d in dets_a_025 if d['confidence'] >= 0.50]
            
            # Potholes specifically in Model A are D40
            potholes_a_025 = [d for d in dets_a_025 if d['class_code'] == 'D40']
            potholes_a_050 = [d for d in dets_a_050 if d['class_code'] == 'D40']
            cracks_a_025 = [d for d in dets_a_025 if d['class_code'] in ['D00', 'D10', 'D20']]
            cracks_a_050 = [d for d in dets_a_050 if d['class_code'] in ['D00', 'D10', 'D20']]
            
            # --- Model B Inference ---
            t0 = time.perf_counter()
            out_b = session_b.run(None, {input_b_name: tensor_np})[0]
            lat_b = (time.perf_counter() - t0) * 1000
            latencies_b.append(lat_b)
            
            dets_b_025 = decode_yolov8_output(out_b, num_classes_b, CLASSES_B, scale, pad_x, pad_y, orig_w, orig_h, 0.25)
            dets_b_050 = [d for d in dets_b_025 if d['confidence'] >= 0.50]
            
            # Potholes in Model B are Class 7 ('POTHOLES')
            potholes_b_025 = [d for d in dets_b_025 if d['class_code'] == 'POTHOLES']
            potholes_b_050 = [d for d in dets_b_050 if d['class_code'] == 'POTHOLES']
            other_b_025 = [d for d in dets_b_025 if d['class_code'] != 'POTHOLES']
            other_b_050 = [d for d in dets_b_050 if d['class_code'] != 'POTHOLES']
            
            record = {
                'filename': f,
                'category': cat.upper() if cat.upper() != 'PATHOLE' else 'POTHOLE',
                'dimensions': {'width': orig_w, 'height': orig_h},
                'model_a': {
                    'latency_ms': round(lat_a, 2),
                    'all_detections_025': dets_a_025,
                    'all_detections_050': dets_a_050,
                    'potholes_025_count': len(potholes_a_025),
                    'potholes_050_count': len(potholes_a_050),
                    'cracks_025_count': len(cracks_a_025),
                    'cracks_050_count': len(cracks_a_050),
                    'total_detections_025': len(dets_a_025),
                    'total_detections_050': len(dets_a_050),
                    'has_pothole_025': len(potholes_a_025) > 0,
                    'has_pothole_050': len(potholes_a_050) > 0,
                    'has_any_defect_025': len(dets_a_025) > 0,
                    'has_any_defect_050': len(dets_a_050) > 0,
                    'max_conf_pothole': max([d['confidence'] for d in potholes_a_025], default=0.0),
                    'max_conf_any': max([d['confidence'] for d in dets_a_025], default=0.0)
                },
                'model_b': {
                    'latency_ms': round(lat_b, 2),
                    'all_detections_025': dets_b_025,
                    'all_detections_050': dets_b_050,
                    'potholes_025_count': len(potholes_b_025),
                    'potholes_050_count': len(potholes_b_050),
                    'other_025_count': len(other_b_025),
                    'other_050_count': len(other_b_050),
                    'total_detections_025': len(dets_b_025),
                    'total_detections_050': len(dets_b_050),
                    'has_pothole_025': len(potholes_b_025) > 0,
                    'has_pothole_050': len(potholes_b_050) > 0,
                    'max_conf_pothole': max([d['confidence'] for d in potholes_b_025], default=0.0)
                }
            }
            records.append(record)
            
    print(f"\nCompleted comparative inference on all {image_count} images.")
    
    # Save JSON results
    with open("scratch/phase2_comparative_results.json", "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    print("Saved detailed results to 'scratch/phase2_comparative_results.json'.")
    
    # Save CSV summary
    with open("scratch/phase2_comparative_table.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Filename", "Category", 
            "ModelA_D40_0.50", "ModelA_MaxConf_D40", "ModelA_Cracks_0.50", "ModelA_Total_0.50",
            "ModelB_Potholes_0.50", "ModelB_MaxConf_Pothole", "ModelB_Other_0.50", "ModelB_Total_0.50",
            "ModelA_D40_0.25", "ModelB_Potholes_0.25",
            "Agreement_Pothole_0.50", "ModelA_Latency_ms", "ModelB_Latency_ms"
        ])
        for r in records:
            ma = r['model_a']
            mb = r['model_b']
            agree = (ma['has_pothole_050'] == mb['has_pothole_050'])
            writer.writerow([
                r['filename'], r['category'],
                ma['potholes_050_count'], ma['max_conf_pothole'], ma['cracks_050_count'], ma['total_detections_050'],
                mb['potholes_050_count'], mb['max_conf_pothole'], mb['other_050_count'], mb['total_detections_050'],
                ma['potholes_025_count'], mb['potholes_025_count'],
                agree, ma['latency_ms'], mb['latency_ms']
            ])
    print("Saved summary table to 'scratch/phase2_comparative_table.csv'.")
    
    # Aggregate Statistics
    print("\n" + "=" * 70)
    print("AGGREGATE COMPARATIVE EVALUATION SUMMARY")
    print("=" * 70)
    
    pothole_images = [r for r in records if r['category'] == 'POTHOLE']
    flood_images = [r for r in records if r['category'] == 'FLOOD']
    garbage_images = [r for r in records if r['category'] == 'GARBAGE']
    
    # 1. Pothole Category (Sensitivity on True Pothole Images)
    print(f"\n[1] TRUE POTHOLE IMAGES (Total: {len(pothole_images)})")
    ma_pothole_050 = sum(1 for r in pothole_images if r['model_a']['has_pothole_050'])
    mb_pothole_050 = sum(1 for r in pothole_images if r['model_b']['has_pothole_050'])
    ma_pothole_025 = sum(1 for r in pothole_images if r['model_a']['has_pothole_025'])
    mb_pothole_025 = sum(1 for r in pothole_images if r['model_b']['has_pothole_025'])
    ma_any_050 = sum(1 for r in pothole_images if r['model_a']['has_any_defect_050'])
    ma_any_025 = sum(1 for r in pothole_images if r['model_a']['has_any_defect_025'])
    
    total_boxes_ma_050 = sum(r['model_a']['potholes_050_count'] for r in pothole_images)
    total_boxes_mb_050 = sum(r['model_b']['potholes_050_count'] for r in pothole_images)
    total_boxes_ma_025 = sum(r['model_a']['potholes_025_count'] for r in pothole_images)
    total_boxes_mb_025 = sum(r['model_b']['potholes_025_count'] for r in pothole_images)
    
    print(f"  Model A (RDD2022 D40 Pothole) @ conf >= 0.50: {ma_pothole_050} / {len(pothole_images)} images ({ma_pothole_050/len(pothole_images)*100:.1f}%), {total_boxes_ma_050} total boxes")
    print(f"  Model B (New YOLOv8x Pothole) @ conf >= 0.50: {mb_pothole_050} / {len(pothole_images)} images ({mb_pothole_050/len(pothole_images)*100:.1f}%), {total_boxes_mb_050} total boxes")
    print(f"  Model A (RDD2022 D40 Pothole) @ conf >= 0.25: {ma_pothole_025} / {len(pothole_images)} images ({ma_pothole_025/len(pothole_images)*100:.1f}%), {total_boxes_ma_025} total boxes")
    print(f"  Model B (New YOLOv8x Pothole) @ conf >= 0.25: {mb_pothole_025} / {len(pothole_images)} images ({mb_pothole_025/len(pothole_images)*100:.1f}%), {total_boxes_mb_025} total boxes")
    print(f"  Model A (Any Road Defect D00-D40) @ 0.50:     {ma_any_050} / {len(pothole_images)} images ({ma_any_050/len(pothole_images)*100:.1f}%)")
    print(f"  Model A (Any Road Defect D00-D40) @ 0.25:     {ma_any_025} / {len(pothole_images)} images ({ma_any_025/len(pothole_images)*100:.1f}%)")
    
    # 2. Flood Category (False Pothole Alarms on Water)
    print(f"\n[2] FLOOD IMAGES (Total: {len(flood_images)}) - False Positive Audit on Water")
    ma_flood_fp_050 = sum(1 for r in flood_images if r['model_a']['has_pothole_050'])
    mb_flood_fp_050 = sum(1 for r in flood_images if r['model_b']['has_pothole_050'])
    ma_flood_fp_025 = sum(1 for r in flood_images if r['model_a']['has_pothole_025'])
    mb_flood_fp_025 = sum(1 for r in flood_images if r['model_b']['has_pothole_025'])
    print(f"  Model A False Potholes @ 0.50: {ma_flood_fp_050} / {len(flood_images)} ({ma_flood_fp_050/len(flood_images)*100:.1f}%)")
    print(f"  Model B False Potholes @ 0.50: {mb_flood_fp_050} / {len(flood_images)} ({mb_flood_fp_050/len(flood_images)*100:.1f}%)")
    print(f"  Model A False Potholes @ 0.25: {ma_flood_fp_025} / {len(flood_images)} ({ma_flood_fp_025/len(flood_images)*100:.1f}%)")
    print(f"  Model B False Potholes @ 0.25: {mb_flood_fp_025} / {len(flood_images)} ({mb_flood_fp_025/len(flood_images)*100:.1f}%)")
    
    # 3. Garbage Category (False Pothole Alarms on Waste / Debris)
    print(f"\n[3] GARBAGE IMAGES (Total: {len(garbage_images)}) - False Positive Audit on Waste Piles")
    ma_garbage_fp_050 = sum(1 for r in garbage_images if r['model_a']['has_pothole_050'])
    mb_garbage_fp_050 = sum(1 for r in garbage_images if r['model_b']['has_pothole_050'])
    ma_garbage_fp_025 = sum(1 for r in garbage_images if r['model_a']['has_pothole_025'])
    mb_garbage_fp_025 = sum(1 for r in garbage_images if r['model_b']['has_pothole_025'])
    print(f"  Model A False Potholes @ 0.50: {ma_garbage_fp_050} / {len(garbage_images)} ({ma_garbage_fp_050/len(garbage_images)*100:.1f}%)")
    print(f"  Model B False Potholes @ 0.50: {mb_garbage_fp_050} / {len(garbage_images)} ({mb_garbage_fp_050/len(garbage_images)*100:.1f}%)")
    print(f"  Model A False Potholes @ 0.25: {ma_garbage_fp_025} / {len(garbage_images)} ({ma_garbage_fp_025/len(garbage_images)*100:.1f}%)")
    print(f"  Model B False Potholes @ 0.25: {mb_garbage_fp_025} / {len(garbage_images)} ({mb_garbage_fp_025/len(garbage_images)*100:.1f}%)")
    
    # 4. Latency
    print(f"\n[4] INFERENCE LATENCY (Over {len(records)} real images on CPU)")
    mean_lat_a = np.mean(latencies_a)
    mean_lat_b = np.mean(latencies_b)
    print(f"  Model A Latency: Mean = {mean_lat_a:.2f} ms (+/- {np.std(latencies_a):.2f} ms)")
    print(f"  Model B Latency: Mean = {mean_lat_b:.2f} ms (+/- {np.std(latencies_b):.2f} ms)")
    print(f"  Latency Ratio (B / A): {mean_lat_b / mean_lat_a:.2f}x slower")
    
    # 5. Key Benchmark Test Cases
    print(f"\n[5] SPECIFIC TARGET CASE AUDIT")
    key_cases = ['road without pothole.webp', 'water filled patholes.jpg', 'pathole 1.webp', 'pathole 4.webp', 'pathole 14.webp', 'pathole 26.webp']
    for kc in key_cases:
        match = [r for r in records if r['filename'].lower() == kc.lower()]
        if match:
            r = match[0]
            ma = r['model_a']
            mb = r['model_b']
            print(f"\n  Target: '{kc}' (Category: {r['category']})")
            print(f"    Model A (RDD2022): D40 Potholes @ 0.50: {ma['potholes_050_count']} (max conf: {ma['max_conf_pothole']}), Total Road Defects: {ma['total_detections_050']}")
            print(f"    Model B (YOLOv8x): Potholes @ 0.50:     {mb['potholes_050_count']} (max conf: {mb['max_conf_pothole']}), Other Detections: {mb['other_050_count']}")

if __name__ == "__main__":
    run_benchmark()
