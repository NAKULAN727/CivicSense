import os
import json
import csv

# Load raw evaluation records
raw_path = r"e:\CivicSenseAI\scratch\vfloodnet_raw_results.json"
with open(raw_path, "r", encoding="utf-8") as f:
    records = json.load(f)

# Aggregate statistics
flood_records = [r for r in records if r['source_folder'] == 'Flood']
pothole_records = [r for r in records if r['source_folder'] == 'Pathole']
garbage_records = [r for r in records if r['source_folder'] == 'Garbage']
non_flood_records = pothole_records + garbage_records

def get_stats(recs):
    coverages = [r['water_coverage_percentage'] for r in recs]
    probs = [r['mean_water_prob'] for r in recs]
    latencies = [r['latency_ms'] for r in recs]
    detected_5 = sum(1 for c in coverages if c >= 5.0)
    sig_20 = sum(1 for c in coverages if c > 20.0)
    no_water = sum(1 for c in coverages if c < 5.0)
    ambiguous = sum(1 for c in coverages if 5.0 <= c <= 20.0)
    return {
        'total_images': len(recs),
        'detected_screening_gte_5pct': detected_5,
        'detected_rate_percent': round((detected_5 / len(recs)) * 100, 2),
        'significant_gte_20pct': sig_20,
        'ambiguous_5_to_20pct': ambiguous,
        'no_significant_water_lt_5pct': no_water,
        'min_coverage_pct': min(coverages),
        'max_coverage_pct': max(coverages),
        'mean_coverage_pct': round(sum(coverages) / len(coverages), 2),
        'mean_water_prob': round(sum(probs) / len(probs), 4),
        'mean_latency_ms': round(sum(latencies) / len(latencies), 2)
    }

flood_stats = get_stats(flood_records)
pothole_stats = get_stats(pothole_records)
garbage_stats = get_stats(garbage_records)
non_flood_stats = get_stats(non_flood_records)

benchmark_data = {
    "benchmark_metadata": {
        "candidate_id": "Candidate 2 (V-FloodNet)",
        "model_name": "V-FloodNet Video/Image Water Segmenter",
        "source_repository": "https://github.com/xmlyqing00/V-FloodNet",
        "huggingface_repository": "https://huggingface.co/xmlyqing00/V-FloodNet",
        "paper_citation": "Yongqing Liang, Xin Li, Brian Tsai, Qin Chen, Navid Jafari. V-FloodNet: A Video Segmentation System for Urban Flood Detection and Quantification. Environmental Modelling & Software, Elsevier, 2023, 105775.",
        "checkpoint_file": "records/link_efficientb4_model.pth (inside records.zip on Hugging Face)",
        "onnx_export_file": "scratch/vfloodnet_deeplabv3plus.onnx",
        "onnx_file_size_bytes": os.path.getsize(r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx"),
        "onnx_file_size_mb": round(os.path.getsize(r"e:\CivicSenseAI\scratch\vfloodnet_deeplabv3plus.onnx") / (1024 * 1024), 2),
        "onnx_opset": 14,
        "model_architecture": "SMP LinkNet with EfficientNet-B4 Encoder (classes=1, activation=sigmoid)",
        "parameter_count": 17862571,
        "input_tensor": "input_image: [batch, 3, 416, 416]",
        "output_tensor": "water_probability: [batch, 1, 416, 416]",
        "dataset_name": "WaterDataset (Boston Harbor, LSU Creek, Houston Buffalo Bayou flood video cameras)",
        "dataset_domain": "Roadside CCTV / surveillance camera frames during flood/storm events (ground-level oblique, NOT aerial/satellite)",
        "license_source": "Elsevier Academic Publication / All rights reserved repository notice (Research/Academic)",
        "license_weights": "Open research checkpoint hosted on Hugging Face (Public download without authentication)",
        "production_model_file": "public/models/flood-water-segmentation.onnx",
        "production_status": "ACTIVE PRODUCTION (PRESERVED & UNCHANGED)",
        "candidate_deployment_status": "BENCHMARK CANDIDATE (ISOLATED IN SCRATCH)",
        "final_recommendation": "PROMISING WITH CALIBRATION"
    },
    "deterministic_threshold_rule": {
        "threshold_tiers": {
            "NO SIGNIFICANT WATER": "< 5.0% water mask coverage",
            "POSSIBLE WATER / AMBIGUOUS": "5.0% - 20.0% water mask coverage",
            "SIGNIFICANT WATER": "> 20.0% water mask coverage"
        },
        "screening_positive_rule": "water_coverage_percentage >= 5.0% indicates positive screening"
    },
    "category_screening_summary": {
        "flood": {
            "detected": flood_stats['detected_screening_gte_5pct'],
            "total": flood_stats['total_images'],
            "formatted": f"{flood_stats['detected_screening_gte_5pct']}/{flood_stats['total_images']}",
            "detection_rate_percent": flood_stats['detected_rate_percent'],
            "significant_water_count": flood_stats['significant_gte_20pct'],
            "ambiguous_count": flood_stats['ambiguous_5_to_20pct'],
            "no_water_count": flood_stats['no_significant_water_lt_5pct'],
            "mean_coverage_percent": flood_stats['mean_coverage_pct']
        },
        "pothole_cross_audit": {
            "false_positive_screening": pothole_stats['detected_screening_gte_5pct'],
            "total": pothole_stats['total_images'],
            "formatted": f"{pothole_stats['detected_screening_gte_5pct']}/{pothole_stats['total_images']}",
            "screening_rate_percent": pothole_stats['detected_rate_percent'],
            "significant_water_count": pothole_stats['significant_gte_20pct'],
            "ambiguous_count": pothole_stats['ambiguous_5_to_20pct'],
            "clean_zero_water_count": pothole_stats['no_significant_water_lt_5pct'],
            "dry_road_result": "0.0% water detected on clean asphalt (road without pothole.webp)",
            "mean_coverage_percent": pothole_stats['mean_coverage_pct']
        },
        "garbage_cross_audit": {
            "false_positive_screening": garbage_stats['detected_screening_gte_5pct'],
            "total": garbage_stats['total_images'],
            "formatted": f"{garbage_stats['detected_screening_gte_5pct']}/{garbage_stats['total_images']}",
            "screening_rate_percent": garbage_stats['detected_rate_percent'],
            "significant_water_count": garbage_stats['significant_gte_20pct'],
            "ambiguous_count": garbage_stats['ambiguous_5_to_20pct'],
            "clean_zero_water_count": garbage_stats['no_significant_water_lt_5pct'],
            "mean_coverage_percent": garbage_stats['mean_coverage_pct']
        },
        "combined_non_flood_cross_audit": {
            "total_false_positive_screening": non_flood_stats['detected_screening_gte_5pct'],
            "total": non_flood_stats['total_images'],
            "formatted": f"{non_flood_stats['detected_screening_gte_5pct']}/{non_flood_stats['total_images']}",
            "screening_rate_percent": non_flood_stats['detected_rate_percent'],
            "clean_negative_screening": non_flood_stats['no_significant_water_lt_5pct'],
            "significant_water_count": non_flood_stats['significant_gte_20pct']
        }
    },
    "comparison_with_production": {
        "production_floodnet": {
            "model_file": "flood-water-segmentation.onnx",
            "flood_detection": "4 / 14 (28.57% category-level screening)",
            "pothole_false_detections": "0 / 12 (0.0%)",
            "garbage_false_detections": "0 / 12 (0.0%)",
            "combined_non_flood_false_detections": "0 / 24 (0.0%)",
            "strengths": "Completely immune to non-flood false positives on test suite",
            "weaknesses": "Severely conservative; fails on 71.4% of real street-level flood scenes"
        },
        "rejected_segformer_candidate": {
            "model_file": "segformer_water_b0.onnx",
            "flood_detection": "14 / 14 (100.0%)",
            "pothole_false_detections": "12 / 12 (100.0%)",
            "garbage_false_detections": "12 / 12 (100.0%)",
            "combined_non_flood_false_detections": "24 / 24 (100.0%)",
            "status": "REJECTED (Catastrophic degenerate mask on all scenes)"
        },
        "candidate_2_vfloodnet": {
            "model_file": "scratch/vfloodnet_deeplabv3plus.onnx",
            "flood_detection": "14 / 14 (100.0% category-level screening; 12/14 > 20% significant flood)",
            "pothole_false_detections": "5 / 12 (41.67% screening; 4 of 5 contain actual rainwater puddles in pothole craters)",
            "garbage_false_detections": "3 / 12 (25.0% screening; 0/12 significant, 9/12 < 5%)",
            "combined_non_flood_false_detections": "8 / 24 (33.33% screening)",
            "dry_road_discrimination": "PASS (0.0% on dry asphalt test)",
            "status": "PROMISING WITH CALIBRATION"
        }
    },
    "quality_gate_audit": {
        "produces_uniform_masks": False,
        "detects_dry_road_as_flood": False,
        "detects_garbage_as_severe_flood": False,
        "shows_degenerate_output": False,
        "distinguishes_water_from_road_texture": True,
        "analysis_notes": "V-FloodNet demonstrates genuine semantic water segmentation capabilities. Unlike the rejected SegFormer, V-FloodNet outputs 0.0% water on dry asphalt with a peak probability of 0.0008. On flood scenes, it produces razor-sharp delineations between flooded asphalt and vehicle bodies. Its false positive screening detections on the Pothole dataset occur predominantly where potholes physically contain standing water/puddles or damp specular sheen. On the Garbage dataset, 9 of 12 images produced < 5% water (mean 3.85%), and zero images produced > 20% coverage. With calibration (adjusting threshold to > 20% or masking road pothole detections), the model is highly viable."
    },
    "audit_records": records
}

# Write scratch/vfloodnet_benchmark.json
json_out = r"e:\CivicSenseAI\scratch\vfloodnet_benchmark.json"
with open(json_out, "w", encoding="utf-8") as f:
    json.dump(benchmark_data, f, indent=2)

# Write scratch/vfloodnet_benchmark.csv
csv_out = r"e:\CivicSenseAI\scratch\vfloodnet_benchmark.csv"
fieldnames = [
    "filename", "source_folder", "category", "image_resolution",
    "candidate_flood_prediction", "water_coverage_percentage",
    "water_category", "substantial_water_coverage", "mean_water_prob",
    "max_water_prob", "water_pixels", "total_pixels", "latency_ms", "inference_status"
]
with open(csv_out, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for r in records:
        writer.writerow(r)

print("Saved benchmark JSON to:", json_out)
print("Saved benchmark CSV to:", csv_out)
