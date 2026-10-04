import urllib.request
import json
import sys
from huggingface_hub import HfApi

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

repo_id = "xmlyqing00/V-FloodNet"
print(f"=== Checking Hugging Face repo: {repo_id} ===")

try:
    info = api.repo_info(repo_id, repo_type="model")
    print(f"Model exists! Private: {info.private}")
    files = api.list_repo_files(repo_id, repo_type="model")
    print(f"Files in repo ({len(files)}):")
    for f in files:
        print(f"  - {f}")
except Exception as e:
    print(f"Error checking {repo_id} as model: {e}")

try:
    info = api.repo_info(repo_id, repo_type="dataset")
    print(f"Dataset exists! Private: {info.private}")
    files = api.list_repo_files(repo_id, repo_type="dataset")
    print(f"Files in dataset repo ({len(files)}):")
    for f in files:
        print(f"  - {f}")
except Exception as e:
    print(f"Error checking {repo_id} as dataset: {e}")
