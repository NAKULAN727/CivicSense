import urllib.request
import json

repos = [
    "barudakwell/floodnet-segformer-model",
    "rbh227/floodnet-segformer",
    "doantrongthai/Flood_Area_Segmentation",
    "SongJuNN/deeplabv3-flood-segmentation",
    "terriblefacehugger/flood_detection_unet",
    "Vabia/Water-Segmentation"
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
