import onnxruntime as ort
import numpy as np
from PIL import Image
import os

print("=== PHASE 8C-5 DUAL MODEL TEST SUITE (ROAD + WASTE) ===")

road_model_path = "public/models/rdd2022-road-damage.onnx"
waste_model_path = "public/models/waste-detection.onnx"

session_road = ort.InferenceSession(road_model_path, providers=['CPUExecutionProvider'])
session_waste = ort.InferenceSession(waste_model_path, providers=['CPUExecutionProvider'])

road_classes = {0: "D00 (Longitudinal Crack)", 1: "D10 (Transverse Crack)", 2: "D20 (Alligator Crack)", 3: "D40 (Pothole)"}
waste_classes = {0: "Cardboard", 1: "E-Waste", 2: "Glass", 3: "Medical Waste", 4: "Metal", 5: "Organic Waste", 6: "Paper", 7: "Plastic"}

def run_dual_inference(img_path, road_thresh=0.50, waste_thresh=0.40):
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return
        
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
    
    # 1. Road model inference
    road_out = session_road.run([session_road.get_outputs()[0].name], {session_road.get_inputs()[0].name: inp})[0][0]
    road_dets = []
    for i in range(8400):
        scs = road_out[4:8, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= road_thresh:
            road_dets.append({'class': road_classes[cls_idx], 'confidence': round(sc, 4)})
            
    # NMS Road
    road_dets.sort(key=lambda x: x['confidence'], reverse=True)
    final_road = road_dets[:5]
    
    # 2. Waste model inference
    waste_out = session_waste.run([session_waste.get_outputs()[0].name], {session_waste.get_inputs()[0].name: inp})[0][0]
    waste_dets = []
    for i in range(8400):
        scs = waste_out[4:12, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= waste_thresh:
            waste_dets.append({'class': waste_classes[cls_idx], 'confidence': round(sc, 4)})
            
    # NMS Waste
    waste_dets.sort(key=lambda x: x['confidence'], reverse=True)
    final_waste = waste_dets[:5]
    
    print(f"\n==================================================")
    print(f"IMAGE: {os.path.basename(img_path)} ({w_orig} x {h_orig})")
    print(f"  ROAD MODEL Detections Count (thresh={road_thresh}): {len(final_road)}")
    for r in final_road:
        print(f"    - {r['class']} (Model Confidence: {r['confidence']})")
        
    print(f"  WASTE MODEL Detections Count (thresh={waste_thresh}): {len(final_waste)}")
    for w in final_waste:
        print(f"    - {w['class']} (Model Confidence: {w['confidence']})")

run_dual_inference("public/assets/potholes_drone.png", 0.50, 0.40)
run_dual_inference("public/assets/garbage_drone.png", 0.50, 0.40)
run_dual_inference("public/assets/flooding_drone.png", 0.50, 0.40)
run_dual_inference("public/assets/satellite_recent.jpg", 0.50, 0.40)
