import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw_records = json.load(f)

with open('scratch/phase8c9_arbitrated_records.json', 'r', encoding='utf-8') as f:
    arb_data = json.load(f)
    arb_records = arb_data['records']

print(f"Total raw records: {len(raw_records)}")
print(f"Total arb records: {len(arb_records)}")

# Let's see what happens on each category under current arbitration
for cat in ['FLOOD', 'POTHOLE', 'GARBAGE']:
    recs = [r for r in arb_records if r['category'] == cat]
    print(f"\nCategory: {cat} ({len(recs)} images)")
    for r in recs:
        raw_cnt = r['raw_waste_count']
        acc_cnt = r['accepted_waste_count']
        sup_cnt = r['suppressed_waste_count']
        if raw_cnt > 0:
            print(f"  {r['filename']:<20} | raw: {raw_cnt} | acc: {acc_cnt} | sup: {sup_cnt} | dec: {r['arbitration_decisions']}")
