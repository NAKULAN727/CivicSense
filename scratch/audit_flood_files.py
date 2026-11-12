import os
import glob
import hashlib
from PIL import Image
import json

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

print(f"Total entries in {folder}: {len(files)}")

audit_records = []
sha256_map = {}

for fname in files:
    fpath = os.path.join(folder, fname)
    is_file = os.path.isfile(fpath)
    file_size_bytes = os.path.getsize(fpath) if is_file else 0
    
    # Compute SHA-256
    sha256_hash = hashlib.sha256()
    is_corrupted = False
    corruption_error = None
    width, height, format_type, mode = None, None, None, None
    
    if is_file:
        try:
            with open(fpath, "rb") as f:
                for byte_block in iter(lambda: f.read(65536), b""):
                    sha256_hash.update(byte_block)
            sha256_hex = sha256_hash.hexdigest()
            
            # Open and verify PIL Image
            with Image.open(fpath) as img:
                img.verify() # verify integrity
            
            # Reopen to read dimensions & mode (verify closes file)
            with Image.open(fpath) as img:
                width, height = img.size
                format_type = img.format
                mode = img.mode
        except Exception as e:
            is_corrupted = True
            corruption_error = str(e)
            sha256_hex = sha256_hash.hexdigest() if file_size_bytes > 0 else "N/A"
    else:
        is_corrupted = True
        corruption_error = "Not a regular file (directory or symlink)"
        sha256_hex = "N/A"

    is_duplicate = False
    duplicate_of = None
    if sha256_hex in sha256_map:
        is_duplicate = True
        duplicate_of = sha256_map[sha256_hex]
    else:
        if not is_corrupted:
            sha256_map[sha256_hex] = fname

    audit_records.append({
        'filename': fname,
        'filepath': fpath,
        'filesize_bytes': file_size_bytes,
        'filesize_kb': round(file_size_bytes / 1024, 2),
        'is_corrupted': is_corrupted,
        'corruption_error': corruption_error,
        'format': format_type,
        'mode': mode,
        'width': width,
        'height': height,
        'total_pixels': width * height if width and height else 0,
        'aspect_ratio': round(width / height, 2) if width and height else 0,
        'sha256': sha256_hex,
        'is_duplicate': is_duplicate,
        'duplicate_of': duplicate_of
    })

print(f"Audit completed for {len(audit_records)} files.")
with open('scratch/phase16_raw_file_audit.json', 'w', encoding='utf-8') as f:
    json.dump(audit_records, f, indent=2)

print("Saved raw audit to scratch/phase16_raw_file_audit.json")

