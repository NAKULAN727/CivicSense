import os
import sys
import json
import csv

sys.stdout.reconfigure(encoding='utf-8')

RAW_RESULTS_8C6 = r"e:\CivicSenseAI\scratch\phase8c6_94_raw_results.json"
REPORTS_DIR = r"e:\CivicSenseAI\reports"
os.makedirs(REPORTS_DIR, exist_ok=True)

with open(RAW_RESULTS_8C6, 'r', encoding='utf-8') as f:
    records = json.load(f)

print(f"Loaded {len(records)} records from Phase 8C-6.")

# Process every image through Contextual Arbitration
arbitrated_records = []

for r in records:
    fn = r['filename']
    cat = r['category']
    folder = r['folder']
    
    # 1. Context variables
    # hasRoadDamage = true if meaningful D00/D10/D20/D40 road detection exists
    has_road_damage = (r['road_post_nms_count'] > 0)
    
    # hasPothole = true if D40 confidence >= 0.25
    has_pothole = r['road_has_d40_conf_025']
    
    # water coverage and component ratio
    water_cov = r['vflood_water_coverage_pct']
    comp_ratio = r['vflood_largest_comp_ratio_pct']
    
    # isSignificantFlood = waterCoverage > 25% AND largestConnectedWaterComponentRatio >= 60%
    is_significant_flood = (water_cov > 25.0 and comp_ratio >= 60.0)
    
    # isPossibleWater = waterCoverage >= 5%
    is_possible_water = (water_cov >= 5.0)
    
    # 2. Flood Classification
    if water_cov < 5.0:
        flood_cls = "NO SIGNIFICANT WATER"
    elif is_significant_flood:
        flood_cls = "SIGNIFICANT WATERLOGGING"
    else:
        flood_cls = "POSSIBLE WATERLOGGING"
        
    # 3. Water-Filled Pothole Classification
    is_water_filled_pothole = (has_pothole and is_possible_water)
    
    # 4. Waste Contextual Arbitration
    raw_waste_dets = r['waste_detections']
    accepted_waste_dets = []
    suppressed_waste_dets = []
    
    arbitration_decisions = []
    arbitration_reasons = []
    
    for d in raw_waste_dets:
        box = d['boundingBox']
        bw = box['width']
        bh = box['height']
        is_monolithic = (bw >= 75.0 and bh >= 75.0)
        
        # Policy
        if not is_monolithic:
            # Case A: NOT monolithic -> RETAIN
            accepted_waste_dets.append(d)
            arbitration_decisions.append("RETAIN_LOCALIZED")
            arbitration_reasons.append(f"Localized waste box ({bw:.1f}%x{bh:.1f}% < 75%x75%); retained without conflict.")
        else:
            # Case B: IS monolithic
            if has_road_damage or is_significant_flood:
                suppressed_waste_dets.append(d)
                arbitration_decisions.append("SUPPRESS_CONTEXTUAL_CONFLICT")
                conflict_sources = []
                if has_road_damage:
                    conflict_sources.append(f"Road Damage ({', '.join(r['road_classes'])})")
                if is_significant_flood:
                    conflict_sources.append(f"Significant Flood ({water_cov:.1f}% water, ratio={comp_ratio:.1f}%)")
                arbitration_reasons.append(f"Monolithic whole-scene box ({bw:.1f}%x{bh:.1f}%) suppressed due to conflicting primary hazard: {' & '.join(conflict_sources)}.")
            else:
                accepted_waste_dets.append(d)
                arbitration_decisions.append("RETAIN_MONOLITHIC_STANDALONE")
                arbitration_reasons.append(f"Monolithic box ({bw:.1f}%x{bh:.1f}%) retained: standalone scene with no conflicting road damage or flood.")

    # Primary incident routing
    final_incident_types = []
    if is_water_filled_pothole:
        final_incident_types.append("WATER-FILLED POTHOLE (Highways Department + Drainage Advisory)")
    elif is_significant_flood:
        final_incident_types.append("SIGNIFICANT WATERLOGGING (Stormwater / Drainage)")
    elif has_road_damage:
        final_incident_types.append(f"ROAD DAMAGE ({', '.join(r['road_classes'])}) (Highways)")
    elif is_possible_water:
        final_incident_types.append("POSSIBLE WATERLOGGING (Stormwater Monitor)")
        
    if len(accepted_waste_dets) > 0 and not is_water_filled_pothole:
        waste_classes_accepted = list(set(d['classCode'] for d in accepted_waste_dets))
        final_incident_types.append(f"DETECTED WASTE ({', '.join(waste_classes_accepted)}) (Sanitation)")

    if not final_incident_types:
        final_incident_str = "CLEAN / NO ACTIONABLE HAZARD"
    else:
        final_incident_str = " | ".join(final_incident_types)
        
    arbitrated_records.append({
        'filename': fn,
        'category': cat,
        'folder': folder,
        'width': r['width'],
        'height': r['height'],
        
        # Road
        'road_post_nms_count': r['road_post_nms_count'],
        'road_classes': r['road_classes'],
        'road_confidences': r['road_confidences'],
        'has_road_damage': has_road_damage,
        'has_pothole': has_pothole,
        
        # Flood
        'water_coverage_pct': water_cov,
        'largest_comp_ratio_pct': comp_ratio,
        'is_significant_flood': is_significant_flood,
        'is_possible_water': is_possible_water,
        'flood_classification': flood_cls,
        'is_water_filled_pothole': is_water_filled_pothole,
        
        # Waste
        'raw_waste_count': len(raw_waste_dets),
        'accepted_waste_count': len(accepted_waste_dets),
        'suppressed_waste_count': len(suppressed_waste_dets),
        'raw_waste_classes': r['waste_classes'],
        'accepted_waste_classes': [d['classCode'] for d in accepted_waste_dets],
        'suppressed_waste_classes': [d['classCode'] for d in suppressed_waste_dets],
        'arbitration_decisions': arbitration_decisions,
        'arbitration_reasons': arbitration_reasons,
        'primary_decision': arbitration_decisions[0] if arbitration_decisions else "NO_WASTE_DETECTION",
        'primary_reason': arbitration_reasons[0] if arbitration_reasons else "Model produced zero waste candidates",
        
        # Final interpretation
        'final_incident_interpretation': final_incident_str
    })

# Metrics calculation
cats = ['GARBAGE', 'FLOOD', 'POTHOLE']
metrics = {}

for c in cats:
    recs = [r for r in arbitrated_records if r['category'] == c]
    tot = len(recs)
    raw_waste = sum(1 for r in recs if r['raw_waste_count'] > 0)
    acc_waste = sum(1 for r in recs if r['accepted_waste_count'] > 0)
    supp_waste = sum(1 for r in recs if r['suppressed_waste_count'] > 0 and r['accepted_waste_count'] == 0)
    
    metrics[c] = {
        'total': tot,
        'raw_waste_count': raw_waste,
        'raw_waste_pct': round((raw_waste / tot) * 100.0, 2),
        'accepted_waste_count': acc_waste,
        'accepted_waste_pct': round((acc_waste / tot) * 100.0, 2),
        'suppressed_count': raw_waste - acc_waste,
        'suppressed_pct': round(((raw_waste - acc_waste) / tot) * 100.0, 2)
    }

print("\n=== CONTEXTUAL ARBITRATION COMPARISON ===")
for c, m in metrics.items():
    print(f"[{c:<8}] Total: {m['total']} | Raw Waste: {m['raw_waste_count']}/{m['total']} ({m['raw_waste_pct']}%) -> Accepted: {m['accepted_waste_count']}/{m['total']} ({m['accepted_waste_pct']}%) | Suppressed: {m['suppressed_count']} (-{m['suppressed_pct']}%)")

# Save JSON cache
with open(r'e:\CivicSenseAI\scratch\phase8c9_arbitrated_records.json', 'w', encoding='utf-8') as f_out:
    json.dump({
        'metrics': metrics,
        'records': arbitrated_records
    }, f_out, indent=2)

print("\nSaved scratch/phase8c9_arbitrated_records.json")
