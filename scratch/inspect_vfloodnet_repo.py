import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

repo = "xmlyqing00/V-FloodNet"
headers = {'User-Agent': 'Mozilla/5.0'}

def get_json(url):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

print(f"=== Inspecting GitHub repo: {repo} ===")
repo_info = get_json(f"https://api.github.com/repos/{repo}")
if repo_info:
    print(f"Name: {repo_info.get('full_name')}")
    print(f"Description: {repo_info.get('description')}")
    print(f"License: {repo_info.get('license')}")
    print(f"Default branch: {repo_info.get('default_branch')}")
    print(f"Archived: {repo_info.get('archived')}")
else:
    print("Repo info could not be fetched or repo does not exist/is private.")

print("\n=== Checking Releases ===")
releases = get_json(f"https://api.github.com/repos/{repo}/releases")
if releases:
    print(f"Found {len(releases)} releases:")
    for r in releases:
        print(f"- Tag: {r.get('tag_name')}, Name: {r.get('name')}")
        for asset in r.get('assets', []):
            print(f"  Asset: {asset.get('name')} ({asset.get('size')} bytes) -> {asset.get('browser_download_url')}")
else:
    print("No releases found.")

print("\n=== Checking Repository Contents (Root) ===")
contents = get_json(f"https://api.github.com/repos/{repo}/contents")
if contents:
    for item in contents:
        print(f"- {item.get('name')} ({item.get('type')}, size={item.get('size')})")
