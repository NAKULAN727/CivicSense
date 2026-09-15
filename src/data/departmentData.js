// CivicSense AI - Department Mapping Rules (Phase 5 Prototype)
// Maps flood & environmental risk categories to responsible civic departments and field categories.
// IMPORTANT: Prototype routing categories only. No real contact numbers, emails, or personal details.

export const DEPARTMENT_MAPPINGS = {
  FLOOD: {
    category: "FLOOD",
    primaryDepartment: "Greater Chennai Corporation",
    secondaryDepartment: "Chennai District Disaster Management Authority",
    fieldCategory: "Storm Water Drainage / Flood Response",
    description: "Inundation risk, marshland overflow, and emergency flood mitigation routing."
  },
  WATERLOGGING: {
    category: "WATERLOGGING",
    primaryDepartment: "Greater Chennai Corporation",
    secondaryDepartment: "Public Works Department (PWD) - Water Resources",
    fieldCategory: "Storm Water Drainage",
    description: "Localized roadway accumulation, blockage in feeder channels, and sump management."
  },
  INFRASTRUCTURE: {
    category: "INFRASTRUCTURE",
    primaryDepartment: "Greater Chennai Corporation",
    secondaryDepartment: "Highways & Minor Ports Department",
    fieldCategory: "Roads & Infrastructure",
    description: "Culvert structural integrity, arterial road passage, and embankment safety."
  },
  ENVIRONMENTAL: {
    category: "ENVIRONMENTAL",
    primaryDepartment: "Tamil Nadu Pollution Control Board & GCC Environment Wing",
    secondaryDepartment: "Department of Environment & Climate Change",
    fieldCategory: "Wetland & Eco-Buffer Conservation",
    description: "Wetland boundary encroachment, water quality, and eco-sensitive area monitoring."
  }
};

/**
 * Gets department mapping based on risk level and issue category
 */
export const getDepartmentMapping = (category = 'FLOOD') => {
  return DEPARTMENT_MAPPINGS[category] || DEPARTMENT_MAPPINGS.FLOOD;
};
