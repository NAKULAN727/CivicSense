import sys
import torch
import torch.nn as nn
import segmentation_models_pytorch.decoders.linknet as smp_linknet
import efficientnet_pytorch.utils as ef_utils

ef_utils.Identity = nn.Identity
sys.modules['segmentation_models_pytorch.linknet'] = smp_linknet
sys.modules['segmentation_models_pytorch.linknet.model'] = smp_linknet

pth_path = r"e:\CivicSenseAI\scratch\link_efficientb4_model.pth"
model = torch.load(pth_path, map_location='cpu', weights_only=False)

sd = model.state_dict()
print(f"Total state_dict keys: {len(sd)}")
print("Sample keys:")
for k in list(sd.keys())[:15]:
    print(f"  {k}: {sd[k].shape}")
for k in list(sd.keys())[-10:]:
    print(f"  {k}: {sd[k].shape}")
