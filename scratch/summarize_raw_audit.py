import json

with open('scratch/phase16_raw_file_audit.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

print(f"Total files audited: {len(records)}")

corrupted = [r for r in records if r['is_corrupted']]
duplicates = [r for r in records if r['is_duplicate']]
valid = [r for r in records if not r['is_corrupted']]

print(f"Valid images: {len(valid)}")
print(f"Corrupted / Unreadable: {len(corrupted)}")
if corrupted:
    for c in corrupted:
        print(f"  Corrupted: {c['filename']} -> {c['corruption_error']}")

print(f"Duplicate images (by SHA-256): {len(duplicates)}")
if duplicates:
    for d in duplicates:
        print(f"  Duplicate: {d['filename']} identical to {d['duplicate_of']} (SHA256: {d['sha256']})")

formats = {}
modes = {}
for r in valid:
    fmt = r['format']
    formats[fmt] = formats.get(fmt, 0) + 1
    m = r['mode']
    modes[m] = modes.get(m, 0) + 1

print("\nFormat breakdown:", formats)
print("Color Mode breakdown:", modes)

for r in records:
    print(f"{r['filename']:<16} | Res: {r['width']}x{r['height']:<5} | Fmt: {r['format']:<5} | Mode: {r['mode']:<5} | Size: {r['filesize_kb']:>6.1f} KB | SHA: {r['sha256'][:12]}...")

