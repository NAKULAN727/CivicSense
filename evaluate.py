import os
import csv
import json
import numpy as np
from PIL import Image
from detectors import CivicSenseEngine

def main():
    print("================================================================================")
    print("CIVICSENSE AI — FULL DATASET EVALUATION & BENCHMARKING (94 IMAGES)")
    print("================================================================================")
    
    engine = CivicSenseEngine.get_instance()
    
    base_dir = "Real Test Datas"
    folders = ["Flood", "Garbage", "Pathole"]
    
    results = []
    category_matches = 0
    total_images = 0
    
    cat_true = []
    cat_pred = []
    
    for folder in folders:
        fdir = os.path.join(base_dir, folder)
        files = sorted(os.listdir(fdir))
        for fname in files:
            fpath = os.path.join(fdir, fname)
            total_images += 1
            
            # Ground truth category
            if fname == "road without pothole.webp":
                true_cat = "OTHER"
            else:
                true_cat = "POTHOLE" if folder == "Pathole" else folder.upper()
                
            try:
                im = Image.open(fpath)
                w, h = im.size
                _, payload = engine.process_image(im)
                
                pred_cat = payload["category"]
                pred_conf = payload["category_confidence"]
                pred_type = payload["type"]
                type_conf = payload["type_confidence"]
                water_cov = payload["water_coverage_pct"]
                warnings = "; ".join(payload["warnings"])
                
                is_match = (pred_cat == true_cat) or (true_cat == "OTHER" and pred_cat in ["OTHER", "UNCERTAIN"])
                if is_match:
                    category_matches += 1
                    match_str = "MATCH"
                else:
                    match_str = "MISMATCH"
                    
                cat_true.append(true_cat)
                cat_pred.append(pred_cat)
                
                results.append({
                    "filename": fname,
                    "folder": folder,
                    "resolution": f"{w}x{h}",
                    "true_category": true_cat,
                    "predicted_category": pred_cat,
                    "category_confidence": pred_conf,
                    "predicted_type": pred_type,
                    "type_confidence": type_conf,
                    "water_coverage_pct": water_cov,
                    "match_status": match_str,
                    "warnings": warnings
                })
                print(f"[{total_images:>2}/94] {fname:<25} | True: {true_cat:<7} | Pred: {pred_cat:<7} ({pred_conf*100:>5.1f}%) | Type: {pred_type:<32} | {match_str}")
            except Exception as e:
                print(f"Error processing {fname}: {e}")
                
    accuracy = (category_matches / total_images) * 100.0
    print("\n================================================================================")
    print(f"OVERALL EVALUATION ACCURACY: {category_matches}/{total_images} ({accuracy:.2f}%)")
    print("================================================================================")
    
    os.makedirs("reports", exist_ok=True)
    
    # Write CSV
    csv_path = "reports/evaluation_results.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "filename", "folder", "resolution", "true_category", "predicted_category",
            "category_confidence", "predicted_type", "type_confidence", "water_coverage_pct",
            "match_status", "warnings"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    print(f"Saved evaluation table CSV to '{csv_path}'")
    
    # Load calibration metrics from training
    metrics_path = "models/category_classifier_metrics.json"
    cat_metrics = {}
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            cat_metrics = json.load(f)
            
    # Write Markdown Report
    md_path = "reports/evaluation_report.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# CivicSense AI — Image-Upload Detection Evaluation Report\n\n")
        f.write(f"- **Total Test Images**: {total_images} (Flood: 32, Garbage: 30, Pothole/Road: 32)\n")
        f.write(f"- **Category Accuracy**: {category_matches}/{total_images} ({accuracy:.2f}%)\n")
        f.write(f"- **5-Fold Cross-Validation Accuracy**: {cat_metrics.get('cv_accuracy', 0)*100:.2f}%\n")
        f.write(f"- **Optimal Calibration Temperature (T)**: {cat_metrics.get('optimal_temperature', 1.0)}\n")
        f.write(f"- **ECE Before Calibration**: {cat_metrics.get('ece_before_pct', 0)}%\n")
        f.write(f"- **ECE After Calibration**: {cat_metrics.get('ece_after_pct', 0)}%\n\n")
        
        f.write("## 1. Category-Level Performance\n\n")
        f.write("| Category | Total Images | Correct Matches | Recall Rate |\n")
        f.write("|:---|:---:|:---:|:---:|\n")
        for c in ["FLOOD", "GARBAGE", "POTHOLE", "OTHER"]:
            c_tot = sum(1 for r in results if r["true_category"] == c)
            c_mat = sum(1 for r in results if r["true_category"] == c and r["match_status"] == "MATCH")
            r_rate = (c_mat / c_tot * 100.0) if c_tot > 0 else 0.0
            f.write(f"| {c} | {c_tot} | {c_mat} | {r_rate:.1f}% |\n")
            
        f.write("\n## 2. Low-Resolution Edge Cases (< 60,000 px)\n\n")
        f.write("The system applies low-resolution protection capping confidence at 70% and flagging `LOW IMAGE RESOLUTION - needs review`:\n\n")
        f.write("| Filename | Resolution | Pred Category | Conf | Pred Type | Match |\n")
        f.write("|:---|:---:|:---:|:---:|:---|:---:|\n")
        for r in results:
            if "LOW IMAGE RESOLUTION" in r["warnings"]:
                f.write(f"| {r['filename']} | {r['resolution']} | {r['predicted_category']} | {r['category_confidence']} | {r['predicted_type']} | {r['match_status']} |\n")
                
        f.write("\n## 3. Full Per-Image Test Results\n\n")
        f.write("| File | True Category | Predicted Category | Conf | Predicted Type | Type Conf | Water % | Status |\n")
        f.write("|:---|:---|:---|:---:|:---|:---:|:---:|:---:|\n")
        for r in results:
            f.write(f"| {r['filename']} | {r['true_category']} | {r['predicted_category']} | {r['category_confidence']} | {r['predicted_type']} | {r['type_confidence']} | {r['water_coverage_pct']}% | {r['match_status']} |\n")
            
    print(f"Saved evaluation markdown report to '{md_path}'")

if __name__ == "__main__":
    main()

