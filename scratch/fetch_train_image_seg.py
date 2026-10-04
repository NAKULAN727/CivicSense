import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://raw.githubusercontent.com/xmlyqing00/V-FloodNet/main/train_image_seg.py"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
        print(f"=== train_image_seg.py ({len(content)} chars) ===")
        print(content[:3000])
except Exception as e:
    print(f"Error fetching train_image_seg.py: {e}")
