import urllib.request
import json

queries = ['water-segmentation', 'puddle', 'flood-segmentation', 'deeplabv3-water', 'segformer-water', 'waterlogging']

for q in queries:
    url = f"https://huggingface.co/api/models?search={q}&limit=10"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"=== Query: '{q}' (Found {len(data)}) ===")
            for item in data:
                print(f" - {item['id']} (downloads: {item.get('downloads', 0)}, tags: {item.get('tags', [])[:3]})")
    except Exception as e:
        print(f"Error for '{q}': {e}")
