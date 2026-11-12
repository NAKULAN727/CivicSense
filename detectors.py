import os
import json
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageOps
import torch
import onnxruntime as ort
import joblib

# Suppress offline warnings and set HuggingFace offline mode
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["GRADIO_ANALYTICS_ENABLED"] = "False"
os.environ["TORCH_CPP_LOG_LEVEL"] = "ERROR"

from transformers import CLIPProcessor, CLIPModel

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

def draw_labeled_box(draw, box, label, score, color_rgb, img_w, img_h, font=None):
    """
    Renders an anti-aliased bounding box with smart label positioning:
    - If box is near image top (y1 < 22), badge renders inside the box top edge.
    - Otherwise, badge renders above the box top edge.
    - Prevents negative coordinates or image clipping.
    """
    x1, y1, x2, y2 = box
    r, g, b = color_rgb
    
    # Outer box border
    draw.rectangle([x1, y1, x2, y2], outline=(r, g, b, 255), width=3)
    # Translucent interior fill
    draw.rectangle([x1, y1, x2, y2], fill=(r, g, b, 35))
    
    tag = f"{label}: {score*100:.0f}%"
    tag_w = len(tag) * 8 + 10
    tag_x2 = min(img_w, x1 + tag_w)
    
    if y1 >= 22:
        badge_y1 = y1 - 20
        badge_y2 = y1
        text_y = y1 - 18
    else:
        badge_y1 = y1
        badge_y2 = min(img_h, y1 + 20)
        text_y = y1 + 2
        
    draw.rectangle([x1, badge_y1, tag_x2, badge_y2], fill=(r, g, b, 230))
    if font is not None:
        draw.text((x1 + 4, text_y), tag, fill=(255, 255, 255, 255), font=font)
    else:
        draw.text((x1 + 4, text_y), tag, fill=(255, 255, 255, 255))

class CivicSenseEngine:
    _instance = None

    def __init__(self, classifier_path="models/category_classifier.joblib"):
        print("Initializing CivicSense Unified Inference Engine...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Load CLIP category model
        model_id = "openai/clip-vit-base-patch32"
        self.clip_model = CLIPModel.from_pretrained(model_id, local_files_only=True).to(self.device)
        self.clip_processor = CLIPProcessor.from_pretrained(model_id, local_files_only=True)
        self.clip_model.eval()
        
        # Load classifier artifact
        if not os.path.exists(classifier_path):
            raise FileNotFoundError(f"Category classifier not found at {classifier_path}. Run train_category.py first!")
        self.clf_data = joblib.load(classifier_path)
        self.clf = self.clf_data["classifier"]
        self.temperature = self.clf_data.get("temperature", 1.0)
        self.class_names = self.clf_data["class_names"]
        self.text_features = self.clf_data.get("text_features", None)
        
        # Load ONNX sessions
        self.rdd_session = ort.InferenceSession("public/models/rdd2022-road-damage.onnx", providers=["CPUExecutionProvider"])
        self.waste_session = ort.InferenceSession("public/models/waste-detection.onnx", providers=["CPUExecutionProvider"])
        
        # Try loading FreeType scalable vector font for crisp labels
        try:
            self.font = ImageFont.load_default(size=13)
        except Exception:
            self.font = None
            
        print("CivicSense Engine initialized successfully. Ready for inference!")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def extract_clip_embedding(self, im):
        with torch.no_grad():
            inp = self.clip_processor(images=im, return_tensors="pt").to(self.device)
            feats = self.clip_model.get_image_features(**inp)
            if hasattr(feats, "pooler_output"):
                feats = feats.pooler_output
            feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
            return feats.cpu().numpy()

    def predict_category(self, im):
        w, h = im.size
        emb = self.extract_clip_embedding(im)
        raw_probs = self.clf.predict_proba(emb)[0] # 3 classes: FLOOD, GARBAGE, POTHOLE
        
        # Temperature scaling
        pseudo_logits = np.log(np.clip(raw_probs, 1e-12, 1.0))
        scaled_logits = pseudo_logits / self.temperature
        exp_logits = np.exp(scaled_logits - np.max(scaled_logits))
        calib_probs = exp_logits / np.sum(exp_logits)
        
        prob_dict = {name: float(calib_probs[i]) for i, name in enumerate(self.class_names)}
        
        # Check clean road similarity (anchor 3 in text prompts)
        is_clean_road = False
        if self.text_features is not None:
            sims = np.dot(emb, self.text_features.T)[0]
            if sims[3] > 0.28 and sims[3] > max(sims[0], sims[1], sims[2]) - 0.02:
                is_clean_road = True
        
        sorted_cats = sorted(prob_dict.items(), key=lambda x: -x[1])
        top_cat, top_prob = sorted_cats[0]
        second_cat, second_prob = sorted_cats[1]
        
        warnings = []
        is_low_res = (w < 300 or h < 200 or (w * h) < 60000)
        if is_low_res:
            warnings.append("LOW IMAGE RESOLUTION - needs review")
            top_prob = min(top_prob, 0.70)
            
        # UNCERTAIN rule: max confidence < 0.60
        if top_prob < 0.60:
            category = "UNCERTAIN"
            category_conf = round(float(top_prob), 3)
            warnings.append(f"Ambiguous incident scene: Top-2 candidates are {top_cat} ({top_prob*100:.1f}%) and {second_cat} ({second_prob*100:.1f}%)")
        else:
            category = top_cat
            category_conf = round(float(top_prob), 3)
            
        return {
            "category": category,
            "category_confidence": category_conf,
            "probabilities": {k: round(v, 4) for k, v in prob_dict.items()},
            "top_candidates": [(top_cat, round(top_prob, 3)), (second_cat, round(second_prob, 3))],
            "is_low_res": is_low_res,
            "is_clean_road": is_clean_road,
            "warnings": warnings
        }

    def segment_water_plan_b(self, im):
        w, h = im.size
        img = np.array(im.convert("RGB"))
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        
        # Muddy floodwater
        lower_brown = np.array([5, 25, 35])
        upper_brown = np.array([35, 230, 220])
        mask_brown = cv2.inRange(hsv, lower_brown, upper_brown)
        
        # Reflective water
        lower_grey = np.array([0, 0, 45])
        upper_grey = np.array([180, 55, 235])
        mask_grey = cv2.inRange(hsv, lower_grey, upper_grey)
        
        # Bluish water
        lower_blue = np.array([80, 30, 40])
        upper_blue = np.array([140, 255, 245])
        mask_blue = cv2.inRange(hsv, lower_blue, upper_blue)
        
        # Texture smoothness
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        lap_var = cv2.boxFilter(np.abs(lap), -1, (15, 15))
        smooth_mask = (lap_var < 22).astype(np.uint8) * 255
        
        horizon_mask = np.zeros((h, w), dtype=np.uint8)
        horizon_mask[int(h * 0.15):, :] = 255
        
        candidates = cv2.bitwise_or(mask_brown, mask_blue)
        candidates = cv2.bitwise_or(candidates, cv2.bitwise_and(mask_grey, smooth_mask))
        candidates = cv2.bitwise_and(candidates, horizon_mask)
        
        k_size = max(5, int(min(w, h) * 0.015))
        if k_size % 2 == 0:
            k_size += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
        opened = cv2.morphologyEx(candidates, cv2.MORPH_OPEN, kernel)
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
        
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(closed)
        clean_mask = np.zeros_like(closed)
        min_area = w * h * 0.01
        largest_cc_area = 0
        
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area >= min_area:
                clean_mask[labels == i] = 255
                if area > largest_cc_area:
                    largest_cc_area = area
                    
        water_pixels = np.count_nonzero(clean_mask)
        water_coverage_pct = (water_pixels / (w * h)) * 100.0
        largest_cc_ratio = (largest_cc_area / water_pixels) if water_pixels > 0 else 0.0
        
        return clean_mask, round(float(water_coverage_pct), 2), round(float(largest_cc_ratio), 3)

    def detect_garbage_boxes(self, im, is_flood=False):
        w_orig, h_orig = im.size
        lb_im, scale, pad_w, pad_h = letterbox(im, 640)
        inp = np.transpose(np.array(lb_im, dtype=np.float32) / 255.0, (2, 0, 1))[None, ...]
        out = self.waste_session.run(None, {"images": inp})[0]
        
        boxes_raw = out[0, :4, :].T
        scores_raw = out[0, 4:, :].T
        max_scores = np.max(scores_raw, axis=1)
        class_ids = np.argmax(scores_raw, axis=1)
        
        mask = max_scores >= 0.25
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
        keep = nms(boxes_orig, cand_scores, 0.45)
        
        total_area = w_orig * h_orig
        detections = []
        for idx in keep:
            b = boxes_orig[idx]
            bw = b[2] - b[0]
            bh = b[3] - b[1]
            area = bw * bh
            
            # Monolithic box suppression in flood scenes (water reflection)
            if is_flood and ((bw >= 0.70 * w_orig and bh >= 0.70 * h_orig) or (area >= 0.60 * total_area)):
                continue
                
            detections.append({
                "box": [round(float(c), 1) for c in b],
                "class_id": int(cand_classes[idx]),
                "class_name": WASTE_CLASSES[cand_classes[idx]],
                "confidence": round(float(cand_scores[idx]), 3),
                "area_pct": round(float((area / total_area) * 100.0), 2)
            })
        return detections

    def detect_pothole_boxes(self, im):
        w_orig, h_orig = im.size
        lb_im, scale, pad_w, pad_h = letterbox(im, 640)
        inp = np.transpose(np.array(lb_im, dtype=np.float32) / 255.0, (2, 0, 1))[None, ...]
        out = self.rdd_session.run(None, {"images": inp})[0]
        
        boxes_raw = out[0, :4, :].T
        scores_raw = out[0, 4:, :].T
        max_scores = np.max(scores_raw, axis=1)
        class_ids = np.argmax(scores_raw, axis=1)
        
        mask = max_scores >= 0.25
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
        keep = nms(boxes_orig, cand_scores, 0.45)
        
        total_area = w_orig * h_orig
        detections = []
        for idx in keep:
            b = boxes_orig[idx]
            bw = b[2] - b[0]
            bh = b[3] - b[1]
            area = bw * bh
            detections.append({
                "box": [round(float(c), 1) for c in b],
                "class_id": int(cand_classes[idx]),
                "class_name": RDD_CLASSES[cand_classes[idx]],
                "confidence": round(float(cand_scores[idx]), 3),
                "area_pct": round(float((area / total_area) * 100.0), 2)
            })
        return detections

    def process_image(self, input_image):
        """
        End-to-End CivicSense AI Pipeline:
        1. Corrects EXIF rotation & normalizes color channels.
        2. Predicts Category (FLOOD / GARBAGE / POTHOLE / UNCERTAIN / OTHER).
        3. Detects Category-Specific Type with calibrated confidence %.
        4. Generates Visual Overlays (semi-transparent water mask or bounding boxes).
        5. Packages structured JSON payload.
        """
        if isinstance(input_image, np.ndarray):
            im = Image.fromarray(input_image)
        else:
            im = input_image
            
        # Fix EXIF orientation (crucial for smartphone uploads) & convert to RGB
        im = ImageOps.exif_transpose(im).convert("RGB")
            
        w, h = im.size
        cat_info = self.predict_category(im)
        cat = cat_info["category"]
        cat_conf = cat_info["category_confidence"]
        warnings = list(cat_info["warnings"])
        is_low_res = cat_info["is_low_res"]
        is_clean_road = cat_info["is_clean_road"]
        
        # Check water segmentation first (useful across all categories)
        water_mask, water_coverage_pct, largest_cc_ratio = self.segment_water_plan_b(im)
        
        # Create visual overlay canvas
        annotated_im = im.copy()
        draw = ImageDraw.Draw(annotated_im, "RGBA")
        
        # Initialize default type outputs
        incident_type = "UNKNOWN"
        type_conf = 0.50
        
        # 1. FLOOD BRANCH
        if cat == "FLOOD":
            # Overlay semi-transparent cyan water mask
            mask_rgba = np.zeros((h, w, 4), dtype=np.uint8)
            mask_rgba[water_mask > 0] = [0, 180, 240, 110] # Cyan / blue water
            mask_pil = Image.fromarray(mask_rgba, mode="RGBA")
            annotated_im = Image.alpha_composite(annotated_im.convert("RGBA"), mask_pil).convert("RGB")
            draw = ImageDraw.Draw(annotated_im, "RGBA")
            
            # Map type taxonomy
            if water_coverage_pct < 3.0:
                incident_type = "F00 No Significant Water"
                type_conf = max(0.60, 1.0 - (water_coverage_pct / 3.0) * 0.4)
            elif water_coverage_pct >= 60.0 and largest_cc_ratio >= 0.70:
                incident_type = "F05 Large-Area Inundation"
                type_conf = min(0.95, 0.70 + (water_coverage_pct / 100.0) * 0.25)
            elif water_coverage_pct >= 35.0:
                incident_type = "F06 General Significant Flooding"
                type_conf = 0.85
            else:
                incident_type = "F01 Roadway Waterlogging"
                type_conf = 0.82
                
            if "Inundation" in incident_type or water_coverage_pct > 50.0:
                warnings.append("F02 Residential / F04 River Overflow distinctions require GIS cadastre/fluvial data - needs operator verification")
                
            # Check for floating waste
            waste_dets = self.detect_garbage_boxes(im, is_flood=True)
            if len(waste_dets) > 0:
                warnings.append(f"Floating debris/waste detected on water surface ({len(waste_dets)} items)")
                for d in waste_dets:
                    draw_labeled_box(draw, d["box"], d["class_name"].split()[0], d["confidence"], (255, 100, 0), w, h, self.font)
                    
        # 2. GARBAGE BRANCH
        elif cat == "GARBAGE":
            waste_dets = self.detect_garbage_boxes(im, is_flood=False)
            if len(waste_dets) > 0:
                classes = [d["class_name"] for d in waste_dets]
                dominant_class = max(set(classes), key=classes.count)
                total_area_pct = sum(d["area_pct"] for d in waste_dets)
                top_conf = max(d["confidence"] for d in waste_dets)
                
                if len(waste_dets) >= 3 or total_area_pct >= 25.0:
                    incident_type = f"DUMP_PILE ({dominant_class})"
                    type_conf = min(0.95, top_conf)
                else:
                    incident_type = f"SCATTERED_LITTER ({dominant_class})"
                    type_conf = top_conf
                    
                for d in waste_dets:
                    draw_labeled_box(draw, d["box"], d["class_name"], d["confidence"], (34, 197, 94), w, h, self.font)
            else:
                incident_type = "UNCLASSIFIED_MUNICIPAL_WASTE"
                type_conf = 0.65
                warnings.append("Waste detected at scene level by CLIP, but individual bounding boxes below screening threshold")
                
        # 3. POTHOLE BRANCH
        elif cat == "POTHOLE":
            pothole_dets = self.detect_pothole_boxes(im)
            
            # Check if clean road
            if is_clean_road and len(pothole_dets) == 0:
                cat = "OTHER"
                cat_conf = 0.95
                incident_type = "CLEAN_ROAD (No Damage)"
                type_conf = 0.95
            elif len(pothole_dets) > 0:
                d40_dets = [d for d in pothole_dets if "D40" in d["class_name"]]
                if len(d40_dets) > 0:
                    top_p = max(d40_dets, key=lambda x: x["confidence"])
                    has_water = (water_coverage_pct >= 5.0)
                    if has_water:
                        incident_type = "WATER_FILLED_POTHOLE"
                        type_conf = top_p["confidence"]
                    else:
                        incident_type = "DRY_POTHOLE (D40)"
                        type_conf = top_p["confidence"]
                else:
                    top_c = max(pothole_dets, key=lambda x: x["confidence"])
                    if "D20" in top_c["class_name"]:
                        incident_type = "ALLIGATOR_CRACKING (D20)"
                        type_conf = top_c["confidence"]
                    elif "D10" in top_c["class_name"]:
                        incident_type = "TRANSVERSE_CRACK (D10)"
                        type_conf = top_c["confidence"]
                    else:
                        incident_type = "LONGITUDINAL_CRACK (D00)"
                        type_conf = top_c["confidence"]
                        
                colors = {
                    "D40 Pothole": (239, 68, 68),
                    "D20 Alligator Crack": (249, 115, 22),
                    "D10 Transverse Crack": (234, 179, 8),
                    "D00 Longitudinal Crack": (168, 85, 247)
                }
                for d in pothole_dets:
                    c = colors.get(d["class_name"], (239, 68, 68))
                    draw_labeled_box(draw, d["box"], d["class_name"], d["confidence"], c, w, h, self.font)
            else:
                if water_coverage_pct >= 8.0:
                    incident_type = "WATER_FILLED_POTHOLE (Submerged Defect)"
                    type_conf = 0.72
                    warnings.append("Road crater obscured by standing muddy water; surface reflection low")
                else:
                    incident_type = "SUSPECTED_ROAD_DEFECT"
                    type_conf = 0.58
                    warnings.append("Surface damage detected at scene level, but crack/crater bounds below 0.25 screening threshold")
                    
        # 4. UNCERTAIN / OTHER
        else:
            incident_type = "UNCERTAIN_SCENE"
            type_conf = cat_conf

        # Apply low-resolution cap to type confidence as well
        if is_low_res:
            type_conf = min(type_conf, 0.70)
            
        result_payload = {
            "category": cat,
            "category_confidence": round(float(cat_conf), 3),
            "type": incident_type,
            "type_confidence": round(float(type_conf), 3),
            "water_coverage_pct": round(float(water_coverage_pct), 1),
            "warnings": warnings
        }
        
        return annotated_im, result_payload
