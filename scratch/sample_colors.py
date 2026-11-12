import os
from PIL import Image
import numpy as np

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

for fname in files:
    im = Image.open(os.path.join(folder, fname)).convert("RGB")
    arr = np.array(im)
    h, w, _ = arr.shape
    # sample some patches
    center_color = arr[h//2, w//2].tolist()
    bottom_center = arr[int(h*0.8), w//2].tolist()
    top_center = arr[int(h*0.2), w//2].tolist()
    print(f"{fname:<16}: shape=({w},{h}) top={top_center} center={center_color} bot={bottom_center}")

