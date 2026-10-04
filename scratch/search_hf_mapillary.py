import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

models = list(api.list_models(search="mapillary", limit=100))
print(f"Total mapillary models found: {len(models)}")
for m in models:
    print(f"- {m.id} | pipeline={getattr(m, 'pipeline_tag', None)} | downloads={getattr(m, 'downloads', 0)} | tags={getattr(m, 'tags', [])[:4]}")
