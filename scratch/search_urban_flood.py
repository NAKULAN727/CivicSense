import urllib.request
import json

print("=== SEARCHING ROBOFLOW & HUGGINGFACE FOR STREET-LEVEL URBAN FLOOD MODELS ===")

# Search HuggingFace for urban flood, street waterlogging, road flood
queries = ["urban-flood", "street-flood", "waterlogging", "road-flooding", "flood-detection-yolo"]

for q in queries:
    url = f"https://huggingface.co/api/models?search={q}&limit=10"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"\nQuery '{q}': {len(data)} results")
            for item in data:
                print(f" - {item['id']} (downloads: {item.get('downloads', 0)})")
    except Exception as e:
        print(f"Error querying {q}: {e}")
