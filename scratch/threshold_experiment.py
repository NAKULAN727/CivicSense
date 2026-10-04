import onnxruntime as ort
import numpy as np
from PIL import Image, ImageEnhance
import os

model_path = "public/models/rdd2022-road-damage.onnx"
session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

class_names = {0: "D00", 1: "D10", 2: "D20", 3: "D40"}

def eval_image(pil_img, name):
    print(f"\n==================================================")
    print(f"EVALUATION: {name}")
    print(f"Dimensions: {pil_img.size[0]} x {pil_img.size[1]} (Aspect Ratio: {pil_img.size[0]/pil_img.size[1]:.3f})")
    
    # Preprocess Direct Stretch
    img_640 = pil_img.resize((640, 640), Image.BILINEAR)
    arr = np.array(img_640, dtype=np.float32) / 255.0
    if arr.shape[-1] == 4: arr = arr[:, :, :3]
    arr = np.transpose(arr, (2, 0, 1))
    inp = np.expand_dims(arr, axis=0)
    
    out = session.run([output_name], {input_name: inp})[0][0] # [8, 8400]
    scores = out[4:8, :]
    
    highest_raw = float(np.max(scores))
    max_idx = np.unravel_index(np.argmax(scores), scores.shape)
    cls_code = class_names[max_idx[0]]
    anchor_idx = max_idx[1]
    
    cx = out[0, anchor_idx] * (100.0 / 640.0)
    cy = out[1, anchor_idx] * (100.0 / 640.0)
    w  = out[2, anchor_idx] * (100.0 / 640.0)
    h  = out[3, anchor_idx] * (100.0 / 640.0)
    x1 = max(0, cx - w / 2)
    y1 = max(0, cy - h / 2)
    
    print(f"Highest Raw Score: {highest_raw:.4f} ({highest_raw*100:.2f}%)")
    print(f"Highest Class: {cls_code}")
    print(f"Highest Candidate Coordinates: x={x1:.2f}%, y={y1:.2f}%, w={w:.2f}%, h={h:.2f}%")
    
    print("\nThreshold Diagnostic Results:")
    thresholds = [0.50, 0.40, 0.30, 0.20, 0.10]
    for t in thresholds:
        raw_count = int(np.sum(scores >= t))
        # Simple NMS count
        boxes = []
        for i in range(8400):
            scs = out[4:8, i]
            b_cls = np.argmax(scs)
            b_sc = float(scs[b_cls])
            if b_sc >= t:
                boxes.append(b_sc)
        print(f"  {int(t*100)}% Threshold -> Raw Candidates: {raw_count}, Above-Threshold Boxes: {len(boxes)}")

pothole_img_path = "public/assets/potholes_drone.png"
if os.path.exists(pothole_img_path):
    base_img = Image.open(pothole_img_path)
    
    # 1. Standard RDD image
    eval_image(base_img, "Standard RDD2022 Pothole Image (1024x1024)")
    
    # 2. Low-res 250x175 Crop
    crop = base_img.crop((300, 300, 800, 650)).resize((250, 175))
    eval_image(crop, "Low-Res 250x175 Cropped Pothole Scene")
    
    # 3. Low-contrast / dark real-life pothole simulation (250x175)
    dark_crop = ImageEnhance.Brightness(crop).enhance(0.5)
    eval_image(dark_crop, "Low-Contrast Dark Pothole Image (250x175)")
