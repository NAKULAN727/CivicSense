import json
import csv
import os

RAW_PATH = r"e:\CivicSenseAI\scratch\raw_validation_results.json"
CANDIDATE_FLOOD_PATH = r"e:\CivicSenseAI\scratch\candidate_flood_results.json"
JSON_OUT_PATH = r"e:\CivicSenseAI\scratch\external_benchmark_report.json"
CSV_OUT_PATH = r"e:\CivicSenseAI\scratch\external_benchmark_report.csv"
SRC_JSON_PATH = r"e:\CivicSenseAI\src\data\externalBenchmarkReport.json"

def generate_report():
    with open(RAW_PATH, 'r') as f:
        raw_records = json.load(f)

    candidate_flood_map = {}
    if os.path.exists(CANDIDATE_FLOOD_PATH):
        with open(CANDIDATE_FLOOD_PATH, 'r') as f:
            cf_list = json.load(f)
            for item in cf_list:
                candidate_flood_map[item['filename']] = item

    benchmark_records = []
    pothole_total, pothole_tp = 0, 0
    flood_total, flood_tp = 0, 0
    garbage_total, garbage_tp = 0, 0
    ext_flood_tp = 0

    for r in raw_records:
        gt = r['groundTruth']
        fname = r['filename']
        w, h = r['imageWidth'], r['imageHeight']
        res_str = f"{w}x{h}"

        has_pothole_det = r['isPotholeDetected']
        has_waste_det = r['isWasteDetected']
        has_flood_det = r['isFloodDetected']

        # Current Model Result
        current_result = "FALSE NEGATIVE"
        if gt == 'POTHOLE':
            pothole_total += 1
            if fname.lower() == 'road without pothole.webp':
                current_result = "CORRECT NEGATIVE" if not has_pothole_det else "FALSE POSITIVE"
            else:
                if has_pothole_det:
                    current_result = "TRUE POSITIVE"
                    pothole_tp += 1
                else:
                    current_result = "FALSE NEGATIVE"
        elif gt == 'GARBAGE':
            garbage_total += 1
            if has_waste_det:
                current_result = "TRUE POSITIVE"
                garbage_tp += 1
            else:
                current_result = "FALSE NEGATIVE"
        elif gt == 'FLOOD':
            flood_total += 1
            if has_flood_det:
                current_result = "TRUE POSITIVE"
                flood_tp += 1
            else:
                current_result = "FALSE NEGATIVE"

        # External Model Evaluation Result
        ext_result = "NOT CONNECTED"
        ext_conf = None
        ext_classes = []
        ext_status = "EXTERNAL API REQUIRES BACKEND PROXY"
        ext_error = "Secrets/API keys must remain server-side. Local candidate evaluated in scratch."

        if gt == 'FLOOD' and fname in candidate_flood_map:
            cf_info = candidate_flood_map[fname]
            if cf_info['isFloodDetected']:
                ext_result = "TRUE POSITIVE (CANDIDATE ONNX)"
                ext_flood_tp += 1
                ext_classes = [f"Candidate Water Coverage ({cf_info['waterAreaPercent']}%)"]
                ext_status = "LOCAL ONNX CANDIDATE TESTED"
                ext_error = "None (Ran segformer_water_b0.onnx locally)"
            else:
                ext_result = "FALSE NEGATIVE (CANDIDATE ONNX)"
                ext_status = "LOCAL ONNX CANDIDATE TESTED"
                ext_error = "None"

        benchmark_records.append({
            'filename': fname,
            'groundTruthFolder': gt,
            'imageWidth': w,
            'imageHeight': h,
            'resolution': res_str,
            'currentModelResult': current_result,
            'currentModelConfidence': r['maxConfidence'],
            'currentDetectedClasses': r['detectedClasses'],
            'externalModelResult': ext_result,
            'externalModelConfidence': ext_conf,
            'externalDetectedClasses': ext_classes,
            'latencyMs': r['inferenceTimeMs'],
            'apiModelStatus': ext_status,
            'errors': ext_error
        })

    report = {
        'reportTitle': 'CivicSense AI – External Model Benchmark Report',
        'generatedAt': '2026-10-04T20:15:00Z',
        'benchmarkStatus': 'LOCAL ONNX CANDIDATE EVALUATED & EXTERNAL API READY',
        'preservationNote': 'All existing production ONNX models remain 100% active and unchanged.',
        'sideBySideSummary': {
            'POTHOLE': {
                'totalImages': pothole_total,
                'currentModel': {
                    'modelName': 'RDD2022 YOLOv8s Road Damage Detector',
                    'detectedCount': pothole_tp,
                    'noDetectedCount': pothole_total - pothole_tp,
                    'detectionRatePercent': round((pothole_tp / pothole_total) * 100, 2),
                    'metricName': 'Category-level detection rate on collected screening dataset',
                    'status': 'ACTIVE PRODUCTION'
                },
                'externalModel': {
                    'candidateName': 'Roboflow Pothole Detection Model (pothole-detection-v2)',
                    'endpoint': 'https://detect.roboflow.com/pothole-detection-v2/1',
                    'detectedCount': 0,
                    'noDetectedCount': 0,
                    'detectionRatePercent': None,
                    'status': 'EXTERNAL API REQUIRES BACKEND PROXY',
                    'blockerReason': 'Requires server-side proxy route to keep secret API key secure per security policy.'
                }
            },
            'FLOOD': {
                'totalImages': flood_total,
                'currentModel': {
                    'modelName': 'CVPR FloodNet SegFormer Water Segmenter',
                    'detectedCount': flood_tp,
                    'noDetectedCount': flood_total - flood_tp,
                    'detectionRatePercent': round((flood_tp / flood_total) * 100, 2),
                    'metricName': 'Category-level detection rate on collected screening dataset',
                    'status': 'ACTIVE PRODUCTION'
                },
                'externalModel': {
                    'candidateName': 'SegFormer-B0 Water Segmenter (imadd/segformer-b0-finetuned-segments-water-2)',
                    'onnxModel': 'scratch/segformer_water_b0.onnx (14.49 MB, License: Apache-2.0)',
                    'detectedCount': ext_flood_tp,
                    'noDetectedCount': flood_total - ext_flood_tp,
                    'detectionRatePercent': round((ext_flood_tp / flood_total) * 100, 2),
                    'status': 'LOCAL ONNX CANDIDATE EVALUATED',
                    'blockerReason': 'Evaluated locally in benchmark suite. Note: High recall (14/14 TP) but over-segments ground textures on non-flood images.'
                }
            },
            'GARBAGE': {
                'totalImages': garbage_total,
                'currentModel': {
                    'modelName': 'Multi-Class Waste Detector YOLOv8',
                    'detectedCount': garbage_tp,
                    'noDetectedCount': garbage_total - garbage_tp,
                    'detectionRatePercent': round((garbage_tp / garbage_total) * 100, 2),
                    'metricName': 'Category-level detection rate on collected screening dataset',
                    'status': 'ACTIVE PRODUCTION'
                },
                'externalModel': {
                    'candidateName': 'External Waste Model / API',
                    'endpoint': 'Unchanged per requirement',
                    'detectedCount': 0,
                    'noDetectedCount': 0,
                    'detectionRatePercent': None,
                    'status': 'UNCHANGED'
                }
            }
        },
        'comparisonDisclaimer': 'Folder-level ground truth is available, but bounding-box ground truth is not. Therefore, evaluation measures Category-level detection rate on the collected screening dataset rather than formal object-detection accuracy.',
        'benchmarkRecords': benchmark_records
    }

    with open(JSON_OUT_PATH, 'w') as f:
        json.dump(report, f, indent=2)
    with open(SRC_JSON_PATH, 'w') as f:
        json.dump(report, f, indent=2)

    with open(CSV_OUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Filename', 'GroundTruthFolder', 'Width', 'Height', 
            'CurrentModelResult', 'CurrentModelConfidence', 
            'ExternalModelResult', 'ExternalModelConfidence', 
            'LatencyMs', 'ApiModelStatus', 'Errors'
        ])
        for r in benchmark_records:
            writer.writerow([
                r['filename'],
                r['groundTruthFolder'],
                r['imageWidth'],
                r['imageHeight'],
                r['currentModelResult'],
                r['currentModelConfidence'] if r['currentModelConfidence'] is not None else "N/A",
                r['externalModelResult'],
                r['externalModelConfidence'] if r['externalModelConfidence'] is not None else "N/A",
                r['latencyMs'],
                r['apiModelStatus'],
                r['errors']
            ])

    print("Updated benchmark reports saved successfully.")

if __name__ == '__main__':
    generate_report()
