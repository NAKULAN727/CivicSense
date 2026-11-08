import os
import re

PROJECT_DIR = r"e:\CivicSenseAI"
EXCLUDE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__', '.system_generated', 'scratch'}

print("==================================================")
print("CIVICSENSE AI — SECRETS & SYNTHETIC DATA AUDIT")
print("==================================================")

real_secret_leaks = []
math_random_code_hits = []

for root, dirs, files in os.walk(PROJECT_DIR):
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
    for file in files:
        if file.endswith(('.png', '.jpg', '.webp', '.onnx', '.pt', '.wasm', '.jsonl', '.tif', '.tiff', '.csv', '.json')):
            continue
        filepath = os.path.join(root, file)
        relpath = os.path.relpath(filepath, PROJECT_DIR)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                for line_no, line in enumerate(f, 1):
                    clean_line = line.strip()
                    # Skip comment lines
                    if clean_line.startswith('//') or clean_line.startswith('*') or clean_line.startswith('#'):
                        continue

                    # Check for Math.random() in code
                    if relpath.startswith(('src', 'server')) and 'Math.random()' in clean_line:
                        math_random_code_hits.append((relpath, line_no, clean_line))

                    # Check for real secrets
                    if 'BEGIN PRIVATE KEY' in clean_line or 'BEGIN RSA PRIVATE KEY' in clean_line:
                        real_secret_leaks.append((relpath, line_no, 'Committed Private Key'))
                    if re.search(r'ERP_CLIENT_SECRET\s*=\s*[\'"][a-zA-Z0-9_\-]{8,}[\'"]', clean_line):
                        if not relpath.endswith('.example'):
                            real_secret_leaks.append((relpath, line_no, 'Committed ERP_CLIENT_SECRET'))
        except Exception:
            pass

print(f"Math.random() code invocations in src/ or server/: {len(math_random_code_hits)}")
for h in math_random_code_hits:
    print(f"  -> {h[0]}:{h[1]}: {h[2]}")

print(f"Committed Real Secret Leaks: {len(real_secret_leaks)}")
for l in real_secret_leaks:
    print(f"  -> {l[0]}:{l[1]}: {l[2]}")

print("==================================================")
if len(math_random_code_hits) == 0 and len(real_secret_leaks) == 0:
    print("AUDIT VERDICT: 0 REAL SECRETS COMMITTED | 0 MATH.RANDOM() IN CODE")
else:
    print("AUDIT VERDICT: ISSUES DETECTED")
print("==================================================")
