import urllib.request
import json

url = "https://huggingface.co/rbh227/floodnet-segformer/raw/main/config.json"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        config = json.loads(response.read().decode())
        print("rbh227/floodnet-segformer Config:")
        print(json.dumps(config, indent=2))
except Exception as e:
    print(f"Error reading config: {e}")
