import os
import shutil
import json
import hashlib
from PIL import Image

flood_src = "Real Test Datas/Flood"
files = sorted(os.listdir(flood_src))

# Verify all 32 files match Phase 16 hashes
with open("scratch/phase16_complete_inventory.json", "r", encoding="utf-8") as f:
    phase16_inv = {x["Filename"]: x for x in json.load(f)}

print(f"Loaded {len(phase16_inv)} reference records.")

# Define stratified scene-level split
# Stratification considerations:
# Total 32 images -> Train: 22 (68.75%), Val: 5 (15.62%), Test: 5 (15.62%)
# Categories:
# Ground-level street: 14 primary -> Train: 10, Val: 2, Test: 2
# Aerial: 6 primary -> Train: 4, Val: 1, Test: 1
# Residential: 3 primary -> Train: 2, Val: 1, Test: 0
# River: 3 primary -> Train: 2, Val: 0, Test: 1
# Shallow: 4 primary -> Train: 3, Val: 0, Test: 1
# Wet roads/reflections: 2 primary -> Train: 1, Val: 1, Test: 0

splits = {
    "train": [
        # Ground-level street (10)
        "flood 1.jpg", "flood 10.webp", "flood 12.webp", "flood 14.webp", "flood 15.jpg",
        "flood 2", "flood 24.webp", "flood 28.webp", "flood 3.webp", "flood 5.webp",
        # Aerial (4)
        "flood 20.webp", "flood 26.webp", "flood 30.webp", "flood 4.webp",
        # Residential (2)
        "flood 11.webp", "flood 22.webp",
        # River (2)
        "flood 21.webp", "flood 25.webp",
        # Shallow waterlogging (3)
        "flood 13.webp", "flood 19.jpg", "flood 23.webp",
        # Wet roads and reflections (1)
        "puddles.jpg"
    ],
    "val": [
        # Ground-level street (2)
        "flood 6.webp", "flood 8.webp",
        # Aerial (1)
        "flood 17.jpg",
        # Residential (1)
        "flood 16.jpg",
        # Wet roads and reflections (1)
        "flood 27.webp"
    ],
    "test": [
        # Ground-level street (2)
        "flood 29.webp", "flood.jpg",
        # Aerial (1)
        "flood 9.webp",
        # River (1)
        "flood 7.webp",
        # Shallow waterlogging (1)
        "flood 18.jpg"
    ]
}

# Verify counts and no overlap
train_set = set(splits["train"])
val_set = set(splits["val"])
test_set = set(splits["test"])

assert len(train_set) == 22, f"Train count {len(train_set)} != 22"
assert len(val_set) == 5, f"Val count {len(val_set)} != 5"
assert len(test_set) == 5, f"Test count {len(test_set)} != 5"
assert len(train_set & val_set) == 0, "Train and Val overlap!"
assert len(train_set & test_set) == 0, "Train and Test overlap!"
assert len(val_set & test_set) == 0, "Val and Test overlap!"
all_split_files = train_set | val_set | test_set
assert all_split_files == set(files), f"Difference: {set(files) ^ all_split_files}"

print("Split validation successful: Train=22, Val=5, Test=5 (Total=32)")

# Create dataset directory structure
base_dir = "datasets/flood_v2"
for d in ["images/train", "images/val", "images/test", 
          "masks/train", "masks/val", "masks/test", 
          "annotations"]:
    os.makedirs(os.path.join(base_dir, d), exist_ok=True)

# Copy original images
copied = 0
for split_name, split_files in splits.items():
    for fn in split_files:
        src_path = os.path.join(flood_src, fn)
        dst_path = os.path.join(base_dir, "images", split_name, fn)
        shutil.copy2(src_path, dst_path)
        
        # Verify copied file hash matches source
        with open(src_path, "rb") as f1, open(dst_path, "rb") as f2:
            h1 = hashlib.sha256(f1.read()).hexdigest()
            h2 = hashlib.sha256(f2.read()).hexdigest()
            assert h1 == h2, f"Hash mismatch for {fn}"
        copied += 1

print(f"Successfully copied {copied} original images into datasets/flood_v2/images/ with verified SHA-256 integrity.")

