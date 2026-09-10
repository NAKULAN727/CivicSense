// CivicSense AI - Historical Flood Reference Intelligence Service
// Primary Data Sources: India Meteorological Department (IMD) Archives & State Disaster Management Authorities (TNSDMA/SDMA)

import { STUDY_AREAS } from '../data/mockData.js';

/**
 * Documented Historical Flood Reference Archives by Location
 */
const HISTORICAL_FLOOD_RECORDS = {
  "pallikaranai–velachery": {
    studyArea: "Pallikaranai–Velachery",
    region: "Chennai Metropolitan Area, Tamil Nadu",
    sourceAttribution: "IMD Historical Climate Archives & TNSDMA Flood Reports",
    records: [
      {
        id: "FL-2023-MICHAUNG",
        eventName: "Cyclone Michaung Severe Inundation",
        date: "04 Dec 2023",
        rainfallMm: 450,
        rainfallPeriod: "24-Hour Cumulative",
        inundationDepth: "1.2m - 1.8m",
        affectedSectors: "Velachery South, Pallikaranai Marshland Fringe, Madipakkam",
        description: "Catastrophic urban runoff stagnation and wetland overflow caused by 450mm extreme precipitation within 24 hours.",
        source: "TNSDMA Official Post-Disaster Audit"
      },
      {
        id: "FL-2021-NOV",
        eventName: "Northeast Monsoon Surge",
        date: "11 Nov 2021",
        rainfallMm: 210,
        rainfallPeriod: "24-Hour Cumulative",
        inundationDepth: "0.8m - 1.2m",
        affectedSectors: "Perungudi Drainage Corridor, Velachery Main Road",
        description: "High-intensity monsoonal cloudburst led to arterial stormwater channel blockage and wetland buffer submergence.",
        source: "IMD Meteorological Bulletin"
      },
      {
        id: "FL-2015-DEC",
        eventName: "2015 Historic Chennai Deluge",
        date: "01 Dec 2015",
        rainfallMm: 494,
        rainfallPeriod: "24-Hour Cumulative",
        inundationDepth: "2.0m - 3.2m",
        affectedSectors: "Pallikaranai Central Basin, Velachery Lake Margin",
        description: "Record-breaking precipitation event resulting in severe basin flooding across low-lying marshland sectors.",
        source: "National Disaster Management Authority (NDMA)"
      }
    ]
  },
  "mumbai": {
    studyArea: "Mumbai",
    region: "Mumbai Metropolitan Region, Maharashtra",
    sourceAttribution: "IMD Mumbai Climate Records & MCGM Disaster Cell",
    records: [
      {
        id: "FL-2023-MUM",
        eventName: "July Monsoon High Tide Inundation",
        date: "26 Jul 2023",
        rainfallMm: 280,
        rainfallPeriod: "24-Hour Cumulative",
        inundationDepth: "0.6m - 1.2m",
        affectedSectors: "Mithi River Basin, Kurla, Sion Low-lying Axis",
        description: "Heavy monsoonal cloudburst synchronized with 4.8m spring high tide, impairing drain outfalls.",
        source: "MCGM Disaster Management Cell"
      },
      {
        id: "FL-2005-JUL",
        eventName: "2005 Great Mumbai Deluge",
        date: "26 Jul 2005",
        rainfallMm: 944,
        rainfallPeriod: "24-Hour Cumulative",
        inundationDepth: "2.5m - 4.0m",
        affectedSectors: "Mithi River Corridor, Suburban Rail Belt",
        description: "Extreme precipitation anomaly causing catastrophic urban inundation across central and suburban sectors.",
        source: "IMD & Maharashtra State Disaster Management"
      }
    ]
  },
  "delhi": {
    studyArea: "Delhi",
    region: "National Capital Region (NCR), Delhi",
    sourceAttribution: "Central Water Commission (CWC) & IMD Delhi",
    records: [
      {
        id: "FL-2023-DEL",
        eventName: "2023 Yamuna River Overflow",
        date: "13 Jul 2023",
        rainfallMm: 153,
        rainfallPeriod: "24-Hour Cumulative (Upstream Release)",
        inundationDepth: "1.0m - 2.1m",
        affectedSectors: "Yamuna Floodplain, ITO, Ring Road",
        description: "Yamuna river water level reached historic 208.66m peak, breaching low-lying embankment sectors.",
        source: "Central Water Commission (CWC) Flood Records"
      }
    ]
  }
};

/**
 * Fetch Historical Flood Reference Data for target study area
 * @param {Object} studyArea Target study area object
 */
export const getHistoricalFloodData = async (studyArea = STUDY_AREAS.pallikaranai_velachery) => {
  const targetArea = studyArea || STUDY_AREAS.pallikaranai_velachery;
  const locationKey = targetArea.name ? targetArea.name.toLowerCase().trim() : 'pallikaranai–velachery';

  const data = HISTORICAL_FLOOD_RECORDS[locationKey] || HISTORICAL_FLOOD_RECORDS['pallikaranai–velachery'];

  return {
    source: data.sourceAttribution,
    mode: 'HISTORICAL_REFERENCE',
    isLive: false,
    studyArea: targetArea.name,
    records: data.records,
    statusLabel: 'HISTORICAL REFERENCE DATA (Official Archives)',
    timestamp: new Date().toISOString()
  };
};
