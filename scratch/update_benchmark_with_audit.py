import json

report_path = r"e:\CivicSenseAI\src\data\externalBenchmarkReport.json"
audit_path = r"e:\CivicSenseAI\scratch\flood_candidate_cross_category_audit.json"

with open(report_path, "r", encoding="utf-8") as f:
    report_data = json.load(f)

with open(audit_path, "r", encoding="utf-8") as f:
    audit_data = json.load(f)

# Update FLOOD externalModel status and blockerReason in sideBySideSummary
report_data['sideBySideSummary']['FLOOD']['externalModel']['status'] = "REJECT DUE TO FALSE POSITIVES (AUDIT COMPLETE)"
report_data['sideBySideSummary']['FLOOD']['externalModel']['blockerReason'] = "Cross-category negative audit revealed 24/24 (100%) false positive water detections on non-flood images (Pathole 12/12, Garbage 12/12). Mean water coverage exceeds 88-92% on dry asphalt and solid waste."
report_data['sideBySideSummary']['FLOOD']['externalModel']['recommendation'] = "REJECT DUE TO FALSE POSITIVES"
report_data['sideBySideSummary']['FLOOD']['currentModel']['status'] = "ACTIVE PRODUCTION (PRESERVED)"

# Attach the complete candidate flood cross-category audit
report_data['candidateFloodCrossCategoryAudit'] = audit_data

# Save updated report
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report_data, f, indent=2)

print(f"Updated {report_path} with candidateFloodCrossCategoryAudit.")
