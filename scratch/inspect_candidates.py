import urllib.request
import os
from ultralytics import YOLO

os.makedirs("scratch", exist_ok=True)

# Candidate C: samraatd/yolov10-waste-detection
url_c = "https://huggingface.co/samraatd/yolov10-waste-detection/resolve/main/best_local.pt"
ckpt_c = "scratch/samraatd_waste_yolov10.pt"

print(f"Downloading Candidate C from {url_c}...")
try:
    if not os.path.exists(ckpt_c):
        urllib.request.urlretrieve(url_c, ckpt_c)
    print(f"Downloaded Candidate C: {os.path.getsize(ckpt_c)} bytes")
    model_c = YOLO(ckpt_c)
    print(f"Candidate C Classes: {model_c.names}")
except Exception as e:
    print(f"Candidate C Error: {e}")

# Candidate D: muaaaa29/Plastic-Waste-Detection-YOLOv8
url_d = "https://huggingface.co/muaaaa29/Plastic-Waste-Detection-YOLOv8/resolve/main/best.pt"
ckpt_d = "scratch/muaaaa_plastic_yolov8.pt"

print(f"\nDownloading Candidate D from {url_d}...")
try:
    if not os.path.exists(ckpt_d):
        urllib.request.urlretrieve(url_d, ckpt_d)
    print(f"Downloaded Candidate D: {os.path.getsize(ckpt_d)} bytes")
    model_d = YOLO(ckpt_d)
    print(f"Candidate D Classes: {model_d.names}")
except Exception as e:
    print(f"Candidate D Error: {e}")
