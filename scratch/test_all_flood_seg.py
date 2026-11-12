import onnxruntime as ort
import numpy as np
from PIL import Image
import os
import glob

flood_sess = ort.InferenceSession('public/models/flood-water-segmentation.onnx', providers=['CPUExecutionProvider'])
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

flood_files = sorted(glob.glob('Real Test Datas/Flood/*.*'))
print(f"Total flood files: {len(flood_files)}")

results = []
for p in flood_files:
    fname = os.path.basename(p)
    try:
        img = Image.open(p).convert('RGB')
        w, h = img.size
        flood_img = img.resize((512, 512), Image.BILINEAR)
        arr = (np.array(flood_img, dtype=np.float32) / 255.0 - mean) / std
        arr = np.transpose(arr, (2, 0, 1))
        inp = np.expand_dims(arr, axis=0)
        out = flood_sess.run(None, {flood_sess.get_inputs()[0].name: inp})[0]
        mask = np.argmax(out[0], axis=0)
        total = 128 * 128
        water_px = int(np.sum((mask == 1) | (mask == 3) | (mask == 5)))
        water_pct = round(water_px / total * 100, 2)
        top_cls = int(np.bincount(mask.flatten()).argmax())
        results.append((fname, f"{w}x{h}", water_pct, top_cls))
    except Exception as e:
        results.append((fname, "ERR", 0, str(e)))

for fname, res, wpct, top_cls in results:
    print(f"  {fname:<18} ({res}): water = {wpct:>5.1f}%, topClass = {top_cls}")
