import sys
import torch
import torch.nn as nn
import segmentation_models_pytorch as smp
import segmentation_models_pytorch.decoders.linknet as smp_linknet
import efficientnet_pytorch.utils as ef_utils

ef_utils.Identity = nn.Identity
sys.modules['segmentation_models_pytorch.linknet'] = smp_linknet
sys.modules['segmentation_models_pytorch.linknet.model'] = smp_linknet

pth_path = r"e:\CivicSenseAI\scratch\link_efficientb4_model.pth"
print(f"Loading {pth_path}...")

model = torch.load(pth_path, map_location='cpu', weights_only=False)
model.check_input_shape = lambda x: None
model.encoder._drop_connect_rate = 0.0
model.eval()

print("Testing forward pass...")
dummy = torch.randn(1, 3, 416, 416)
with torch.no_grad():
    out = model(dummy)

print(f"SUCCESS! Output shape: {out.shape}, min={out.min().item():.4f}, max={out.max().item():.4f}, mean={out.mean().item():.4f}")
