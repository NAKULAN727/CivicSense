import urllib.request
import os
import shutil
from ultralytics import YOLO
import onnx
import onnxruntime as ort

print("=== DOWNLOADING AND INSPECTING WASTE DETECTION CHECKPOINTS ===")

os.makedirs("scratch", exist_ok=True)
os.makedirs("public/models", exist_ok=True)

# Candidate A: HrutikAdsare/waste-detection-yolov8
url_a = "https://huggingface.co/HrutikAdsare/waste-detection-yolov8/resolve/main/best.pt"
ckpt_a = "scratch/hrutik_waste_yolov8.pt"

print(f"\nDownloading Candidate A from {url_a}...")
try:
    if not os.path.exists(ckpt_a):
        urllib.request.urlretrieve(url_a, ckpt_a)
    print(f"Downloaded Candidate A: {os.path.getsize(ckpt_a)} bytes")
    
    model_a = YOLO(ckpt_a)
    print(f"Candidate A Classes: {model_a.names}")
except Exception as e:
    print(f"Candidate A Error: {e}")

# Candidate B: esapzoi/litter-detection-yolov8
url_b = "https://huggingface.co/esapzoi/litter-detection-yolov8/resolve/main/best.pt"
ckpt_b = "scratch/esapzoi_litter_yolov8.pt"

print(f"\nDownloading Candidate B from {url_b}...")
try:
    if not os.path.exists(ckpt_b):
        urllib.request.urlretrieve(url_b, ckpt_b)
    print(f"Downloaded Candidate B: {os.path.getsize(ckpt_b)} bytes")
    
    model_b = YOLO(ckpt_b)
    print(f"Candidate B Classes: {model_b.names}")
except Exception as e:
    print(f"Candidate B Error: {e}")
