import sys
import os
import torch
import torch.nn as nn
import segmentation_models_pytorch as smp
import segmentation_models_pytorch.decoders.linknet as smp_linknet
import efficientnet_pytorch.utils as ef_utils
import onnx
import onnxruntime as ort
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# Aliases for loading pickled checkpoint
ef_utils.Identity = nn.Identity
sys.modules['segmentation_models_pytorch.linknet'] = smp_linknet
sys.modules['segmentation_models_pytorch.linknet.model'] = smp_linknet

pth_path = r"e:\CivicSenseAI\scratch\link_efficientb4_model.pth"
onnx_path = r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx"

print(f"Loading {pth_path}...")
loaded_model = torch.load(pth_path, map_location='cpu', weights_only=False)
sd = loaded_model.state_dict()

print("Creating clean smp.Linknet model...")
fresh_model = smp.Linknet(
    encoder_name='efficientnet-b4',
    encoder_weights=None,
    in_channels=3,
    classes=1,
    activation='sigmoid'
)
fresh_model.load_state_dict(sd, strict=True)
fresh_model.eval()

dummy_input = torch.randn(1, 3, 416, 416, dtype=torch.float32)

print(f"Exporting to ONNX at {onnx_path}...")
torch.onnx.export(
    fresh_model,
    dummy_input,
    onnx_path,
    input_names=['input_image'],
    output_names=['water_probability'],
    dynamic_axes={'input_image': {0: 'batch'}, 'water_probability': {0: 'batch'}},
    opset_version=14,
    dynamo=False
)

file_size_mb = os.path.getsize(onnx_path) / (1024 * 1024)
print(f"Export complete! ONNX file size: {file_size_mb:.2f} MB")

# Verify ONNX model
print("Verifying ONNX graph...")
onnx_model = onnx.load(onnx_path)
onnx.checker.check_model(onnx_model)
print("ONNX model checker passed successfully!")

# Test with ONNX Runtime CPUExecutionProvider
print("Testing inference with ONNX Runtime...")
session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
in_name = session.get_inputs()[0].name
in_shape = session.get_inputs()[0].shape
out_name = session.get_outputs()[0].name
out_shape = session.get_outputs()[0].shape

print(f"ONNX Input: name='{in_name}', shape={in_shape}")
print(f"ONNX Output: name='{out_name}', shape={out_shape}")

test_in = np.random.randn(1, 3, 416, 416).astype(np.float32)
ort_out = session.run([out_name], {in_name: test_in})[0]

print(f"ONNX Runtime inference success! Output shape: {ort_out.shape}, min={ort_out.min():.4f}, max={ort_out.max():.4f}")
