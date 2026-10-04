import urllib.request
import struct
import zlib
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://huggingface.co/xmlyqing00/V-FloodNet/resolve/main/records.zip"
out_path = r"e:\CivicSenseAI\scratch\link_efficientb4_model.pth"

# Offset of local header: 365991501
# Next entry offset: 432873647
start = 365991501
end = 432873647

print(f"Fetching byte range {start}-{end} ({ (end - start)/(1024*1024):.2f} MB)...")
req = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}', 'User-Agent': 'Mozilla/5.0'})

with urllib.request.urlopen(req) as resp:
    data = resp.read()

print(f"Downloaded {len(data)} bytes. Parsing local header...")

# Local file header structure:
# 0..3: signature 0x04034b50 (PK\x03\x04)
# 8..9: compression method (8 = deflate, 0 = store)
# 18..21: compressed size
# 22..25: uncompressed size
# 26..27: filename length
# 28..29: extra field length

sig = data[:4]
if sig != b'PK\x03\x04':
    print(f"Invalid local header signature: {sig}")
    sys.exit(1)

comp_method = struct.unpack('<H', data[8:10])[0]
comp_size = struct.unpack('<I', data[18:22])[0]
uncomp_size = struct.unpack('<I', data[22:26])[0]
fn_len = struct.unpack('<H', data[26:28])[0]
extra_len = struct.unpack('<H', data[28:30])[0]

filename = data[30:30+fn_len].decode('utf-8')
print(f"Header: filename={filename}, method={comp_method}, comp_size={comp_size}, uncomp_size={uncomp_size}")

file_data_start = 30 + fn_len + extra_len
raw_compressed = data[file_data_start:file_data_start + comp_size]
print(f"Extracting compressed data ({len(raw_compressed)} bytes)...")

if comp_method == 8: # Deflate
    decompressed = zlib.decompress(raw_compressed, -15)
elif comp_method == 0:
    decompressed = raw_compressed
else:
    print(f"Unknown compression method {comp_method}")
    sys.exit(1)

print(f"Decompressed {len(decompressed)} bytes (expected: {uncomp_size}). Saving to {out_path}...")
with open(out_path, "wb") as f:
    f.write(decompressed)

print(f"Successfully saved {out_path} ({os.path.getsize(out_path) / (1024*1024):.2f} MB)!")
