import re

with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "r", encoding="utf-8") as f:
    text = f.read()

# Let's inspect all lines around activeTab === 'BENCHMARK' or similar
lines = text.split('\n')
for i, l in enumerate(lines):
    if "activeTab ===" in l:
        print(f"Line {i+1}: {l}")
    if "<>" in l or "</>" in l:
        print(f"Fragment at line {i+1}: {l}")
    if "{activeTab === 'BENCHMARK'" in l:
        print(f"Benchmark tab at line {i+1}: {l}")
