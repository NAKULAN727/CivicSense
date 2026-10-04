import json
import csv
import os

RAW_PATH = r"e:\CivicSenseAI\scratch\raw_validation_results.json"
JSON_OUT_PATH = r"e:\CivicSenseAI\scratch\external_benchmark_report.json"
CSV_OUT_PATH = r"e:\CivicSenseAI\scratch\external_benchmark_report.csv"
SRC_JSON_PATH = r"e:\CivicSenseAI\src\data\externalBenchmarkReport.json"

def generate_benchmark():
    if not os.path.exists(RAW_PATH):
        print(f"Error: {RAW_PATH} missing.")
        return

    with open(RAW_PATH, 'r') as f:
        records = json.load(f)

    benchmark_records = []
    
    pothole_current_tp = 0
    pothole_total = 0
    flood_current_tp = 0
    flood_total = 0
    garbage_current_tp = 0
    garbage_total = 0

    for r in records:
        gt = r['groundTruth']
        fname = r['filename']
        w, h = r['imageWidth'], r['imageHeight']
        res_str = f"{w}x{h}"

        has_pothole_det = r['isPotholeDetected']
        has_waste_det = r['isWasteDetected']
        has_flood_det = r['isFloodDetected']

        # Current Model Category-Level Detection Evaluation
        current_result = "FALSE NEGATIVE"
        if gt == 'POTHOLE':
            pothole_total += 1
            if fname.lower() == 'road without pothole.webp':
                current_result = "CORRECT NEGATIVE" if not has_pothole_det else "FALSE POSITIVE"
            else:
                if has_pothole_det:
                    current_result = "TRUE POSITIVE"
                    pothole_current_tp += 1
                else:
                    current_result = "FALSE NEGATIVE"
        elif gt == 'GARBAGE':
            garbage_total += 1
            if has_waste_det:
                current_result = "TRUE POSITIVE"
                garbage_current_tp += 1
            else:
                current_result = "FALSE NEGATIVE"
        elif gt == 'FLOOD':
            flood_total += 1
            if has_flood_det:
                current_result = "TRUE POSITIVE"
                flood_current_tp += 1
            else:
                current_result = "FALSE NEGATIVE"

        # External model status per security directives
        ext_result = "NOT CONNECTED"
        ext_conf = None
        ext_status = "EXTERNAL API REQUIRES BACKEND PROXY"
        ext_error = "Secrets/API keys must remain server-side/backend-proxied. No secret key exposed in frontend."

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
            'externalDetectedClasses': [],
            'latencyMs': r['inferenceTimeMs'],
            'apiModelStatus': ext_status,
            'errors': ext_error
        })

    pothole_rate = round((pothole_current_tp / pothole_total) * 100, 2) if pothole_total > 0 else 0
    flood_rate = round((flood_current_tp / flood_total) * 100, 2) if flood_total > 0 else 0
    garbage_rate = round((garbage_current_tp / garbage_total) * 100, 2) if garbage_total > 0 else 0

    benchmark_report = {
        'reportTitle': 'CivicSense AI – External Model Benchmark Report',
        'generatedAt': '2026-10-04T20:00:00Z',
        'benchmarkStatus': 'EXTERNAL API REQUIRES BACKEND PROXY',
        'preservationNote': 'All existing production ONNX models remain 100% active and unchanged.',
        'sideBySideSummary': {
            'POTHOLE': {
                'totalImages': pothole_total,
                'currentModel': {
                    'modelName': 'RDD2022 YOLOv8s Road Damage Detector',
                    'detectedCount': pothole_current_tp,
                    'noDetectedCount': pothole_total - pothole_current_tp,
                    'detectionRatePercent': pothole_rate,
                    'metricName': 'Category-level detection rate on collected screening dataset',
                    'status': 'ACTIVE PRODUCTION'
                },
                'externalModel': {
                    'candidateName': 'Roboflow Pothole Detection Model (pothole-detection-v2)',
                    'endpoint': 'https://detect.roboflow.com/pothole-detection-v2/1 (Configurable via VITE_EXTERNAL_POTHOLE_API_URL)',
                    'detectedCount': 0,
                    'noDetectedCount': 0,
                    'detectionRatePercent': None,
                    'status': 'EXTERNAL API REQUIRES BACKEND PROXY',
                    'blockerReason': 'Requires server-side proxy route to keep Roboflow API key secure per security policy.'
                }
            },
            'FLOOD': {
                'totalImages': flood_total,
                'currentModel': {
                    'modelName': 'CVPR FloodNet SegFormer Water Segmenter',
                    'detectedCount': flood_current_tp,
                    'noDetectedCount': flood_total - flood_current_tp,
                    'detectionRatePercent': flood_rate,
                    'metricName': 'Category-level detection rate on collected screening dataset',
                    'status': 'ACTIVE PRODUCTION'
                },
                'externalModel': {
                    'candidateName': 'Street-Level Urban Waterlogging Detection API',
                    'endpoint': 'Configurable via VITE_EXTERNAL_FLOOD_API_URL',
                    'detectedCount': 0,
                    'noDetectedCount': 0,
                    'detectionRatePercent': None,
                    'status': 'EXTERNAL API REQUIRES BACKEND PROXY',
                    'blockerReason': 'Requires server-side proxy route to keep API access token secure per security policy.'
                }
            },
            'GARBAGE': {
                'totalImages': garbage_total,
                'currentModel': {
                    'modelName': 'Multi-Class Waste Detector YOLOv8',
                    'detectedCount': garbage_current_tp,
                    'noDetectedCount': garbage_total - garbage_current_tp,
                    'detectionRatePercent': garbage_rate,
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
        'comparisonDisclaimer': 'Folder-level ground truth is available, but bounding-box ground truth is not. Therefore, evaluation measures category-level detection rate on the collected screening dataset rather than formal object-detection accuracy.',
        'benchmarkRecords': benchmark_records
    }

    with open(JSON_OUT_PATH, 'w') as f_json:
        json.dump(benchmark_report, f_json, indent=2)
    print(f"Saved updated JSON benchmark report to: {JSON_OUT_PATH}")

    with open(SRC_JSON_PATH, 'w') as f_src_json:
        json.dump(benchmark_report, f_src_json, indent=2)
    print(f"Saved updated JSON benchmark report to: {SRC_JSON_PATH}")

    with open(CSV_OUT_PATH, 'w', newline='', encoding='utf-8') as f_csv:
        writer = csv.writer(f_csv)
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
    print(f"Saved updated CSV benchmark report to: {CSV_OUT_PATH}")

if __name__ == '__main__':
    generate_benchmark()
