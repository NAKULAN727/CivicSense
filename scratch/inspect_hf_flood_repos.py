import urllib.request
import json

repos = [
    "imadd/segformer-b0-finetuned-segments-water-2",
    "doantrongthai/Flood_Area_Segmentation",
    "prithivMLmods/Flood-Image-Detection",
    "SongJuNN/deeplabv3-flood-segmentation",
    "Hoangphii/flood-segmentation-ssl"
]

for repo in repos:
    url = f"https://huggingface.co/api/models/{repo}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"\n==========================================")
            print(f"REPO: {data.get('id')}")
            print(f"License: {data.get('license', 'Unspecified')}")
            print(f"Tags: {data.get('tags', [])}")
            siblings = [s['rfilename'] for s in data.get('siblings', [])]
            print(f"Files: {siblings}")
    except Exception as e:
        print(f"Error inspecting {repo}: {e}")
