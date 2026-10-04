import urllib.request
import json
import os

print("=== SEARCHING FOR VERIFIED WASTE / LITTER DETECTION MODELS ===")

# Check Hugging Face hub API for waste / litter detection models
url = "https://huggingface.co/api/models?search=waste-detection"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"Found {len(data)} repositories on HF matching 'waste-detection':")
        for item in data[:15]:
            print(f" - {item['id']}")
except Exception as e:
    print(f"HF Search Error: {e}")

url2 = "https://huggingface.co/api/models?search=litter-detection"
try:
    req = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"\nFound {len(data)} repositories on HF matching 'litter-detection':")
        for item in data[:15]:
            print(f" - {item['id']}")
except Exception as e:
    print(f"HF Search Error: {e}")

url3 = "https://huggingface.co/api/models?search=garbage-detection"
try:
    req = urllib.request.Request(url3, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"\nFound {len(data)} repositories on HF matching 'garbage-detection':")
        for item in data[:15]:
            print(f" - {item['id']}")
except Exception as e:
    print(f"HF Search Error: {e}")
