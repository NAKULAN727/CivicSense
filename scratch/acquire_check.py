import urllib.request
import json
import os

print("Searching for verified RDD2022 models...")

# Check Hugging Face hub API for RDD2022 models
url = "https://huggingface.co/api/models?search=rdd2022"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"Found {len(data)} repositories on HF matching 'rdd2022':")
        for item in data[:10]:
            print(f" - {item['id']}")
except Exception as e:
    print(f"HF Search Error: {e}")

# Check specific model: rezzzq/yolo12s-road-damage-rdd2022
model_id = "rezzzq/yolo12s-road-damage-rdd2022"
files_url = f"https://huggingface.co/api/models/{model_id}"
try:
    req = urllib.request.Request(files_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"\nFiles in {model_id}:")
        if 'siblings' in data:
            for f in data['siblings']:
                print(f" - {f['rfilename']}")
except Exception as e:
    print(f"Model file check error for {model_id}: {e}")
