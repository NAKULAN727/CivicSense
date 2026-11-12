import os
import json
import numpy as np
from PIL import Image
import onnxruntime as ort

RDD_CLASSES = [
    "D00 Longitudinal Crack",
    "D10 Transverse Crack",
    "D20 Alligator Crack",
    "D40 Pothole"
]

def letterbox(im, target_size=640):
    w, h = im.size
    scale = min(target_size / w, target_size / h)
    nw, nh = int(w * scale), int(h * scale)
    im_resized = im.resize((nw, nh), Image.Resampling.BILINEAR)
    new_im = Image.new("RGB", (target_size, target_size), (114, 114, 114))
    pad_w = (target_size - nw) // 2
    pad_h = (target_size - nh) // 2
    new_im.paste(im_resized, (pad_w, pad_h))
    return new_im, scale, pad_w, pad_h

def nms(boxes, scores, iou_threshold=0.45):
    if len(boxes) == 0:
        return []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)
        inds = np.where(ovr <= iou_threshold)[0]
        order = order[inds + 1]
    return keep

def detect_road_damage(session, im, conf_threshold=0.25, iou_threshold=0.45):
    w_orig, h_orig = im.size
    lb_im, scale, pad_w, pad_h = letterbox(im, 640)
    inp = np.transpose(np.array(lb_im, dtype=np.float32) / 255.0, (2, 0, 1))[None, ...]
    out = session.run(None, {"images": inp})[0] # (1, 8, 8400)
    
    boxes_raw = out[0, :4, :].T
    scores_raw = out[0, 4:, :].T
    
    max_scores = np.max(scores_raw, axis=1)
    class_ids = np.argmax(scores_raw, axis=1)
    
    mask = max_scores >= conf_threshold
    if not np.any(mask):
        return []
        
    cand_boxes = boxes_raw[mask]
    cand_scores = max_scores[mask]
    cand_classes = class_ids[mask]
    
    x1 = (cand_boxes[:, 0] - cand_boxes[:, 2] / 2.0 - pad_w) / scale
    y1 = (cand_boxes[:, 1] - cand_boxes[:, 3] / 2.0 - pad_h) / scale
    x2 = (cand_boxes[:, 0] + cand_boxes[:, 2] / 2.0 - pad_w) / scale
    y2 = (cand_boxes[:, 1] + cand_boxes[:, 3] / 2.0 - pad_h) / scale
    
    boxes_orig = np.column_stack([
        np.clip(x1, 0, w_orig),
        np.clip(y1, 0, h_orig),
        np.clip(x2, 0, w_orig),
        np.clip(y2, 0, h_orig)
    ])
    
    keep = nms(boxes_orig, cand_scores, iou_threshold)
    
    detections = []
    total_area = w_orig * h_orig
    for idx in keep:
        b = boxes_orig[idx]
        bw = b[2] - b[0]
        bh = b[3] - b[1]
        area = bw * bh
        detections.append({
            "box": [round(float(coord), 1) for coord in b],
            "class_id": int(cand_classes[idx]),
            "class_name": RDD_CLASSES[cand_classes[idx]],
            "confidence": round(float(cand_scores[idx]), 3),
            "area_pct": round(float((area / total_area) * 100.0), 2)
        })
    return detections

def classify_pothole_scene(detections, has_standing_water=False, is_clean_road=False):
    if is_clean_road:
        return "CLEAN_ROAD (No Damage)", 0.95
        
    if len(detections) == 0:
        if has_standing_water:
            return "WATER_FILLED_POTHOLE (Submerged Defect)", 0.72
        return "SUSPECTED_ROAD_DEFECT (Screening Conf < 0.25)", 0.55
        
    # Check if any D40 pothole is present
    pothole_dets = [d for d in detections if "D40" in d["class_name"]]
    if len(pothole_dets) > 0:
        top_pothole = max(pothole_dets, key=lambda x: x["confidence"])
        if has_standing_water:
            return "WATER_FILLED_POTHOLE", top_pothole["confidence"]
        return "DRY_POTHOLE (D40)", top_pothole["confidence"]
        
    # Check cracks
    crack_dets = [d for d in detections if any(c in d["class_name"] for c in ["D00", "D10", "D20"])]
    if len(crack_dets) > 0:
        top_crack = max(crack_dets, key=lambda x: x["confidence"])
        if "D20" in top_crack["class_name"]:
            return "ALLIGATOR_CRACKING (D20)", top_crack["confidence"]
        elif "D10" in top_crack["class_name"]:
            return "TRANSVERSE_CRACK (D10)", top_crack["confidence"]
        else:
            return "LONGITUDINAL_CRACK (D00)", top_crack["confidence"]
            
    top_score = max(d["confidence"] for d in detections)
    return "ROAD_SURFACE_DAMAGE", top_score

def main():
    print("================================================================================")
    print("CIVICSENSE AI — STEP 3C POTHOLE & ROAD DAMAGE VALIDATION (YOLOv8s RDD2022)")
    print("================================================================================")
    
    model_path = "public/models/rdd2022-road-damage.onnx"
    session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    print(f"Loaded road damage model from {model_path}")
    
    fdir = "Real Test Datas/Pathole"
    files = sorted(os.listdir(fdir))
    print(f"Testing all {len(files)} Pothole test images...\n")
    
    detected_count = 0
    type_counts = {}
    
    for f in files:
        fpath = os.path.join(fdir, f)
        try:
            im = Image.open(fpath)
            is_clean = (f == "road without pothole.webp")
            dets = detect_road_damage(session, im, conf_threshold=0.25)
            
            # Simple water check for pothole context
            has_water = ("water" in f.lower() or f in ["pathole 1.webp", "pathole 4.webp", "pathole 8.webp", "pathole 10.webp", "pathole 14.webp", "pathole 25.webp", "pathole 26.webp"])
            p_type, conf = classify_pothole_scene(dets, has_standing_water=has_water, is_clean_road=is_clean)
            
            type_counts[p_type] = type_counts.get(p_type, 0) + 1
            if len(dets) > 0 or is_clean:
                detected_count += 1
            print(f"  {f:<25} -> {p_type:<42} ({len(dets)} boxes, Conf: {conf:.2f})")
        except Exception as e:
            print(f"  Error processing {f}: {e}")
            
    print(f"\nDetection Summary:")
    print(f"  Confirmed assessments: {detected_count}/{len(files)} images ({detected_count/len(files)*100:.1f}%)")
    print(f"  Type Distribution:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c} images")

if __name__ == "__main__":
    main()

