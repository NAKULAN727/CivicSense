import onnxruntime as ort
from PIL import Image
import numpy as np

waste_sess = ort.InferenceSession('public/models/waste-detection.onnx', providers=['CPUExecutionProvider'])
flood_sess = ort.InferenceSession('public/models/flood-water-segmentation.onnx', providers=['CPUExecutionProvider'])

for num in [1, 2, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 29, 30]:
    ext = 'webp' if num in (1, 2, 5, 6, 7, 9) else 'jpg'
    fname = f"garbage {num}.{ext}"
    p = f"Real Test Datas/Garbage/{fname}"
    
    img = Image.open(p).convert('RGB')
    w_orig, h_orig = img.size
    scale = min(640.0 / w_orig, 640.0 / h_orig)
    nw = int(round(w_orig * scale))
    nh = int(round(h_orig * scale))
    pad_x = (640.0 - nw) / 2.0
    pad_y = (640.0 - nh) / 2.0
    img_lb = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new('RGB', (640, 640), (114, 114, 114))
    canvas.paste(img_lb, (int(pad_x), int(pad_y)))
    arr = np.transpose(np.array(canvas, dtype=np.float32) / 255.0, (2, 0, 1))
    tensor = np.expand_dims(arr, axis=0)
    out = waste_sess.run(None, {waste_sess.get_inputs()[0].name: tensor})[0][0]
    
    # max waste score
    scores = out[4:12, :]
    max_sc = float(np.max(scores))
    
    # flood
    fl_img = img.resize((512, 512), Image.BILINEAR)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    fl_arr = (np.array(fl_img, dtype=np.float32)/255.0 - mean)/std
    fl_arr = np.transpose(fl_arr, (2,0,1))
    fl_out = flood_sess.run(None, {flood_sess.get_inputs()[0].name: np.expand_dims(fl_arr, 0)})[0][0]
    mask = np.argmax(fl_out, axis=0)
    w_pct = round(float(np.sum((mask==1)|(mask==3)|(mask==5))) / (128*128) * 100, 2)
    
    print(f"{fname:<16}: max_waste={max_sc:.4f}, water={w_pct}%")

