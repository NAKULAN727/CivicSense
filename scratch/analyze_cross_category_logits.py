import os
import sys
import json
import csv
import time
import numpy as np
from PIL import Image
from transformers import SegformerImageProcessor
import onnxruntime as ort

sys.stdout.reconfigure(encoding='utf-8')

onnx_path = r"e:\CivicSenseAI\scratch\segformer_water_b0.onnx"
model_id = "imadd/segformer-b0-finetuned-segments-water-2"
processor = SegformerImageProcessor.from_pretrained(model_id)
session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name

dataset_root = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"

folders = [
    ("Flood", "FLOOD"),
    ("Pathole", "POTHOLE"),
    ("Garbage", "GARBAGE")
]

all_records = []

for folder_name, category in folders:
    folder_path = os.path.join(dataset_root, folder_name)
    if not os.path.exists(folder_path):
        print(f"Warning: {folder_path} not found!")
        continue
    
    files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))])
    
    for filename in files:
        filepath = os.path.join(folder_path, filename)
        try:
            pil_img = Image.open(filepath).convert("RGB")
        except Exception as e:
            print(f"Failed to load {filepath}: {e}")
            continue
        
        w, h = pil_img.size
        inputs = processor(images=pil_img, return_tensors="np")
        pixel_values = inputs['pixel_values'].astype(np.float32)
        
        t0 = time.perf_counter()
        outputs = session.run(None, {input_name: pixel_values})[0]
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        
        logits = outputs[0] # [2, 128, 128]
        # Class 0: water, Class 1: unlabeled
        water_logits = logits[0]
        unlabeled_logits = logits[1]
        
        # Raw argmax mask: 1 where water (class 0 > class 1), 0 otherwise
        raw_water_mask = (water_logits > unlabeled_logits).astype(np.uint8)
        raw_water_pixels = int(np.sum(raw_water_mask))
        total_pixels = raw_water_mask.size # 128 * 128 = 16384
        raw_water_pct = round((raw_water_pixels / total_pixels) * 100, 2)
        
        # Softmax probabilities
        exp_0 = np.exp(water_logits - np.maximum(water_logits, unlabeled_logits))
        exp_1 = np.exp(unlabeled_logits - np.maximum(water_logits, unlabeled_logits))
        softmax_water = exp_0 / (exp_0 + exp_1)
        
        mean_water_prob = round(float(np.mean(softmax_water)), 4)
        max_water_prob = round(float(np.max(softmax_water)), 4)
        min_water_prob = round(float(np.min(softmax_water)), 4)
        
        # Logit statistics
        mean_water_logit = round(float(np.mean(water_logits)), 4)
        mean_unlabeled_logit = round(float(np.mean(unlabeled_logits)), 4)
        logit_diff = round(mean_water_logit - mean_unlabeled_logit, 4)
        
        # Mask stats
        min_water_logit = round(float(np.min(water_logits)), 4)
        max_water_logit = round(float(np.max(water_logits)), 4)

        all_records.append({
            'filename': filename,
            'source_folder': folder_name,
            'category': category,
            'image_resolution': f"{w}x{h}",
            'image_width': w,
            'image_height': h,
            'latency_ms': elapsed_ms,
            'raw_water_pixels': raw_water_pixels,
            'total_pixels': total_pixels,
            'raw_water_pct': raw_water_pct,
            'mean_water_prob': mean_water_prob,
            'max_water_prob': max_water_prob,
            'min_water_prob': min_water_prob,
            'mean_water_logit': mean_water_logit,
            'mean_unlabeled_logit': mean_unlabeled_logit,
            'logit_diff': logit_diff,
            'min_water_logit': min_water_logit,
            'max_water_logit': max_water_logit
        })

print(f"Total processed: {len(all_records)} images.")
print("\n--- Summary by Source Folder (Raw Argmax Water Coverage %) ---")
for f_name, cat in folders:
    recs = [r for r in all_records if r['source_folder'] == f_name]
    pcts = [r['raw_water_pct'] for r in recs]
    probs = [r['mean_water_prob'] for r in recs]
    print(f"{f_name} ({len(recs)} imgs):")
    print(f"  Water Coverage %: min={min(pcts)}%, max={max(pcts)}%, mean={round(np.mean(pcts), 2)}%, median={round(np.median(pcts), 2)}%")
    print(f"  Mean Water Prob : min={min(probs)}, max={max(probs)}, mean={round(np.mean(probs), 4)}")
    for r in recs:
        print(f"    {r['filename']:<25} raw_water={r['raw_water_pct']:>6}% mean_p={r['mean_water_prob']} diff={r['logit_diff']}")

with open(r"e:\CivicSenseAI\scratch\raw_cross_category_dump.json", "w", encoding="utf-8") as f:
    json.dump(all_records, f, indent=2)
