import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

for query in ["flood", "water", "waterlogging", "puddle"]:
    models = list(api.list_models(filter="ultralytics", search=query))
    print(f"Filter 'ultralytics' + search '{query}': {len(models)}")
    for m in models:
        print(f"  {m.id} (downloads={getattr(m, 'downloads', 0)})")
