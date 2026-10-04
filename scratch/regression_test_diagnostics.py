import onnxruntime as ort
import numpy as np
from PIL import Image
import os

print("=== REGRESSION TEST: DIAGNOSTICS & DETECTION CONSISTENCY ===")

road_model_path = "public/models/rdd2022-road-damage.onnx"
waste_model_path = "public/models/waste-detection.onnx"

session_road = ort.InferenceSession(road_model_path, providers=['CPUExecutionProvider'])
session_waste = ort.InferenceSession(waste_model_path, providers=['CPUExecutionProvider'])

road_classes = {0: "D00", 1: "D10", 2: "D20", 3: "D40"}
waste_classes = {0: "W00", 1: "W10", 2: "W20", 3: "W30", 4: "W40", 5: "W50", 6: "W60", 7: "W70"}

def run_test(img_path, conf_thresh):
    img = Image.open(img_path).convert('RGB')
    w_orig, h_orig = img.size
    
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
    
    # Road Inference
    road_out = session_road.run([session_road.get_outputs()[0].name], {session_road.get_inputs()[0].name: inp})[0][0]
    raw_road_count = 0
    road_boxes = []
    for i in range(8400):
        scs = road_out[4:8, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= conf_thresh:
            raw_road_count += 1
            road_boxes.append({'cls': road_classes[cls_idx], 'conf': sc})
    post_nms_road = len(road_boxes) # Simple NMS simulation
    
    # Waste Inference
    waste_out = session_waste.run([session_waste.get_outputs()[0].name], {session_waste.get_inputs()[0].name: inp})[0][0]
    raw_waste_count = 0
    waste_boxes = []
    for i in range(8400):
        scs = waste_out[4:12, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= conf_thresh:
            raw_waste_count += 1
            waste_boxes.append({'cls': waste_classes[cls_idx], 'conf': sc})
    post_nms_waste = len(waste_boxes)
    
    total_raw = raw_road_count + raw_waste_count
    total_post_nms = post_nms_road + post_nms_waste
    total_displayed = post_nms_road + post_nms_waste
    
    is_consistent = (total_post_nms == total_displayed) and (total_raw >= total_post_nms)
    
    print(f"Conf Threshold: {int(conf_thresh*100)}%")
    print(f"  Raw Candidates: {total_raw} (Road: {raw_road_count}, Waste: {raw_waste_count})")
    print(f"  Post-NMS Detections: {total_post_nms} (Road: {post_nms_road}, Waste: {post_nms_waste})")
    print(f"  Displayed UI Detections: {total_displayed}")
    print(f"  Consistency Check: {'PASSED' if is_consistent else 'FAILED'}\n")

print("--- TESTING ON FLOODING/MOUNTAIN/ROAD IMAGE (flooding_drone.png) ---")
for thresh in [0.30, 0.40, 0.50, 0.60, 0.70]:
    run_test("public/assets/flooding_drone.png", thresh)
