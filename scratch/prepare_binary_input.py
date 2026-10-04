import os
import sys
import numpy as np
from PIL import Image

print("=== PREPARING RAW PREPROCESSED FLOAT32 INPUT BINARY ===")

img_path = "public/assets/flooding_drone.png"
img = Image.open(img_path).convert("RGB").resize((1254, 1254))

# Resize to 512x512
resized_512 = img.resize((512, 512), Image.BILINEAR)
arr_512 = np.array(resized_512, dtype=np.float32) / 255.0
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
norm_arr = (arr_512 - mean) / std
chw = np.transpose(norm_arr, (2, 0, 1)).astype(np.float32)

bin_path = "scratch/flooding_drone_preprocessed.bin"
chw.tofile(bin_path)
print(f"Saved preprocessed Float32 CHW array to {bin_path} ({os.path.getsize(bin_path)} bytes)")
