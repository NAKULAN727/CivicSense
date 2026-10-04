import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

for tag in ["image-segmentation", "object-detection"]:
    print(f"\n=== Searching pipeline_tag: {tag} ===")
    for keyword in ["flood", "water", "puddle", "waterlogging"]:
        models = list(api.list_models(filter=tag, search=keyword, limit=50))
        for m in models:
            m_id = m.id
            if m_id.startswith("imadd/"): # Skip rejected model
                continue
            tags = getattr(m, 'tags', [])
            downloads = getattr(m, 'downloads', 0)
            print(f"[{keyword}] {m_id} | downloads={downloads} | tags={tags[:6]}")
