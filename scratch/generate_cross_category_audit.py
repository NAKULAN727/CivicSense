import os
import sys
import json
import csv
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# Load the raw dump
with open(r"e:\CivicSenseAI\scratch\raw_cross_category_dump.json", "r", encoding="utf-8") as f:
    raw_records = json.load(f)

# Deterministic Thresholding Rule:
# Rule Definition:
# 1. NO SIGNIFICANT WATER: water_coverage_pct < 5.0%
# 2. POSSIBLE WATER / AMBIGUOUS: 5.0% <= water_coverage_pct <= 20.0%
# 3. SIGNIFICANT WATER: water_coverage_pct > 20.0%
#
# Screening Detection Rule:
# An image is screened as positive for water if water_coverage_pct >= 5.0% (standard screening threshold)
# Substantial water coverage is flagged if water_coverage_pct > 20.0%

def classify_water_coverage(pct):
    if pct < 5.0:
        return "NO SIGNIFICANT WATER"
    elif pct <= 20.0:
        return "POSSIBLE WATER / AMBIGUOUS"
    else:
        return "SIGNIFICANT WATER"

processed_records = []

for r in raw_records:
    pct = r['raw_water_pct']
    water_category = classify_water_coverage(pct)
    is_screened_positive = pct >= 5.0
    substantial_water = pct > 20.0
    candidate_prediction = "SIGNIFICANT_WATER_DETECTED" if substantial_water else ("WATER_DETECTED" if is_screened_positive else "NO_WATER_DETECTED")
    
    rec = {
        'filename': r['filename'],
        'source_folder': r['source_folder'],
        'category': r['category'],
        'image_resolution': r['image_resolution'],
        'image_width': r['image_width'],
        'image_height': r['image_height'],
        'candidate_flood_prediction': candidate_prediction,
        'water_coverage_percentage': pct,
        'water_category': water_category,
        'substantial_water_coverage': substantial_water,
        'inference_latency_ms': r['latency_ms'],
        'water_mask_statistics': {
            'water_pixels': r['raw_water_pixels'],
            'total_pixels': r['total_pixels'],
            'mean_water_logit': r['mean_water_logit'],
            'mean_unlabeled_logit': r['mean_unlabeled_logit'],
            'logit_diff': r['logit_diff'],
            'min_water_logit': r['min_water_logit'],
            'max_water_logit': r['max_water_logit']
        },
        'confidence_statistics': {
            'mean_water_prob': r['mean_water_prob'],
            'max_water_prob': r['max_water_prob'],
            'min_water_prob': r['min_water_prob']
        }
    }
    processed_records.append(rec)

# Calculate Screening Counts
flood_records = [r for r in processed_records if r['source_folder'] == 'Flood']
pothole_records = [r for r in processed_records if r['source_folder'] == 'Pathole']
garbage_records = [r for r in processed_records if r['source_folder'] == 'Garbage']
non_flood_records = pothole_records + garbage_records

# A. Flood-positive screening: X/14
flood_positive_count = sum(1 for r in flood_records if r['water_coverage_percentage'] >= 5.0)
flood_total = len(flood_records)

# B. Pothole-category water detections: X/12
pothole_water_count = sum(1 for r in pothole_records if r['water_coverage_percentage'] >= 5.0)
pothole_total = len(pothole_records)

# C. Garbage-category water detections: Y/12
garbage_water_count = sum(1 for r in garbage_records if r['water_coverage_percentage'] >= 5.0)
garbage_total = len(garbage_records)

# D. Combined non-flood screening: (X+Y)/24
combined_non_flood_water_count = pothole_water_count + garbage_water_count
combined_non_flood_total = len(non_flood_records)

# Category distributions per folder
def get_distribution(recs):
    dist = {"NO SIGNIFICANT WATER": 0, "POSSIBLE WATER / AMBIGUOUS": 0, "SIGNIFICANT WATER": 0}
    for r in recs:
        dist[r['water_category']] += 1
    return dist

audit_data = {
    'audit_metadata': {
        'candidate_model_id': 'imadd/segformer-b0-finetuned-segments-water-2',
        'candidate_model_file': 'segformer_water_b0.onnx',
        'production_model_file': 'flood-water-segmentation.onnx',
        'production_status': 'ACTIVE PRODUCTION (UNCHANGED)',
        'candidate_status': 'BENCHMARK CANDIDATE',
        'audit_type': 'Cross-Category Negative False-Positive Audit',
        'dataset_folders_evaluated': ['Flood (14)', 'Pathole (12)', 'Garbage (12)'],
        'total_images_evaluated': len(processed_records),
        'non_flood_images_evaluated': combined_non_flood_total
    },
    'deterministic_threshold_rule': {
        'definition': 'Deterministic classification based on water coverage percentage across 128x128 output logits',
        'tiers': {
            'NO SIGNIFICANT WATER': '< 5.0% water mask coverage',
            'POSSIBLE WATER / AMBIGUOUS': '5.0% - 20.0% water mask coverage (localized wet patches, puddles, edges)',
            'SIGNIFICANT WATER': '> 20.0% water mask coverage (substantial standing water / street flooding)'
        },
        'screening_positive_rule': 'water_coverage_percentage >= 5.0% flags positive water screening'
    },
    'screening_results': {
        'flood_positive_screening': {
            'detected': flood_positive_count,
            'total': flood_total,
            'rate_percent': round((flood_positive_count / flood_total) * 100, 2),
            'formatted': f"{flood_positive_count}/{flood_total}"
        },
        'pothole_water_screening': {
            'detected': pothole_water_count,
            'total': pothole_total,
            'rate_percent': round((pothole_water_count / pothole_total) * 100, 2),
            'formatted': f"{pothole_water_count}/{pothole_total}"
        },
        'garbage_water_screening': {
            'detected': garbage_water_count,
            'total': garbage_total,
            'rate_percent': round((garbage_water_count / garbage_total) * 100, 2),
            'formatted': f"{garbage_water_count}/{garbage_total}"
        },
        'combined_non_flood_screening': {
            'detected': combined_non_flood_water_count,
            'total': combined_non_flood_total,
            'rate_percent': round((combined_non_flood_water_count / combined_non_flood_total) * 100, 2),
            'formatted': f"{combined_non_flood_water_count}/{combined_non_flood_total}"
        }
    },
    'category_distributions': {
        'Flood': get_distribution(flood_records),
        'Pathole': get_distribution(pothole_records),
        'Garbage': get_distribution(garbage_records),
        'Combined_Non_Flood': get_distribution(non_flood_records)
    },
    'statistical_insights': {
        'flood_mean_coverage_percent': round(float(np.mean([r['water_coverage_percentage'] for r in flood_records])), 2),
        'pothole_mean_coverage_percent': round(float(np.mean([r['water_coverage_percentage'] for r in pothole_records])), 2),
        'garbage_mean_coverage_percent': round(float(np.mean([r['water_coverage_percentage'] for r in garbage_records])), 2),
        'dry_road_sample_coverage_percent': next((r['water_coverage_percentage'] for r in pothole_records if 'road without pothole' in r['filename']), None),
        'mean_latency_ms': round(float(np.mean([r['inference_latency_ms'] for r in processed_records])), 2),
        'key_finding': 'The candidate model predicts >81% water coverage uniformly across ALL 24 non-flood images (mean pothole coverage: 92.81%, mean garbage coverage: 88.75%), including clean dry asphalt. The logit margin (Class 0 water vs Class 1 background) is virtually static (+0.12 to +0.14) regardless of scene content, indicating degenerate feature discrimination or persistent positive head bias.'
    },
    'candidate_recommendation': {
        'decision': 'REJECT DUE TO FALSE POSITIVES',
        'rationale': 'The candidate model (imadd/segformer-b0-finetuned-segments-water-2) exhibits catastrophic cross-category false positives, detecting >81% water on 24/24 non-flood images (100% false-positive screening rate). Clean dry roads and garbage heaps are flagged as severe flooding. Replacing or deploying this model would cause systemic false alarms across the entire CivicSense platform.',
        'production_action': 'Retain flood-water-segmentation.onnx as ACTIVE PRODUCTION. Do not deploy segformer_water_b0.onnx.'
    },
    'audit_records': processed_records
}

# Write JSON
json_path = r"e:\CivicSenseAI\scratch\flood_candidate_cross_category_audit.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(audit_data, f, indent=2)

print(f"Wrote JSON audit to: {json_path}")

# Write CSV
csv_path = r"e:\CivicSenseAI\scratch\flood_candidate_cross_category_audit.csv"
fieldnames = [
    'filename',
    'source_folder',
    'category',
    'image_resolution',
    'candidate_flood_prediction',
    'water_coverage_percentage',
    'water_category',
    'substantial_water_coverage',
    'mean_water_prob',
    'max_water_prob',
    'logit_diff',
    'water_pixels',
    'total_pixels',
    'inference_latency_ms'
]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for r in processed_records:
        writer.writerow({
            'filename': r['filename'],
            'source_folder': r['source_folder'],
            'category': r['category'],
            'image_resolution': r['image_resolution'],
            'candidate_flood_prediction': r['candidate_flood_prediction'],
            'water_coverage_percentage': r['water_coverage_percentage'],
            'water_category': r['water_category'],
            'substantial_water_coverage': r['substantial_water_coverage'],
            'mean_water_prob': r['confidence_statistics']['mean_water_prob'],
            'max_water_prob': r['confidence_statistics']['max_water_prob'],
            'logit_diff': r['water_mask_statistics']['logit_diff'],
            'water_pixels': r['water_mask_statistics']['water_pixels'],
            'total_pixels': r['water_mask_statistics']['total_pixels'],
            'inference_latency_ms': r['inference_latency_ms']
        })

print(f"Wrote CSV audit to: {csv_path}")

print("\n=== SCREENING RESULTS ===")
print(f"A. Flood-positive screening: {audit_data['screening_results']['flood_positive_screening']['formatted']} ({audit_data['screening_results']['flood_positive_screening']['rate_percent']}%)")
print(f"B. Pothole-category water detections: {audit_data['screening_results']['pothole_water_screening']['formatted']} ({audit_data['screening_results']['pothole_water_screening']['rate_percent']}%)")
print(f"C. Garbage-category water detections: {audit_data['screening_results']['garbage_water_screening']['formatted']} ({audit_data['screening_results']['garbage_water_screening']['rate_percent']}%)")
print(f"D. Combined non-flood screening: {audit_data['screening_results']['combined_non_flood_screening']['formatted']} ({audit_data['screening_results']['combined_non_flood_screening']['rate_percent']}%)")
print(f"Recommendation: {audit_data['candidate_recommendation']['decision']}")
