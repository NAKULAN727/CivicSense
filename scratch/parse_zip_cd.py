import urllib.request
import struct

url = "https://huggingface.co/xmlyqing00/V-FloodNet/resolve/main/records.zip"

# 1. Get file size
req = urllib.request.Request(url, headers={'Range': 'bytes=0-0', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    size = int(resp.headers.get('Content-Range').split('/')[-1])

print(f"File size: {size} bytes ({size/(1024*1024):.2f} MB)")

# 2. Read last 65536 bytes
tail_len = min(size, 65536)
start = size - tail_len
req = urllib.request.Request(url, headers={'Range': f'bytes={start}-{size-1}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    tail_data = resp.read()

# 3. Find EOCD signature: 0x06054b50 (PK\x05\x06)
eocd_pos = tail_data.rfind(b'PK\x05\x06')
if eocd_pos == -1:
    print("EOCD not found in last 64KB")
    sys.exit(1)

# EOCD structure:
# offset 12: size of central directory (4 bytes)
# offset 16: offset of central directory with respect to start of disk (4 bytes)
cd_size = struct.unpack('<I', tail_data[eocd_pos+12:eocd_pos+16])[0]
cd_offset = struct.unpack('<I', tail_data[eocd_pos+16:eocd_pos+20])[0]

print(f"Central directory offset: {cd_offset}, size: {cd_size}")

# 4. Fetch Central Directory
req = urllib.request.Request(url, headers={'Range': f'bytes={cd_offset}-{cd_offset+cd_size-1}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    cd_data = resp.read()

# 5. Parse Central Directory headers (PK\x01\x02)
pos = 0
entries = []
while pos < len(cd_data):
    if cd_data[pos:pos+4] != b'PK\x01\x02':
        break
    
    comp_size = struct.unpack('<I', cd_data[pos+20:pos+24])[0]
    uncomp_size = struct.unpack('<I', cd_data[pos+24:pos+28])[0]
    fn_len = struct.unpack('<H', cd_data[pos+28:pos+30])[0]
    extra_len = struct.unpack('<H', cd_data[pos+30:pos+32])[0]
    comment_len = struct.unpack('<H', cd_data[pos+32:pos+34])[0]
    local_header_offset = struct.unpack('<I', cd_data[pos+42:pos+46])[0]
    
    filename = cd_data[pos+46:pos+46+fn_len].decode('utf-8', errors='ignore')
    entries.append({
        'filename': filename,
        'uncompressed_mb': uncomp_size / (1024*1024),
        'compressed_mb': comp_size / (1024*1024),
        'offset': local_header_offset
    })
    
    pos += 46 + fn_len + extra_len + comment_len

print(f"\nFound {len(entries)} files in records.zip:")
for e in entries:
    print(f"- {e['filename']} (uncomp: {e['uncompressed_mb']:.2f} MB, comp: {e['compressed_mb']:.2f} MB, offset: {e['offset']})")
