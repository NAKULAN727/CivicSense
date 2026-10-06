import os
import sys
import json
import csv

sys.stdout.reconfigure(encoding='utf-8')

REPORTS_DIR = r"e:\CivicSenseAI\reports"
RAW_RESULTS_8C6 = r"e:\CivicSenseAI\scratch\phase8c6_94_raw_results.json"

with open(RAW_RESULTS_8C6, 'r', encoding='utf-8') as f:
    records = json.load(f)

print(f"Loaded {len(records)} records from Phase 8C-6.")

# ==============================================================================
# 1. FLOOD TOPOLOGY CALIBRATION COMPARISON
# ==============================================================================
flood_topo_rows = []
flood_retained = 0
flood_lost = []
garb_suppressed = []
pothole_suppressed = []

for r in records:
    fn = r['filename']
    cat = r['category']
    cov = r['vflood_water_coverage_pct']
    ratio = r['vflood_largest_comp_ratio_pct']
    
    # Old policy
    if cov < 5.0:
        old_cls = 'NO SIGNIFICANT WATER'
    elif cov <= 25.0:
        old_cls = 'POSSIBLE WATERLOGGING'
    else:
        old_cls = 'SIGNIFICANT WATERLOGGING'
        
    # Candidate policy with topology guard:
    # SIGNIFICANT WATERLOGGING requires: waterCoverage > 25% AND largestConnectedWaterComponentRatio >= 0.60 (60%)
    if cov < 5.0:
        new_cls = 'NO SIGNIFICANT WATER'
    elif cov <= 25.0:
        new_cls = 'POSSIBLE WATERLOGGING'
    else:
        if ratio >= 60.0:
            new_cls = 'SIGNIFICANT WATERLOGGING'
        else:
            new_cls = 'POSSIBLE WATERLOGGING'
            
    is_changed = (old_cls != new_cls)
    if is_changed:
        if cat == 'FLOOD':
            flood_lost.append(fn)
        elif cat == 'GARBAGE':
            garb_suppressed.append(fn)
        elif cat == 'POTHOLE':
            pothole_suppressed.append(fn)
    else:
        if cat == 'FLOOD' and old_cls == 'SIGNIFICANT WATERLOGGING':
            flood_retained += 1
            
    flood_topo_rows.append({
        'filename': fn,
        'category': cat,
        'waterCoverage': f"{cov}%",
        'largestComponentRatio': f"{ratio}%",
        'oldClassification': old_cls,
        'newClassification': new_cls,
        'statusChanged': "YES" if is_changed else "NO"
    })

csv_topo_path = os.path.join(REPORTS_DIR, "phase8c8_flood_topology_comparison.csv")
with open(csv_topo_path, 'w', newline='', encoding='utf-8') as f_csv:
    writer = csv.DictWriter(f_csv, fieldnames=[
        'filename', 'category', 'waterCoverage', 'largestComponentRatio',
        'oldClassification', 'newClassification', 'statusChanged'
    ])
    writer.writeheader()
    writer.writerows(flood_topo_rows)
print(f"Wrote {csv_topo_path}")

# ==============================================================================
# 2. WASTE GEOMETRIC CALIBRATION COMPARISON (Candidate rule at 75% x 75%)
# ==============================================================================
waste_geom_rows = []

for r in records:
    fn = r['filename']
    cat = r['category']
    dets = r['waste_detections']
    
    if len(dets) == 0:
        waste_geom_rows.append({
            'filename': fn,
            'category': cat,
            'class': "NONE",
            'confidence': "NONE",
            'boxWidth': "0.0%",
            'boxHeight': "0.0%",
            'areaRatio': "0.0%",
            'rawStatus': "NO_DETECTION",
            'filteredStatus': "NO_DETECTION",
            'filterReason': "No waste detections produced by model"
        })
        continue
        
    is_single = (len(dets) == 1)
    for idx, d in enumerate(dets):
        box = d['boundingBox']
        bw = box['width']
        bh = box['height']
        area = round((bw * bh) / 100.0, 2)
        conf = d['confidence']
        cls_code = d['classCode']
        
        # Rule: IF single waste detection AND box width >= 75% AND box height >= 75%
        is_monolithic = is_single and (bw >= 75.0 and bh >= 75.0)
        
        raw_status = "DETECTED_WASTE"
        if is_monolithic:
            filt_status = "FLAGGED_MONOLITHIC_SUPPRESSED"
            reason = f"Monolithic whole-scene bounding box ({bw}%x{bh}% >= 75%x75%) with single detection"
        else:
            filt_status = "ACCEPTED_DETECTION"
            if not is_single:
                reason = f"Multi-box detection cluster ({len(dets)} boxes); retained"
            else:
                reason = f"Localized bounding box ({bw}%x{bh}% < 75%x75%); retained"
                
        waste_geom_rows.append({
            'filename': fn,
            'category': cat,
            'class': cls_code,
            'confidence': conf,
            'boxWidth': f"{bw}%",
            'boxHeight': f"{bh}%",
            'areaRatio': f"{area}%",
            'rawStatus': raw_status,
            'filteredStatus': filt_status,
            'filterReason': reason
        })

csv_waste_path = os.path.join(REPORTS_DIR, "phase8c8_waste_geometry_comparison.csv")
with open(csv_waste_path, 'w', newline='', encoding='utf-8') as f_csv:
    writer = csv.DictWriter(f_csv, fieldnames=[
        'filename', 'category', 'class', 'confidence', 'boxWidth', 'boxHeight',
        'areaRatio', 'rawStatus', 'filteredStatus', 'filterReason'
    ])
    writer.writeheader()
    writer.writerows(waste_geom_rows)
print(f"Wrote {csv_waste_path}")

# ==============================================================================
# 3. MULTIPLE GEOMETRIC THRESHOLD SWEEP EVALUATION
# ==============================================================================
geom_thresholds = [60.0, 65.0, 70.0, 75.0, 80.0, 85.0]
geom_sweep_results = []

for th in geom_thresholds:
    g_raw = sum(1 for r in records if r['category'] == 'GARBAGE' and len(r['waste_detections']) > 0)
    fl_raw = sum(1 for r in records if r['category'] == 'FLOOD' and len(r['waste_detections']) > 0)
    po_raw = sum(1 for r in records if r['category'] == 'POTHOLE' and len(r['waste_detections']) > 0)
    
    g_retained = 0
    fl_suppressed = 0
    po_suppressed = 0
    
    g_lost_list = []
    
    for r in records:
        cat = r['category']
        dets = r['waste_detections']
        if len(dets) == 0:
            continue
            
        is_mono = (len(dets) == 1 and dets[0]['boundingBox']['width'] >= th and dets[0]['boundingBox']['height'] >= th)
        is_retained = (not is_mono)
        
        if cat == 'GARBAGE':
            if is_retained:
                g_retained += 1
            else:
                g_lost_list.append(r['filename'])
        elif cat == 'FLOOD':
            if is_mono:
                fl_suppressed += 1
        elif cat == 'POTHOLE':
            if is_mono:
                po_suppressed += 1
                
    non_g_suppressed = fl_suppressed + po_suppressed
    geom_sweep_results.append({
        'threshold': f"{int(th)}% x {int(th)}%",
        'garbage_retained': f"{g_retained} / 24 ({round(g_retained/24*100, 1)}%)",
        'garbage_lost_count': len(g_lost_list),
        'flood_suppressed': f"{fl_suppressed} / 22 ({round(fl_suppressed/22*100, 1)}%)",
        'pothole_suppressed': f"{po_suppressed} / 27 ({round(po_suppressed/27*100, 1)}%)",
        'total_non_garbage_suppressed': f"{non_g_suppressed} / 49 ({round(non_g_suppressed/49*100, 1)}%)",
        'lost_garbage_samples': g_lost_list
    })

# Save JSON dump for markdown generation
with open(r'e:\CivicSenseAI\scratch\phase8c8_metrics.json', 'w', encoding='utf-8') as f_out:
    json.dump({
        'flood_retained': flood_retained,
        'flood_lost': flood_lost,
        'garb_suppressed': garb_suppressed,
        'pothole_suppressed': pothole_suppressed,
        'geom_sweep': geom_sweep_results
    }, f_out, indent=2)

print("Saved scratch/phase8c8_metrics.json")
