import torch
import sys

sys.stdout.reconfigure(encoding='utf-8')

pth_path = r"e:\CivicSenseAI\scratch\link_efficientb4_model.pth"
print(f"Loading {pth_path} with torch.load...")

try:
    obj = torch.load(pth_path, map_location='cpu', weights_only=False)
    print(f"Loaded object type: {type(obj)}")
    if isinstance(obj, dict):
        print(f"Keys in dict: {list(obj.keys())[:10]}")
    elif hasattr(obj, 'eval'):
        print("Object is an instantiated PyTorch nn.Module!")
        print(f"Model class name: {obj.__class__.__name__}")
        print(f"Model architecture snippet:")
        print(str(obj)[:1000])
        print(f"Parameters count: {sum(p.numel() for p in obj.parameters()):,}")
except Exception as e:
    print(f"Error loading checkpoint: {e}")
