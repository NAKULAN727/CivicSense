import os
import json
import numpy as np
from PIL import Image
import onnxruntime as ort

WASTE_CLASSES = [
    "W00 Cardboard",
    "W10 E-Waste",
    "W20 Glass",
    "W30 Metal",
    "W40 Paper",
    "W50 Plastic/Organic",
    "W60 Non-Recyclable",
    "W70 Textile/Other"
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

def detect_waste(session, im, conf_threshold=0.25, iou_threshold=0.45, is_flood_scene=False):
    w_orig, h_orig = im.size
    lb_im, scale, pad_w, pad_h = letterbox(im, 640)
    inp = np.transpose(np.array(lb_im, dtype=np.float32) / 255.0, (2, 0, 1))[None, ...]
    out = session.run(None, {"images": inp})[0] # (1, 12, 8400)
    
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
    
    x1 = np.clip(x1, 0, w_orig)
    y1 = np.clip(y1, 0, h_orig)
    x2 = np.clip(x2, 0, w_orig)
    y2 = np.clip(y2, 0, h_orig)
    
    boxes_orig = np.column_stack([x1, y1, x2, y2])
    keep_indices = nms(boxes_orig, cand_scores, iou_threshold)
    
    detections = []
    total_area = w_orig * h_orig
    
    for idx in keep_indices:
        b = boxes_orig[idx]
        bw = b[2] - b[0]
        bh = b[3] - b[1]
        area = bw * bh
        
        # Suppress monolithic box ONLY in flood scenes (water reflection false positive)
        if is_flood_scene and ((bw >= 0.70 * w_orig and bh >= 0.70 * h_orig) or (area >= 0.60 * total_area)):
            continue
            
        detections.append({
            "box": [round(float(coord), 1) for coord in b],
            "class_id": int(cand_classes[idx]),
            "class_name": WASTE_CLASSES[cand_classes[idx]],
            "confidence": round(float(cand_scores[idx]), 3),
            "area_pct": round(float((area / total_area) * 100.0), 2)
        })
        
    return detections

def classify_garbage_scene(detections):
    if len(detections) == 0:
        return "NO_WASTE_DETECTED", 0.50
        
    total_area_pct = sum(d["area_pct"] for d in detections)
    num_boxes = len(detections)
    top_score = max(d["confidence"] for d in detections)
    
    classes = [d["class_name"] for d in detections]
    dominant_class = max(set(classes), key=classes.count)
    
    if num_boxes >= 3 or total_area_pct >= 25.0:
        scene_type = f"DUMP_PILE ({dominant_class})"
        conf = min(0.95, top_score)
    elif num_boxes >= 1:
        scene_type = f"SCATTERED_LITTER ({dominant_class})"
        conf = top_score
    else:
        scene_type = dominant_class
        conf = top_score
        
    return scene_type, round(float(conf), 3)

def main():
    print("================================================================================")
    print("CIVICSENSE AI — STEP 3B GARBAGE MODEL & TYPE VALIDATION (YOLOv8s ONNX)")
    print("================================================================================")
    
    model_path = "public/models/waste-detection.onnx"
    session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    print(f"Loaded waste model from {model_path}")
    
    fdir = "Real Test Datas/Garbage"
    files = sorted(os.listdir(fdir))
    print(f"Testing all {len(files)} Garbage test images...\n")
    
    detected_count = 0
    type_counts = {}
    
    for f in files:
        fpath = os.path.join(fdir, f)
        try:
            im = Image.open(fpath)
            dets = detect_waste(session, im, conf_threshold=0.25, is_flood_scene=False)
            scene_type, conf = classify_garbage_scene(dets)
            
            type_counts[scene_type] = type_counts.get(scene_type, 0) + 1
            if len(dets) > 0:
                detected_count += 1
            print(f"  {f:<20} -> {scene_type:<38} ({len(dets)} boxes, Top Conf: {conf:.2f})")
        except Exception as e:
            print(f"  Error processing {f}: {e}")
            
    print(f"\nDetection Summary:")
    print(f"  Successfully detected waste in {detected_count}/{len(files)} images ({detected_count/len(files)*100:.1f}%)")
    print(f"  Type Distribution:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c} images")

if __name__ == "__main__":
    main()
