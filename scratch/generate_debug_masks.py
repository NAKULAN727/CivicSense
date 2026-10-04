import os
import sys
import json
import torch
import numpy as np
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=== GENERATING STANDALONE SEGMENTATION DEBUG MASKS ===", flush=True)

import onnxruntime as ort
from transformers import SegformerForSemanticSegmentation

onnx_path = "public/models/flood-water-segmentation.onnx"
img_path = "public/assets/flooding_drone.png"

session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
inputs_meta = session.get_inputs()

orig_img = Image.open(img_path).convert("RGB")
w_orig, h_orig = orig_img.size

# High-Res 1254x1254 test image
highres_img = orig_img.resize((1254, 1254), Image.BILINEAR)

# Preprocessing
resized_512 = highres_img.resize((512, 512), Image.BILINEAR)
arr_512 = np.array(resized_512, dtype=np.float32) / 255.0
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
norm_arr = (arr_512 - mean) / std
chw = np.transpose(norm_arr, (2, 0, 1))
input_tensor_np = np.expand_dims(chw, axis=0).astype(np.float32)

# Run ONNX inference
onnx_outputs = session.run(None, {inputs_meta[0].name: input_tensor_np})
logits = onnx_outputs[0] # [1, 10, 128, 128]

argmax_mask_128 = np.argmax(logits[0], axis=0).astype(np.uint8) # [128, 128]

# Map classes to distinct RGB colors for visual debug inspection
# 0: background (Black)
# 1: building flooded (Red)
# 2: building non-flooded (Gray)
# 3: road flooded (Purple)
# 4: road non-flooded (Dark Yellow)
# 5: water (Cyan / Bright Blue)
# 6: tree (Green)
# 7: vehicle (Orange)
# 8: pool (Magenta)
# 9: grass (Light Green)

COLOR_MAP = {
    0: [0, 0, 0],          # Background: Black
    1: [239, 68, 68],      # Building Flooded: Red
    2: [100, 116, 139],    # Building Non-Flooded: Slate Gray
    3: [168, 85, 247],     # Road Flooded: Purple
    4: [234, 179, 8],      # Road Non-Flooded: Yellow
    5: [0, 180, 255],      # Water: Cyan Blue
    6: [34, 197, 94],      # Tree: Green
    7: [249, 115, 22],     # Vehicle: Orange
    8: [236, 72, 153],     # Pool: Pink/Magenta
    9: [132, 204, 22]      # Grass: Lime Green
}

rgb_mask_128 = np.zeros((128, 128, 3), dtype=np.uint8)
for c, color in COLOR_MAP.items():
    rgb_mask_128[argmax_mask_128 == c] = color

# Save 128x128 mask resized to 1254x1254
debug_mask_img = Image.fromarray(rgb_mask_128).resize((1254, 1254), Image.NEAREST)
os.makedirs("scratch", exist_ok=True)
debug_mask_img.save("scratch/flood_debug_mask.png")
print("Saved debug class segmentation mask to: scratch/flood_debug_mask.png")

# Create semi-transparent overlay over 1254x1254 test image
highres_rgba = highres_img.convert("RGBA")
mask_rgba = debug_mask_img.convert("RGBA")

# Water mask overlay
water_mask_128 = (argmax_mask_128 == 1) | (argmax_mask_128 == 3) | (argmax_mask_128 == 5)
overlay_array = np.array(highres_rgba, dtype=np.float32)
mask_resized = np.array(Image.fromarray(water_mask_128.astype(np.uint8) * 255).resize((1254, 1254), Image.NEAREST)) > 0

# Blend Cyan color [0, 180, 255] with 50% opacity where water is predicted
cyan_color = np.array([0, 180, 255], dtype=np.float32)
for channel in range(3):
    overlay_array[:, :, channel][mask_resized] = overlay_array[:, :, channel][mask_resized] * 0.4 + cyan_color[channel] * 0.6

overlay_img = Image.fromarray(np.clip(overlay_array, 0, 255).astype(np.uint8))
overlay_img.save("scratch/flood_debug_overlay.png")
print("Saved visual overlay to: scratch/flood_debug_overlay.png")

# Calculate metrics
total_pixels = 128 * 128
flood_pixels = int(np.sum(water_mask_128))
percent = round((flood_pixels / total_pixels) * 100, 2)
print(f"\nModel Predicted Flood Pixels: {flood_pixels} / {total_pixels} ({percent}%)")
