import json
from collections import Counter

with open("scratch/phase16_complete_inventory.json", "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"Total items: {len(items)}")

formats = Counter(x["Format"] for x in items)
print("Formats:", formats)

low_res = sum(1 for x in items if x["IsLowResolution"] == "YES")
print("Low-resolution count (<300x200 or <60k px):", low_res)

primary_cats = Counter(x["PrimaryCategory"] for x in items)
print("\nPrimary Categories:")
for k, v in primary_cats.most_common():
    print(f"  {k:<32}: {v}")

# All category occurrences (Primary + Secondary)
all_cats = Counter()
for x in items:
    all_cats[x["PrimaryCategory"]] += 1
    if x["SecondaryCategories"]:
        for sec in x["SecondaryCategories"].split("; "):
            if sec.strip():
                all_cats[sec.strip()] += 1

print("\nTotal Category Occurrences (Primary + Secondary):")
for k, v in all_cats.most_common():
    print(f"  {k:<32}: {v}")

seg_zero = sum(1 for x in items if x["SegFormerWaterPct"] == 0.0)
print(f"\nSegFormer 0.0% Water Coverage Count: {seg_zero} / {len(items)}")

needs_mask_cnt = sum(1 for x in items if x["NeedsManualSegmentationMask"] == "YES")
print(f"Requires Manual Segmentation Mask: {needs_mask_cnt} / {len(items)}")

