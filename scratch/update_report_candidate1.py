import json

report_path = r"e:\CivicSenseAI\src\data\externalBenchmarkReport.json"
verification_path = r"e:\CivicSenseAI\scratch\flood_yolov8seg_benchmark.json"

with open(report_path, "r", encoding="utf-8") as f:
    report = json.load(f)

with open(verification_path, "r", encoding="utf-8") as f:
    verif = json.load(f)

# Update FLOOD in sideBySideSummary
report['sideBySideSummary']['FLOOD']['candidate1_yolov8seg'] = {
    "candidateName": "YOLOv8-Seg Waterlogging Instance Segmenter",
    "sources": ["henrys-workspace-ds68i/waterlogging-1hcfe", "jhonattan-fredy-moreno-bernal/flood-ai"],
    "status": "WEIGHTS NOT VERIFIED",
    "verificationNote": "Weights unavailable for public local download from Roboflow Universe without paid plan/API key. Benchmark stopped per requirement to avoid fabricating unverified model results.",
    "recommendation": "NOT VERIFIED"
}

# Attach candidate1Verification
report['candidate1Yolov8SegVerification'] = verif

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

print(f"Updated {report_path} with Candidate 1 verification data.")
