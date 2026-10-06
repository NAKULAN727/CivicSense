import os
import sys
import json
import csv
import time
import hashlib
import numpy as np
from PIL import Image
import onnxruntime as ort
from scipy.ndimage import label, center_of_mass

sys.stdout.reconfigure(encoding='utf-8')

DATASET_ROOT = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"
MODEL_ROAD = r"e:\CivicSenseAI\public\models\rdd2022-road-damage.onnx"
MODEL_WASTE = r"e:\CivicSenseAI\public\models\waste-detection.onnx"
MODEL_FLOOD_PROD = r"e:\CivicSenseAI\public\models\flood-water-segmentation.onnx"
MODEL_VFLOODNET = r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx"

CATEGORIES = [
    ("Flood", "FLOOD"),
    ("Garbage", "GARBAGE"),
    ("Pathole", "POTHOLE")
]

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

# ImageNet normalization for V-FloodNet
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

def compute_sha256(filepath):
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

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

def preprocess_vfloodnet_416(pil_img):
    resized = pil_img.resize((416, 416), Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, axis=0)
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    return arr

def preprocess_segformer_512(pil_img):
    img_resized = pil_img.resize((512, 512), Image.BILINEAR)
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
    return tensor

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

def main():
    print("=" * 80)
    print("CIVICSENSE AI — PHASE 8C-6: 94-IMAGE REAL-WORLD VALIDATION")
    print("=" * 80)
    
    # 1. Dataset Integrity & Duplicate Detection
    print("\n[STEP 1] Scanning dataset integrity...")
    scanned_files = []
    hashes = {}
    duplicates = []
    
    for folder_name, cat in CATEGORIES:
        folder_path = os.path.join(DATASET_ROOT, folder_name)
        if not os.path.exists(folder_path):
            print(f"ERROR: Missing folder {folder_path}")
            continue
        for f in sorted(os.listdir(folder_path)):
            fpath = os.path.join(folder_path, f)
            if not os.path.isfile(fpath):
                continue
            sha = compute_sha256(fpath)
            if sha in hashes:
                duplicates.append({'file': f, 'existing': hashes[sha], 'sha': sha})
            else:
                hashes[sha] = fpath
            
            try:
                with Image.open(fpath) as img:
                    w, h = img.size
                    img.verify()
                is_readable = True
                err = None
            except Exception as e:
                is_readable = False
                err = str(e)
                w, h = 0, 0
                
            scanned_files.append({
                'filename': f,
                'folder': folder_name,
                'category': cat,
                'filepath': fpath,
                'sha256': sha,
                'width': w,
                'height': h,
                'readable': is_readable,
                'error': err
            })

    total_found = len(scanned_files)
    readable_files = [x for x in scanned_files if x['readable']]
    unreadable_files = [x for x in scanned_files if not x['readable']]
    
    print(f"Total files found: {total_found}")
    print(f"Readable files: {len(readable_files)}")
    print(f"Unreadable files: {len(unreadable_files)}")
    print(f"Duplicate files detected: {len(duplicates)}")
    print(f"Unique validation images: {len(readable_files)}")
    
    if len(readable_files) != 94:
        print(f"WARNING: Expected 94 readable images, found {len(readable_files)}")
        
    # 2. Model Initialization
    print("\n[STEP 2] Loading ONNX inference sessions...")
    sess_road = ort.InferenceSession(MODEL_ROAD, providers=['CPUExecutionProvider'])
    sess_waste = ort.InferenceSession(MODEL_WASTE, providers=['CPUExecutionProvider'])
    sess_vflood = ort.InferenceSession(MODEL_VFLOODNET, providers=['CPUExecutionProvider'])
    print("All 3 ONNX models loaded successfully into CPUExecutionProvider.")
    
    road_in_name = sess_road.get_inputs()[0].name
    waste_in_name = sess_waste.get_inputs()[0].name
    vflood_in_name = sess_vflood.get_inputs()[0].name
    vflood_out_name = sess_vflood.get_outputs()[0].name

    results = []
    
    print("\n[STEP 3] Running inference across all 94 images...")
    t_start_all = time.time()
    
    for idx, item in enumerate(readable_files, 1):
        f = item['filename']
        folder = item['folder']
        cat = item['category']
        fpath = item['filepath']
        
        pil_img = Image.open(fpath).convert('RGB')
        orig_w, orig_h = pil_img.size
        tot_px = orig_w * orig_h
        
        low_res_warning = (orig_w < 300 or orig_h < 200 or tot_px < 60000)
        low_res_text = f"LOW RESOLUTION ({orig_w}x{orig_h} < 300x200 / < 60k px)" if low_res_warning else None
        
        # --- A. Road Damage Model ---
        tensor_road, _, _, scale_r, pad_x_r, pad_y_r = preprocess_yolo_640(pil_img)
        out_road = sess_road.run(None, {road_in_name: tensor_road})[0][0] # [8, 8400]
        
        raw_road_candidates = []
        raw_road_candidates_all = [] # for fusion check at conf >= 0.25
        num_det_r = out_road.shape[1]
        
        for i in range(num_det_r):
            cx_c, cy_c, w_c, h_c = out_road[0, i], out_road[1, i], out_road[2, i], out_road[3, i]
            x1_c, y1_c = cx_c - w_c / 2.0, cy_c - h_c / 2.0
            x2_c, y2_c = cx_c + w_c / 2.0, cy_c + h_c / 2.0
            x1_o, y1_o = (x1_c - pad_x_r) / scale_r, (y1_c - pad_y_r) / scale_r
            x2_o, y2_o = (x2_c - pad_x_r) / scale_r, (y2_c - pad_y_r) / scale_r
            x1_cl = max(0, min(orig_w, x1_o))
            y1_cl = max(0, min(orig_h, y1_o))
            x2_cl = max(0, min(orig_w, x2_o))
            y2_cl = max(0, min(orig_h, y2_o))
            w_o, h_o = x2_cl - x1_cl, y2_cl - y1_cl
            if w_o <= 0 or h_o <= 0:
                continue
                
            x_pct = round((x1_cl / orig_w) * 100, 2)
            y_pct = round((y1_cl / orig_h) * 100, 2)
            w_pct = round((w_o / orig_w) * 100, 2)
            h_pct = round((h_o / orig_h) * 100, 2)
            
            scores = out_road[4:8, i]
            best_idx = int(np.argmax(scores))
            max_score = float(scores[best_idx])
            
            cand_info = {
                'type': ROAD_CLASSES[best_idx]['name'],
                'classCode': ROAD_CLASSES[best_idx]['code'],
                'confidence': round(max_score, 4),
                'boundingBox': {'x': x_pct, 'y': y_pct, 'width': w_pct, 'height': h_pct}
            }
            if max_score >= 0.25:
                raw_road_candidates_all.append(cand_info)
            if max_score >= 0.50:
                raw_road_candidates.append(cand_info)
                
        nms_road = apply_nms(raw_road_candidates, 0.45)
        has_pothole_d40_conf_025 = any(d['classCode'] == 'D40' and d['confidence'] >= 0.25 for d in raw_road_candidates_all)
        has_pothole_d40_post_nms = any(d['classCode'] == 'D40' for d in nms_road)
        
        # --- B. Waste Model ---
        tensor_waste, _, _, scale_w, pad_x_w, pad_y_w = preprocess_yolo_640(pil_img)
        out_waste = sess_waste.run(None, {waste_in_name: tensor_waste})[0][0] # [12, 8400]
        
        raw_waste_candidates = []
        num_det_w = out_waste.shape[1]
        num_classes_w = out_waste.shape[0] - 4
        
        for i in range(num_det_w):
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
                
            x_pct = round((x1_cl / orig_w) * 100, 2)
            y_pct = round((y1_cl / orig_h) * 100, 2)
            w_pct = round((w_o / orig_w) * 100, 2)
            h_pct = round((h_o / orig_h) * 100, 2)
            
            scores = out_waste[4:4+num_classes_w, i]
            best_idx = int(np.argmax(scores))
            max_score = float(scores[best_idx])
            
            if max_score >= 0.50 and best_idx in WASTE_CLASSES:
                cand_info = {
                    'type': WASTE_CLASSES[best_idx]['name'],
                    'classCode': WASTE_CLASSES[best_idx]['code'],
                    'confidence': round(max_score, 4),
                    'boundingBox': {'x': x_pct, 'y': y_pct, 'width': w_pct, 'height': h_pct}
                }
                raw_waste_candidates.append(cand_info)
                
        nms_waste = apply_nms(raw_waste_candidates, 0.45)
        
        # --- C. V-FloodNet Candidate Model ---
        tensor_vflood = preprocess_vfloodnet_416(pil_img)
        t_vf0 = time.perf_counter()
        prob_map_vflood = sess_vflood.run([vflood_out_name], {vflood_in_name: tensor_vflood})[0][0, 0] # [416, 416]
        vf_lat_ms = round((time.perf_counter() - t_vf0) * 1000, 2)
        
        bin_mask_vflood = (prob_map_vflood >= 0.5).astype(np.uint8)
        tot_mask_px = 416 * 416 # 173056
        water_px = int(np.sum(bin_mask_vflood))
        water_cov_pct = round((water_px / tot_mask_px) * 100.0, 2)
        mean_water_prob = round(float(np.mean(prob_map_vflood)), 4)
        max_water_prob = round(float(np.max(prob_map_vflood)), 4)
        
        # Spatial Topology & Connected Components
        if water_px == 0:
            num_comps = 0
            lrg_comp_px = 0
            lrg_comp_area_pct = 0.0
            lrg_comp_ratio_pct = 0.0
            spatial_topo = "NO_WATER"
            vert_dist = {'sky_upper_pct': 0.0, 'mid_scene_pct': 0.0, 'road_ground_pct': 0.0}
        else:
            labeled_arr, num_comps = label(bin_mask_vflood)
            comp_sizes = [int(np.sum(labeled_arr == k)) for k in range(1, num_comps + 1)]
            lrg_comp_px = max(comp_sizes) if comp_sizes else 0
            lrg_comp_area_pct = round((lrg_comp_px / tot_mask_px) * 100.0, 2)
            lrg_comp_ratio_pct = round((lrg_comp_px / water_px) * 100.0, 2)
            
            upper_w = int(np.sum(bin_mask_vflood[0:125, :]))
            mid_w = int(np.sum(bin_mask_vflood[125:291, :]))
            lower_w = int(np.sum(bin_mask_vflood[291:416, :]))
            vert_dist = {
                'sky_upper_pct': round((upper_w / water_px) * 100.0, 1),
                'mid_scene_pct': round((mid_w / water_px) * 100.0, 1),
                'road_ground_pct': round((lower_w / water_px) * 100.0, 1)
            }
            if water_cov_pct > 25.0 and lrg_comp_ratio_pct > 75.0:
                spatial_topo = "LARGE_CONTINUOUS_ROAD_FLOOD"
            elif water_cov_pct > 20.0:
                spatial_topo = "SUBSTANTIAL_SPREAD_WATERLOGGING"
            elif water_cov_pct >= 5.0 and num_comps <= 3 and lrg_comp_area_pct < 15.0:
                spatial_topo = "LOCALIZED_PUDDLE_OR_POTHOLE_WATER"
            elif water_cov_pct >= 5.0:
                spatial_topo = "DISPERSED_WET_PATCHES"
            else:
                spatial_topo = "TRACE_OR_SPECULAR_WATER"
                
        # Calibrated 4-Tier Policy
        is_water_filled_pothole = has_pothole_d40_conf_025 and (water_cov_pct >= 5.0)
        
        if is_water_filled_pothole:
            waterlogging_status = "WATER-FILLED POTHOLE"
            severity_tier = "HIGH_ROAD_HAZARD"
        elif water_cov_pct < 5.0:
            waterlogging_status = "NO SIGNIFICANT WATER"
            severity_tier = "LEVEL 1"
        elif water_cov_pct <= 25.0:
            waterlogging_status = "POSSIBLE WATERLOGGING"
            severity_tier = "LEVEL 2"
        else:
            waterlogging_status = "SIGNIFICANT WATERLOGGING"
            severity_tier = "LEVEL 3"

        # --- D. Final CivicSense Interpretation ---
        road_classes_list = [d['classCode'] for d in nms_road]
        road_confs_list = [float(d['confidence']) for d in nms_road]
        waste_classes_list = [d['classCode'] for d in nms_waste]
        waste_confs_list = [float(d['confidence']) for d in nms_waste]
        
        highest_road_conf = max(road_confs_list) if road_confs_list else None
        highest_waste_conf = max(waste_confs_list) if waste_confs_list else None
        
        interp_parts = []
        if is_water_filled_pothole:
            interp_parts.append(f"Water-Filled Pothole ({water_cov_pct}% water, D40 conf={max([float(d['confidence']) for d in raw_road_candidates_all if d['classCode']=='D40'])})")
        elif severity_tier in ["LEVEL 2", "LEVEL 3"]:
            interp_parts.append(f"Waterlogging: {waterlogging_status} ({water_cov_pct}%)")
        
        if nms_road and not is_water_filled_pothole:
            interp_parts.append(f"Road Damage: {', '.join(road_classes_list)}")
            
        if nms_waste:
            interp_parts.append(f"Detected Waste: {', '.join(waste_classes_list)}")
            
        if not interp_parts:
            final_interpretation = "No Significant Defects Detected (Clean / Low Severity)"
        else:
            final_interpretation = " | ".join(interp_parts)
            
        record = {
            'index': idx,
            'filename': f,
            'folder': folder,
            'category': cat,
            'width': orig_w,
            'height': orig_h,
            'total_pixels': tot_px,
            'lowResolutionWarning': low_res_warning,
            'lowResolutionText': low_res_text,
            'sha256': item['sha256'],
            
            # Road Model
            'road_raw_count': len(raw_road_candidates),
            'road_post_nms_count': len(nms_road),
            'road_classes': road_classes_list,
            'road_confidences': road_confs_list,
            'road_highest_conf': highest_road_conf,
            'road_has_d40': has_pothole_d40_post_nms,
            'road_has_d40_conf_025': has_pothole_d40_conf_025,
            'road_detections': nms_road,
            
            # Waste Model
            'waste_raw_count': len(raw_waste_candidates),
            'waste_post_nms_count': len(nms_waste),
            'waste_classes': waste_classes_list,
            'waste_confidences': waste_confs_list,
            'waste_highest_conf': highest_waste_conf,
            'waste_detections': nms_waste,
            
            # Flood Candidate (V-FloodNet)
            'vflood_water_coverage_pct': water_cov_pct,
            'vflood_water_pixels': water_px,
            'vflood_mean_water_prob': mean_water_prob,
            'vflood_max_water_prob': max_water_prob,
            'vflood_waterlogging_status': waterlogging_status,
            'vflood_severity_tier': severity_tier,
            'vflood_spatial_topology': spatial_topo,
            'vflood_num_connected_components': num_comps,
            'vflood_largest_comp_area_pct': lrg_comp_area_pct,
            'vflood_largest_comp_ratio_pct': lrg_comp_ratio_pct,
            'vflood_vertical_distribution': vert_dist,
            'vflood_latency_ms': vf_lat_ms,
            
            # Fusion & Final Interpretation
            'is_water_filled_pothole': is_water_filled_pothole,
            'final_civicsense_interpretation': final_interpretation
        }
        results.append(record)
        
        if idx % 10 == 0 or idx == len(readable_files):
            print(f"  [{idx:02d}/94] {folder:8s} | {f:<30s} | {orig_w}x{orig_h} | Water={water_cov_pct:>5.1f}% ({waterlogging_status}) | Road={len(nms_road)} | Waste={len(nms_waste)}")

    total_duration_sec = round(time.time() - t_start_all, 2)
    print(f"\nCompleted inference on all {len(results)} images in {total_duration_sec} seconds.")
    
    def json_serializer(obj):
        if isinstance(obj, (np.floating, float)):
            return float(obj)
        if isinstance(obj, (np.integer, int)):
            return int(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return str(obj)

    # Save raw results JSON
    with open(r'e:\CivicSenseAI\scratch\phase8c6_94_raw_results.json', 'w', encoding='utf-8') as f_out:
        json.dump(results, f_out, indent=2, default=json_serializer)
    print("Saved scratch/phase8c6_94_raw_results.json")

    return results, scanned_files, duplicates

if __name__ == '__main__':
    main()
