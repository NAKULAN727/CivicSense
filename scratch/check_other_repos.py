import urllib.request
import json

repos = [
    "duongng2911/rt-detr-resnet-50-dc5-rdd2022-finetuned",
    "SreekarAditya/yolo-rdd2022-benchmark",
    "Phongwit/YOLO_RDD2022"
]

for repo in repos:
    print(f"\nFiles in {repo}:")
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
