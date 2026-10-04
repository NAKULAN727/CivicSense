import urllib.request
import zipfile
import io

url = "https://huggingface.co/xmlyqing00/V-FloodNet/resolve/main/records.zip"
print(f"Checking Range requests on {url}...")

req = urllib.request.Request(url, headers={'Range': 'bytes=0-10', 'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        print(f"Status: {resp.status}, Content-Range: {resp.headers.get('Content-Range')}")
        print("Range requests are supported!")
except Exception as e:
    print(f"Range request failed: {e}")
