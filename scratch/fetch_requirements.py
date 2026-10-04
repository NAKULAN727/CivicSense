import urllib.request

url = "https://raw.githubusercontent.com/xmlyqing00/V-FloodNet/main/requirements.txt"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        print("=== requirements.txt ===")
        print(resp.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
