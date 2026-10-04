import os
import sys
import json
import csv
import time
import numpy as np
from PIL import Image
import onnxruntime as ort

sys.stdout.reconfigure(encoding='utf-8')

onnx_path = r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx"
dataset_root = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"

session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
in_name = session.get_inputs()[0].name
out_name = session.get_outputs()[0].name

folders = [
    ("Flood", "FLOOD"),
    ("Pathole", "POTHOLE"),
    ("Garbage", "GARBAGE")
]

# ImageNet normalization
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

def preprocess(pil_img, dims=(416, 416)):
    resized = pil_img.resize(dims, Image.BILINEAR)
    arr = np.array(resized).astype(np.float32) / 255.0 # [416, 416, 3]
    arr = np.transpose(arr, (2, 0, 1)) # [3, 416, 416]
    arr = np.expand_dims(arr, axis=0) # [1, 3, 416, 416]
    arr = (arr - mean) / std
    return arr

# Deterministic threshold rule
def classify_water(pct):
    if pct < 5.0:
        return "NO SIGNIFICANT WATER"
    elif pct <= 20.0:
        return "POSSIBLE WATER / AMBIGUOUS"
    else:
        return "SIGNIFICANT WATER"

records = []

for folder_name, cat in folders:
    folder_path = os.path.join(dataset_root, folder_name)
    if not os.path.exists(folder_path):
        continue
    
    files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))])
    
    for f in files:
        fp = os.path.join(folder_path, f)
        try:
            pil_img = Image.open(fp).convert("RGB")
        except Exception as e:
            print(f"Skipping {f}: {e}")
            continue
        
        w, h = pil_img.size
        input_tensor = preprocess(pil_img, (416, 416))
        
        t0 = time.perf_counter()
        outputs = session.run([out_name], {in_name: input_tensor})[0] # [1, 1, 416, 416]
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        
        prob_map = outputs[0, 0] # [416, 416]
        water_mask = (prob_map >= 0.5).astype(np.uint8)
        water_pixels = int(np.sum(water_mask))
        total_pixels = water_mask.size # 416*416 = 173056
        water_pct = round((water_pixels / total_pixels) * 100, 2)
        
        mean_water_prob = round(float(np.mean(prob_map)), 4)
        max_water_prob = round(float(np.max(prob_map)), 4)
        
        water_cat = classify_water(water_pct)
        is_detected = water_pct >= 5.0
        substantial = water_pct > 20.0
        
        pred_label = "SIGNIFICANT_FLOOD_DETECTED" if substantial else ("FLOOD_WATER_DETECTED" if is_detected else "NO_FLOOD_DETECTED")
        
        records.append({
            'filename': f,
            'source_folder': folder_name,
            'category': cat,
            'image_resolution': f"{w}x{h}",
            'candidate_flood_prediction': pred_label,
            'water_coverage_percentage': water_pct,
            'water_category': water_cat,
            'substantial_water_coverage': substantial,
            'mean_water_prob': mean_water_prob,
            'max_water_prob': max_water_prob,
            'water_pixels': water_pixels,
            'total_pixels': total_pixels,
            'latency_ms': latency_ms,
            'inference_status': "SUCCESS"
        })

print(f"Processed all {len(records)} images.")
print("\n--- Summary by Category ---")
for f_name, cat in folders:
    recs = [r for r in records if r['source_folder'] == f_name]
    pcts = [r['water_coverage_percentage'] for r in recs]
    probs = [r['mean_water_prob'] for r in recs]
    det = sum(1 for r in recs if r['water_coverage_percentage'] >= 5.0)
    sig = sum(1 for r in recs if r['water_coverage_percentage'] > 20.0)
    print(f"\n{cat} ({len(recs)} imgs):")
    print(f"  Detected (>=5%): {det}/{len(recs)} ({round((det/len(recs))*100, 2)}%)")
    print(f"  Significant (>20%): {sig}/{len(recs)}")
    print(f"  Coverage %: min={min(pcts)}%, max={max(pcts)}%, mean={round(np.mean(pcts), 2)}%, median={round(np.median(pcts), 2)}%")
    print(f"  Mean Prob : min={min(probs)}, max={max(probs)}, mean={round(np.mean(probs), 4)}")
    for r in recs:
        print(f"    {r['filename']:<28} water={r['water_coverage_percentage']:>6}% max_p={r['max_water_prob']} cat={r['water_category']}")

with open(r"e:\CivicSenseAI\scratch\vfloodnet_raw_results.json", "w", encoding="utf-8") as f:
    json.dump(records, f, indent=2)
