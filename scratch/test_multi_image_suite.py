import os
import sys
import json
import torch
import numpy as np
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=== CIVICSENSE AI FLOOD MODEL MULTI-IMAGE SUITE AUDIT ===", flush=True)

import onnxruntime as ort

onnx_path = "public/models/flood-water-segmentation.onnx"
session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
inputs_meta = session.get_inputs()

# Helper function for ImageNet normalization
def preprocess_imagenet(pil_img, target_size=(512, 512)):
    resized = pil_img.resize(target_size, Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    norm = (arr - mean) / std
    chw = np.transpose(norm, (2, 0, 1))
    return np.expand_dims(chw, axis=0).astype(np.float32)

# Load / generate 8 test images as specified in Prompt Section 8
flooding_asset = Image.open("public/assets/flooding_drone.png").convert("RGB")
garbage_asset = Image.open("public/assets/garbage_drone.png").convert("RGB")
potholes_asset = Image.open("public/assets/potholes_drone.png").convert("RGB")

test_scenarios = [
    {"id": "1", "name": "1254x1254 Flooded City", "img": flooding_asset.resize((1254, 1254)), "expected": "FLOOD"},
    {"id": "2", "name": "250x188 Flooded Image", "img": flooding_asset.resize((250, 188)), "expected": "FLOOD"},
    {"id": "3", "name": "Clear Flooded Street", "img": flooding_asset, "expected": "FLOOD"},
    {"id": "4", "name": "Waterlogged Road", "img": flooding_asset.crop((100, 100, 700, 700)), "expected": "FLOOD"},
    {"id": "5", "name": "Normal Dry Road", "img": potholes_asset, "expected": "DRY"},
    {"id": "6", "name": "Normal City Street", "img": Image.fromarray((np.random.rand(600, 800, 3) * 100 + 80).astype(np.uint8)), "expected": "DRY"},
    {"id": "7", "name": "Building Structure", "img": Image.fromarray((np.random.rand(700, 700, 3) * 80 + 100).astype(np.uint8)), "expected": "DRY"},
    {"id": "8", "name": "Solid Waste Accumulation", "img": garbage_asset, "expected": "WASTE"}
]

suite_results = []

for sc in test_scenarios:
    img = sc["img"]
    w, h = img.size
    inp_np = preprocess_imagenet(img, (512, 512))
    logits = session.run(None, {inputs_meta[0].name: inp_np})[0] # [1, 10, 128, 128]
    
    argmax_map = np.argmax(logits[0], axis=0) # [128, 128]
    water_mask = (argmax_map == 1) | (argmax_map == 3) | (argmax_map == 5)
    flood_pixels = int(np.sum(water_mask))
    total_pixels = 128 * 128
    flooded_percent = round((flood_pixels / total_pixels) * 100, 2)
    flood_detected = flooded_percent > 1.0

    # Class distribution statistics
    class_counts = {int(c): int(np.sum(argmax_map == c)) for c in range(10)}
    dominant_class = int(np.argmax(np.bincount(argmax_map.flatten())))

    # Class 5 (Water) logit statistics
    w_logits = logits[0, 5, :, :]
    min_w = float(np.min(w_logits))
    max_w = float(np.max(w_logits))
    mean_w = float(np.mean(w_logits))
    std_w = float(np.std(w_logits))

    record = {
        "scenario_id": sc["id"],
        "name": sc["name"],
        "resolution": f"{w}x{h}",
        "expected": sc["expected"],
        "flood_pixels": flood_pixels,
        "total_pixels": total_pixels,
        "flooded_percent": flooded_percent,
        "flood_detected": flood_detected,
        "water_logit_stats": {
            "min": round(min_w, 4),
            "max": round(max_w, 4),
            "mean": round(mean_w, 4),
            "std": round(std_w, 4)
        },
        "dominant_class": dominant_class,
        "class_distribution": class_counts
    }
    suite_results.append(record)
    print(f"[{sc['name']}] Res: {w}x{h} | Flood%: {flooded_percent}% (Pixels: {flood_pixels}/{total_pixels}) | Water Logit Max: {max_w:.2f} | Dom Class: {dominant_class}", flush=True)

summary = {
    "scenarios_tested": len(suite_results),
    "model": onnx_path,
    "results": suite_results
}

with open("scratch/flood_multi_image_suite.json", "w") as f:
    json.dump(summary, f, indent=2)

print("\nSaved multi-image suite report to scratch/flood_multi_image_suite.json", flush=True)
