import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

print("Searching for YOLO models with flood/waterlogging/road water...")

yolo_models = []
for q in ["flood", "waterlog", "water-segmentation", "puddle", "road-water"]:
    models = list(api.list_models(search=q, limit=100))
    for m in models:
        tags = getattr(m, 'tags', [])
        m_id = m.id.lower()
        # check if it's a yolo model
        is_yolo = any("yolo" in t.lower() for t in tags) or "yolo" in m_id
        if is_yolo:
            yolo_models.append(m)

print(f"Total matching YOLO models: {len(yolo_models)}")
for m in yolo_models:
    print(f"- {m.id} | downloads={getattr(m, 'downloads', 0)} | tags={getattr(m, 'tags', [])[:6]}")
