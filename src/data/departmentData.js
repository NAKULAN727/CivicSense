// CivicSense AI - Department Mapping Rules (Phase 5 & 7 Location-Aware Routing)
// Maps flood & environmental risk categories to responsible civic departments and field categories per study area.
// IMPORTANT: Prototype routing categories only. No real contact numbers, emails, or personal details.

export const LOCATION_DEPARTMENT_MAPPINGS = {
  CHENNAI: {
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
  },

  MUMBAI: {
    FLOOD: {
      category: "FLOOD",
      primaryDepartment: "Brihanmumbai Municipal Corporation (BMC)",
      secondaryDepartment: "Maharashtra State Disaster Management Authority (MSDMA) / BMC Disaster Management Unit",
      fieldCategory: "Urban Flood / Storm Water Drainage Response",
      description: "Monsoon inundation risk, low-lying drainage pumping, and coastal storm water management."
    },
    WATERLOGGING: {
      category: "WATERLOGGING",
      primaryDepartment: "Brihanmumbai Municipal Corporation (BMC) Storm Water Drain Dept",
      secondaryDepartment: "BMC Disaster Management Unit",
      fieldCategory: "Urban Flood / Storm Water Drainage Response",
      description: "Subway waterlogging clearance, arterial road drainage, and high-capacity pump dispatch."
    },
    INFRASTRUCTURE: {
      category: "INFRASTRUCTURE",
      primaryDepartment: "Brihanmumbai Municipal Corporation (BMC) Infrastructure Cell",
      secondaryDepartment: "Mumbai Metropolitan Region Development Authority (MMRDA)",
      fieldCategory: "Roads & Transit Infrastructure",
      description: "Culvert structural integrity, subway drainage clearance, and flyover runoff management."
    },
    ENVIRONMENTAL: {
      category: "ENVIRONMENTAL",
      primaryDepartment: "Maharashtra Pollution Control Board (MPCB)",
      secondaryDepartment: "Maharashtra Environment & Climate Change Department",
      fieldCategory: "Coastal & Wetland Protection",
      description: "Mithi River eco-monitoring, mangrove buffer protection, and urban flood basin surveillance."
    }
  },

  DELHI: {
    FLOOD: {
      category: "FLOOD",
      primaryDepartment: "Municipal Corporation of Delhi (MCD) & Irrigation and Flood Control Department (I&FC)",
      secondaryDepartment: "Delhi Disaster Management Authority (DDMA)",
      fieldCategory: "Urban Flood / Drainage Response",
      description: "Yamuna floodplain monitoring, stormwater drain clearance, and low-lying inundation response."
    },
    WATERLOGGING: {
      category: "WATERLOGGING",
      primaryDepartment: "Municipal Corporation of Delhi (MCD) Stormwater Cell",
      secondaryDepartment: "Delhi Development Authority (DDA)",
      fieldCategory: "Urban Flood / Drainage Response",
      description: "Underpass waterlogging mitigation, pump pre-staging, and arterial drain clearance."
    },
    INFRASTRUCTURE: {
      category: "INFRASTRUCTURE",
      primaryDepartment: "Public Works Department (PWD) Delhi",
      secondaryDepartment: "Delhi Development Authority (DDA)",
      fieldCategory: "Civic & Transport Infrastructure",
      description: "Underpass drainage, embankment safety, and stormwater channel clearance."
    },
    ENVIRONMENTAL: {
      category: "ENVIRONMENTAL",
      primaryDepartment: "Delhi Pollution Control Committee (DPCC)",
      secondaryDepartment: "Department of Environment, Govt of NCT of Delhi",
      fieldCategory: "Yamuna & Eco-Buffer Conservation",
      description: "Yamuna floodplain encroachment, runoff pollution, and eco-buffer conservation."
    }
  },

  GENERIC: {
    FLOOD: {
      category: "FLOOD",
      primaryDepartment: "Department routing unavailable for this study area.",
      secondaryDepartment: "Prototype Regional Disaster Management Unit",
      fieldCategory: "Generic / Prototype Flood Response",
      description: "Department routing unavailable for this study area. Generic prototype response assigned."
    },
    WATERLOGGING: {
      category: "WATERLOGGING",
      primaryDepartment: "Department routing unavailable for this study area.",
      secondaryDepartment: "Prototype Regional Public Works Department",
      fieldCategory: "Generic / Prototype Drainage Response",
      description: "Department routing unavailable for this study area. Generic prototype response assigned."
    },
    INFRASTRUCTURE: {
      category: "INFRASTRUCTURE",
      primaryDepartment: "Department routing unavailable for this study area.",
      secondaryDepartment: "Prototype Regional Infrastructure Authority",
      fieldCategory: "Generic / Prototype Infrastructure Management",
      description: "Department routing unavailable for this study area. Generic prototype response assigned."
    },
    ENVIRONMENTAL: {
      category: "ENVIRONMENTAL",
      primaryDepartment: "Department routing unavailable for this study area.",
      secondaryDepartment: "Prototype Regional Environment Protection Board",
      fieldCategory: "Generic / Prototype Environmental Conservation",
      description: "Department routing unavailable for this study area. Generic prototype response assigned."
    }
  }
};

// Default export for backward compatibility
export const DEPARTMENT_MAPPINGS = LOCATION_DEPARTMENT_MAPPINGS.CHENNAI;

/**
 * Resolves location key from study area parameter (string or object)
 */
export const resolveLocationKey = (studyArea) => {
  if (!studyArea) return null;

  let str = '';
  if (typeof studyArea === 'string') {
    str = studyArea.toLowerCase();
  } else if (typeof studyArea === 'object') {
    str = `${studyArea.id || ''} ${studyArea.name || ''} ${studyArea.region || ''}`.toLowerCase();
  }

  if (str.includes('mumbai')) return 'MUMBAI';
  if (str.includes('delhi')) return 'DELHI';
  if (str.includes('pallikaranai') || str.includes('velachery') || str.includes('chennai')) return 'CHENNAI';

  return 'GENERIC';
};

/**
 * Gets department mapping based on issue category and target study area
 * 
 * @param {string} category Risk issue category (default: 'FLOOD')
 * @param {Object|string|null} studyArea Target study area object or location name string
 * @returns {Object} Location-aware department mapping object
 */
export const getDepartmentMapping = (category = 'FLOOD', studyArea = null) => {
  let locationKey = resolveLocationKey(studyArea);

  // If studyArea parameter was omitted entirely (null/undefined), fallback to CHENNAI for backward compatibility
  if (!studyArea) {
    locationKey = 'CHENNAI';
  }

  const areaMappings = LOCATION_DEPARTMENT_MAPPINGS[locationKey] || LOCATION_DEPARTMENT_MAPPINGS.GENERIC;
  return areaMappings[category] || areaMappings.FLOOD || LOCATION_DEPARTMENT_MAPPINGS.CHENNAI.FLOOD;
};

