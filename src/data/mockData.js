// CivicSense AI - Predictive Community Intelligence Platform
// Geospatial & Risk Intelligence Mock Database (Chennai Metropolitan Area & Pallikaranai-Velachery Study Area)

export const CHENNAI_CENTER = {
  lat: 13.0827,
  lng: 80.2707,
  zoom: 11,
  name: "Chennai Metropolitan Region"
};

export const STUDY_AREAS = {
  pallikaranai_velachery: {
    id: "pallikaranai_velachery",
    name: "Pallikaranai–Velachery",
    region: "Chennai, Tamil Nadu",
    lat: 12.94,
    lng: 80.21,
    zoom: 14,
    bbox: [80.190, 12.920, 80.250, 12.982],
    bounds: [
      [12.982, 80.190],
      [12.982, 80.250],
      [12.920, 80.250],
      [12.920, 80.190]
    ]
  },
  mumbai: {
    id: "mumbai",
    name: "Mumbai",
    region: "Mumbai, Maharashtra",
    lat: 19.0760,
    lng: 72.8777,
    zoom: 14,
    bbox: [72.8577, 19.0560, 72.9177, 19.1180],
    bounds: [
      [19.118, 72.8577],
      [19.118, 72.9177],
      [19.056, 72.9177],
      [19.056, 72.8577]
    ]
  },
  delhi: {
    id: "delhi",
    name: "Delhi",
    region: "Delhi, NCR",
    lat: 28.6139,
    lng: 77.2090,
    zoom: 14,
    bbox: [77.1700, 28.5700, 77.2500, 28.6500],
    bounds: [
      [28.650, 77.1700],
      [28.650, 77.2500],
      [28.570, 77.2500],
      [28.570, 77.1700]
    ]
  }
};

export const STUDY_AREA_CENTER = STUDY_AREAS.pallikaranai_velachery;

// Selectable Risk Zones inside Pallikaranai-Velachery Study Area
export const PALLIKARANAI_RISK_ZONES = [
  {
    id: "ZONE-FL-84",
    name: "Pallikaranai Marshland Central Basin",
    layer: "Flood Risk",
    riskScore: 84,
    riskLevel: "HIGH",
    color: "#f43f5e",
    strokeColor: "#e11d48",
    polygon: [
      [19.104, 72.8757],
      [19.111, 72.8957],
      [19.088, 72.9027],
      [19.082, 72.8817]
    ],
    detectedChange: "Increased water extent (+27% inundation area)",
    supportingData: "Rainfall (184mm/24h) + low elevation (2.1m ASL) + historical flood pattern + Sentinel-2 water expansion index",
    responsibleDept: "Municipal Drainage / Disaster Management",
    recommendedAction: "Inspect drainage and prepare flood response resources immediately.",
    slaHours: 12,
    status: "Active Risk"
  },
  {
    id: "ZONE-HT-67",
    name: "Velachery Main Road & Commercial Hub",
    layer: "Heat Risk",
    riskScore: 67,
    riskLevel: "HIGH",
    color: "#ea580c",
    strokeColor: "#c2410c",
    polygon: [
      [19.111, 72.8827],
      [19.118, 72.8927],
      [19.104, 72.8977],
      [19.098, 72.8857]
    ],
    detectedChange: "+4.2°C Urban Thermal Heat Island intensity vs surrounding wetlands",
    supportingData: "Landsat-9 Surface Thermal Infrared + dense concrete cover + high traffic friction",
    responsibleDept: "Greater Chennai Corporation (GCC) Environmental Cell",
    recommendedAction: "Deploy cool pavement reflectives & create shaded urban pedestrian corridors.",
    slaHours: 24,
    status: "Active Risk"
  },
  {
    id: "ZONE-WS-42",
    name: "Perungudi Urban Drain Corridor",
    layer: "Water Stress",
    riskScore: 42,
    riskLevel: "MODERATE",
    color: "#0284c7",
    strokeColor: "#0369a1",
    polygon: [
      [19.091, 72.8977],
      [19.098, 72.9127],
      [19.078, 72.9157],
      [19.074, 72.8997]
    ],
    detectedChange: "Stormwater flow velocity drop (-38%) due to sediment accumulation",
    supportingData: "Sentinel-1 SAR surface moisture + GCC drain telemetry sensors",
    responsibleDept: "Chennai Metropolitan Water Supply & Sewerage Board (CMWSSB)",
    recommendedAction: "Clear clogged arterial drain channels and desilt retention culverts.",
    slaHours: 36,
    status: "Monitoring"
  },
  {
    id: "ZONE-VG-31",
    name: "Medavakkam Eco-Buffer Margin",
    layer: "Vegetation Change",
    riskScore: 31,
    riskLevel: "MODERATE",
    color: "#eab308",
    strokeColor: "#ca8a04",
    polygon: [
      [19.074, 72.8727],
      [19.082, 72.8877],
      [19.066, 72.8927],
      [19.061, 72.8777]
    ],
    detectedChange: "-12% green canopy loss detected over past 12 months",
    supportingData: "NDVI multispectral satellite index (0.64 -> 0.52)",
    responsibleDept: "Forest Department & Biodiversity Conservation Board",
    recommendedAction: "Initiate mangrove protection buffer and restrict unauthorized land clearing.",
    slaHours: 48,
    status: "Monitoring"
  },
  {
    id: "ZONE-LU-55",
    name: "Madipakkam Peripheral Zone",
    layer: "Land-Use Change",
    riskScore: 55,
    riskLevel: "MODERATE",
    color: "#8b5cf6",
    strokeColor: "#6d28d9",
    polygon: [
      [19.101, 72.8627],
      [19.108, 72.8757],
      [19.091, 72.8797],
      [19.086, 72.8657]
    ],
    detectedChange: "+8% built-up surface area increase along marshland periphery",
    supportingData: "High-resolution satellite building footprint segmentation (YOLOv8-Geo)",
    responsibleDept: "Chennai Metropolitan Development Authority (CMDA)",
    recommendedAction: "Review zoning permits and enforce wetland buffer boundaries.",
    slaHours: 48,
    status: "Under Review"
  }
];

// Chennai Metro Overview Hotspot Pins
export const CHENNAI_HOTSPOTS = [
  {
    id: "CSAI-2026-CH01",
    type: "Flood Risk",
    title: "Pallikaranai Marshland Water Extent Surge",
    description: "Satellite SAR detected 27% increase in open water extent post-monsoon precipitation, threatening Velachery low-lying sectors.",
    location: {
      lat: 19.0760,
      lng: 72.8777,
      address: "Pallikaranai Marshland Wetland Zone, Chennai",
      ward: "Ward 180 - Velachery South"
    },
    severity: "Critical",
    riskScore: 84,
    status: "Active Alert",
    reportedAt: "2026-09-08T10:15:00+05:30",
    detectedBy: "Sentinel-2 & Sentinel-1 SAR Fusion Engine",
    confidence: 0.94,
    recommendedDept: "Municipal Drainage / Disaster Management",
    estCost: 145000,
    slaHours: 12,
    trafficVolume: "High"
  },
  {
    id: "CSAI-2026-CH02",
    type: "Heat Risk",
    title: "T. Nagar Urban Heat Island Spike",
    description: "Land surface temperature elevated by 5.8°C above regional average due to heavy asphalt density and reduced urban canopy.",
    location: {
      lat: 13.0418,
      lng: 80.2341,
      address: "Usman Road Corridor, T. Nagar",
      ward: "Ward 134 - T. Nagar"
    },
    severity: "High",
    riskScore: 67,
    status: "Assigned",
    reportedAt: "2026-09-08T09:30:00+05:30",
    detectedBy: "Landsat-9 Thermal Infrared AI Scanner",
    confidence: 0.91,
    recommendedDept: "Greater Chennai Corporation (GCC) Urban Planning",
    estCost: 85000,
    slaHours: 24,
    trafficVolume: "Critical"
  },
  {
    id: "CSAI-2026-CH03",
    type: "Water Stress",
    title: "Koyambedu Wholesale Drain Blockage",
    description: "Severe urban runoff stagnation detected along major stormwater culverts near Koyambedu market intersection.",
    location: {
      lat: 13.0694,
      lng: 80.1948,
      address: "100 Feet Road, Koyambedu Junction",
      ward: "Ward 127 - Koyambedu"
    },
    severity: "High",
    riskScore: 72,
    status: "Pending Review",
    reportedAt: "2026-09-08T08:45:00+05:30",
    detectedBy: "AeroScan Drone AI Patrol",
    confidence: 0.89,
    recommendedDept: "Municipal Drainage Department",
    estCost: 42000,
    slaHours: 18,
    trafficVolume: "Critical"
  },
  {
    id: "CSAI-2026-CH04",
    type: "Land-Use Change",
    title: "Sholinganallur IT Buffer Encroachment",
    description: "Satellite imagery flags 8% rapid built-up area surge encroaching onto natural drainage channels.",
    location: {
      lat: 12.9010,
      lng: 80.2279,
      address: "OMR IT Corridor, Sholinganallur",
      ward: "Ward 197 - Sholinganallur"
    },
    severity: "Medium",
    riskScore: 55,
    status: "Under Review",
    reportedAt: "2026-09-07T14:20:00+05:30",
    detectedBy: "Sentinel-2 Building Footprint AI",
    confidence: 0.87,
    recommendedDept: "Chennai Metropolitan Development Authority (CMDA)",
    estCost: 120000,
    slaHours: 48,
    trafficVolume: "High"
  },
  {
    id: "CSAI-2026-CH05",
    type: "Vegetation Change",
    title: "Guindy National Park Margin Canopy Loss",
    description: "-12% green cover reduction observed over recent quarter along park boundary construction zone.",
    location: {
      lat: 13.0067,
      lng: 80.2206,
      address: "Sardar Patel Road, Guindy",
      ward: "Ward 170 - Guindy"
    },
    severity: "Medium",
    riskScore: 48,
    status: "Monitoring",
    reportedAt: "2026-09-07T11:10:00+05:30",
    detectedBy: "NDVI Vegetation Index Monitor",
    confidence: 0.85,
    recommendedDept: "Tamil Nadu Forest Department",
    estCost: 35000,
    slaHours: 48,
    trafficVolume: "Medium"
  }
];

export const MOCK_ISSUES = CHENNAI_HOTSPOTS;

// Satellite Analysis Comparison Metadata
export const SATELLITE_COMPARISON_DATA = {
  studyArea: "Pallikaranai–Velachery",
  baselineDate: "15 Oct 2025 (Pre-Monsoon Baseline)",
  recentDate: "08 Sep 2026 (Recent Sentinel-2 Pass)",
  satelliteSource: "Sentinel-2A MSI & Sentinel-1 C-SAR Fusion (10m Spatial Resolution)",
  modeLabel: "Satellite Data: DEMONSTRATION MODE",
  isLive: false,
  previousObservation: {
    date: "15 Oct 2025",
    platform: "Sentinel-2A MSI L2A",
    cloudCover: "2.1%",
    waterExtentKm2: 1.82,
    ndviIndex: 0.636,
    builtUpKm2: 4.10,
    bands: { green: 0.12, red: 0.08, nir: 0.36, swir: 0.18 }
  },
  recentObservation: {
    date: "08 Sep 2026",
    platform: "Sentinel-2B MSI & Sentinel-1 C-SAR",
    cloudCover: "4.8%",
    waterExtentKm2: 2.31,
    ndviIndex: 0.349,
    builtUpKm2: 4.43,
    bands: { green: 0.18, red: 0.14, nir: 0.29, swir: 0.22 }
  },
  metrics: {
    waterBodyChange: {
      value: "+27%",
      previous: "1.82 km²",
      recent: "2.31 km²",
      direction: "up",
      severity: "high",
      label: "Water Extent (Inundation)",
      detail: "Inundation extent expanded by 0.49 km² (+27%) into low-lying sectors."
    },
    vegetationChange: {
      value: "-18.8%",
      previous: "NDVI 0.64",
      recent: "NDVI 0.52",
      direction: "down",
      severity: "moderate",
      label: "Vegetation Canopy (NDVI)",
      detail: "NDVI canopy reduction from submergence & marshland eco-buffer loss."
    },
    builtUpChange: {
      value: "+8%",
      previous: "4.10 km²",
      recent: "4.43 km²",
      direction: "up",
      severity: "moderate",
      label: "Built-up Impervious Area",
      detail: "Concrete expansion along the Velachery-Medavakkam commercial corridor."
    }
  }
};

// AI Community Risk Engine Scores
export const INITIAL_AI_RISK_ENGINE_SCORES = [
  {
    id: "flood",
    name: "Flood Risk",
    score: 84,
    level: "HIGH",
    color: "#f43f5e",
    icon: "🌊",
    trend: "+14% post-rain",
    description: "Severe risk of urban inundation driven by 184mm rainfall and low elevation drainage bottleneck."
  },
  {
    id: "heat",
    name: "Heat Risk",
    score: 67,
    level: "HIGH",
    color: "#ea580c",
    icon: "🔥",
    trend: "+4.2°C anomaly",
    description: "Thermal heat island intensity elevated along high-density concrete commercial axes."
  },
  {
    id: "water_stress",
    name: "Water Stress",
    score: 42,
    level: "MODERATE",
    color: "#0284c7",
    icon: "💧",
    trend: "Stable",
    description: "Groundwater recharge capacity compromised due to clogged stormwater channels."
  },
  {
    id: "vegetation_loss",
    name: "Vegetation Loss",
    score: 31,
    level: "MODERATE",
    color: "#eab308",
    icon: "🌳",
    trend: "-12% annual",
    description: "Gradual decline in wetland vegetation buffers along urban perimeter."
  }
];

// Department Alert Data for High Flood Risk Trigger
export const INITIAL_DEPARTMENT_ALERT = {
  id: "CSAI-2026-X94B",
  alertTitle: "HIGH FLOOD RISK DETECTED",
  area: "Pallikaranai–Velachery",
  riskScore: 84,
  riskLevel: "HIGH",
  reason: "Heavy rainfall + low elevation + historical flood pattern + satellite-detected water expansion.",
  responsibleDept: "Municipal Drainage / Disaster Management",
  targetEmail: "disaster.response@gcc.tn.gov.in",
  targetSMSGateway: "+91 44 2561 9000",
  recommendedAction: "Inspect drainage and prepare flood response resources",
  status: "Pending Dispatch",
  sentTime: null
};

// Community Pulse Indicators
export const COMMUNITY_PULSE_DATA = {
  location: "Pallikaranai–Velachery",
  updatedAt: "2 mins ago",
  indicators: [
    { text: "High flood risk detected", level: "critical", color: "🔴" },
    { text: "Heat risk increasing", level: "high", color: "🟠" },
    { text: "Moderate water stress", level: "moderate", color: "🟡" },
    { text: "No major vegetation loss detected", level: "normal", color: "🟢" }
  ],
  aiRecommendation: "Prepare drainage response resources in the high-risk zone and monitor water accumulation during heavy rainfall."
};

// Historical Risk Trends (Chennai Zonal Metrics)
export const CHENNAI_HISTORICAL_RISK_TRENDS = [
  { month: "Jan", Flood: 15, Heat: 45, Stress: 60, Canopy: 78 },
  { month: "Feb", Flood: 12, Heat: 52, Stress: 65, Canopy: 76 },
  { month: "Mar", Flood: 10, Heat: 68, Stress: 72, Canopy: 73 },
  { month: "Apr", Flood: 22, Heat: 82, Stress: 78, Canopy: 70 },
  { month: "May", Flood: 35, Heat: 91, Stress: 85, Canopy: 68 },
  { month: "Jun", Flood: 40, Heat: 78, Stress: 70, Canopy: 67 },
  { month: "Jul", Flood: 55, Heat: 70, Stress: 58, Canopy: 65 },
  { month: "Aug", Flood: 72, Heat: 64, Stress: 48, Canopy: 64 },
  { month: "Sep", Flood: 84, Heat: 67, Stress: 42, Canopy: 62 }
];

export const WARD_HEALTH_DATA = [
  { name: "Velachery", health: 68, activeIssues: 18, resolvedCount: 84 },
  { name: "Pallikaranai", health: 58, activeIssues: 24, resolvedCount: 65 },
  { name: "T. Nagar", health: 74, activeIssues: 12, resolvedCount: 95 },
  { name: "Guindy", health: 81, activeIssues: 7, resolvedCount: 79 },
  { name: "Koyambedu", health: 64, activeIssues: 15, resolvedCount: 48 },
  { name: "Sholinganallur", health: 55, activeIssues: 31, resolvedCount: 62 }
];

export const DEPT_DISPATCH_STATS = [
  { name: "Municipal Drainage", dispatched: 48, completed: 39, pending: 9 },
  { name: "GCC Disaster Mgmt", dispatched: 32, completed: 28, pending: 4 },
  { name: "CMWSSB (Water)", dispatched: 26, completed: 22, pending: 4 },
  { name: "Forest & Wetland", dispatched: 14, completed: 12, pending: 2 }
];

export const MOCK_NOTIFICATIONS = [
  {
    id: "N-01",
    issueId: "CSAI-2026-CH01",
    title: "🚨 HIGH FLOOD RISK DETECTED",
    description: "Sentinel-2 satellite flagged +27% water expansion in Pallikaranai Marshland. Drainage response team notified.",
    time: "Just now",
    severity: "critical"
  },
  {
    id: "N-02",
    issueId: "CSAI-2026-CH02",
    title: "T. Nagar Urban Heat Spike",
    description: "Landsat thermal sensor recorded 5.8°C heat island anomaly near Usman Road flyover.",
    time: "14 mins ago",
    severity: "high"
  },
  {
    id: "N-03",
    issueId: "CSAI-2026-CH03",
    title: "Koyambedu Drain Telemetry Warning",
    description: "Flow rate dropped 38% at main stormwater culvert. Desilting crew scheduled.",
    time: "45 mins ago",
    severity: "high"
  }
];

export const predictDeteriorationCurve = (traffic, rainfall, age, material) => {
  const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let materialFactor = 1.0;
  if (material === "Eco-Mix Asphalt") materialFactor = 1.0;
  if (material === "Standard Bitumen") materialFactor = 1.2;
  if (material === "Polymer Modified Asphalt") materialFactor = 1.65;

  const trafficWeight = traffic / 5;
  const rainWeight = 1.0 + (rainfall - 1000) / 2000;

  return years.map(y => {
    const activeAge = parseFloat(age) + y;
    let deteriorationScore = 100 - (
      Math.pow(activeAge, 1.45) * 
      (3.2 + trafficWeight * 2.8) * 
      (1.0 + rainWeight * 0.45) / 
      materialFactor
    );
    deteriorationScore = Math.max(0, Math.min(100, Math.round(deteriorationScore)));
    return {
      year: y,
      predictedAge: Math.round(activeAge),
      health: deteriorationScore
    };
  });
};
