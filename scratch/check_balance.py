with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Check open/close braces
open_b = 0
open_p = 0
for i, l in enumerate(lines):
    for ch in l:
        if ch == '{': open_b += 1
        elif ch == '}': open_b -= 1
        elif ch == '(': open_p += 1
        elif ch == ')': open_p -= 1
    if open_b < 0:
        print(f"Negative braces at line {i+1}")
        break

print(f"Final open_b: {open_b}, open_p: {open_p}")
