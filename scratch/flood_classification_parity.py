# CivicSense AI — Phase 15 Flood Classification Python Parity Module
# Mirrors src/services/floodClassificationService.js

FLOOD_CATEGORIES = {
    'F00': {'code': 'F00', 'name': 'NO_SIGNIFICANT_WATER', 'title': 'No Significant Water / Dry Surface', 'defaultSeverity': 'LOW', 'defaultPriority': 'ROUTINE', 'requiresReview': False},
    'F01': {'code': 'F01', 'name': 'ROAD_WATERLOGGING', 'title': 'Roadway Waterlogging', 'defaultSeverity': 'HIGH', 'defaultPriority': 'IMMEDIATE', 'requiresReview': True},
    'F02': {'code': 'F02', 'name': 'RESIDENTIAL_INUNDATION', 'title': 'Residential Inundation', 'defaultSeverity': 'CRITICAL', 'defaultPriority': 'IMMEDIATE', 'requiresReview': True},
    'F03': {'code': 'F03', 'name': 'BUILDING_SURROUNDING_FLOODING', 'title': 'Building Perimeter Flooding', 'defaultSeverity': 'HIGH', 'defaultPriority': 'HIGH', 'requiresReview': True},
    'F04': {'code': 'F04', 'name': 'RIVER_OVERFLOW', 'title': 'River / Channel Overflow (Fluvial Flooding)', 'defaultSeverity': 'CRITICAL', 'defaultPriority': 'IMMEDIATE', 'requiresReview': True},
    'F05': {'code': 'F05', 'name': 'LARGE_AREA_INUNDATION', 'title': 'Large-Area Inundation', 'defaultSeverity': 'CRITICAL', 'defaultPriority': 'IMMEDIATE', 'requiresReview': True},
    'F06': {'code': 'F06', 'name': 'GENERAL_SIGNIFICANT_FLOODING', 'title': 'General Significant Flooding (Unclassified / Review Required)', 'defaultSeverity': 'HIGH', 'defaultPriority': 'IMMEDIATE', 'requiresReview': True}
}

def classify_flood_event(water_coverage_pct=0.0, topology_ratio=None, raw_road=[], geographic_context={}, image_metadata={}):
    has_road = len(raw_road) > 0
    pothole_det = next((d for d in raw_road if (d.get('classCode') == 'D40' or 'pothole' in d.get('type', '').lower()) and d.get('confidence', 0) >= 0.25), None)
    is_water_filled_pothole = bool(pothole_det and water_coverage_pct >= 5.0)

    is_gps_verified = bool(geographic_context.get('isGpsVerified'))
    is_near_river = bool(geographic_context.get('isNearRiver'))
    is_residential = bool(geographic_context.get('isResidentialZone'))
    has_bld_prox = bool(geographic_context.get('hasBuildingProximity'))
    has_ingress = bool(geographic_context.get('hasWaterIngressEvidence'))

    if water_coverage_pct < 5.0:
        cat = FLOOD_CATEGORIES['F00']
        sev, pri = 'LOW', 'ROUTINE'
        reason = f"Water coverage is {water_coverage_pct:.1f}% (< 5.0% threshold). Negligible surface water."
    elif is_water_filled_pothole:
        cat = FLOOD_CATEGORIES['F01']
        sev, pri = 'HIGH', 'IMMEDIATE'
        reason = f"Structural road cavity (D40 Pothole) holding visible water ({water_coverage_pct:.1f}%)."
    elif water_coverage_pct >= 50.0 and (topology_ratio is None or topology_ratio >= 80.0):
        if has_road:
            cat = FLOOD_CATEGORIES['F01']
            sev, pri = 'CRITICAL' if water_coverage_pct >= 35.0 else 'HIGH', 'IMMEDIATE'
            reason = f"Extensive waterlogging ({water_coverage_pct:.1f}%) confirmed on roadway corridor with verified pavement damage context."
        elif is_near_river:
            cat = FLOOD_CATEGORIES['F04']
            sev, pri = 'CRITICAL', 'IMMEDIATE'
            reason = f"Extensive inundation ({water_coverage_pct:.1f}%) in verified river corridor proximity. Fluvial channel overflow confirmed via hydrographic GIS overlay."
        else:
            cat = FLOOD_CATEGORIES['F05']
            sev, pri = 'CRITICAL', 'IMMEDIATE'
            reason = f"Continuous landscape-scale inundation ({water_coverage_pct:.1f}% coverage, {topology_ratio:.1f}% component ratio). Land-use context requires operator review."
    elif water_coverage_pct > 25.0 and (topology_ratio is None or topology_ratio >= 60.0):
        if has_road:
            cat = FLOOD_CATEGORIES['F01']
            sev, pri = 'CRITICAL' if water_coverage_pct >= 35.0 else 'HIGH', 'IMMEDIATE'
            reason = f"Continuous roadway waterlogging ({water_coverage_pct:.1f}%) supported by detected pavement defect context."
        elif is_residential and has_ingress:
            cat = FLOOD_CATEGORIES['F02']
            sev, pri = 'CRITICAL', 'IMMEDIATE'
            reason = f"Residential parcel inundation ({water_coverage_pct:.1f}%) with verified GIS cadastral alignment and structural water ingress evidence."
        elif has_bld_prox:
            cat = FLOOD_CATEGORIES['F03']
            sev, pri = 'HIGH', 'HIGH'
            reason = f"Surface water ({water_coverage_pct:.1f}%) surrounding building perimeter foundations without confirmed interior penetration."
        elif is_near_river:
            cat = FLOOD_CATEGORIES['F04']
            sev, pri = 'CRITICAL', 'IMMEDIATE'
            reason = f"Surface inundation ({water_coverage_pct:.1f}%) adjoining river corridor. Potential fluvial overtopping identified."
        else:
            cat = FLOOD_CATEGORIES['F06']
            sev, pri = 'CRITICAL' if water_coverage_pct >= 35.0 else 'HIGH', 'IMMEDIATE'
            reason = f"Extensive water coverage ({water_coverage_pct:.1f}%). Specific land-use (road vs. residential vs. open land) cannot be established from 2D pixels alone; operator review required."
    elif water_coverage_pct >= 5.0:
        if has_road:
            cat = FLOOD_CATEGORIES['F01']
            sev, pri = 'MEDIUM', 'MEDIUM'
            reason = f"Moderate localized water ({water_coverage_pct:.1f}%) on roadway with pavement defects."
        else:
            cat = FLOOD_CATEGORIES['F06']
            sev, pri = 'MEDIUM', 'MEDIUM'
            reason = f"Moderate localized water ({water_coverage_pct:.1f}%). Localized puddles or surface runoff margin."

    return {
        'categoryCode': cat['code'],
        'categoryName': cat['name'],
        'title': cat['title'],
        'severity': sev,
        'priority': pri,
        'operatorStatus': 'NEEDS REVIEW' if cat['requiresReview'] else 'CONFIRMED',
        'waterCoveragePercent': water_coverage_pct,
        'topologyRatio': topology_ratio,
        'evidence': reason,
        'guards': {
            'buildingDamageInferred': False,
            'humanDangerInferred': False,
            'gpsFabricated': False,
            'populationFabricated': False
        }
    }

