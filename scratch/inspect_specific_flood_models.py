from huggingface_hub import HfApi, model_info
from transformers import AutoConfig

candidates = [
    "Tianmu28/segformer-b0-segments-floods",
    "Tianmu28/segformer-flood-images-finetuned",
    "abiramikandasamy03/aifloodsense-flood-model",
    "siavava/segformer-waterline-detection"
]

for c in candidates:
    print(f"\n=================== {c} ===================")
    try:
        info = model_info(c)
        print(f"Author / Tags: {info.tags}")
        print(f"Downloads: {info.downloads}")
        print(f"Description snippet: {info.card_data}")
    except Exception as e:
        print(f"Error getting info: {e}")
        
    try:
        cfg = AutoConfig.from_pretrained(c)
        print(f"id2label: {cfg.id2label}")
        print(f"num_labels: {len(cfg.id2label)}")
    except Exception as e:
        print(f"Error getting config: {e}")
