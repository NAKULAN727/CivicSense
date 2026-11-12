import os
import json
import numpy as np
from PIL import Image
import onnxruntime as ort

cand_path = 'public/models/flood_segmentation.onnx'
prod_path = 'public/models/flood-water-segmentation.onnx'

cand_sess = ort.InferenceSession(cand_path, providers=['CPUExecutionProvider'])
prod_sess = ort.InferenceSession(prod_path, providers=['CPUExecutionProvider'])

mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

manifest_path = 'datasets/flood_v2/dataset_manifest.json'
with open(manifest_path, 'r') as f:
    manifest = json.load(f)

results = []

for item in manifest['images']:
    fname = item['filename']
    split = item['split']
    mask_fname = item['mask_filename']
    
    img_path = os.path.join('datasets/flood_v2/images', split, fname)
    mask_path = os.path.join('datasets/flood_v2/masks', split, mask_fname)
    
    if not os.path.exists(img_path) or not os.path.exists(mask_path):
        continue
        
    img = Image.open(img_path).convert('RGB')
    orig_w, orig_h = img.size
    
    gt_mask = np.array(Image.open(mask_path))
    gt_flood = (gt_mask == 1)
    gt_valid = (gt_mask != 255)
    gt_pct = (np.sum(gt_flood & gt_valid) / np.sum(gt_valid) * 100.0) if np.sum(gt_valid) > 0 else 0.0
    
    # Preprocess
    resized = img.resize((512, 512), Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)
    arr = np.expand_dims(arr, 0)
    norm_tensor = (arr - mean) / std
    
    # Candidate
    cand_out = cand_sess.run(['logits'], {'pixel_values': norm_tensor})[0]
    cand_128 = np.argmax(cand_out[0], axis=0)
    cand_pct = float(np.mean(cand_128 == 1) * 100.0)
    cand_up = np.array(Image.fromarray(cand_128.astype(np.uint8)).resize((orig_w, orig_h), Image.NEAREST))
    cand_pred_binary = (cand_up == 1) & gt_valid
    
    # Prod
    prod_out = prod_sess.run(['output0'], {'images': norm_tensor})[0]
    prod_128 = np.argmax(prod_out[0], axis=0)
    prod_flood_128 = np.isin(prod_128, [1, 3, 5])
    prod_pct = float(np.mean(prod_flood_128) * 100.0)
    prod_up = np.array(Image.fromarray(prod_flood_128.astype(np.uint8)).resize((orig_w, orig_h), Image.NEAREST))
    prod_pred_binary = (prod_up == 1) & gt_valid
    
    gt_target = gt_flood & gt_valid
    
    # Metrics Candidate
    cand_inter = int(np.sum(gt_target & cand_pred_binary))
    cand_union = int(np.sum(gt_target | cand_pred_binary))
    cand_iou = (cand_inter / cand_union) if cand_union > 0 else (1.0 if np.sum(gt_target)==0 else 0.0)
    
    # Metrics Prod
    prod_inter = int(np.sum(gt_target & prod_pred_binary))
    prod_union = int(np.sum(gt_target | prod_pred_binary))
    prod_iou = (prod_inter / prod_union) if prod_union > 0 else (1.0 if np.sum(gt_target)==0 else 0.0)
    
    results.append({
        'filename': fname,
        'split': split,
        'gt_pct': round(gt_pct, 2),
        'cand_pct': round(cand_pct, 2),
        'prod_pct': round(prod_pct, 2),
        'cand_iou': round(cand_iou, 4),
        'prod_iou': round(prod_iou, 4)
    })

test_res = [r for r in results if r['split'] == 'test']
val_res = [r for r in results if r['split'] == 'val']
train_res = [r for r in results if r['split'] == 'train']

print('=== TEST SPLIT (5 images) ===')
for r in test_res:
    print(f"{r['filename']}: GT={r['gt_pct']}%, Cand={r['cand_pct']}% (IoU {r['cand_iou']:.3f}), Prod={r['prod_pct']}% (IoU {r['prod_iou']:.3f})")
print(f"Test Mean IoU -> Candidate: {np.mean([r['cand_iou'] for r in test_res]):.4f}, Production: {np.mean([r['prod_iou'] for r in test_res]):.4f}")

print('\n=== VAL SPLIT (5 images) ===')
for r in val_res:
    print(f"{r['filename']}: GT={r['gt_pct']}%, Cand={r['cand_pct']}% (IoU {r['cand_iou']:.3f}), Prod={r['prod_pct']}% (IoU {r['prod_iou']:.3f})")
print(f"Val Mean IoU -> Candidate: {np.mean([r['cand_iou'] for r in val_res]):.4f}, Production: {np.mean([r['prod_iou'] for r in val_res]):.4f}")

print(f"\n=== OVERALL (32 images) ===")
print(f"Overall Mean IoU -> Candidate: {np.mean([r['cand_iou'] for r in results]):.4f}, Production: {np.mean([r['prod_iou'] for r in results]):.4f}")

with open('scratch/flood_model_comparison_detailed.json', 'w') as f:
    json.dump({
        'test_mean_iou_candidate': float(np.mean([r['cand_iou'] for r in test_res])),
        'test_mean_iou_production': float(np.mean([r['prod_iou'] for r in test_res])),
        'val_mean_iou_candidate': float(np.mean([r['cand_iou'] for r in val_res])),
        'val_mean_iou_production': float(np.mean([r['prod_iou'] for r in val_res])),
        'overall_mean_iou_candidate': float(np.mean([r['cand_iou'] for r in results])),
        'overall_mean_iou_production': float(np.mean([r['prod_iou'] for r in results])),
        'per_image_results': results
    }, f, indent=2)
print("Saved scratch/flood_model_comparison_detailed.json")
