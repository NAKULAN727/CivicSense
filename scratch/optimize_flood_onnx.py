import os
import sys
import json
import torch
import numpy as np
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=== CIVICSENSE AI FLOOD ONNX MODEL GRAPH OPTIMIZATION ===", flush=True)

import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

orig_onnx_path = "public/models/flood-water-segmentation.onnx"
optimized_onnx_path = "scratch/floodnet_optimized.onnx"
target_onnx_path = "public/models/flood-water-segmentation.onnx"

orig_size = os.path.getsize(orig_onnx_path)
print(f"Original ONNX Model File Size: {orig_size} bytes ({orig_size / (1024*1024):.2f} MB)")

# Apply dynamic ONNX quantization (FP32 -> INT8/UINT8 weights)
print("\n1. Applying ONNX Dynamic Quantization (Targeting <25 MB for browser WASM)...", flush=True)
quantize_dynamic(
    model_input=orig_onnx_path,
    model_output=optimized_onnx_path,
    weight_type=QuantType.QUInt8,
    extra_options={'EnableONNXRuntimeOptimization': True}
)

opt_size = os.path.getsize(optimized_onnx_path)
print(f"Optimized ONNX Model File Size: {opt_size} bytes ({opt_size / (1024*1024):.2f} MB)")
print(f"Size Reduction: {((orig_size - opt_size) / orig_size) * 100:.2f}% reduction!")

# 2. Verify structure of optimized ONNX model
print("\n2. Verifying structure and correctness of optimized ONNX model...", flush=True)
opt_model = onnx.load(optimized_onnx_path)
onnx.checker.check_model(opt_model)
print("ONNX Checker: Optimized model structure is 100% VALID!")

# 3. Test inference on 1254x1254 flood image
img_path = "public/assets/flooding_drone.png"
orig_img = Image.fromarray((np.random.rand(1254, 1254, 3) * 60 + np.array([30, 90, 180])).astype(np.uint8))
if os.path.exists(img_path):
    orig_img = Image.open(img_path).convert("RGB").resize((1254, 1254))

def preprocess_imagenet(pil_img, target_size=(512, 512)):
    resized = pil_img.resize(target_size, Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    norm = (arr - mean) / std
    chw = np.transpose(norm, (2, 0, 1))
    return np.expand_dims(chw, axis=0).astype(np.float32)

inp_np = preprocess_imagenet(orig_img, (512, 512))

sess_orig = ort.InferenceSession(orig_onnx_path, providers=['CPUExecutionProvider'])
sess_opt = ort.InferenceSession(optimized_onnx_path, providers=['CPUExecutionProvider'])

out_orig = sess_orig.run(None, {"images": inp_np})[0]
out_opt = sess_opt.run(None, {"images": inp_np})[0]

diff_max = float(np.max(np.abs(out_orig - out_opt)))
diff_mean = float(np.mean(np.abs(out_orig - out_opt)))

print(f"\nOriginal vs Optimized Logits Difference:")
print(f"  Max Absolute Diff: {diff_max:.6f}")
print(f"  Mean Absolute Diff: {diff_mean:.6f}")

argmax_orig = np.argmax(out_orig[0], axis=0)
argmax_opt = np.argmax(out_opt[0], axis=0)

water_orig = int(np.sum((argmax_orig == 1) | (argmax_orig == 3) | (argmax_orig == 5)))
water_opt = int(np.sum((argmax_opt == 1) | (argmax_opt == 3) | (argmax_opt == 5)))

print(f"\nSegmentation Prediction Comparison (16,384 Total Pixels):")
print(f"  Original Model Flood Pixels: {water_orig} ({water_orig / 16384 * 100:.2f}%)")
print(f"  Optimized Model Flood Pixels: {water_opt} ({water_opt / 16384 * 100:.2f}%)")
print(f"  Pixel Mask Agreement: {np.sum(argmax_orig == argmax_opt) / 16384 * 100:.2f}%")

# Replace target ONNX model with optimized binary
import shutil
shutil.copy(optimized_onnx_path, target_onnx_path)
print(f"\nReplaced {target_onnx_path} with optimized ONNX binary ({os.path.getsize(target_onnx_path)/(1024*1024):.2f} MB)")
