import urllib.request
import json

urls_to_test = [
    "https://universe.roboflow.com/henrys-workspace-ds68i/waterlogging-1hcfe",
    "https://universe.roboflow.com/henrys-workspace-ds68i/waterlogging-1hcfe/model",
    "https://api.roboflow.com/henrys-workspace-ds68i/waterlogging-1hcfe",
    "https://universe.roboflow.com/jhonattan-fredy-moreno-bernal/flood-ai"
]

for url in urls_to_test:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[SUCCESS] {url} -> Status {resp.status}")
    except Exception as e:
        print(f"[FAILED] {url} -> {e}")
