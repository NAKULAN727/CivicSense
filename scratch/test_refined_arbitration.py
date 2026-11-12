import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw_records = json.load(f)

print(f"Total raw records: {len(raw_records)}")

def simulate_arbitration(r):
    w_dets = r.get('waste_detections', [])
    road_dets = r.get('road_detections', [])
    w_orig = r.get('width', 640)
    h_orig = r.get('height', 480)
    total_px = w_orig * h_orig
    is_low_res = (w_orig < 300) or (h_orig < 200) or (total_px < 60000)
    
    # Flood evidence
    water_cov = r.get('water_coverage_pct', r.get('vflood_water_coverage_pct', 0.0))
    top_ratio = r.get('largest_comp_ratio_pct', r.get('vflood_largest_comp_ratio_pct', 0.0))
    
    is_sig_flood = (water_cov > 25.0 and top_ratio >= 60.0)
    is_possible_water = (water_cov >= 5.0)
    
    has_road = len(road_dets) > 0
    has_pothole = any(d.get('classCode') == 'D40' and d.get('confidence', 0) >= 0.25 for d in road_dets)
    
    contextual_waste = []
    suppressed_waste = []
    candidate_waste = [] # Uncertain / needs review
    
    for d in w_dets:
        box = d.get('boundingBox', {})
        bw = box.get('width', 0.0)
        bh = box.get('height', 0.0)
        is_monolithic = (bw >= 75.0 and bh >= 75.0)
        
        if not is_monolithic:
            # Localized waste box -> Retain (genuine floating debris or localized trash)
            contextual_waste.append({
                'det': d,
                'decision': 'RETAIN_LOCALIZED_WASTE',
                'reason': f'Localized waste box ({bw:.1f}% x {bh:.1f}%) represents genuine trash accumulation.'
            })
        else:
            # Monolithic whole-scene box (>= 75% x 75%)
            if is_sig_flood or is_possible_water:
                # Water presence confirms whole-scene detection is water reflection / texture
                suppressed_waste.append({
                    'det': d,
                    'decision': 'SUPPRESSED_WATER_REFLECTION_OR_TEXTURE',
                    'reason': f'Monolithic waste box ({bw:.1f}% x {bh:.1f}%) suppressed: water presence ({water_cov:.1f}%) indicates water reflection or floodwater texture.'
                })
            elif has_road:
                # Road damage context confirms road surface conflict
                suppressed_waste.append({
                    'det': d,
                    'decision': 'SUPPRESSED_ROAD_DAMAGE_CONFLICT',
                    'reason': f'Monolithic waste box ({bw:.1f}% x {bh:.1f}%) suppressed because primary road damage context is present.'
                })
            elif is_low_res:
                # Low resolution with no positive water/road detection:
                # Do NOT auto-confirm as high-severity waste! Flag as uncertain candidate requiring review
                candidate_waste.append({
                    'det': d,
                    'decision': 'NEEDS_REVIEW_LOW_RESOLUTION_CANDIDATE',
                    'reason': f'Monolithic waste box ({bw:.1f}% x {bh:.1f}%) on low-resolution image ({w_orig}x{h_orig}) is uncertain. Flagged for operator review.'
                })
            else:
                # Standard resolution, unconflicted scene (genuine municipal dump)
                contextual_waste.append({
                    'det': d,
                    'decision': 'RETAIN_UNCONFLICTED_MONOLITHIC',
                    'reason': f'Monolithic waste box ({bw:.1f}% x {bh:.1f}%) retained because standard resolution imagery shows unconflicted open waste accumulation.'
                })
                
    return {
        'contextual_waste': contextual_waste,
        'suppressed_waste': suppressed_waste,
        'candidate_waste': candidate_waste,
        'is_low_res': is_low_res,
        'water_cov': water_cov,
        'is_sig_flood': is_sig_flood,
        'is_possible_water': is_possible_water,
        'has_road': has_road,
        'has_pothole': has_pothole
    }

# Run on flood 1.jpg specifically
f1 = next(r for r in raw_records if r['filename'] == 'flood 1.jpg')
res_f1 = simulate_arbitration(f1)
print("\n--- RESULTS FOR flood 1.jpg (with actual SegFormer 0% water) ---")
# Simulate if water_cov was 0.0%:
f1_zero_water = dict(f1)
f1_zero_water['water_coverage_pct'] = 0.0
f1_zero_water['vflood_water_coverage_pct'] = 0.0
res_f1_zero = simulate_arbitration(f1_zero_water)
print(f"Contextual waste: {len(res_f1_zero['contextual_waste'])}")
print(f"Suppressed waste: {len(res_f1_zero['suppressed_waste'])}")
print(f"Candidate waste (needs review): {len(res_f1_zero['candidate_waste'])}")
for c in res_f1_zero['candidate_waste']:
    print(f"  Candidate Decision: {c['decision']}, Reason: {c['reason']}")

# Now check all 30 Garbage images
print("\n--- RESULTS FOR 30 GARBAGE IMAGES ---")
garbage_recs = [r for r in raw_records if r['category'] == 'GARBAGE']
garb_acc = 0
for r in garbage_recs:
    res = simulate_arbitration(r)
    acc = len(res['contextual_waste'])
    if acc > 0:
        garb_acc += 1
    else:
        print(f"  Zero accepted in garbage: {r['filename']} (raw={len(r.get('waste_detections', []))})")
print(f"Garbage accepted waste: {garb_acc} / {len(garbage_recs)} (Phase 8C-9 benchmark was 22/30)")
