import os
import sys
import json
import numpy as np
from PIL import Image
import onnxruntime as ort

dataset_root = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"
onnx_path = r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx"
session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
in_name = session.get_inputs()[0].name
out_name = session.get_outputs()[0].name

mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

def preprocess(pil_img, dims=(416, 416)):
    resized = pil_img.resize(dims, Image.BILINEAR)
    arr = np.array(resized).astype(np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, axis=0)
    arr = (arr - mean) / std
    return arr

# Check what pathole 1, 4, 8, 10 look like
diag_dir = r"e:\CivicSenseAI\scratch\vfloodnet_overlays"
os.makedirs(diag_dir, exist_ok=True)

for folder in ["Pathole", "Garbage", "Flood"]:
    fpath = os.path.join(dataset_root, folder)
    for fname in sorted(os.listdir(fpath)):
        full = os.path.join(fpath, fname)
        if not os.path.isfile(full): continue
        img = Image.open(full).convert("RGB")
        inp = preprocess(img)
        out = session.run([out_name], {in_name: inp})[0][0, 0]
        mask = (out >= 0.5).astype(np.uint8)
        pct = round(float(np.sum(mask)) / mask.size * 100, 2)
        
        # Save overlay for key interesting ones
        if folder == "Pathole" or (folder == "Garbage" and pct >= 5.0) or (folder == "Flood" and pct < 20.0):
            # create red mask overlay on 416x416 image
            base = img.resize((416, 416), Image.BILINEAR)
            base_arr = np.array(base)
            overlay = base_arr.copy()
            overlay[mask == 1, 0] = np.clip(overlay[mask == 1, 0].astype(int) + 120, 0, 255)
            overlay[mask == 1, 1] = overlay[mask == 1, 1] // 2
            overlay[mask == 1, 2] = overlay[mask == 1, 2] // 2
            comb = Image.fromarray(np.hstack([base_arr, overlay]))
            clean_name = fname.replace(" ", "_").replace("(", "").replace(")", "")
            comb.save(os.path.join(diag_dir, f"{folder}_{clean_name}_{pct}pct.png"))

print("Overlays generated in scratch/vfloodnet_overlays.")
