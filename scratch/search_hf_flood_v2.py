import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

queries = ["flood", "waterlog", "puddle", "urban flood", "road flood", "water segmentation"]

found_models = {}

for q in queries:
    models = api.list_models(search=q, limit=40)
    for m in models:
        if m.id not in found_models:
            found_models[m.id] = {
                'id': m.id,
                'downloads': getattr(m, 'downloads', 0),
                'likes': getattr(m, 'likes', 0),
                'pipeline_tag': getattr(m, 'pipeline_tag', None),
                'tags': getattr(m, 'tags', [])
            }

print(f"Total unique models found: {len(found_models)}")
for m_id, info in sorted(found_models.items(), key=lambda x: x[1]['downloads'] or 0, reverse=True)[:35]:
    print(f"- {m_id} | pipeline: {info['pipeline_tag']} | downloads: {info['downloads']} | tags: {info['tags'][:5]}")
