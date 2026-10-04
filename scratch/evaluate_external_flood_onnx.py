import os
import sys
import json
import time
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

print("=== EVALUATING CANDIDATE STREET-LEVEL WATER SEGMENTATION MODEL ===")
print("Candidate Repo: imadd/segformer-b0-finetuned-segments-water-2")
print("License: Apache-2.0")
print("Architecture: SegFormer-B0 Water Segmenter")

try:
    import torch
    from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor

    model_id = "imadd/segformer-b0-finetuned-segments-water-2"
    print(f"\nLoading model '{model_id}' from HuggingFace...")
    processor = SegformerImageProcessor.from_pretrained(model_id)
    model = SegformerForSemanticSegmentation.from_pretrained(model_id)
    model.eval()

    print(f"Model ID2LABEL mapping: {model.config.id2label}")
    print(f"Model LABEL2ID mapping: {model.config.label2id}")

    # Export to ONNX if not already exported
    onnx_path = r"e:\CivicSenseAI\scratch\segformer_water_b0.onnx"
    if not os.path.exists(onnx_path):
        print(f"Exporting '{model_id}' to ONNX format at {onnx_path}...")
        dummy_input = torch.randn(1, 3, 512, 512)
        # Use legacy ONNX exporter to avoid dynamo print unicode issue on Windows
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            input_names=['pixel_values'],
            output_names=['logits'],
            dynamic_axes={'pixel_values': {0: 'batch'}, 'logits': {0: 'batch'}},
            opset_version=14,
            dynamo=False
        )
        print(f"Export complete. ONNX File size: {os.path.getsize(onnx_path) / (1024*1024):.2f} MB")

    # Evaluate on the 14 Flood images
    import onnxruntime as ort
    session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    print(f"ONNX Session Input Name: {input_name}, Shape: {session.get_inputs()[0].shape}")

    flood_dir = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas\Flood"
    files = sorted([f for f in os.listdir(flood_dir) if os.path.isfile(os.path.join(flood_dir, f))])
    
    print(f"\nEvaluating on {len(files)} real test images in '{flood_dir}'...")

    results = []
    tp_count = 0

    for f in files:
        fp = os.path.join(flood_dir, f)
        try:
            pil_img = Image.open(fp).convert('RGB')
        except Exception as e:
            print(f"Skipping {f}: {e}")
            continue

        w, h = pil_img.size
        inputs = processor(images=pil_img, return_tensors="np")
        pixel_values = inputs['pixel_values'].astype(np.float32)

        start = time.time()
        outputs = session.run(None, {input_name: pixel_values})[0] # [1, num_classes, H, W]
        elapsed_ms = round((time.time() - start) * 1000, 1)

        logits = outputs[0] # [num_classes, H, W]
        predicted_mask = np.argmax(logits, axis=0) # [H, W]

        # Class 0 is 'water' in imadd/segformer-b0-finetuned-segments-water-2
        water_class_idx = 0
        water_pixels = np.sum(predicted_mask == water_class_idx)
        total_pixels = predicted_mask.size
        water_ratio = float(water_pixels) / total_pixels
        water_percent = round(water_ratio * 100, 2)
        is_detected = water_percent > 1.0

        if is_detected:
            tp_count += 1

        results.append({
            'filename': f,
            'imageWidth': w,
            'imageHeight': h,
            'isFloodDetected': is_detected,
            'waterAreaPercent': water_percent,
            'latencyMs': elapsed_ms
        })

        print(f"[{'TP' if is_detected else 'FN'}] {f} ({w}x{h}): water={water_percent}%, latency={elapsed_ms}ms")

    print(f"\nSummary for Candidate Model (segformer-b0-finetuned-segments-water-2):")
    print(f"  Detected: {tp_count} / {len(files)} ({round((tp_count/len(files))*100, 2)}%)")

    with open(r"e:\CivicSenseAI\scratch\candidate_flood_results.json", "w", encoding="utf-8") as f_out:
        json.dump(results, f_out, indent=2)

except Exception as e:
    print(f"Error during candidate model evaluation: {e}")
