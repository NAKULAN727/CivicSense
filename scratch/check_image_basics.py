import os
from PIL import Image

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

for fname in files:
    fpath = os.path.join(folder, fname)
    im = Image.open(fpath)
    print(f"{fname:<16}: format={im.format}, size={im.size}, mode={im.mode}")

