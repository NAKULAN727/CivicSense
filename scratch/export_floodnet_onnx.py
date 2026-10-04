import os
import sys
import shutil
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import torch
from PIL import Image
import numpy as np

print("=== CIVICSENSE AI FLOODNET SEGFORMER ONNX EXPORT ===")

os.makedirs("scratch", exist_ok=True)
os.makedirs("public/models", exist_ok=True)

try:
    from transformers import SegformerForSemanticSegmentation
    import onnx
    import onnxruntime as ort

    model_id = "rbh227/floodnet-segformer"
    print(f"Loading Hugging Face Segformer model {model_id}...")
    
    model = SegformerForSemanticSegmentation.from_pretrained(model_id)
    model.eval()

    print("\n1. MODEL CLASS METADATA (id2label):")
    id2label = model.config.id2label
    print(id2label)
    print(f"Total classes: {len(id2label)}")

    # Export to ONNX (static shape [1, 3, 512, 512])
    target_onnx_path = "public/models/flood-water-segmentation.onnx"
    dummy_input = torch.randn(1, 3, 512, 512)

    print("\n2. EXPORTING TO ONNX (imgsz=512x512, static batch=1)...")
    torch.onnx.export(
        model,
        dummy_input,
        "scratch/floodnet_segformer.onnx",
        input_names=["images"],
        output_names=["output0"],
        opset_version=18,
        dynamic_axes=None
    )
    print("PyTorch ONNX Export complete!")

    raw_onnx_path = "scratch/floodnet_segformer.onnx"
    onnx_model = onnx.load(raw_onnx_path)
    # Save as a single self-contained binary file without external data dependencies
    onnx.save_model(onnx_model, target_onnx_path, save_as_external_data=False)
    
    onnx_size = os.path.getsize(target_onnx_path)
    print(f"Saved self-contained ONNX model to: {target_onnx_path}")
    print(f"ONNX Model File Size: {onnx_size} bytes ({onnx_size / (1024*1024):.2f} MB)")

    print("\n3. INSPECTING ONNX BINARY METADATA:")
    onnx_model_verify = onnx.load(target_onnx_path)
    onnx.checker.check_model(onnx_model_verify)
    print("ONNX Checker: Model structure is valid!")

    session = ort.InferenceSession(target_onnx_path, providers=['CPUExecutionProvider'])
    inputs_onnx = session.get_inputs()
    outputs_onnx = session.get_outputs()

    print("\nINPUT TENSOR DETAILS:")
    for i in inputs_onnx:
        print(f"  Name: '{i.name}'")
        print(f"  Shape: {i.shape}")
        print(f"  Type: {i.type}")

    print("\nOUTPUT TENSOR DETAILS:")
    for o in outputs_onnx:
        print(f"  Name: '{o.name}'")
        print(f"  Shape: {o.shape}")
        print(f"  Type: {o.type}")

    # Save summary metadata JSON
    summary = {
        "model_id": model_id,
        "model_file": target_onnx_path,
        "file_size_bytes": onnx_size,
        "architecture": "SegformerForSemanticSegmentation (MiT-B0)",
        "dataset": "FloodNet (CVPR FloodNet Challenge)",
        "id2label": id2label,
        "input_name": inputs_onnx[0].name,
        "input_shape": inputs_onnx[0].shape,
        "input_type": inputs_onnx[0].type,
        "output_name": outputs_onnx[0].name,
        "output_shape": outputs_onnx[0].shape,
        "output_type": outputs_onnx[0].type
    }

    with open("scratch/flood_onnx_inspection.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("\nSaved inspection summary to scratch/flood_onnx_inspection.json")

except Exception as e:
    print(f"EXPORT ERROR: {e}")
    import traceback
    traceback.print_exc()
