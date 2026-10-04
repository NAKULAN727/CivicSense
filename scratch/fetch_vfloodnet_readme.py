import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://raw.githubusercontent.com/xmlyqing00/V-FloodNet/main/README.md"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
        print(f"=== README.md ({len(content)} chars) ===")
        print(content[:3000])
        print("\n... [MIDDLE] ...\n")
        print(content[3000:6000])
        print("\n... [REST] ...\n")
        print(content[6000:])
except Exception as e:
    print(f"Error fetching README: {e}")
