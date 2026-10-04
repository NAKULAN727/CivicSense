import urllib.request
import json

repos = [
    "Razeshhh/Waste-detection-yolov8",
    "HrutikAdsare/waste-detection-yolov8",
    "esapzoi/litter-detection-yolov8",
    "aryanshh/litter-detection-yolov8",
    "samraatd/yolov10-waste-detection",
    "muaaaa29/Plastic-Waste-Detection-YOLOv8"
]

for repo in repos:
    print(f"\n==================================================")
    print(f"Files in {repo}:")
    try:
        url = f"https://huggingface.co/api/models/{repo}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if 'siblings' in data:
                for f in data['siblings']:
                    print(f" - {f['rfilename']}")
    except Exception as e:
        print(f" Error: {e}")
