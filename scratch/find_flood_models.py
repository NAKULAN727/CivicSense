import urllib.request
import json
import os

print("=== SEARCHING FOR VERIFIED RGB FLOOD / WATER SEGMENTATION MODELS ===")

keywords = [
    "flood-segmentation",
    "floodnet",
    "water-segmentation",
    "water-segmentation-rgb",
    "flood-detection",
    "street-flood"
]

for kw in keywords:
    url = f"https://huggingface.co/api/models?search={kw}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"\nFound {len(data)} repositories on HF matching '{kw}':")
            for item in data[:10]:
                print(f" - {item['id']}")
    except Exception as e:
        print(f"HF Search Error for '{kw}': {e}")
