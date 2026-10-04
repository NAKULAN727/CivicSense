import sys
from huggingface_hub import HfApi, hf_hub_download

sys.stdout.reconfigure(encoding='utf-8')
api = HfApi()

repo_id = "xmlyqing00/V-FloodNet"
print(f"=== Inspecting files and sizes in {repo_id} ===")

files_info = api.list_repo_tree(repo_id, repo_type="model")
for item in files_info:
    path = getattr(item, 'path', str(item))
    size = getattr(item, 'size', None)
    size_str = f"{size / (1024*1024):.2f} MB" if size else "Unknown size"
    if any(k in path.lower() for k in ["records", "waternet", "link", "checkpoint", ".pth", ".zip"]):
        print(f"  - {path} ({size_str})")
