import os
from PIL import Image
import numpy as np

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

for fname in files:
    fpath = os.path.join(folder, fname)
    im = Image.open(fpath).convert('RGB')
    w, h = im.size
    arr = np.array(im)
    
    # Calculate color statistics
    r_mean = np.mean(arr[:, :, 0])
    g_mean = np.mean(arr[:, :, 1])
    b_mean = np.mean(arr[:, :, 2])
    brightness = (r_mean + g_mean + b_mean) / 3.0
    
    # Blue-to-red ratio (water hue indicator)
    blue_ratio = b_mean / (r_mean + 1e-5)
    
    # Vertical gradient: compare top 25% vs bottom 25%
    top_brightness = np.mean(arr[:h//4, :, :])
    bot_brightness = np.mean(arr[3*h//4:, :, :])
    vert_diff = bot_brightness - top_brightness
    
    print(f"{fname:<16}: {w}x{h:<5} | Bright: {brightness:>5.1f} | B/R: {blue_ratio:>4.2f} | Bot-Top Diff: {vert_diff:>5.1f}")

