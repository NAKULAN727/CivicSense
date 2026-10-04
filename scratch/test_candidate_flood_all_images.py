import os
import json
import time
import numpy as np
from PIL import Image
from transformers import SegformerImageProcessor
import onnxruntime as ort

print("=== EVALUATING CANDIDATE WATER MODEL ON ALL 38 REAL IMAGES ===")

onnx_path = r"e:\CivicSenseAI\scratch\segformer_water_b0.onnx"
model_id = "imadd/segformer-b0-finetuned-segments-water-2"
processor = SegformerImageProcessor.from_pretrained(model_id)
session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name

dataset_dir = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"

records = []
category_stats = {
    'FLOOD': {'total': 0, 'detected': 0},
    'GARBAGE': {'total': 0, 'detected': 0},
    'POTHOLE': {'total': 0, 'detected': 0}
}

for root, dirs, files in os.walk(dataset_dir):
    folder = os.path.basename(root)
    gt = None
    if folder.upper() == 'FLOOD': gt = 'FLOOD'
    elif folder.upper() == 'GARBAGE': gt = 'GARBAGE'
    elif folder.upper() == 'PATHOLE': gt = 'POTHOLE'
    else: continue

    for f in sorted(files):
        fp = os.path.join(root, f)
        try:
            pil_img = Image.open(fp).convert('RGB')
        except Exception as e:
            continue

        w, h = pil_img.size
        inputs = processor(images=pil_img, return_tensors="np")
        pixel_values = inputs['pixel_values'].astype(np.float32)

        start = time.time()
        outputs = session.run(None, {input_name: pixel_values})[0]
        elapsed_ms = round((time.time() - start) * 1000, 1)

        logits = outputs[0]
        predicted_mask = np.argmax(logits, axis=0)

        # Class 0 is water
        water_pixels = np.sum(predicted_mask == 0)
        total_pixels = predicted_mask.size
        water_ratio = float(water_pixels) / total_pixels
        water_percent = round(water_ratio * 100, 2)
        is_detected = water_percent > 5.0 # threshold at 5.0%

        category_stats[gt]['total'] += 1
        if is_detected:
            category_stats[gt]['detected'] += 1

        records.append({
            'filename': f,
            'groundTruth': gt,
            'imageWidth': w,
            'imageHeight': h,
            'waterAreaPercent': water_percent,
            'isFloodDetected': is_detected,
            'latencyMs': elapsed_ms
        })

print("\n--- CANDIDATE WATER MODEL SUMMARY (5% THRESHOLD) ---")
for cat, s in category_stats.items():
    rate = round((s['detected']/s['total'])*100, 2) if s['total']>0 else 0
    print(f"Category {cat}: Detected={s['detected']}/{s['total']} ({rate}%)")
