import onnxruntime as ort
import numpy as np
from PIL import Image
import os
import json

print("=== PHASE 8C-4D BEFORE VS AFTER LETTERBOX COMPARISON ===")

model_path = "public/models/rdd2022-road-damage.onnx"
session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

class_names = {0: "D00", 1: "D10", 2: "D20", 3: "D40"}

# 1. Direct Stretch Preprocessing & Reverse
def run_direct_stretch(pil_img, conf_thresh=0.50):
    w_orig, h_orig = pil_img.size
    img_640 = pil_img.resize((640, 640), Image.BILINEAR)
    arr = np.array(img_640, dtype=np.float32) / 255.0
    if arr.shape[-1] == 4: arr = arr[:, :, :3]
    arr = np.transpose(arr, (2, 0, 1))
    inp = np.expand_dims(arr, axis=0)
    
    out = session.run([output_name], {input_name: inp})[0][0] # [8, 8400]
    scores = out[4:8, :]
    
    max_score = float(np.max(scores)) if scores.size > 0 else 0.0
    
    boxes = []
    for i in range(8400):
        scs = out[4:8, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= conf_thresh:
            cx = out[0, i] * (100.0 / 640.0)
            cy = out[1, i] * (100.0 / 640.0)
            w = out[2, i] * (100.0 / 640.0)
            h = out[3, i] * (100.0 / 640.0)
            x1 = max(0.0, cx - w / 2.0)
            y1 = max(0.0, cy - h / 2.0)
            boxes.append({
                'class': class_names[cls_idx],
                'confidence': round(sc, 4),
                'box_pct': [round(x1, 2), round(y1, 2), round(w, 2), round(h, 2)]
            })
    return max_score, boxes

# 2. Aspect-Preserving Letterbox Preprocessing & Reverse
def run_letterbox(pil_img, conf_thresh=0.50):
    w_orig, h_orig = pil_img.size
    scale = min(640.0 / w_orig, 640.0 / h_orig)
    nw = int(round(w_orig * scale))
    nh = int(round(h_orig * scale))
    pad_x = (640.0 - nw) / 2.0
    pad_y = (640.0 - nh) / 2.0
    
    img_resized = pil_img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new('RGB', (640, 640), (114, 114, 114))
    canvas.paste(img_resized, (int(pad_x), int(pad_y)))
    
    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    inp = np.expand_dims(arr, axis=0)
    
    out = session.run([output_name], {input_name: inp})[0][0]
    scores = out[4:8, :]
    
    max_score = float(np.max(scores)) if scores.size > 0 else 0.0
    
    boxes = []
    for i in range(8400):
        scs = out[4:8, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= conf_thresh:
            cx_lb = out[0, i]
            cy_lb = out[1, i]
            w_lb = out[2, i]
            h_lb = out[3, i]
            
            x1_lb = cx_lb - w_lb / 2.0
            y1_lb = cy_lb - h_lb / 2.0
            x2_lb = cx_lb + w_lb / 2.0
            y2_lb = cy_lb + h_lb / 2.0
            
            # Reverse letterbox transformation to original image space
            x1_orig = (x1_lb - pad_x) / scale
            y1_orig = (y1_lb - pad_y) / scale
            x2_orig = (x2_lb - pad_x) / scale
            y2_orig = (y2_lb - pad_y) / scale
            
            x1_c = max(0.0, min(float(w_orig), x1_orig))
            y1_c = max(0.0, min(float(h_orig), y1_orig))
            x2_c = max(0.0, min(float(w_orig), x2_orig))
            y2_c = max(0.0, min(float(h_orig), y2_orig))
            
            w_c = x2_c - x1_c
            h_c = y2_c - y1_c
            
            if w_c > 0 and h_c > 0:
                x_pct = (x1_c / w_orig) * 100.0
                y_pct = (y1_c / h_orig) * 100.0
                w_pct = (w_c / w_orig) * 100.0
                h_pct = (h_c / h_orig) * 100.0
                
                boxes.append({
                    'class': class_names[cls_idx],
                    'confidence': round(sc, 4),
                    'box_pct': [round(x_pct, 2), round(y_pct, 2), round(w_pct, 2), round(h_pct, 2)]
                })
    return max_score, boxes, scale, pad_x, pad_y

def run_test_item(label, pil_img):
    print(f"\n==================================================")
    print(f"TEST ITEM: {label}")
    print(f"Dimensions: {pil_img.size[0]} x {pil_img.size[1]} (Aspect Ratio: {pil_img.size[0]/pil_img.size[1]:.3f})")
    
    max_s_str, boxes_str = run_direct_stretch(pil_img, 0.50)
    max_s_lbox, boxes_lbox, scale, pad_x, pad_y = run_letterbox(pil_img, 0.50)
    
    print(f"\n  [BEFORE] Direct Stretch (50% Threshold):")
    print(f"    Highest Raw Score: {max_s_str:.4f}")
    print(f"    Raw Candidate Count: {len(boxes_str)}")
    for b in boxes_str[:3]:
        print(f"      - {b['class']} ({b['confidence']}): {b['box_pct']}")
        
    print(f"\n  [AFTER] Letterbox Preprocessing (50% Threshold):")
    print(f"    Scale Factor: {scale:.4f} | Pad X: {pad_x:.1f}, Pad Y: {pad_y:.1f}")
    print(f"    Highest Raw Score: {max_s_lbox:.4f}")
    print(f"    Raw Candidate Count: {len(boxes_lbox)}")
    for b in boxes_lbox[:3]:
        print(f"      - {b['class']} ({b['confidence']}): {b['box_pct']}")

# Load base image
if os.path.exists("public/assets/potholes_drone.png"):
    img_rdd = Image.open("public/assets/potholes_drone.png")
    
    # TEST A: 1024x1024 Square Benchmark
    run_test_item("TEST A: 1024x1024 RDD2022 Pothole Benchmark", img_rdd)
    
    # TEST B: 250x175 Low-Res Pothole Crop
    crop_250x175 = img_rdd.crop((300, 300, 800, 650)).resize((250, 175))
    run_test_item("TEST B: 250x175 Real-Life Low-Res Pothole Crop", crop_250x175)
    
    # TEST G: Wide Landscape Image (1280x480, aspect 2.67:1)
    wide_img = img_rdd.crop((100, 200, 900, 500)).resize((1280, 480))
    run_test_item("TEST G: Wide Landscape Road Scene (1280x480)", wide_img)
    
    # TEST H: Tall Portrait Image (480x1280, aspect 0.375:1)
    tall_img = img_rdd.crop((200, 100, 500, 900)).resize((480, 1280))
    run_test_item("TEST H: Tall Portrait Road Scene (480x1280)", tall_img)

if os.path.exists("public/assets/garbage_drone.png"):
    run_test_item("TEST D: Garbage Accumulation Non-Road Image", Image.open("public/assets/garbage_drone.png"))

if os.path.exists("public/assets/flooding_drone.png"):
    run_test_item("TEST E: Flooding Scene Non-Road Image", Image.open("public/assets/flooding_drone.png"))

if os.path.exists("public/assets/satellite_recent.jpg"):
    run_test_item("TEST F: Satellite Buildings / Trees Non-Road Image", Image.open("public/assets/satellite_recent.jpg"))
