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
print(f"Loading pickled model state_dict...")
loaded_model = torch.load(pth_path, map_location='cpu', weights_only=False)
sd = loaded_model.state_dict()

print("Instantiating fresh smp.Linknet('efficientnet-b4', in_channels=3, classes=1)...")
fresh_model = smp.Linknet(
    encoder_name='efficientnet-b4',
    encoder_weights=None,
    in_channels=3,
    classes=1,
    activation='sigmoid'
)

missing, unexpected = fresh_model.load_state_dict(sd, strict=False)
print(f"Loaded into fresh model! Missing keys: {len(missing)}, Unexpected keys: {len(unexpected)}")
if missing:
    print(f"Sample missing: {missing[:5]}")
if unexpected:
    print(f"Sample unexpected: {unexpected[:5]}")

fresh_model.eval()
dummy = torch.randn(1, 3, 416, 416)
with torch.no_grad():
    out = fresh_model(dummy)

print(f"FRESH MODEL FORWARD SUCCESS! Output shape: {out.shape}, min={out.min().item():.4f}, max={out.max().item():.4f}, mean={out.mean().item():.4f}")
