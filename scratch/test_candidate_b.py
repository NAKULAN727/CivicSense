import os
import shutil
from ultralytics import YOLO
import onnxruntime as ort
import numpy as np
from PIL import Image

print("=== TESTING CANDIDATE B: esapzoi/litter-detection-yolov8 ===")

ckpt_b = "scratch/esapzoi_litter_yolov8.pt"
model = YOLO(ckpt_b)
print(f"Classes: {model.names}")

exported_path = model.export(format="onnx", imgsz=640, dynamic=False)
print(f"Exported candidate B to {exported_path}")

session = ort.InferenceSession(exported_path, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

def test_img(img_path):
    if not os.path.exists(img_path): return
    img = Image.open(img_path).convert('RGB')
    w_orig, h_orig = img.size
    
    scale = min(640.0 / w_orig, 640.0 / h_orig)
    nw = int(round(w_orig * scale))
    nh = int(round(h_orig * scale))
    pad_x = (640.0 - nw) / 2.0
    pad_y = (640.0 - nh) / 2.0
    
    img_resized = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new('RGB', (640, 640), (114, 114, 114))
    canvas.paste(img_resized, (int(pad_x), int(pad_y)))
    
    arr = np.array(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    inp = np.expand_dims(arr, axis=0)
    
    outputs = session.run([output_name], {input_name: inp})[0][0] # [5, 8400]
    scores = outputs[4, :] # 1 class (Litter)
    
    max_score = float(np.max(scores)) if scores.size > 0 else 0.0
    print(f"\nImage: {os.path.basename(img_path)}")
    print(f"  Highest Litter Score: {max_score:.4f} ({max_score*100:.2f}%)")
    
    above_50 = np.sum(scores >= 0.50)
    above_40 = np.sum(scores >= 0.40)
    above_30 = np.sum(scores >= 0.30)
    print(f"  Candidates >= 50%: {above_50}, >= 40%: {above_40}, >= 30%: {above_30}")

test_img("public/assets/garbage_drone.png")
test_img("public/assets/potholes_drone.png")
test_img("public/assets/flooding_drone.png")
test_img("public/assets/satellite_recent.jpg")
