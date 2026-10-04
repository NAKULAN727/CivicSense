import urllib.request
import os
import sys

print("=== CIVICSENSE AI MODEL ACQUISITION & EXPORT ===")

# Create scratch dir if needed
os.makedirs("scratch", exist_ok=True)
os.makedirs("public/models", exist_ok=True)

# 1. Download official benchmark checkpoint from SreekarAditya/yolo-rdd2022-benchmark or rezzzq
url = "https://huggingface.co/SreekarAditya/yolo-rdd2022-benchmark/resolve/main/yolo-rdd2022-benchmark/yolov8s_seed0_best.pt"
ckpt_path = "scratch/yolov8s_rdd2022_best.pt"

if not os.path.exists(ckpt_path):
    print(f"Downloading checkpoint from {url}...")
    urllib.request.urlretrieve(url, ckpt_path)
    print(f"Downloaded checkpoint: {os.path.getsize(ckpt_path)} bytes")
else:
    print(f"Checkpoint already present: {ckpt_path} ({os.path.getsize(ckpt_path)} bytes)")

# We will export via ultralytics script once installed
