import os
import json
from PIL import Image, ExifTags

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

results = []
for fname in files:
    fpath = os.path.join(folder, fname)
    im = Image.open(fpath)
    exif_data = {}
    if hasattr(im, '_getexif') and im._getexif():
        exif = im._getexif()
        for k, v in exif.items():
            tag = ExifTags.TAGS.get(k, k)
            exif_data[str(tag)] = str(v)[:50]
    
    results.append({
        "filename": fname,
        "format": im.format,
        "size": im.size,
        "mode": im.mode,
        "has_exif": bool(exif_data)
    })

print(json.dumps(results, indent=2))

