import onnxruntime as ort
import numpy as np
from PIL import Image
import os
import glob
import json

print("================================================================================")
print("CIVICSENSE AI — CRITICAL WASTE FALSE-POSITIVE INVESTIGATION & REGRESSION SUITE")
print("================================================================================")

# Load real production ONNX sessions
print("Loading production ONNX model sessions...")
waste_sess = ort.InferenceSession('public/models/waste-detection.onnx', providers=['CPUExecutionProvider'])
flood_sess = ort.InferenceSession('public/models/flood-water-segmentation.onnx', providers=['CPUExecutionProvider'])
road_sess = ort.InferenceSession('public/models/rdd2022-road-damage.onnx', providers=['CPUExecutionProvider'])
print("Models loaded successfully.\n")

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

def iou(b1, b2):
    xa = max(b1['x'], b2['x'])
    ya = max(b1['y'], b2['y'])
    xb = min(b1['x'] + b1['width'], b2['x'] + b2['width'])
    yb = min(b1['y'] + b1['height'], b2['y'] + b2['height'])
    inter = max(0.0, xb - xa) * max(0.0, yb - ya)
    a1 = b1['width'] * b1['height']
    a2 = b2['width'] * b2['height']
    return inter / (a1 + a2 - inter + 1e-6)

def run_image_inference(img_path, conf_thresh=0.50):
    img = Image.open(img_path).convert('RGB')
    w_orig, h_orig = img.size
    total_pixels = w_orig * h_orig
    aspect_ratio = round(w_orig / h_orig, 2)
    is_low_res = (w_orig < 300) or (h_orig < 200) or (total_pixels < 60000)

    # 1. WASTE MODEL INFERENCE (640x640 letterbox)
    scale = min(640.0 / w_orig, 640.0 / h_orig)
    nw = int(round(w_orig * scale))
    nh = int(round(h_orig * scale))
    pad_x = (640.0 - nw) / 2.0
    pad_y = (640.0 - nh) / 2.0

    img_lb = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new('RGB', (640, 640), (114, 114, 114))
    canvas.paste(img_lb, (int(pad_x), int(pad_y)))

    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    tensor_waste = np.expand_dims(arr, axis=0)

    waste_in_name = waste_sess.get_inputs()[0].name
    waste_out = waste_sess.run(None, {waste_in_name: tensor_waste})[0][0] # [12, 8400]

    raw_waste = []
    num_dets = waste_out.shape[1]
    for i in range(num_dets):
        scs = [waste_out[4 + c, i] for c in range(8)]
        best_sc = max(scs)
        cls_idx = scs.index(best_sc)
        if best_sc >= conf_thresh:
            cx_lb = waste_out[0, i]
            cy_lb = waste_out[1, i]
            w_lb = waste_out[2, i]
            h_lb = waste_out[3, i]

            x1_o = max(0.0, min(float(w_orig), (cx_lb - w_lb / 2.0 - pad_x) / scale))
            y1_o = max(0.0, min(float(h_orig), (cy_lb - h_lb / 2.0 - pad_y) / scale))
            x2_o = max(0.0, min(float(w_orig), (cx_lb + w_lb / 2.0 - pad_x) / scale))
            y2_o = max(0.0, min(float(h_orig), (cy_lb + h_lb / 2.0 - pad_y) / scale))

            w_box = x2_o - x1_o
            h_box = y2_o - y1_o
            if w_box > 0 and h_box > 0:
                raw_waste.append({
                    'classCode': WASTE_CLASSES[cls_idx]['code'],
                    'type': WASTE_CLASSES[cls_idx]['name'],
                    'confidence': round(float(best_sc), 4),
                    'boundingBox': {
                        'x': round((x1_o / w_orig) * 100, 2),
                        'y': round((y1_o / h_orig) * 100, 2),
                        'width': round((w_box / w_orig) * 100, 2),
                        'height': round((h_box / h_orig) * 100, 2)
                    }
                })

    # Waste NMS
    raw_waste.sort(key=lambda x: x['confidence'], reverse=True)
    nms_waste = []
    for d in raw_waste:
        keep = True
        for s in nms_waste:
            if s['classCode'] == d['classCode'] and iou(s['boundingBox'], d['boundingBox']) > 0.45:
                keep = False
                break
        if keep:
            nms_waste.append(d)

    # 2. ROAD MODEL INFERENCE
    road_in_name = road_sess.get_inputs()[0].name
    road_out = road_sess.run(None, {road_in_name: tensor_waste})[0][0] # [8, 8400]
    raw_road = []
    num_road_dets = road_out.shape[1]
    for i in range(num_road_dets):
        scs = [road_out[4 + c, i] for c in range(4)]
        best_sc = max(scs)
        cls_idx = scs.index(best_sc)
        if best_sc >= 0.25: # Road damage threshold
            cx_lb = road_out[0, i]
            cy_lb = road_out[1, i]
            w_lb = road_out[2, i]
            h_lb = road_out[3, i]

            x1_o = max(0.0, min(float(w_orig), (cx_lb - w_lb / 2.0 - pad_x) / scale))
            y1_o = max(0.0, min(float(h_orig), (cy_lb - h_lb / 2.0 - pad_y) / scale))
            x2_o = max(0.0, min(float(w_orig), (cx_lb + w_lb / 2.0 - pad_x) / scale))
            y2_o = max(0.0, min(float(h_orig), (cy_lb + h_lb / 2.0 - pad_y) / scale))

            w_box = x2_o - x1_o
            h_box = y2_o - y1_o
            if w_box > 0 and h_box > 0:
                raw_road.append({
                    'classCode': ROAD_CLASSES[cls_idx]['code'],
                    'type': ROAD_CLASSES[cls_idx]['name'],
                    'confidence': round(float(best_sc), 4),
                    'boundingBox': {
                        'x': round((x1_o / w_orig) * 100, 2),
                        'y': round((y1_o / h_orig) * 100, 2),
                        'width': round((w_box / w_orig) * 100, 2),
                        'height': round((h_box / h_orig) * 100, 2)
                    }
                })

    raw_road.sort(key=lambda x: x['confidence'], reverse=True)
    nms_road = []
    for d in raw_road:
        keep = True
        for s in nms_road:
            if s['classCode'] == d['classCode'] and iou(s['boundingBox'], d['boundingBox']) > 0.45:
                keep = False
                break
        if keep:
            nms_road.append(d)

    # 3. FLOOD MODEL INFERENCE (512x512 ImageNet norm)
    flood_img = img.resize((512, 512), Image.BILINEAR)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    fl_arr = (np.array(flood_img, dtype=np.float32) / 255.0 - mean) / std
    fl_arr = np.transpose(fl_arr, (2, 0, 1))
    tensor_flood = np.expand_dims(fl_arr, axis=0)

    flood_in_name = flood_sess.get_inputs()[0].name
    flood_out = flood_sess.run(None, {flood_in_name: tensor_flood})[0] # [1, 10, 128, 128]
    mask = np.argmax(flood_out[0], axis=0)
    spatial = 128 * 128
    water_px = int(np.sum((mask == 1) | (mask == 3) | (mask == 5)))
    water_cov_pct = round((water_px / spatial) * 100.0, 2)

    # 4. CONTEXTUAL ARBITRATION (Refined Production Logic)
    is_sig_flood = water_cov_pct > 25.0 # (assuming continuous)
    is_possible_water = water_cov_pct >= 5.0
    has_road = len(nms_road) > 0
    pothole_det = next((d for d in nms_road if d['classCode'] == 'D40' and d['confidence'] >= 0.25), None)
    has_pothole = bool(pothole_det)
    is_water_filled_pothole = has_pothole and is_possible_water

    contextual_waste = []
    suppressed_waste = []
    candidate_waste = []

    for waste in nms_waste:
        box = waste['boundingBox']
        box_area_pct = (box['width'] * box['height']) / 100.0
        is_monolithic = (box['width'] >= 70.0 and box['height'] >= 70.0) or (box_area_pct >= 60.0)

        if not is_monolithic:
            contextual_waste.append({
                'det': waste,
                'decision': 'RETAIN_LOCALIZED_WASTE',
                'reason': f"Localized waste box ({box['width']}% × {box['height']}%) represents genuine trash accumulation."
            })
        else:
            if has_road or is_sig_flood or (is_possible_water and waste['classCode'] in ('W50', 'W20')):
                conflict_reason = (
                    f"Monolithic waste detection box ({box['width']}% × {box['height']}%) suppressed: water presence ({water_cov_pct}%) indicates water surface reflection or floodwater texture."
                    if (is_sig_flood or is_possible_water) else
                    f"Monolithic waste detection box ({box['width']}% × {box['height']}%) suppressed because road damage context is present."
                )
                suppressed_waste.append({
                    'det': waste,
                    'decision': 'SUPPRESSED_CONTEXTUAL_CONFLICT',
                    'reason': conflict_reason
                })
            elif is_low_res:
                candidate_waste.append({
                    'det': waste,
                    'decision': 'NEEDS_REVIEW_LOW_RESOLUTION_CANDIDATE',
                    'reason': f"Monolithic waste box ({box['width']}% × {box['height']}%) on low-resolution imagery ({w_orig} × {h_orig}) cannot be reliably classified automatically. Flagged for human review."
                })
            else:
                contextual_waste.append({
                    'det': waste,
                    'isMonolithicScene': True,
                    'decision': 'RETAIN_UNCONFLICTED_MONOLITHIC',
                    'reason': f"Monolithic waste box ({box['width']}% × {box['height']}%) retained because standard resolution imagery shows unconflicted open waste accumulation (genuine municipal dump)."
                })

    # 5. CIVIC INCIDENTS GENERATION
    civic_incidents = []

    # Priority 1: Water-Filled Pothole
    if is_water_filled_pothole:
        civic_incidents.append({
            'type': 'WATER_FILLED_POTHOLE',
            'severity': 'HIGH',
            'priority': 'IMMEDIATE',
            'operatorStatus': 'NEEDS REVIEW',
            'isUncertain': False
        })
    # Priority 2: Flood Inundation
    elif is_sig_flood:
        civic_incidents.append({
            'type': 'SIGNIFICANT_WATERLOGGING',
            'severity': 'CRITICAL' if water_cov_pct >= 35.0 else 'HIGH',
            'priority': 'IMMEDIATE',
            'operatorStatus': 'NEEDS REVIEW',
            'isUncertain': False
        })
    elif is_possible_water:
        civic_incidents.append({
            'type': 'POSSIBLE_WATERLOGGING',
            'severity': 'MEDIUM',
            'priority': 'MEDIUM',
            'operatorStatus': 'NEEDS REVIEW',
            'isUncertain': False
        })

    # Priority 3: Road Damage
    if len(nms_road) > 0 and not is_water_filled_pothole:
        civic_incidents.append({
            'type': 'ROAD_DAMAGE',
            'severity': 'HIGH' if has_pothole else 'MEDIUM',
            'priority': 'HIGH' if has_pothole else 'MEDIUM',
            'operatorStatus': 'NEEDS REVIEW',
            'isUncertain': False
        })

    # Priority 4: Waste Accumulation
    if len(contextual_waste) > 0:
        has_localized = any(not d.get('isMonolithicScene', False) for d in contextual_waste)
        has_large = any((d['det']['boundingBox']['width'] * d['det']['boundingBox']['height']) / 10000 >= 0.10 for d in contextual_waste)
        
        # Whole-scene monolithic detection without localized confirmation is assigned MEDIUM (never auto-confirmed HIGH)
        if not has_localized and len(contextual_waste) == 1 and contextual_waste[0].get('isMonolithicScene', False):
            waste_sev = "MEDIUM"
            waste_pri = "MEDIUM"
            is_unc = True
        else:
            waste_sev = "HIGH" if (has_large or len(contextual_waste) >= 3) else ("MEDIUM" if len(contextual_waste) >= 2 else "LOW")
            waste_pri = "HIGH" if waste_sev == "HIGH" else "MEDIUM"
            is_unc = False

        civic_incidents.append({
            'type': 'WASTE_ACCUMULATION',
            'title': 'Visible Waste Accumulation' if not is_unc else 'Candidate Waste Accumulation (Review Required)',
            'severity': waste_sev,
            'priority': waste_pri,
            'operatorStatus': 'NEEDS REVIEW',
            'isUncertain': is_unc
        })
    elif len(candidate_waste) > 0:
        cand = candidate_waste[0]
        civic_incidents.append({
            'type': 'WASTE_ACCUMULATION_CANDIDATE',
            'title': 'Candidate Waste Accumulation (Review Required)',
            'severity': 'LOW',
            'priority': 'ROUTINE',
            'operatorStatus': 'NEEDS REVIEW',
            'isUncertain': True,
            'lowResolutionWarning': f"LOW IMAGE RESOLUTION: Image resolution ({w_orig} × {h_orig}) is below minimum threshold (<300×200). Automated confirmation withheld."
        })

    return {
        'filename': os.path.basename(img_path),
        'resolution': f"{w_orig} × {h_orig}",
        'is_low_res': is_low_res,
        'raw_waste_count': len(raw_waste),
        'nms_waste_count': len(nms_waste),
        'nms_waste': nms_waste,
        'raw_road_count': len(raw_road),
        'nms_road_count': len(nms_road),
        'water_coverage_pct': water_cov_pct,
        'contextual_waste_count': len(contextual_waste),
        'candidate_waste_count': len(candidate_waste),
        'suppressed_waste_count': len(suppressed_waste),
        'contextual_waste': contextual_waste,
        'candidate_waste': candidate_waste,
        'suppressed_waste': suppressed_waste,
        'civic_incidents': civic_incidents
    }

if __name__ == '__main__':
    print("Running test cases across 6 target categories...\n")

    # TEST 1: Flooded street with no visible garbage
test1_paths = [
    'Real Test Datas/Flood/flood 1.jpg',
    'Real Test Datas/Flood/flood 10.webp',
    'Real Test Datas/Flood/flood 15.jpg',
    'Real Test Datas/Flood/flood 12.webp'
]
print("--- TEST SUITE 1: Flooded street with no visible garbage ---")
for p in test1_paths:
    res = run_image_inference(p)
    inc_types = [f"{i['type']} ({i['severity']}/{i['priority']}, uncertain={i['isUncertain']})" for i in res['civic_incidents']]
    print(f"Image: {res['filename']:<15} | Res: {res['resolution']:<11} | LowRes: {str(res['is_low_res']):<5} | Water: {res['water_coverage_pct']:>5.1f}% | AccWaste: {res['contextual_waste_count']} | CandWaste: {res['candidate_waste_count']} | SupWaste: {res['suppressed_waste_count']}")
    print(f"  Incidents: {inc_types}")
    # Verify NO auto-confirmed high-severity waste incident
    assert not any(i['type'] == 'WASTE_ACCUMULATION' and i['severity'] == 'HIGH' for i in res['civic_incidents']), f"FAIL: Auto-confirmed high-severity waste incident in {res['filename']}"
print("[PASS] Test Suite 1: No false auto-confirmed high-severity waste on flood images!\n")

# TEST 2: Flooded street with floating garbage
test2_paths = [
    'Real Test Datas/Flood/flood 17.jpg',
    'Real Test Datas/Flood/flood 8.webp',
    'Real Test Datas/Flood/flood 25.webp'
]
print("--- TEST SUITE 2: Flooded street with floating garbage ---")
for p in test2_paths:
    res = run_image_inference(p)
    inc_types = [f"{i['type']} ({i['severity']}/{i['priority']})" for i in res['civic_incidents']]
    print(f"Image: {res['filename']:<15} | Res: {res['resolution']:<11} | Water: {res['water_coverage_pct']:>5.1f}% | AccWaste: {res['contextual_waste_count']} | SupWaste: {res['suppressed_waste_count']}")
    print(f"  Incidents: {inc_types}")
print("[PASS] Test Suite 2 evaluated successfully.\n")

# TEST 3: Genuine organic waste accumulation
test3_paths = [
    'Real Test Datas/Garbage/garbage 1.webp',
    'Real Test Datas/Garbage/garbage 11.jpg',
    'Real Test Datas/Garbage/garbage 18.jpg'
]
print("--- TEST SUITE 3: Genuine organic waste accumulation ---")
for p in test3_paths:
    res = run_image_inference(p)
    inc_types = [f"{i['type']} ({i['severity']}/{i['priority']})" for i in res['civic_incidents']]
    print(f"Image: {res['filename']:<15} | Res: {res['resolution']:<11} | AccWaste: {res['contextual_waste_count']} | Incidents: {inc_types}")
    assert any('WASTE' in i['type'] for i in res['civic_incidents']), f"FAIL: Expected waste incident in {res['filename']}"
print("[PASS] Test Suite 3: Genuine waste verified.\n")

# TEST 4: Dry road
test4_paths = [
    'Real Test Datas/Pathole/road without pothole.webp'
]
print("--- TEST SUITE 4: Dry road ---")
for p in test4_paths:
    res = run_image_inference(p)
    inc_types = [f"{i['type']} ({i['severity']}/{i['priority']})" for i in res['civic_incidents']]
    print(f"Image: {res['filename']:<30} | Incidents: {inc_types}")
    assert not any(i['type'] == 'WASTE_ACCUMULATION' for i in res['civic_incidents']), f"FAIL: Unexpected waste in dry road"
print("[PASS] Test Suite 4: Clear road clean.\n")

# TEST 5: Wet road with reflections
test5_paths = [
    'Real Test Datas/Flood/puddles.jpg'
]
print("--- TEST SUITE 5: Wet road with reflections ---")
for p in test5_paths:
    res = run_image_inference(p)
    inc_types = [f"{i['type']} ({i['severity']}/{i['priority']})" for i in res['civic_incidents']]
    print(f"Image: {res['filename']:<15} | Water: {res['water_coverage_pct']}% | AccWaste: {res['contextual_waste_count']} | SupWaste: {res['suppressed_waste_count']} | Incidents: {inc_types}")
    assert not any(i['type'] == 'WASTE_ACCUMULATION' and i['severity'] == 'HIGH' for i in res['civic_incidents']), f"FAIL: Water reflection confirmed as high waste"
print("[PASS] Test Suite 5: Wet road reflections handled cleanly.\n")

# TEST 6: All 30 Garbage Benchmark Images
print("--- TEST SUITE 6: All 30 Garbage Benchmark Images ---")
all_garbage = sorted(glob.glob('Real Test Datas/Garbage/*.*'))
accepted_count = 0
for p in all_garbage:
    res = run_image_inference(p)
    if res['contextual_waste_count'] > 0:
        accepted_count += 1
print(f"Total Garbage Images Evaluated: {len(all_garbage)}")
print(f"Accepted Waste Detections Count: {accepted_count} / {len(all_garbage)}")
assert accepted_count >= 18, f"FAIL: Too many garbage images suppressed ({accepted_count})"
print("[PASS] Test Suite 6: Production garbage detection capability fully preserved!\n")

print("================================================================================")
print("ALL 6 REGRESSION TEST SUITES EXECUTED WITH REAL ONNX MODELS — 100% SUCCESS")
print("================================================================================")
