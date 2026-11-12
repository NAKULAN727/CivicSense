import json

with open('scratch/phase8c6_94_raw_results.json', 'r', encoding='utf-8') as f:
    raw_records = json.load(f)

with open('scratch/phase8c9_arbitrated_records.json', 'r', encoding='utf-8') as f:
    arb_data = json.load(f)
    arb_records = arb_data['records']

def run_arbitration(r):
    w_dets = r.get('waste_detections', [])
    road_dets = r.get('road_detections', [])
    w_orig = r.get('width', 640)
    h_orig = r.get('height', 480)
    total_px = w_orig * h_orig
    is_low_res = (w_orig < 300) or (h_orig < 200) or (total_px < 60000)
    
    # In live app or benchmark:
    water_cov = r.get('water_coverage_pct', r.get('vflood_water_coverage_pct', 0.0))
    top_ratio = r.get('largest_comp_ratio_pct', r.get('vflood_largest_comp_ratio_pct', 0.0))
    
    is_sig_flood = (water_cov > 25.0 and top_ratio >= 60.0)
    is_possible_water = (water_cov >= 5.0)
    has_road = len(road_dets) > 0
    has_pothole = any(d.get('classCode') == 'D40' and d.get('confidence', 0) >= 0.25 for d in road_dets)
    
    contextual_waste = []
    suppressed_waste = []
    candidate_waste = []
    
    for d in w_dets:
        box = d.get('boundingBox', {})
        bw = box.get('width', 0.0)
        bh = box.get('height', 0.0)
        is_monolithic = (bw >= 75.0 and bh >= 75.0)
        
        if not is_monolithic:
            contextual_waste.append({
                'det': d,
                'decision': 'RETAIN_LOCALIZED_WASTE',
                'reason': f'Localized waste box ({bw:.1f}% x {bh:.1f}%) represents genuine trash accumulation.'
            })
        else:
            if has_road or is_sig_flood:
                conflict_reason = (
                    f"Monolithic waste detection box ({bw:.1f}% x {bh:.1f}%) suppressed because significant flood context ({water_cov:.1f}%) is present."
                    if is_sig_flood else
                    f"Monolithic waste detection box ({bw:.1f}% x {bh:.1f}%) suppressed because road damage context is present."
                )
                suppressed_waste.append({
                    'det': d,
                    'decision': 'SUPPRESSED_CONTEXTUAL_CONFLICT',
                    'reason': conflict_reason
                })
            elif is_low_res:
                candidate_waste.append({
                    'det': d,
                    'decision': 'NEEDS_REVIEW_LOW_RESOLUTION_CANDIDATE',
                    'reason': f'Monolithic waste box ({bw:.1f}% x {bh:.1f}%) on low-resolution image ({w_orig}x{h_orig}) cannot be reliably classified automatically. Flagged for human review.'
                })
            else:
                contextual_waste.append({
                    'det': d,
                    'decision': 'RETAIN_UNCONFLICTED_MONOLITHIC',
                    'reason': f'Monolithic waste box ({bw:.1f}% x {bh:.1f}%) retained because standard resolution imagery shows unconflicted open waste accumulation (genuine municipal dump).'
                })
                
    return {
        'contextual_waste': contextual_waste,
        'suppressed_waste': suppressed_waste,
        'candidate_waste': candidate_waste,
        'is_low_res': is_low_res
    }

garb_recs = [r for r in raw_records if r['category'] == 'GARBAGE']
garb_acc = sum(1 for r in garb_recs if len(run_arbitration(r)['contextual_waste']) > 0)
print(f"Garbage accepted: {garb_acc}/30 (Target: 22/30) -> {'PASS' if garb_acc == 22 else 'FAIL'}")

flood_recs = [r for r in raw_records if r['category'] == 'FLOOD']
flood_acc = sum(1 for r in flood_recs if len(run_arbitration(r)['contextual_waste']) > 0)
print(f"Flood cross-category accepted: {flood_acc}/32 (Target: 5/32) -> {'PASS' if flood_acc == 5 else 'FAIL'}")

pothole_recs = [r for r in raw_records if r['category'] == 'POTHOLE']
pothole_acc = sum(1 for r in pothole_recs if len(run_arbitration(r)['contextual_waste']) > 0)
print(f"Pothole cross-category accepted: {pothole_acc}/32 (Target: 10/32) -> {'PASS' if pothole_acc == 10 else 'FAIL'}")
