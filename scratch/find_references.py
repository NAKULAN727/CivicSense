import os

reports = [os.path.join("reports", f) for f in os.listdir("reports") if f.endswith(".md")]
flood_names = [f"flood {i}" for i in range(1, 31)] + ["flood.jpg", "puddles.jpg", "flood 2"]

findings = {}
for r in reports:
    with open(r, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    for fn in flood_names:
        if fn in content:
            if fn not in findings:
                findings[fn] = []
            findings[fn].append(r)

for fn in sorted(findings.keys()):
    print(f"{fn:<16}: referenced in {len(findings[fn])} reports -> {findings[fn][:2]}")

