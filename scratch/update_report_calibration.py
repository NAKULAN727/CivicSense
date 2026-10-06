import json

with open("scratch/vfloodnet_calibration.json", "r", encoding="utf-8") as f:
    calib_data = json.load(f)

with open("src/data/externalBenchmarkReport.json", "r", encoding="utf-8") as f:
    report = json.load(f)

report["vfloodnetCalibrationReport"] = calib_data

with open("src/data/externalBenchmarkReport.json", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

print("Updated src/data/externalBenchmarkReport.json with vfloodnetCalibrationReport!")
