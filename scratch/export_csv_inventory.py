import json
import csv

with open("scratch/phase16_complete_inventory.json", "r", encoding="utf-8") as f:
    items = json.load(f)

csv_path = "reports/phase16_flood_dataset_inventory.csv"
fieldnames = [
    "Index",
    "Filename",
    "Format",
    "Width",
    "Height",
    "AspectRatio",
    "TotalPixels",
    "FileSizeBytes",
    "FileSizeKB",
    "SHA256",
    "IsLowResolution",
    "SegFormerWaterPct",
    "SegFormerTopologyPct",
    "VFloodNetWaterPct",
    "VFloodNetTopologyPct",
    "WasteDetectionsCount",
    "RoadDetectionsCount",
    "PrimaryCategory",
    "SecondaryCategories",
    "NeedsManualSegmentationMask",
    "ManualMaskJustification"
]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for row in items:
        writer.writerow(row)

print(f"Generated {csv_path} with {len(items)} rows.")

