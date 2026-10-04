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
print(f"Loading {pth_path} with alias mapping and Identity patch...")

try:
    model = torch.load(pth_path, map_location='cpu', weights_only=False)
    print("SUCCESSFULLY LOADED MODEL!")
    print(f"Type: {type(model)}")
    print(f"Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Test dummy inference on CPU
    dummy = torch.randn(1, 3, 416, 416)
    model.eval()
    with torch.no_grad():
        out = model(dummy)
    print(f"Forward pass output shape: {out.shape}, min={out.min().item():.4f}, max={out.max().item():.4f}")
except Exception as e:
    import traceback
    traceback.print_exc()
