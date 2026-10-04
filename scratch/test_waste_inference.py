import onnxruntime as ort
import numpy as np
from PIL import Image
import os

print("=== TESTING REAL WASTE DETECTION ONNX MODEL INFERENCE ===")

model_path = "public/models/waste-detection.onnx"
session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])

input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

class_names = {
    0: 'cardboard',
    1: 'e-waste',
    2: 'glass',
    3: 'medical',
    4: 'metal',
    5: 'organic',
    6: 'paper',
    7: 'plastic'
}

def run_waste_inference(img_path, conf_thresh=0.40):
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return
        
    img = Image.open(img_path).convert('RGB')
    w_orig, h_orig = img.size
    
    # Letterbox preprocessing
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
    
    outputs = session.run([output_name], {input_name: inp})[0][0] # [12, 8400]
    scores = outputs[4:12, :]
    
    max_score = float(np.max(scores)) if scores.size > 0 else 0.0
    
    boxes = []
    for i in range(8400):
        scs = outputs[4:12, i]
        cls_idx = int(np.argmax(scs))
        sc = float(scs[cls_idx])
        if sc >= conf_thresh:
            cx_lb = outputs[0, i]
            cy_lb = outputs[1, i]
            w_lb = outputs[2, i]
            h_lb = outputs[3, i]
            
            x1_lb = cx_lb - w_lb / 2.0
            y1_lb = cy_lb - h_lb / 2.0
            x2_lb = cx_lb + w_lb / 2.0
            y2_lb = cy_lb + h_lb / 2.0
            
            x1_orig = max(0.0, min(float(w_orig), (x1_lb - pad_x) / scale))
            y1_orig = max(0.0, min(float(h_orig), (y1_lb - pad_y) / scale))
            x2_orig = max(0.0, min(float(w_orig), (x2_lb - pad_x) / scale))
            y2_orig = max(0.0, min(float(h_orig), (y2_lb - pad_y) / scale))
            
            w_c = x2_orig - x1_orig
            h_c = y2_orig - y1_orig
            
            if w_c > 0 and h_c > 0:
                boxes.append({
                    'class': class_names[cls_idx],
                    'confidence': round(sc, 4),
                    'box_pct': [round((x1_orig/w_orig)*100, 2), round((y1_orig/h_orig)*100, 2), round((w_c/w_orig)*100, 2), round((h_c/h_orig)*100, 2)]
                })
                
    # Simple NMS
    boxes.sort(key=lambda x: x['confidence'], reverse=True)
    selected = []
    for b in boxes:
        keep = True
        for s in selected:
            if s['class'] == b['class']:
                b1, b2 = b['box_pct'], s['box_pct']
                xa, ya = max(b1[0], b2[0]), max(b1[1], b2[1])
                xb, yb = min(b1[0]+b1[2], b2[0]+b2[2]), min(b1[1]+b1[3], b2[1]+b2[3])
                inter = max(0, xb - xa) * max(0, yb - ya)
                area1, area2 = b1[2]*b1[3], b2[2]*b2[3]
                iou = inter / (area1 + area2 - inter + 1e-6)
                if iou > 0.45:
                    keep = False
                    break
        if keep:
            selected.append(b)
            
    print(f"\nImage: {os.path.basename(img_path)} ({w_orig}x{h_orig})")
    print(f"  Highest Raw Waste Score: {max_score:.4f}")
    print(f"  Detections Count (thresh={conf_thresh}): {len(selected)}")
    for b in selected[:5]:
        print(f"   - {b['class']} (conf={b['confidence']}): {b['box_pct']}")

run_waste_inference("public/assets/garbage_drone.png", 0.35)
run_waste_inference("public/assets/potholes_drone.png", 0.35)
run_waste_inference("public/assets/flooding_drone.png", 0.35)
run_waste_inference("public/assets/satellite_recent.jpg", 0.35)
