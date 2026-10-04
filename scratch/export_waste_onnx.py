import os
import shutil
import json

print("=== EXPORT & INSPECT WASTE DETECTION ONNX MODEL ===")

ckpt_path = "scratch/hrutik_waste_yolov8.pt"
target_onnx_path = "public/models/waste-detection.onnx"

try:
    from ultralytics import YOLO
    import onnx
    import onnxruntime as ort

    print(f"Loading PyTorch checkpoint from {ckpt_path}...")
    model = YOLO(ckpt_path)

    print("\n1. CHECKPOINT METADATA:")
    print("Class names dictionary in checkpoint:")
    print(model.names)
    num_classes = len(model.names)
    print(f"Total classes: {num_classes}")

    print("\n2. EXPORTING TO ONNX (imgsz=640, static batch=1)...")
    exported_path = model.export(format="onnx", imgsz=640, dynamic=False, simplify=False)
    print(f"Exported to: {exported_path}")

    os.makedirs("public/models", exist_ok=True)
    shutil.copy(exported_path, target_onnx_path)
    print(f"Copied ONNX model to: {target_onnx_path}")
    onnx_size = os.path.getsize(target_onnx_path)
    print(f"ONNX Model File Size: {onnx_size} bytes ({onnx_size / (1024*1024):.2f} MB)")

    print("\n3. INSPECTING ONNX BINARY METADATA:")
    onnx_model = onnx.load(target_onnx_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX Checker: Model structure is valid!")

    session = ort.InferenceSession(target_onnx_path, providers=['CPUExecutionProvider'])
    inputs = session.get_inputs()
    outputs = session.get_outputs()

    print("\nINPUT TENSOR DETAILS:")
    for i in inputs:
        print(f"  Name: '{i.name}'")
        print(f"  Shape: {i.shape}")
        print(f"  Type: {i.type}")

    print("\nOUTPUT TENSOR DETAILS:")
    for o in outputs:
        print(f"  Name: '{o.name}'")
        print(f"  Shape: {o.shape}")
        print(f"  Type: {o.type}")

    summary = {
        "model_file": target_onnx_path,
        "file_size_bytes": onnx_size,
        "class_mapping": model.names,
        "input_name": inputs[0].name,
        "input_shape": inputs[0].shape,
        "input_type": inputs[0].type,
        "output_name": outputs[0].name,
        "output_shape": outputs[0].shape,
        "output_type": outputs[0].type
    }

    with open("scratch/waste_onnx_inspection.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("\nSaved inspection summary to scratch/waste_onnx_inspection.json")

except Exception as e:
    print(f"EXPORT/INSPECTION ERROR: {e}")
    import traceback
    traceback.print_exc()
