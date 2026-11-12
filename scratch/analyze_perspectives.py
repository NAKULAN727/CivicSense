import os
import json
from PIL import Image
import numpy as np

folder = "Real Test Datas/Flood"
files = sorted(os.listdir(folder))

# We can analyze aspect ratio, perspective cues, vertical gradients, color distribution
details = {}

for fname in files:
    fpath = os.path.join(folder, fname)
    im = Image.open(fpath).convert('RGB')
    w, h = im.size
    arr = np.array(im)
    
    # Calculate color variance, gradients, sky presence (upper 20% blue/white)
    upper_band = arr[:int(h*0.2), :, :]
    mid_band = arr[int(h*0.2):int(h*0.7), :, :]
    lower_band = arr[int(h*0.7):, :, :]
    
    # Sky detection proxy (high brightness, blue >= red in upper band)
    up_r, up_g, up_b = np.mean(upper_band[:, :, 0]), np.mean(upper_band[:, :, 1]), np.mean(upper_band[:, :, 2])
    has_sky = (up_b >= up_r * 0.9) and (np.mean(upper_band) > 130)
    
    # Ground water tint (brown/muddy vs blue/gray)
    low_r, low_g, low_b = np.mean(lower_band[:, :, 0]), np.mean(lower_band[:, :, 1]), np.mean(lower_band[:, :, 2])
    
    details[fname] = {
        "width": w,
        "height": h,
        "aspect_ratio": round(w/h, 2),
        "upper_rgb": [round(up_r, 1), round(up_g, 1), round(up_b, 1)],
        "lower_rgb": [round(low_r, 1), round(low_g, 1), round(low_b, 1)],
        "has_sky": bool(has_sky)
    }

print("Analyzed", len(details), "images.")

