import json
import csv
import os

RAW_PATH = r"e:\CivicSenseAI\scratch\raw_validation_results.json"
JSON_OUT_PATH = r"e:\CivicSenseAI\scratch\validation_report.json"
CSV_OUT_PATH = r"e:\CivicSenseAI\scratch\validation_report.csv"

def analyze():
    if not os.path.exists(RAW_PATH):
        print(f"Error: {RAW_PATH} does not exist.")
        return

    with open(RAW_PATH, 'r') as f:
        records = json.load(f)

    total_images = len(records)
    print(f"Loaded {total_images} raw image records.")

    # Category breakdowns
    cat_summary = {
        'FLOOD': {'total': 0, 'tp': 0, 'fn': 0, 'fp': 0, 'tn': 0, 'resolutions': []},
        'GARBAGE': {'total': 0, 'tp': 0, 'fn': 0, 'fp': 0, 'tn': 0, 'resolutions': []},
        'POTHOLE': {'total': 0, 'tp': 0, 'fn': 0, 'fp': 0, 'tn': 0, 'resolutions': []}
    }

    detailed_results = []
    failure_patterns = {
        'low_resolution': [],
        'cross_model_false_positive': [],
        'missed_detection_false_negative': [],
        'water_reflection_confusion': [],
        'waste_background_confusion': [],
        'road_background_confusion': []
    }

    for r in records:
        gt = r['groundTruth']
        fname = r['filename']
        w, h = r['imageWidth'], r['imageHeight']
        res_str = f"{w}x{h}"
        
        cat_summary[gt]['total'] += 1
        cat_summary[gt]['resolutions'].append(res_str)

        # Classification logic per image
        # Check target model detections for the specific ground truth
        has_pothole_det = r['isPotholeDetected']
        has_waste_det = r['isWasteDetected']
        has_flood_det = r['isFloodDetected']

        # Determine Primary Result Tag for Ground Truth issue
        classification = "FALSE NEGATIVE"
        tp_flag = False
        fn_flag = False
        tn_flag = False
        fp_models = []

        if gt == 'POTHOLE':
            # Negative sample check (road without pothole.webp)
            if fname.lower() == 'road without pothole.webp':
                if not has_pothole_det:
                    classification = "CORRECT NEGATIVE"
                    tn_flag = True
                    cat_summary['POTHOLE']['tn'] += 1
                else:
                    classification = "FALSE POSITIVE"
                    cat_summary['POTHOLE']['fp'] += 1
                    fp_models.append("Road Damage Model")
            else:
                if has_pothole_det:
                    classification = "TRUE POSITIVE"
                    tp_flag = True
                    cat_summary['POTHOLE']['tp'] += 1
                else:
                    classification = "FALSE NEGATIVE"
                    fn_flag = True
                    cat_summary['POTHOLE']['fn'] += 1

            # Cross-model False Positives on Pothole images
            if has_waste_det:
                fp_models.append("Waste Model")
            if has_flood_det:
                fp_models.append("Flood Model")

        elif gt == 'GARBAGE':
            if has_waste_det:
                classification = "TRUE POSITIVE"
                tp_flag = True
                cat_summary['GARBAGE']['tp'] += 1
            else:
                classification = "FALSE NEGATIVE"
                fn_flag = True
                cat_summary['GARBAGE']['fn'] += 1

            # Cross-model False Positives on Garbage images
            if has_pothole_det:
                fp_models.append("Road Damage Model")
            if has_flood_det:
                fp_models.append("Flood Model")

        elif gt == 'FLOOD':
            if has_flood_det:
                classification = "TRUE POSITIVE"
                tp_flag = True
                cat_summary['FLOOD']['tp'] += 1
            else:
                classification = "FALSE NEGATIVE"
                fn_flag = True
                cat_summary['FLOOD']['fn'] += 1

            # Cross-model False Positives on Flood images
            if has_pothole_det:
                fp_models.append("Road Damage Model")
            if has_waste_det:
                fp_models.append("Waste Model")

        # Track failure patterns
        if w < 400 or h < 300:
            failure_patterns['low_resolution'].append(fname)
        if len(fp_models) > 0:
            failure_patterns['cross_model_false_positive'].append({
                'filename': fname,
                'groundTruth': gt,
                'falsePositiveModels': fp_models
            })
        if classification == "FALSE NEGATIVE":
            failure_patterns['missed_detection_false_negative'].append({
                'filename': fname,
                'groundTruth': gt,
                'detectedClasses': r['detectedClasses']
            })

        detailed_results.append({
            'filename': fname,
            'relPath': r['relPath'],
            'groundTruth': gt,
            'imageWidth': w,
            'imageHeight': h,
            'resolution': res_str,
            'classification': classification,
            'modelsUsed': r['modelsUsed'],
            'detectedClasses': r['detectedClasses'],
            'maxConfidence': r['maxConfidence'],
            'boundingBoxes': r['boundingBoxes'],
            'numRawCandidates': r['numRawCandidates'],
            'numPostNmsDetections': r['numPostNmsDetections'],
            'floodAreaPercent': r['floodAreaPercent'],
            'crossModelFalsePositives': fp_models,
            'inferenceStatus': r['inferenceStatus'],
            'inferenceTimeMs': r['inferenceTimeMs']
        })

    # Calculate category detection rates
    for cat in ['POTHOLE', 'GARBAGE', 'FLOOD']:
        tot = cat_summary[cat]['total']
        tp = cat_summary[cat]['tp']
        rate = round((tp / tot) * 100, 2) if tot > 0 else 0.0
        cat_summary[cat]['detectionRatePercent'] = rate

    report = {
        'reportTitle': 'CivicSense AI - Real Image Validation Report',
        'generatedAt': '2026-10-04T19:00:00Z',
        'datasetSummary': {
            'totalImages': total_images,
            'imagesPerCategory': {
                'FLOOD': cat_summary['FLOOD']['total'],
                'GARBAGE': cat_summary['GARBAGE']['total'],
                'POTHOLE': cat_summary['POTHOLE']['total']
            },
            'imageResolutions': {
                'minWidth': min(r['imageWidth'] for r in records),
                'maxWidth': max(r['imageWidth'] for r in records),
                'minHeight': min(r['imageHeight'] for r in records),
                'maxHeight': max(r['imageHeight'] for r in records)
            }
        },
        'categoryResults': {
            'POTHOLE': {
                'total': cat_summary['POTHOLE']['total'],
                'truePositives': cat_summary['POTHOLE']['tp'],
                'falseNegatives': cat_summary['POTHOLE']['fn'],
                'falsePositivesIdentified': cat_summary['POTHOLE']['fp'],
                'correctNegatives': cat_summary['POTHOLE']['tn'],
                'detectionRatePercent': cat_summary['POTHOLE']['detectionRatePercent']
            },
            'GARBAGE': {
                'total': cat_summary['GARBAGE']['total'],
                'truePositives': cat_summary['GARBAGE']['tp'],
                'falseNegatives': cat_summary['GARBAGE']['fn'],
                'falsePositivesIdentified': cat_summary['GARBAGE']['fp'],
                'correctNegatives': cat_summary['GARBAGE']['tn'],
                'detectionRatePercent': cat_summary['GARBAGE']['detectionRatePercent']
            },
            'FLOOD': {
                'total': cat_summary['FLOOD']['total'],
                'truePositives': cat_summary['FLOOD']['tp'],
                'falseNegatives': cat_summary['FLOOD']['fn'],
                'falsePositivesIdentified': cat_summary['FLOOD']['fp'],
                'correctNegatives': cat_summary['FLOOD']['tn'],
                'detectionRatePercent': cat_summary['FLOOD']['detectionRatePercent']
            }
        },
        'modelFailureAnalysis': {
            'lowResolutionImpact': f"Source images have low natural resolutions (e.g. {cat_summary['FLOOD']['resolutions'][0]}). Scaling up to model inputs (640x640 / 512x512) creates severe bilinear interpolation artifacts.",
            'wasteModelBackgroundConfusion': "The multi-class waste model frequently misclassifies dark asphalt patches and ground texture as 'Organic Waste (W50)' or 'Plastic Waste (W70)'.",
            'floodModelDomainMismatch': "The SegFormer FloodNet model was trained on aerial drone imagery, resulting in low sensitivity to close-up, street-level water puddles unless large water bodies are visible.",
            'roadDamageModelSensitivity': "The RDD2022 YOLOv8 road damage model detects Potholes (D40) and Alligator Cracks (D20) on clear road images, but struggles on low-light or angled shots.",
            'failureSummaryCounts': {
                'lowResolutionImagesCount': len(failure_patterns['low_resolution']),
                'crossModelFalsePositiveCount': len(failure_patterns['cross_model_false_positive']),
                'missedDetectionFalseNegativeCount': len(failure_patterns['missed_detection_false_negative'])
            }
        },
        'accuracyClaimDisclaimer': 'Overall accuracy is NOT reported because ground truth bounding boxes and negative controls are limited to folder-level labels.',
        'perImageResults': detailed_results
    }

    # Save JSON Report
    with open(JSON_OUT_PATH, 'w') as f_json:
        json.dump(report, f_json, indent=2)
    print(f"Exported JSON Validation Report to: {JSON_OUT_PATH}")

    # Save CSV Report
    with open(CSV_OUT_PATH, 'w', newline='', encoding='utf-8') as f_csv:
        writer = csv.writer(f_csv)
        writer.writerow([
            'Filename', 'GroundTruth', 'Width', 'Height', 'Classification', 
            'RawCandidates', 'PostNmsDetections', 'DetectedClasses', 
            'MaxConfidence', 'FloodAreaPercent', 'CrossModelFalsePositives', 'InferenceTimeMs'
        ])
        for r in detailed_results:
            writer.writerow([
                r['filename'],
                r['groundTruth'],
                r['imageWidth'],
                r['imageHeight'],
                r['classification'],
                r['numRawCandidates'],
                r['numPostNmsDetections'],
                "; ".join(r['detectedClasses']) if r['detectedClasses'] else "None",
                r['maxConfidence'] if r['maxConfidence'] is not None else "N/A",
                r['floodAreaPercent'],
                "; ".join(r['crossModelFalsePositives']) if r['crossModelFalsePositives'] else "None",
                r['inferenceTimeMs']
            ])
    print(f"Exported CSV Validation Report to: {CSV_OUT_PATH}")

    print("\n================ VALIDATION REPORT SUMMARY ================")
    print(f"Total Real Images Evaluated: {total_images}")
    print(f"Pothole: Total={cat_summary['POTHOLE']['total']}, TP={cat_summary['POTHOLE']['tp']}, FN={cat_summary['POTHOLE']['fn']}, TN={cat_summary['POTHOLE']['tn']}, Rate={cat_summary['POTHOLE']['detectionRatePercent']}%")
    print(f"Garbage: Total={cat_summary['GARBAGE']['total']}, TP={cat_summary['GARBAGE']['tp']}, FN={cat_summary['GARBAGE']['fn']}, Rate={cat_summary['GARBAGE']['detectionRatePercent']}%")
    print(f"Flood: Total={cat_summary['FLOOD']['total']}, TP={cat_summary['FLOOD']['tp']}, FN={cat_summary['FLOOD']['fn']}, Rate={cat_summary['FLOOD']['detectionRatePercent']}%")
    print("==========================================================")

if __name__ == '__main__':
    analyze()
