import json
import os
import onnxruntime as ort
import numpy as np
from PIL import Image

# Load models
waste_sess = ort.InferenceSession('public/models/waste-detection.onnx', providers=['CPUExecutionProvider'])
flood_sess = ort.InferenceSession('public/models/flood-water-segmentation.onnx', providers=['CPUExecutionProvider'])
road_sess = ort.InferenceSession('public/models/rdd2022-road-damage.onnx', providers=['CPUExecutionProvider'])

with open('scratch/phase16_raw_file_audit.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

# Also load phase8c6 raw results to get existing human descriptions / metadata if any
with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    p8c6 = json.load(f)
p8c6_map = {d['filename']: d for d in p8c6 if d['category'] == 'FLOOD'}

detailed_audit = []

for r in records:
    fname = r['filename']
    fpath = r['filepath']
    img = Image.open(fpath).convert('RGB')
    w, h = img.size

    # Flood SegFormer inference
    fl_img = img.resize((512, 512), Image.BILINEAR)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    fl_arr = (np.array(fl_img, dtype=np.float32) / 255.0 - mean) / std
    fl_arr = np.transpose(fl_arr, (2, 0, 1))
    fl_out = flood_sess.run(None, {flood_sess.get_inputs()[0].name: np.expand_dims(fl_arr, 0)})[0]
    mask = np.argmax(fl_out[0], axis=0)

    # Class counts
    counts = {c: int(np.sum(mask == c)) for c in range(10)}
    water_bin = ((mask == 1) | (mask == 3) | (mask == 5)).astype(int)
    w_px = int(np.sum(water_bin))
    water_cov_pct = round((w_px / (128 * 128)) * 100.0, 2)

    # Connected component
    from scipy import ndimage
    labeled, num_features = ndimage.label(water_bin)
    if num_features > 0:
        sizes = ndimage.sum(water_bin, labeled, range(1, num_features + 1))
        max_c = np.max(sizes)
        comp_ratio = round((max_c / w_px) * 100.0, 2)
    else:
        comp_ratio = 0.0

    # Vertical distribution (upper 33%, middle 34%, lower 33%)
    h_third = 128 // 3
    upper_water = np.sum(water_bin[:h_third, :])
    mid_water = np.sum(water_bin[h_third:2*h_third, :])
    lower_water = np.sum(water_bin[2*h_third:, :])
    tot_w = max(1, w_px)
    vert_dist = {
        'upper_pct': round((upper_water / tot_w) * 100.0, 1),
        'mid_pct': round((mid_water / tot_w) * 100.0, 1),
        'lower_pct': round((lower_water / tot_w) * 100.0, 1)
    }

    # Road damage check (640x640 letterbox)
    scale = min(640.0 / w, 640.0 / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    pad_x, pad_y = (640.0 - nw) / 2.0, (640.0 - nh) / 2.0
    img_lb = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new('RGB', (640, 640), (114, 114, 114))
    canvas.paste(img_lb, (int(pad_x), int(pad_y)))
    arr_lb = np.transpose(np.array(canvas, dtype=np.float32) / 255.0, (2, 0, 1))
    tensor_lb = np.expand_dims(arr_lb, 0)
    
    road_out = road_sess.run(None, {road_sess.get_inputs()[0].name: tensor_lb})[0][0]
    road_dets = []
    for i in range(road_out.shape[1]):
        scs = [road_out[4 + c, i] for c in range(4)]
        best_sc = max(scs)
        if best_sc >= 0.25:
            road_dets.append({'cls': scs.index(best_sc), 'conf': round(float(best_sc), 3)})

    # Waste check
    waste_out = waste_sess.run(None, {waste_sess.get_inputs()[0].name: tensor_lb})[0][0]
    waste_dets = []
    for i in range(waste_out.shape[1]):
        scs = [waste_out[4 + c, i] for c in range(8)]
        best_sc = max(scs)
        if best_sc >= 0.50:
            waste_dets.append({'cls': scs.index(best_sc), 'conf': round(float(best_sc), 3)})

    r_p8 = p8c6_map.get(fname, {})

    detailed_audit.append({
        'filename': fname,
        'filepath': fpath,
        'filesize_kb': r['filesize_kb'],
        'format': r['format'],
        'width': w,
        'height': h,
        'aspect_ratio': r['aspect_ratio'],
        'sha256': r['sha256'],
        'water_coverage_pct': water_cov_pct,
        'topology_ratio_pct': comp_ratio,
        'num_components': int(num_features),
        'vertical_dist': vert_dist,
        'road_detections_count': len(road_dets),
        'waste_detections_count': len(waste_dets),
        'existing_topology_label': r_p8.get('vflood_spatial_topology', 'N/A')
    })

print(f"Computed detailed diagnostics for {len(detailed_audit)} images.")
with open('scratch/phase16_detailed_audit.json', 'w', encoding='utf-8') as f:
    json.dump(detailed_audit, f, indent=2)

print("Saved detailed audit to scratch/phase16_detailed_audit.json")

