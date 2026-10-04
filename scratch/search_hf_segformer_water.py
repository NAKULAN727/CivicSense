import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

models = list(api.list_models(search="segformer", limit=200))
print(f"Total segformer models scanned: {len(models)}")
relevant = []
for m in models:
    m_id = m.id.lower()
    if any(k in m_id for k in ["water", "flood", "puddle", "road", "street", "urban", "driving", "anomaly"]):
        relevant.append(m)

print(f"Relevant SegFormer models found: {len(relevant)}")
for m in relevant:
    downloads = getattr(m, 'downloads', 0)
    print(f"- {m.id} | downloads={downloads} | tags={getattr(m, 'tags', [])[:5]}")
