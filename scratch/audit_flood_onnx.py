import os
import sys
import json
import torch
import numpy as np
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=== CIVICSENSE AI PHASE 8C-6A FLOOD ONNX FALSE-NEGATIVE AUDIT ===", flush=True)

import onnx
import onnxruntime as ort
from transformers import SegformerForSemanticSegmentation

onnx_path = "public/models/flood-water-segmentation.onnx"
img_path = "public/assets/flooding_drone.png"

# 1. VERIFY ONNX GRAPH METADATA
print("\n--- 1. ONNX GRAPH METADATA INSPECTION ---", flush=True)
onnx_model = onnx.load(onnx_path)
onnx.checker.check_model(onnx_model)

print(f"ONNX Model File: {onnx_path}")
print(f"ONNX File Size: {os.path.getsize(onnx_path)} bytes ({os.path.getsize(onnx_path)/(1024*1024):.2f} MB)")
print(f"ONNX IR Version: {onnx_model.ir_version}")
print(f"ONNX Opset Version: {onnx_model.opset_import[0].version}")
print(f"Producer Name: {onnx_model.producer_name}")
print(f"Producer Version: {onnx_model.producer_version}")

session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
inputs_meta = session.get_inputs()
outputs_meta = session.get_outputs()

print(f"Input Name: '{inputs_meta[0].name}', Shape: {inputs_meta[0].shape}, Type: {inputs_meta[0].type}")
print(f"Output Name: '{outputs_meta[0].name}', Shape: {outputs_meta[0].shape}, Type: {outputs_meta[0].type}")

# 2. LOAD PYTORCH MODEL & CLASS MAPPING
print("\n--- 2. PYTORCH MODEL & CLASS MAPPING AUDIT ---", flush=True)
pt_model = SegformerForSemanticSegmentation.from_pretrained("rbh227/floodnet-segformer")
pt_model.eval()

id2label = pt_model.config.id2label
print("Official HuggingFace id2label mapping:")
for k, v in id2label.items():
    print(f"  Class {k}: '{v}'")

# 3. PREPROCESSING COMPARISON (1254x1254 & original resolution)
print("\n--- 3. TESTING INFERENCE ON FLOOD IMAGE ---", flush=True)
if os.path.exists(img_path):
    orig_img = Image.open(img_path).convert("RGB")
    print(f"Loaded image: {img_path}, Original Size: {orig_img.size}")
else:
    print(f"Creating synthetic 1254x1254 flooded image...")
    orig_img = Image.fromarray((np.random.rand(1254, 1254, 3) * 60 + np.array([30, 90, 180])).astype(np.uint8))

# Test both 512x512 direct resize and 1254x1254 high-res image
highres_img = orig_img.resize((1254, 1254))

def preprocess_imagenet(pil_img, target_size=(512, 512)):
    resized = pil_img.resize(target_size, Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0  # RGB HWC in [0, 1]
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    norm = (arr - mean) / std
    chw = np.transpose(norm, (2, 0, 1))
    return np.expand_dims(chw, axis=0).astype(np.float32)

input_tensor_np = preprocess_imagenet(highres_img, (512, 512))

# 4. RUN PYTORCH INFERENCE
with torch.no_grad():
    pt_input = torch.from_numpy(input_tensor_np)
    pt_output = pt_model(pt_input).logits # Shape: [1, 10, 128, 128]
    pt_logits = pt_output.cpu().numpy()

# 5. RUN ONNX INFERENCE
onnx_outputs = session.run(None, {inputs_meta[0].name: input_tensor_np})
onnx_logits = onnx_outputs[0] # Shape: [1, 10, 128, 128]

print("\n--- 4. PYTORCH VS ONNX LOGITS DIFFERENCE ---", flush=True)
diff = np.abs(pt_logits - onnx_logits)
print(f"Max Absolute Logit Diff between PyTorch and ONNX: {np.max(diff):.6f}")
print(f"Mean Absolute Logit Diff: {np.mean(diff):.6f}")

# 6. PER-CLASS LOGIT STATISTICS DUMP
print("\n--- 5. PER-CLASS LOGIT STATISTICS (ONNX MODEL OUTPUT [1, 10, 128, 128]) ---", flush=True)

# Logits shape: [1, 10, 128, 128]
spatial_size = 128 * 128 # 16,384
argmax_mask = np.argmax(onnx_logits[0], axis=0) # [128, 128]

for c in range(10):
    c_logits = onnx_logits[0, c, :, :]
    c_min = float(np.min(c_logits))
    c_max = float(np.max(c_logits))
    c_mean = float(np.mean(c_logits))
    c_std = float(np.std(c_logits))
    c_argmax_count = int(np.sum(argmax_mask == c))
    c_label = id2label.get(c, str(c))
    
    is_target_flood = c in [1, 3, 5]
    tag = " [TARGET FLOOD CLASS]" if is_target_flood else ""
    print(f"Class {c} ({c_label}){tag}:")
    print(f"  Min: {c_min:.4f}, Max: {c_max:.4f}, Mean: {c_mean:.4f}, Std: {c_std:.4f}")
    print(f"  Argmax Pixels: {c_argmax_count} / {spatial_size} ({c_argmax_count/spatial_size*100:.2f}%)")

target_flood_pixels = int(np.sum((argmax_mask == 1) | (argmax_mask == 3) | (argmax_mask == 5)))
print(f"\nTOTAL TARGET FLOOD PIXELS (Classes 1, 3, 5): {target_flood_pixels} / {spatial_size}")
print(f"TOTAL FLOODED AREA PERCENT: {target_flood_pixels / spatial_size * 100:.2f}%")

# Save detailed json report
audit_report = {
    "onnx_path": onnx_path,
    "onnx_size_mb": os.path.getsize(onnx_path) / (1024*1024),
    "opset": onnx_model.opset_import[0].version,
    "input_shape": inputs_meta[0].shape,
    "output_shape": outputs_meta[0].shape,
    "max_pt_onnx_diff": float(np.max(diff)),
    "target_flood_pixels": target_flood_pixels,
    "flooded_area_percent": float(target_flood_pixels / spatial_size * 100),
    "id2label": id2label,
    "argmax_distribution": {int(c): int(np.sum(argmax_mask == c)) for c in range(10)}
}

with open("scratch/flood_audit_report.json", "w") as f:
    json.dump(audit_report, f, indent=2)

print("\nSaved inspection summary to scratch/flood_audit_report.json")
