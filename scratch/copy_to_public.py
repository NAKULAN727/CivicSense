import os
import shutil

src_dir = "Real Test Datas/Flood"
dst_dir = "public/flood_images"
os.makedirs(dst_dir, exist_ok=True)

files = os.listdir(src_dir)
for f in files:
    shutil.copy2(os.path.join(src_dir, f), os.path.join(dst_dir, f))

print(f"Copied {len(files)} flood images to {dst_dir} for web serving.")

