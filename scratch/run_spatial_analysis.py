import os
import sys
import json
import numpy as np
from PIL import Image
import onnxruntime as ort
from scipy.ndimage import label, center_of_mass

onnx_path = r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx"
dataset_root = r"c:\Users\NAKULAN\OneDrive\Pictures\Real Test Datas"

session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
in_name = session.get_inputs()[0].name
out_name = session.get_outputs()[0].name

mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

def preprocess(pil_img, dims=(416, 416)):
    resized = pil_img.resize(dims, Image.BILINEAR)
    arr = np.array(resized).astype(np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, axis=0)
    arr = (arr - mean) / std
    return arr

folders = [
    ("Flood", "FLOOD"),
    ("Pathole", "POTHOLE"),
    ("Garbage", "GARBAGE")
]

spatial_records = []

for folder_name, cat in folders:
    folder_path = os.path.join(dataset_root, folder_name)
    if not os.path.exists(folder_path):
        continue
    
    files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))])
    
    for f in files:
        fp = os.path.join(folder_path, f)
        try:
            pil_img = Image.open(fp).convert("RGB")
        except Exception as e:
            continue
        
        orig_w, orig_h = pil_img.size
        input_tensor = preprocess(pil_img, (416, 416))
        prob_map = session.run([out_name], {in_name: input_tensor})[0][0, 0]
        
        binary_mask = (prob_map >= 0.5).astype(np.uint8)
        total_pixels = binary_mask.size # 173056
        water_pixels = int(np.sum(binary_mask))
        water_coverage_pct = round((water_pixels / total_pixels) * 100, 2)
        
        if water_pixels == 0:
            spatial_records.append({
                'filename': f,
                'category': cat,
                'source_folder': folder_name,
                'orig_resolution': f"{orig_w}x{orig_h}",
                'orig_width': orig_w,
                'orig_height': orig_h,
                'water_coverage_pct': 0.0,
                'water_pixels': 0,
                'num_connected_components': 0,
                'largest_component_pixels': 0,
                'largest_component_area_pct': 0.0,
                'largest_component_ratio_pct': 0.0,
                'bbox_xyxy': None,
                'centroid_xy': None,
                'vertical_distribution': {'sky_upper_pct': 0.0, 'mid_scene_pct': 0.0, 'road_ground_pct': 0.0},
                'spatial_topology': "NO_WATER"
            })
            continue
        
        # Bounding box
        y_indices, x_indices = np.where(binary_mask == 1)
        min_y, max_y = int(np.min(y_indices)), int(np.max(y_indices))
        min_x, max_x = int(np.min(x_indices)), int(np.max(x_indices))
        bbox = [min_x, min_y, max_x, max_y]
        
        # Centroid
        cent_y, cent_x = center_of_mass(binary_mask)
        cent_xy = [round(float(cent_x), 1), round(float(cent_y), 1)]
        
        # Connected components
        labeled_array, num_features = label(binary_mask)
        component_sizes = [int(np.sum(labeled_array == i)) for i in range(1, num_features + 1)]
        largest_comp_px = max(component_sizes) if component_sizes else 0
        largest_comp_area_pct = round((largest_comp_px / total_pixels) * 100, 2)
        largest_comp_ratio_pct = round((largest_comp_px / water_pixels) * 100, 2) if water_pixels > 0 else 0.0
        
        # Vertical distribution (416 rows)
        # Upper (0 to 125, ~30%): Sky / buildings / background
        # Mid (125 to 291, ~40%): Midground / horizon / vehicles
        # Lower (291 to 416, ~30%): Road foreground
        upper_water = int(np.sum(binary_mask[0:125, :]))
        mid_water = int(np.sum(binary_mask[125:291, :]))
        lower_water = int(np.sum(binary_mask[291:416, :]))
        
        sky_upper_pct = round((upper_water / water_pixels) * 100, 1)
        mid_scene_pct = round((mid_water / water_pixels) * 100, 1)
        road_ground_pct = round((lower_water / water_pixels) * 100, 1)
        
        # Spatial topology classification
        if water_coverage_pct > 25.0 and largest_comp_ratio_pct > 75.0:
            topology = "LARGE_CONTINUOUS_ROAD_FLOOD"
        elif water_coverage_pct > 20.0:
            topology = "SUBSTANTIAL_SPREAD_WATERLOGGING"
        elif water_coverage_pct >= 5.0 and num_features <= 3 and largest_comp_area_pct < 15.0:
            topology = "LOCALIZED_PUDDLE_OR_POTHOLE_WATER"
        elif water_coverage_pct >= 5.0:
            topology = "DISPERSED_WET_PATCHES"
        else:
            topology = "TRACE_OR_SPECULAR_WATER"
            
        spatial_records.append({
            'filename': f,
            'category': cat,
            'source_folder': folder_name,
            'orig_resolution': f"{orig_w}x{orig_h}",
            'orig_width': orig_w,
            'orig_height': orig_h,
            'water_coverage_pct': water_coverage_pct,
            'water_pixels': water_pixels,
            'num_connected_components': num_features,
            'largest_component_pixels': largest_comp_px,
            'largest_component_area_pct': largest_comp_area_pct,
            'largest_component_ratio_pct': largest_comp_ratio_pct,
            'bbox_xyxy': bbox,
            'centroid_xy': cent_xy,
            'vertical_distribution': {
                'sky_upper_pct': sky_upper_pct,
                'mid_scene_pct': mid_scene_pct,
                'road_ground_pct': road_ground_pct
            },
            'spatial_topology': topology
        })

print(f"Processed {len(spatial_records)} images for spatial validation.\n")

print(f"{'Filename':<28} | {'Folder':<8} | {'Cov%':<6} | {'Comps':<5} | {'LrgCompArea%':<12} | {'LrgRatio%':<9} | {'Road/Gnd%':<9} | {'Topology':<25}")
print("-" * 125)
for r in spatial_records:
    if r['water_coverage_pct'] > 0:
        print(f"{r['filename']:<28} | {r['source_folder']:<8} | {r['water_coverage_pct']:>5.1f}% | {r['num_connected_components']:>5} | {r['largest_component_area_pct']:>11.1f}% | {r['largest_component_ratio_pct']:>8.1f}% | {r['vertical_distribution']['road_ground_pct']:>8.1f}% | {r['spatial_topology']:<25}")

with open(r"e:\CivicSenseAI\scratch\vfloodnet_spatial_analysis.json", "w", encoding="utf-8") as f:
    json.dump(spatial_records, f, indent=2)
