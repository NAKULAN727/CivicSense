import os
import sys
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

test_samples = [
    (r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas\Flood\flood 1.jpg", "Flood"),
    (r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas\Pathole\pathole 1.webp", "Pothole"),
    (r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas\Pathole\road without pothole.webp", "Pothole-CleanRoad"),
    (r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas\Garbage\garbage 1.webp", "Garbage")
]

for path, label in test_samples:
    img = Image.open(path).convert('RGB')
    inputs = processor(images=img, return_tensors="np")
    pixel_values = inputs['pixel_values'].astype(np.float32)
    outputs = session.run(None, {input_name: pixel_values})[0] # [1, 2, 128, 128]
    logits = outputs[0] # [2, 128, 128]
    
    # Class 0: water, Class 1: unlabeled
    c0 = logits[0]
    c1 = logits[1]
    
    # Softmax probability for class 0
    exp_c0 = np.exp(c0 - np.maximum(c0, c1))
    exp_c1 = np.exp(c1 - np.maximum(c0, c1))
    prob_water = exp_c0 / (exp_c0 + exp_c1)
    
    argmax = np.argmax(logits, axis=0) # [128, 128]
    
    print(f"\n--- Sample: {label} ({os.path.basename(path)}) ---")
    print(f"Logits shape: {logits.shape}")
    print(f"Class 0 (water)     min: {np.min(c0):.3f}, max: {np.max(c0):.3f}, mean: {np.mean(c0):.3f}")
    print(f"Class 1 (unlabeled) min: {np.min(c1):.3f}, max: {np.max(c1):.3f}, mean: {np.mean(c1):.3f}")
    print(f"Argmax: class 0 count = {np.sum(argmax == 0)} / {argmax.size} ({np.mean(argmax == 0)*100:.1f}%)")
    print(f"Argmax: class 1 count = {np.sum(argmax == 1)} / {argmax.size} ({np.mean(argmax == 1)*100:.1f}%)")
    print(f"Mean Softmax Water Prob: {np.mean(prob_water):.3f}")
    print(f"Pixels with Softmax Prob > 0.5: {np.sum(prob_water > 0.5)} ({np.mean(prob_water > 0.5)*100:.1f}%)")
    print(f"Pixels with Softmax Prob > 0.8: {np.sum(prob_water > 0.8)} ({np.mean(prob_water > 0.8)*100:.1f}%)")
    print(f"Pixels with Softmax Prob > 0.95: {np.sum(prob_water > 0.95)} ({np.mean(prob_water > 0.95)*100:.1f}%)")
