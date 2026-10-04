import os
from ultralytics import YOLO
import onnxruntime as ort
import numpy as np
from PIL import Image

print("=== TESTING CANDIDATE D: muaaaa29/Plastic-Waste-Detection-YOLOv8 ===")

ckpt_d = "scratch/muaaaa_plastic_yolov8.pt"
model_d = YOLO(ckpt_d)
print(f"Candidate D Classes: {model_d.names}")

exported_d = model_d.export(format="onnx", imgsz=640, dynamic=False)
print(f"Exported Candidate D: {exported_d}")

session_d = ort.InferenceSession(exported_d, providers=['CPUExecutionProvider'])
input_name_d = session_d.get_inputs()[0].name
output_name_d = session_d.get_outputs()[0].name

def test_cand_d(img_path):
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
    
    outputs = session_d.run([output_name_d], {input_name_d: inp})[0][0] # [11, 8400]
    scores = outputs[4:11, :]
    
    max_score = float(np.max(scores)) if scores.size > 0 else 0.0
    max_idx = np.unravel_index(np.argmax(scores), scores.shape)
    cls_name = model_d.names[max_idx[0]]
    
    print(f"\nImage: {os.path.basename(img_path)}")
    print(f"  Highest Score: {max_score:.4f} ({max_score*100:.2f}%) - Class: {cls_name}")
    print(f"  Candidates >= 50%: {np.sum(scores >= 0.50)}, >= 40%: {np.sum(scores >= 0.40)}, >= 30%: {np.sum(scores >= 0.30)}")

test_cand_d("public/assets/garbage_drone.png")
test_cand_d("public/assets/potholes_drone.png")
test_cand_d("public/assets/flooding_drone.png")
test_cand_d("public/assets/satellite_recent.jpg")
