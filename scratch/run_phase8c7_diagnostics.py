import os
import sys
import json
import csv
import time
import numpy as np
from PIL import Image
import onnxruntime as ort

sys.stdout.reconfigure(encoding='utf-8')

DATASET_ROOT = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"
MODEL_WASTE = r"e:\CivicSenseAI\public\models\waste-detection.onnx"
MODEL_ROAD = r"e:\CivicSenseAI\public\models\rdd2022-road-damage.onnx"
RAW_RESULTS_8C6 = r"e:\CivicSenseAI\scratch\phase8c6_94_raw_results.json"

CATEGORIES = [
    ("Flood", "FLOOD"),
    ("Garbage", "GARBAGE"),
    ("Pathole", "POTHOLE")
]

WASTE_CLASSES = {
    0: {'code': 'W00', 'name': 'Cardboard Waste'},
    1: {'code': 'W10', 'name': 'E-Waste'},
    2: {'code': 'W20', 'name': 'Glass Waste'},
    3: {'code': 'W30', 'name': 'Medical Waste'},
    4: {'code': 'W40', 'name': 'Metal Waste'},
    5: {'code': 'W50', 'name': 'Organic Waste'},
    6: {'code': 'W60', 'name': 'Paper Waste'},
    7: {'code': 'W70', 'name': 'Plastic Waste'}
}

ROAD_CLASSES = {
    0: {'code': 'D00', 'name': 'Longitudinal Crack'},
    1: {'code': 'D10', 'name': 'Transverse Crack'},
    2: {'code': 'D20', 'name': 'Alligator Crack'},
    3: {'code': 'D40', 'name': 'Pothole'}
}

def preprocess_yolo_640(pil_img):
    orig_w, orig_h = pil_img.size
    scale = min(640.0 / orig_w, 640.0 / orig_h)
    resized_w = int(round(orig_w * scale))
    resized_h = int(round(orig_h * scale))
    pad_x = (640.0 - resized_w) / 2.0
    pad_y = (640.0 - resized_h) / 2.0
    
    img_resized = pil_img.resize((resized_w, resized_h), Image.BILINEAR)
    canvas = Image.new('RGB', (640, 640), (114, 114, 114))
    canvas.paste(img_resized, (int(round(pad_x)), int(round(pad_y))))
    
    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    tensor = np.expand_dims(arr, axis=0)
    return tensor, orig_w, orig_h, scale, pad_x, pad_y

def calculate_iou(boxA, boxB):
    xA = max(boxA['x'], boxB['x'])
    yA = max(boxA['y'], boxB['y'])
    xB = min(boxA['x'] + boxA['width'], boxB['x'] + boxB['width'])
    yB = min(boxA['y'] + boxA['height'], boxB['y'] + boxB['height'])
    inter = max(0, xB - xA) * max(0, yB - yA)
    if inter == 0:
        return 0.0
    areaA = boxA['width'] * boxA['height']
    areaB = boxB['width'] * boxB['height']
    union = areaA + areaB - inter
    return inter / float(union) if union > 0 else 0.0

def apply_nms(boxes, iou_thresh=0.45):
    sorted_boxes = sorted(boxes, key=lambda x: x['confidence'], reverse=True)
    selected = []
    while sorted_boxes:
        curr = sorted_boxes.pop(0)
        selected.append(curr)
        for i in range(len(sorted_boxes) - 1, -1, -1):
            if sorted_boxes[i]['classCode'] == curr['classCode'] and calculate_iou(curr['boundingBox'], sorted_boxes[i]['boundingBox']) > iou_thresh:
                sorted_boxes.pop(i)
    return selected

def run_diagnostics():
    print("=" * 70)
    print("PHASE 8C-7: WASTE & ROAD MODEL DIAGNOSTICS & THRESHOLD SWEEP")
    print("=" * 70)

    # Load 8C-6 baseline results
    with open(RAW_RESULTS_8C6, 'r', encoding='utf-8') as f:
        baseline_records = json.load(f)
    print(f"Loaded {len(baseline_records)} baseline records from Phase 8C-6.")

    sess_waste = ort.InferenceSession(MODEL_WASTE, providers=['CPUExecutionProvider'])
    waste_in_name = sess_waste.get_inputs()[0].name
    
    sess_road = ort.InferenceSession(MODEL_ROAD, providers=['CPUExecutionProvider'])
    road_in_name = sess_road.get_inputs()[0].name

    waste_thresholds = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]
    
    # Structure to hold detections per image at varying thresholds
    waste_sweep_data = {t: {'GARBAGE': 0, 'FLOOD': 0, 'POTHOLE': 0} for t in waste_thresholds}
    
    # Also track detailed detection records
    detailed_waste_detections = []
    detailed_road_pothole_audit = []

    for r in baseline_records:
        filename = r['filename']
        folder = r['folder']
        category = r['category']
        fpath = os.path.join(DATASET_ROOT, folder, filename)
        
        pil_img = Image.open(fpath).convert('RGB')
        orig_w, orig_h = pil_img.size
        
        # 1. RUN WASTE MODEL FOR SWEEP
        tensor_w, _, _, scale_w, pad_x_w, pad_y_w = preprocess_yolo_640(pil_img)
        out_waste = sess_waste.run(None, {waste_in_name: tensor_w})[0][0] # [12, 8400]
        num_det_w = out_waste.shape[1]
        num_classes_w = out_waste.shape[0] - 4
        
        raw_waste_boxes = []
        for i in range(num_det_w):
            scores = out_waste[4:4+num_classes_w, i]
            best_idx = int(np.argmax(scores))
            max_score = float(scores[best_idx])
            
            if max_score >= 0.25 and best_idx in WASTE_CLASSES:
                cx_c, cy_c, w_c, h_c = out_waste[0, i], out_waste[1, i], out_waste[2, i], out_waste[3, i]
                x1_c, y1_c = cx_c - w_c / 2.0, cy_c - h_c / 2.0
                x2_c, y2_c = cx_c + w_c / 2.0, cy_c + h_c / 2.0
                x1_o, y1_o = (x1_c - pad_x_w) / scale_w, (y1_c - pad_y_w) / scale_w
                x2_o, y2_o = (x2_c - pad_x_w) / scale_w, (y2_c - pad_y_w) / scale_w
                x1_cl = max(0, min(orig_w, x1_o))
                y1_cl = max(0, min(orig_h, y1_o))
                x2_cl = max(0, min(orig_w, x2_o))
                y2_cl = max(0, min(orig_h, y2_o))
                w_o, h_o = x2_cl - x1_cl, y2_cl - y1_cl
                if w_o <= 0 or h_o <= 0:
                    continue
                    
                raw_waste_boxes.append({
                    'type': WASTE_CLASSES[best_idx]['name'],
                    'classCode': WASTE_CLASSES[best_idx]['code'],
                    'confidence': round(max_score, 4),
                    'boundingBox': {
                        'x': round((x1_cl / orig_w) * 100, 2),
                        'y': round((y1_cl / orig_h) * 100, 2),
                        'width': round((w_o / orig_w) * 100, 2),
                        'height': round((h_o / orig_h) * 100, 2)
                    }
                })

        # Test each threshold for waste
        for t in waste_thresholds:
            cands_at_t = [b for b in raw_waste_boxes if b['confidence'] >= t]
            nms_at_t = apply_nms(cands_at_t, 0.45)
            if len(nms_at_t) > 0:
                waste_sweep_data[t][category] += 1
                
        # Detections at standard 0.50
        cands_at_50 = [b for b in raw_waste_boxes if b['confidence'] >= 0.50]
        nms_at_50 = apply_nms(cands_at_50, 0.45)
        if (category in ['FLOOD', 'POTHOLE']) and len(nms_at_50) > 0:
            detailed_waste_detections.append({
                'filename': filename,
                'category': category,
                'resolution': f"{orig_w}x{orig_h}",
                'num_detections': len(nms_at_50),
                'classes': [d['classCode'] for d in nms_at_50],
                'confidences': [d['confidence'] for d in nms_at_50],
                'boxes': [d['boundingBox'] for d in nms_at_50]
            })

        # 2. RUN ROAD MODEL FOR DETAILED POTHOLE AUDIT (IF POTHOLE)
        if category == 'POTHOLE':
            tensor_r, _, _, scale_r, pad_x_r, pad_y_r = preprocess_yolo_640(pil_img)
            out_road = sess_road.run(None, {road_in_name: tensor_r})[0][0]
            num_det_r = out_road.shape[1]
            
            raw_road_all = []
            for i in range(num_det_r):
                scores_r = out_road[4:8, i]
                best_r_idx = int(np.argmax(scores_r))
                max_r_score = float(scores_r[best_r_idx])
                
                if max_r_score >= 0.15:
                    raw_road_all.append({
                        'classCode': ROAD_CLASSES[best_r_idx]['code'],
                        'name': ROAD_CLASSES[best_r_idx]['name'],
                        'confidence': round(max_r_score, 4)
                    })
                    
            cands_r_50 = [b for b in raw_road_all if b['confidence'] >= 0.50]
            d40_50 = [b for b in cands_r_50 if b['classCode'] == 'D40']
            all_d40_scores = [b['confidence'] for b in raw_road_all if b['classCode'] == 'D40']
            max_d40_conf = max(all_d40_scores) if all_d40_scores else None
            
            detailed_road_pothole_audit.append({
                'filename': filename,
                'width': orig_w,
                'height': orig_h,
                'low_res': r['lowResolutionWarning'],
                'd40_detected': len(d40_50) > 0,
                'd40_count_at_50': len(d40_50),
                'highest_d40_conf': max_d40_conf,
                'any_road_defect_at_50': len(cands_r_50) > 0,
                'road_classes_at_50': list(set(b['classCode'] for b in cands_r_50)),
                'water_coverage_pct': r['vflood_water_coverage_pct'],
                'waterlogging_status': r['vflood_waterlogging_status']
            })

    print("\n[WASTE THRESHOLD SWEEP RESULTS]")
    print(f"{'Threshold':<10} | {'Garbage (/30)':<15} | {'Flood (/32)':<15} | {'Pothole (/32)':<15} | {'Combined Non-Garbage (/64)':<28}")
    print("-" * 90)
    sweep_rows = []
    for t in waste_thresholds:
        g = waste_sweep_data[t]['GARBAGE']
        fl = waste_sweep_data[t]['FLOOD']
        po = waste_sweep_data[t]['POTHOLE']
        non_g = fl + po
        g_pct = round((g / 30.0) * 100.0, 1)
        fl_pct = round((fl / 32.0) * 100.0, 1)
        po_pct = round((po / 32.0) * 100.0, 1)
        non_g_pct = round((non_g / 64.0) * 100.0, 1)
        print(f"{int(t*100):>3}% ({t:.2f}) | {g:>2}/30 ({g_pct:>5.1f}%) | {fl:>2}/32 ({fl_pct:>5.1f}%) | {po:>2}/32 ({po_pct:>5.1f}%) | {non_g:>2}/64 ({non_g_pct:>5.1f}%)")
        sweep_rows.append({
            'threshold_pct': f"{int(t*100)}%",
            'threshold_float': t,
            'garbage_detected_count': g,
            'garbage_detected_pct': g_pct,
            'flood_cross_detections': fl,
            'flood_cross_pct': fl_pct,
            'pothole_cross_detections': po,
            'pothole_cross_pct': po_pct,
            'combined_non_garbage_count': non_g,
            'combined_non_garbage_pct': non_g_pct
        })

    # Save sweep CSV
    with open(r'e:\CivicSenseAI\reports\phase8c7_waste_threshold_analysis.csv', 'w', newline='', encoding='utf-8') as f_csv:
        writer = csv.DictWriter(f_csv, fieldnames=[
            'threshold_pct', 'threshold_float', 'garbage_detected_count', 'garbage_detected_pct',
            'flood_cross_detections', 'flood_cross_pct', 'pothole_cross_detections', 'pothole_cross_pct',
            'combined_non_garbage_count', 'combined_non_garbage_pct'
        ])
        writer.writeheader()
        writer.writerows(sweep_rows)
    print("Saved reports/phase8c7_waste_threshold_analysis.csv")

    def json_serializer(obj):
        if isinstance(obj, (np.floating, float)):
            return float(obj)
        if isinstance(obj, (np.integer, int)):
            return int(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return str(obj)

    # Save detailed audit cache
    with open(r'e:\CivicSenseAI\scratch\phase8c7_diagnostic_dump.json', 'w', encoding='utf-8') as f_dump:
        json.dump({
            'waste_sweep': sweep_rows,
            'detailed_waste_detections': detailed_waste_detections,
            'detailed_road_pothole_audit': detailed_road_pothole_audit
        }, f_dump, indent=2, default=json_serializer)
    print("Saved scratch/phase8c7_diagnostic_dump.json")

    return sweep_rows, detailed_waste_detections, detailed_road_pothole_audit

if __name__ == '__main__':
    run_diagnostics()
