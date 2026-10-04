with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "r", encoding="utf-8") as f:
    text = f.read()

# Extract the Candidate 2 card
cand2_marker_start = "{/* SECTION: CANDIDATE 2 V-FLOODNET VERIFICATION & BENCHMARK */}"
cand2_marker_end = "{/* Phase 2: FLOOD */}"

start_idx = text.find(cand2_marker_start)
end_idx = text.find(cand2_marker_end)

if start_idx != -1 and end_idx != -1:
    cand2_card_block = text[start_idx:end_idx].strip()
    # Remove from its misplaced location
    text = text[:start_idx] + text[end_idx:]
    
    # Now find where it should be inserted: right before {/* VIEW TOGGLE BAR */}
    insert_marker = "{/* VIEW TOGGLE BAR */}"
    ins_idx = text.find(insert_marker)
    if ins_idx != -1:
        text = text[:ins_idx] + cand2_card_block + "\n\n      " + text[ins_idx:]
        print("Candidate 2 card moved successfully!")
    else:
        print("Failed to find insert marker")
else:
    print(f"Failed to find markers: start={start_idx}, end={end_idx}")

with open(r"e:\CivicSenseAI\src\components\ExternalBenchmarkTool.jsx", "w", encoding="utf-8") as f:
    f.write(text)
