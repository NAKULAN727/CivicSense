import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://raw.githubusercontent.com/xmlyqing00/V-FloodNet/main/test_image_seg.py"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
        print(f"=== test_image_seg.py ({len(content)} chars) ===")
        print(content)
except Exception as e:
    print(f"Error fetching test_image_seg.py: {e}")
