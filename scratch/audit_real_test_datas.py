import os
from PIL import Image

base_dir = "Real Test Datas"
folders = sorted(os.listdir(base_dir))

report = {}

for folder in folders:
    folder_path = os.path.join(base_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    files = sorted(os.listdir(folder_path))
    report[folder] = []
    print(f"\n==========================================")
    print(f"FOLDER: {folder} (Total entries: {len(files)})")
    print(f"==========================================")
    for f in files:
        fpath = os.path.join(folder_path, f)
        fsize_kb = round(os.path.getsize(fpath) / 1024, 2)
        try:
            im = Image.open(fpath)
            w, h = im.size
            fmt = im.format
            mode = im.mode
            ext = os.path.splitext(f)[1].lower()
            unexpected = []
            if ext == '':
                unexpected.append("NO_EXTENSION")
            elif ext == '.crdownload':
                unexpected.append("CRDOWNLOAD_EXTENSION")
            elif (fmt == 'JPEG' and ext == '.webp') or (fmt == 'WEBP' and ext in ['.jpg', '.jpeg']):
                unexpected.append(f"EXT_MISMATCH(ext={ext}, fmt={fmt})")
            
            report[folder].append({
                "filename": f,
                "size_kb": fsize_kb,
                "width": w,
                "height": h,
                "format": fmt,
                "mode": mode,
                "unexpected": unexpected
            })
            unexp_str = f" [UNEXPECTED: {', '.join(unexpected)}]" if unexpected else ""
            print(f"  {f:<32} | {fmt:<5} | {mode:<4} | {w}x{h:<5} | {fsize_kb:>6.2f} KB{unexp_str}")
        except Exception as e:
            print(f"  {f:<32} | FAILED TO READ: {e}")
            report[folder].append({
                "filename": f,
                "size_kb": fsize_kb,
                "error": str(e),
                "unexpected": ["CORRUPTED_OR_UNREADABLE"]
            })

