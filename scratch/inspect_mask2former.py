import json
from transformers import AutoConfig

try:
    cfg = AutoConfig.from_pretrained("facebook/mask2former-swin-large-mapillary-vistas-semantic")
    print("Loaded config successfully!")
    print(f"Num labels: {len(cfg.id2label)}")
    print(f"Labels: {cfg.id2label}")
except Exception as e:
    print(f"Error loading config: {e}")
