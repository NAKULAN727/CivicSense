import os
import json

report_path = r"e:\CivicSenseAI\src\data\externalBenchmarkReport.json"
benchmark_path = r"e:\CivicSenseAI\scratch\vfloodnet_benchmark.json"

with open(report_path, "r", encoding="utf-8") as f:
    report = json.load(f)

with open(benchmark_path, "r", encoding="utf-8") as f:
    vfloodnet_data = json.load(f)

report["candidate2VFloodNetVerification"] = vfloodnet_data

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

print("Successfully updated externalBenchmarkReport.json with candidate2VFloodNetVerification.")
