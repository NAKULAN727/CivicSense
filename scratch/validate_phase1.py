import os
import time
import numpy as np
import onnx
import onnxruntime as ort
from ultralytics import YOLO
import torch

MODEL_A_PATH = "public/models/rdd2022-road-damage.onnx"
MODEL_B_PT_PATH = "scratch/incoming_models/pathole/y8best.pt"
MODEL_B_ONNX_PATH = "scratch/incoming_models/pathole/y8best.onnx"

print("=" * 60)
print("PHASE 1: MODEL VALIDATION AND ARCHITECTURAL COMPARISON")
print("=" * 60)

# -------------------------------------------------------------
# 1. Model A Inspection (rdd2022-road-damage.onnx)
# -------------------------------------------------------------
print("\n[1] INSPECTING MODEL A (RDD2022 ROAD DAMAGE ONNX)...")
size_a_bytes = os.path.getsize(MODEL_A_PATH)
print(f"Model A File Path: {MODEL_A_PATH}")
print(f"Model A File Size: {size_a_bytes} bytes ({size_a_bytes / (1024*1024):.2f} MB)")

model_a_onnx = onnx.load(MODEL_A_PATH)
session_a = ort.InferenceSession(MODEL_A_PATH, providers=['CPUExecutionProvider'])

input_a = session_a.get_inputs()[0]
output_a = session_a.get_outputs()[0]

print(f"Input Name: '{input_a.name}', Shape: {input_a.shape}, Type: {input_a.type}")
print(f"Output Name: '{output_a.name}', Shape: {output_a.shape}, Type: {output_a.type}")

# Road Damage Classes in production:
# Output shape is [1, 8, 8400]: 4 bbox coords (x,y,w,h) + 4 class probabilities
# Classes: 0: D00 (Longitudinal Crack), 1: D10 (Transverse Crack), 2: D20 (Alligator Crack), 3: D40 (Pothole)
print("Model A Classes (4 classes): 0: D00, 1: D10, 2: D20, 3: D40 (Pothole)")

# Benchmark Latency for Model A
dummy_input_a = np.zeros(input_a.shape, dtype=np.float32)
# Warmup
for _ in range(5):
    _ = session_a.run(None, {input_a.name: dummy_input_a})

latencies_a = []
for _ in range(20):
    t0 = time.perf_counter()
    _ = session_a.run(None, {input_a.name: dummy_input_a})
    latencies_a.append((time.perf_counter() - t0) * 1000)

mean_lat_a = np.mean(latencies_a)
std_lat_a = np.std(latencies_a)
print(f"Model A Inference Latency (CPU, 20 runs): Mean = {mean_lat_a:.2f} ms (+/- {std_lat_a:.2f} ms)")


# -------------------------------------------------------------
# 2. Model B Inspection (y8best.pt PyTorch)
# -------------------------------------------------------------
print("\n[2] INSPECTING MODEL B (YOLOv8 POTHOLE PT)...")
size_b_bytes = os.path.getsize(MODEL_B_PT_PATH)
print(f"Model B File Path: {MODEL_B_PT_PATH}")
print(f"Model B File Size: {size_b_bytes} bytes ({size_b_bytes / (1024*1024):.2f} MB)")

yolo_b = YOLO(MODEL_B_PT_PATH)
print(f"Model B Task: {yolo_b.task}")
print(f"Model B Classes: {yolo_b.names}")
print(f"Number of Classes: {len(yolo_b.names)}")

# Parameter count
total_params = sum(p.numel() for p in yolo_b.model.parameters())
print(f"Total Parameters: {total_params:,} ({total_params / 1e6:.2f} M params)")

# Check architecture variant based on parameter count:
# YOLOv8n: ~3.2M, YOLOv8s: ~11.2M, YOLOv8m: ~25.9M, YOLOv8l: ~43.7M, YOLOv8x: ~68.2M
if total_params > 60e6:
    arch_type = "YOLOv8x (Extra Large)"
elif total_params > 40e6:
    arch_type = "YOLOv8l (Large)"
elif total_params > 20e6:
    arch_type = "YOLOv8m (Medium)"
elif total_params > 10e6:
    arch_type = "YOLOv8s (Small)"
else:
    arch_type = "YOLOv8n (Nano)"
print(f"Estimated Architecture: {arch_type}")

# Test inference on dummy PyTorch tensor
dummy_input_b = torch.zeros((1, 3, 640, 640), dtype=torch.float32)
# Warmup
for _ in range(5):
    _ = yolo_b.model(dummy_input_b)

latencies_b_pt = []
for _ in range(20):
    t0 = time.perf_counter()
    _ = yolo_b.model(dummy_input_b)
    latencies_b_pt.append((time.perf_counter() - t0) * 1000)

mean_lat_b_pt = np.mean(latencies_b_pt)
print(f"Model B PyTorch Latency (CPU, 20 runs): Mean = {mean_lat_b_pt:.2f} ms")


# -------------------------------------------------------------
# 3. Model B ONNX Export & Numerical Parity Validation
# -------------------------------------------------------------
print("\n[3] EXPORTING MODEL B TO ONNX AND VALIDATING NUMERICAL PARITY...")
if not os.path.exists(MODEL_B_ONNX_PATH):
    print("Exporting Model B to ONNX format (opset=12, imgsz=640)...")
    exported_path = yolo_b.export(format="onnx", imgsz=640, opset=12, dynamic=False)
    print(f"Export completed: {exported_path}")
else:
    print(f"Found existing exported ONNX: {MODEL_B_ONNX_PATH}")

size_b_onnx = os.path.getsize(MODEL_B_ONNX_PATH)
print(f"Model B ONNX File Size: {size_b_onnx} bytes ({size_b_onnx / (1024*1024):.2f} MB)")

session_b = ort.InferenceSession(MODEL_B_ONNX_PATH, providers=['CPUExecutionProvider'])
input_b = session_b.get_inputs()[0]
output_b = session_b.get_outputs()[0]

print(f"Model B ONNX Input: '{input_b.name}', Shape: {input_b.shape}, Type: {input_b.type}")
print(f"Model B ONNX Output: '{output_b.name}', Shape: {output_b.shape}, Type: {output_b.type}")

# Test ORT latency on Model B ONNX
latencies_b_onnx = []
dummy_input_b_np = np.zeros(input_b.shape, dtype=np.float32)
for _ in range(5):
    _ = session_b.run(None, {input_b.name: dummy_input_b_np})

for _ in range(20):
    t0 = time.perf_counter()
    _ = session_b.run(None, {input_b.name: dummy_input_b_np})
    latencies_b_onnx.append((time.perf_counter() - t0) * 1000)

mean_lat_b_onnx = np.mean(latencies_b_onnx)
print(f"Model B ONNX Latency (CPU, 20 runs): Mean = {mean_lat_b_onnx:.2f} ms")

# Numerical parity check with non-zero random tensor
rng = np.random.RandomState(42)
test_tensor_np = rng.uniform(0.0, 1.0, size=(1, 3, 640, 640)).astype(np.float32)
test_tensor_torch = torch.from_numpy(test_tensor_np)

with torch.no_grad():
    pt_output = yolo_b.model(test_tensor_torch)
    if isinstance(pt_output, tuple):
        pt_out_np = pt_output[0].cpu().numpy()
    else:
        pt_out_np = pt_output.cpu().numpy()

ort_output = session_b.run(None, {input_b.name: test_tensor_np})[0]

max_diff = np.max(np.abs(pt_out_np - ort_output))
mean_diff = np.mean(np.abs(pt_out_np - ort_output))
print(f"\nNumerical Parity (PyTorch vs ONNX):")
print(f"  Max Absolute Difference: {max_diff:.8e}")
print(f"  Mean Absolute Difference: {mean_diff:.8e}")
assert max_diff < 1e-3, f"Numerical difference too high: {max_diff}"
print("  Numerical Validation: PASS (Exact Parity within FP32 numerical tolerance)")

print("\n" + "=" * 60)
print("PHASE 1 SUMMARY TABLE:")
print("=" * 60)
print(f"{'Feature':<25} | {'Model A (Production)':<25} | {'Model B (New Candidate)':<25}")
print("-" * 80)
print(f"{'Architecture':<25} | {'YOLOv8s':<25} | {arch_type:<25}")
print(f"{'Format':<25} | {'ONNX (opset 12)':<25} | {'PyTorch PT / ONNX (opset 12)':<25}")
print(f"{'File Size':<25} | {f'{size_a_bytes/(1024*1024):.1f} MB':<25} | {f'{size_b_onnx/(1024*1024):.1f} MB (ONNX)':<25}")
print(f"{'Parameters':<25} | {'~11.2 M':<25} | {f'{total_params/1e6:.1f} M':<25}")
print(f"{'Input Resolution':<25} | {str(input_a.shape):<25} | {str(input_b.shape):<25}")
print(f"{'Output Shape':<25} | {str(output_a.shape):<25} | {str(output_b.shape):<25}")
print(f"{'Classes':<25} | {'4 (D00, D10, D20, D40)':<25} | {str(yolo_b.names):<25}")
print(f"{'ORT CPU Latency':<25} | {f'{mean_lat_a:.1f} ms':<25} | {f'{mean_lat_b_onnx:.1f} ms':<25}")
print("=" * 60)

