import os
import glob
import json
import csv
import time
import numpy as np
from PIL import Image
import onnxruntime as ort

DATASET_DIR = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"
MODEL_ROAD = r"e:\CivicSenseAI\public\models\rdd2022-road-damage.onnx"
MODEL_WASTE = r"e:\CivicSenseAI\public\models\waste-detection.onnx"
MODEL_FLOOD = r"e:\CivicSenseAI\public\models\flood-water-segmentation.onnx"

CONFIDENCE_THRESHOLD = 0.50
NMS_IOU_THRESHOLD = 0.45

ROAD_CLASSES = {
    0: {'code': 'D00', 'name': 'Longitudinal Crack'},
    1: {'code': 'D10', 'name': 'Transverse Crack'},
    2: {'code': 'D20', 'name': 'Alligator Crack'},
    3: {'code': 'D40', 'name': 'Pothole'}
}

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

FLOOD_CLASSES = {
    0: {'code': 'F00', 'name': 'background', 'isWater': False},
    1: {'code': 'F10', 'name': 'building flooded', 'isWater': True},
    2: {'code': 'F20', 'name': 'building non-flooded', 'isWater': False},
    3: {'code': 'F30', 'name': 'road flooded', 'isWater': True},
    4: {'code': 'F40', 'name': 'road non-flooded', 'isWater': False},
    5: {'code': 'F50', 'name': 'water', 'isWater': True},
    6: {'code': 'F60', 'name': 'tree', 'isWater': False},
    7: {'code': 'F70', 'name': 'vehicle', 'isWater': False},
    8: {'code': 'F80', 'name': 'pool', 'isWater': False},
    9: {'code': 'F90', 'name': 'grass', 'isWater': False}
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
    return tensor, orig_w, orig_h, resized_w, resized_h, scale, pad_x, pad_y

def preprocess_segformer(pil_img, target_w=512, target_h=512):
    orig_w, orig_h = pil_img.size
    img_resized = pil_img.resize((target_w, target_h), Image.BILINEAR)
    arr = np.array(img_resized, dtype=np.float32) / 255.0
    if arr.ndim == 2:
        arr = np.stack([arr]*3, axis=-1)
    elif arr.shape[-1] == 4:
        arr = arr[:, :, :3]
        
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    arr = (arr - mean) / std
    arr = np.transpose(arr, (2, 0, 1))
    tensor = np.expand_dims(arr, axis=0)
    return tensor, orig_w, orig_h

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
            if sorted_boxes[i]['classCode'] == curr['classCode'] and calculate_iou(curr['boundingBox'], sorted_boxes[i]['boundingBox']) > iou_thresh:
                sorted_boxes.pop(i)
    return selected

def run_validation():
    print("Loading ONNX models...")
    session_road = ort.InferenceSession(MODEL_ROAD, providers=['CPUExecutionProvider'])
    session_waste = ort.InferenceSession(MODEL_WASTE, providers=['CPUExecutionProvider'])
    session_flood = ort.InferenceSession(MODEL_FLOOD, providers=['CPUExecutionProvider'])
    print("Models loaded successfully.")
    
    records = []
    
    for root, dirs, files in os.walk(DATASET_DIR):
        folder_name = os.path.basename(root)
        if not folder_name:
            continue
        
        # Ground truth strictly from folder
        gt_category = None
        if folder_name.upper() == 'FLOOD':
            gt_category = 'FLOOD'
        elif folder_name.upper() == 'GARBAGE':
            gt_category = 'GARBAGE'
        elif folder_name.upper() == 'PATHOLE':
            gt_category = 'POTHOLE'
        else:
            continue
            
        for f in sorted(files):
            file_path = os.path.join(root, f)
            rel_path = os.path.relpath(file_path, DATASET_DIR)
            
            try:
                pil_img = Image.open(file_path).convert('RGB')
            except Exception as e:
                print(f"Skipping invalid image {f}: {e}")
                continue
                
            orig_w, orig_h = pil_img.size
            start_time = time.time()
            
            # --- 1. Road Damage Model ---
            tensor_road, _, _, _, _, scale_r, pad_x_r, pad_y_r = preprocess_yolo(pil_img, 640, 640)
            inp_name_road = session_road.get_inputs()[0].name
            out_road = session_road.run(None, {inp_name_road: tensor_road})[0][0] # [8, 8400]
            
            raw_road_candidates = []
            num_det_r = out_road.shape[1]
            for i in range(num_det_r):
                cx_c, cy_c, w_c, h_c = out_road[0, i], out_road[1, i], out_road[2, i], out_road[3, i]
                x1_c = cx_c - w_c / 2.0
                y1_c = cy_c - h_c / 2.0
                x2_c = cx_c + w_c / 2.0
                y2_c = cy_c + h_c / 2.0
                
                x1_o = (x1_c - pad_x_r) / scale_r
                y1_o = (y1_c - pad_y_r) / scale_r
                x2_o = (x2_c - pad_x_r) / scale_r
                y2_o = (y2_c - pad_y_r) / scale_r
                
                x1_cl = max(0, min(orig_w, x1_o))
                y1_cl = max(0, min(orig_h, y1_o))
                x2_cl = max(0, min(orig_w, x2_o))
                y2_cl = max(0, min(orig_h, y2_o))
                
                w_o = x2_cl - x1_cl
                h_o = y2_cl - y1_cl
                if w_o <= 0 or h_o <= 0:
                    continue
                    
                x_pct = round((x1_cl / orig_w) * 100, 2)
                y_pct = round((y1_cl / orig_h) * 100, 2)
                w_pct = round((w_o / orig_w) * 100, 2)
                h_pct = round((h_o / orig_h) * 100, 2)
                
                scores = out_road[4:8, i]
                best_idx = np.argmax(scores)
                max_score = float(scores[best_idx])
                
                if max_score >= CONFIDENCE_THRESHOLD:
                    class_info = ROAD_CLASSES[best_idx]
                    raw_road_candidates.append({
                        'type': class_info['name'],
                        'classCode': class_info['code'],
                        'confidence': float(round(max_score, 4)),
                        'boundingBox': {'x': float(x_pct), 'y': float(y_pct), 'width': float(w_pct), 'height': float(h_pct)}
                    })
            nms_road = apply_nms(raw_road_candidates, NMS_IOU_THRESHOLD)
            
            # --- 2. Waste Model ---
            tensor_waste, _, _, _, _, scale_w, pad_x_w, pad_y_w = preprocess_yolo(pil_img, 640, 640)
            inp_name_waste = session_waste.get_inputs()[0].name
            out_waste = session_waste.run(None, {inp_name_waste: tensor_waste})[0][0] # [12, 8400]
            
            raw_waste_candidates = []
            num_det_w = out_waste.shape[1]
            num_classes_w = out_waste.shape[0] - 4
            for i in range(num_det_w):
                cx_c, cy_c, w_c, h_c = out_waste[0, i], out_waste[1, i], out_waste[2, i], out_waste[3, i]
                x1_c = cx_c - w_c / 2.0
                y1_c = cy_c - h_c / 2.0
                x2_c = cx_c + w_c / 2.0
                y2_c = cy_c + h_c / 2.0
                
                x1_o = (x1_c - pad_x_w) / scale_w
                y1_o = (y1_c - pad_y_w) / scale_w
                x2_o = (x2_c - pad_x_w) / scale_w
                y2_o = (y2_c - pad_y_w) / scale_w
                
                x1_cl = max(0, min(orig_w, x1_o))
                y1_cl = max(0, min(orig_h, y1_o))
                x2_cl = max(0, min(orig_w, x2_o))
                y2_cl = max(0, min(orig_h, y2_o))
                
                w_o = x2_cl - x1_cl
                h_o = y2_cl - y1_cl
                if w_o <= 0 or h_o <= 0:
                    continue
                    
                x_pct = round((x1_cl / orig_w) * 100, 2)
                y_pct = round((y1_cl / orig_h) * 100, 2)
                w_pct = round((w_o / orig_w) * 100, 2)
                h_pct = round((h_o / orig_h) * 100, 2)
                
                scores = out_waste[4:4+num_classes_w, i]
                best_idx = np.argmax(scores)
                max_score = float(scores[best_idx])
                
                if max_score >= CONFIDENCE_THRESHOLD and best_idx < len(WASTE_CLASSES):
                    class_info = WASTE_CLASSES[best_idx]
                    raw_waste_candidates.append({
                        'type': class_info['name'],
                        'classCode': class_info['code'],
                        'confidence': float(round(max_score, 4)),
                        'boundingBox': {'x': float(x_pct), 'y': float(y_pct), 'width': float(w_pct), 'height': float(h_pct)}
                    })
            nms_waste = apply_nms(raw_waste_candidates, NMS_IOU_THRESHOLD)
            
            # --- 3. Flood Model ---
            tensor_flood, _, _ = preprocess_segformer(pil_img, 512, 512)
            inp_name_flood = session_flood.get_inputs()[0].name
            out_flood = session_flood.run(None, {inp_name_flood: tensor_flood})[0][0] # [10, 128, 128]
            
            # Argmax over class dimension 0
            argmax_map = np.argmax(out_flood, axis=0) # [128, 128]
            spatial_size = 128 * 128
            water_pixels = np.sum((argmax_map == 1) | (argmax_map == 3) | (argmax_map == 5))
            flooded_ratio = float(water_pixels) / spatial_size
            flooded_percent = round(flooded_ratio * 100, 2)
            is_flood_detected = flooded_percent > 1.0
            
            elapsed_ms = round((time.time() - start_time) * 1000, 1)
            
            # Formulate Record
            raw_candidates_total = len(raw_road_candidates) + len(raw_waste_candidates)
            post_nms_total = len(nms_road) + len(nms_waste)
            
            detected_classes = []
            confidences = []
            bboxes = []
            
            for d in nms_road:
                detected_classes.append(f"Road: {d['type']} ({d['classCode']})")
                confidences.append(d['confidence'])
                bboxes.append(d['boundingBox'])
                
            for d in nms_waste:
                detected_classes.append(f"Waste: {d['type']} ({d['classCode']})")
                confidences.append(d['confidence'])
                bboxes.append(d['boundingBox'])
                
            if is_flood_detected:
                detected_classes.append(f"Flood: Water Coverage ({flooded_percent}%)")
                confidences.append(None) # segmentation confidence is null per spec
                bboxes.append(None)
                
            # Check target detections per ground truth category
            is_pothole_detected = any(d['classCode'] == 'D40' for d in nms_road) or any('Crack' in d['type'] or 'Pothole' in d['type'] for d in nms_road)
            is_waste_detected = len(nms_waste) > 0
            
            valid_confs = [c for c in confidences if c is not None]
            max_conf = max(valid_confs) if valid_confs else None
            
            record = {
                'filename': f,
                'relPath': rel_path,
                'groundTruth': gt_category,
                'imageWidth': orig_w,
                'imageHeight': orig_h,
                'modelsUsed': ['RDD2022 YOLOv8 Road Damage', 'YOLOv8 Waste Detector', 'SegFormer FloodNet Segmenter'],
                'detectedClasses': detected_classes,
                'maxConfidence': max_conf,
                'confidences': confidences,
                'boundingBoxes': bboxes,
                'numRawCandidates': raw_candidates_total,
                'numPostNmsDetections': post_nms_total,
                'floodAreaPercent': flooded_percent,
                'isPotholeDetected': is_pothole_detected,
                'isWasteDetected': is_waste_detected,
                'isFloodDetected': is_flood_detected,
                'nmsRoadDetections': nms_road,
                'nmsWasteDetections': nms_waste,
                'inferenceStatus': 'SUCCESS',
                'inferenceTimeMs': elapsed_ms
            }
            records.append(record)
            print(f"Processed [{gt_category}] {f} ({orig_w}x{orig_h}): raw={raw_candidates_total}, post={post_nms_total}, flood={flooded_percent}%, classes={detected_classes}")

    with open(r'e:\CivicSenseAI\scratch\raw_validation_results.json', 'w') as f_out:
        json.dump(records, f_out, indent=2)
    print(f"\nSaved raw validation results for {len(records)} images to e:\\CivicSenseAI\\scratch\\raw_validation_results.json")

if __name__ == '__main__':
    run_validation()
