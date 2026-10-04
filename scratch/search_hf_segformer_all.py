import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

for query in ["water", "flood", "puddle"]:
    models = list(api.list_models(filter="segformer", search=query))
    print(f"Query '{query}' with filter 'segformer': {len(models)} models")
    for m in models:
        print(f"  {m.id} (downloads={getattr(m, 'downloads', 0)})")
