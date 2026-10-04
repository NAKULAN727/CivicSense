import onnxruntime as ort
import onnx
import numpy as np
from PIL import Image
import os
import json

print("=== PHASE 8C-4C INFERENCE PIPELINE & ONNX GRAPH AUDIT ===")

model_path = "public/models/rdd2022-road-damage.onnx"

# 1. Inspect ONNX Graph Output Nodes
onnx_model = onnx.load(model_path)
print(f"\n1. ONNX GRAPH INSPECTION:")
print(f"  Producer Name: {onnx_model.producer_name}")
print(f"  Producer Version: {onnx_model.producer_version}")
print(f"  Opset Version: {onnx_model.opset_import[0].version}")

output_node = None
for node in onnx_model.graph.node:
    if "output0" in node.output:
        output_node = node
        print(f"  Node driving 'output0': {node.op_type} (name: {node.name})")

session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

class_names = {
    0: "D00 (Longitudinal Crack)",
    1: "D10 (Transverse Crack)",
    2: "D20 (Alligator Crack)",
    3: "D40 (Pothole)"
}

# 2. Preprocessing helper Functions
def preprocess_direct_stretch(pil_img):
    """Current implementation: Direct stretch to 640x640 without letterboxing"""
    img_resized = pil_img.resize((640, 640), Image.BILINEAR)
    arr = np.array(img_resized, dtype=np.float32) / 255.0
    if arr.shape[-1] == 4:
        arr = arr[:, :, :3]
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, axis=0)

def preprocess_letterbox(pil_img, target_size=(640, 640), color=(114, 114, 114)):
    """YOLOv8 Standard Letterbox Preprocessing preserving aspect ratio"""
    w, h = pil_img.size
    scale = min(target_size[0] / w, target_size[1] / h)
    nw = int(round(w * scale))
    nh = int(round(h * scale))
    
    img_resized = pil_img.resize((nw, nh), Image.BILINEAR)
    new_img = Image.new('RGB', target_size, color)
    pad_x = (target_size[0] - nw) // 2
    pad_y = (target_size[1] - nh) // 2
    new_img.paste(img_resized, (pad_x, pad_y))
    
    arr = np.array(new_img, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, axis=0), scale, pad_x, pad_y

def run_diagnostic_experiment(pil_img, img_label="Test Image"):
    print(f"\n==================================================")
    print(f"DIAGNOSTIC EXPERIMENT FOR: {img_label}")
    print(f"Original PIL dimensions: {pil_img.size[0]} x {pil_img.size[1]} (Aspect Ratio: {pil_img.size[0]/pil_img.size[1]:.3f})")
    
    # Check Direct Stretch vs Letterbox
    inp_stretch = preprocess_direct_stretch(pil_img)
    inp_lbox, scale, pad_x, pad_y = preprocess_letterbox(pil_img)
    
    out_stretch = session.run([output_name], {input_name: inp_stretch})[0][0] # [8, 8400]
    out_lbox = session.run([output_name], {input_name: inp_lbox})[0][0]       # [8, 8400]
    
    # Analyze raw scores for Direct Stretch
    scores_stretch = out_stretch[4:8, :] # [4, 8400]
    max_score_stretch = float(np.max(scores_stretch))
    max_idx_stretch = np.unravel_index(np.argmax(scores_stretch), scores_stretch.shape)
    
    # Analyze raw scores for Letterbox
    scores_lbox = out_lbox[4:8, :] # [4, 8400]
    max_score_lbox = float(np.max(scores_lbox))
    max_idx_lbox = np.unravel_index(np.argmax(scores_lbox), scores_lbox.shape)
    
    print(f"\n--- DIRECT STRETCH RESIZE RESULTS ---")
    print(f"  Highest Raw Score: {max_score_stretch:.6f}")
    print(f"  Class with Highest Score: {class_names[max_idx_stretch[0]]} (index {max_idx_stretch[0]})")
    anchor_idx = max_idx_stretch[1]
    cx = out_stretch[0, anchor_idx] * (100.0 / 640.0)
    cy = out_stretch[1, anchor_idx] * (100.0 / 640.0)
    w = out_stretch[2, anchor_idx] * (100.0 / 640.0)
    h = out_stretch[3, anchor_idx] * (100.0 / 640.0)
    print(f"  Coordinates for Top Candidate (Direct Stretch %): x={cx-w/2:.2f}%, y={cy-h/2:.2f}%, w={w:.2f}%, h={h:.2f}%")
    
    print(f"\n--- LETTERBOX RESIZE RESULTS ---")
    print(f"  Highest Raw Score: {max_score_lbox:.6f}")
    print(f"  Class with Highest Score: {class_names[max_idx_lbox[0]]} (index {max_idx_lbox[0]})")
    
    print(f"\n--- THRESHOLD EXPERIMENT (DIRECT STRETCH) ---")
    thresholds = [0.50, 0.40, 0.30, 0.20, 0.10]
    for thresh in thresholds:
        count = int(np.sum(scores_stretch >= thresh))
        print(f"  Threshold {int(thresh*100)}%: Raw Candidates >= {thresh:.2f} = {count}")
        
    print(f"\n--- THRESHOLD EXPERIMENT (LETTERBOX) ---")
    for thresh in thresholds:
        count = int(np.sum(scores_lbox >= thresh))
        print(f"  Threshold {int(thresh*100)}%: Raw Candidates >= {thresh:.2f} = {count}")

# Test 1: Known RDD2022 Potholes Image
pothole_img_path = "public/assets/potholes_drone.png"
if os.path.exists(pothole_img_path):
    img_rdd = Image.open(pothole_img_path)
    run_diagnostic_experiment(img_rdd, "Known RDD2022 Pothole Image (potholes_drone.png)")

# Test 2: Downsampled & Low Resolution Non-Square Pothole Crop (250x175)
if os.path.exists(pothole_img_path):
    # Crop a 250x175 region containing the pothole
    w, h = img_rdd.size
    crop_250x175 = img_rdd.resize((250, 175), Image.BILINEAR)
    run_diagnostic_experiment(crop_250x175, "Downsampled Low-Res 250x175 Pothole Test Image")
