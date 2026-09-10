// CivicSense AI - Real-Time Topographic Elevation Intelligence Service
// Primary Data Source: Open-Elevation API & Copernicus DEM 30m via Open-Meteo

import { STUDY_AREAS } from '../data/mockData.js';

const OPEN_ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup';
const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fallback Elevation Demonstration Data
 */
const DEMO_ELEVATION_FALLBACK = {
  "pallikaranai–velachery": { elevation: 3.0 },
  "mumbai": { elevation: 8.0 },
  "delhi": { elevation: 216.0 }
};

/**
 * Fetch Live Elevation Data for target study area coordinates
 * @param {Object} studyArea Target study area object containing lat, lng, name
 */
export const fetchElevationData = async (studyArea = STUDY_AREAS.pallikaranai_velachery) => {
  const targetArea = studyArea || STUDY_AREAS.pallikaranai_velachery;
  const lat = targetArea.lat;
  const lng = targetArea.lng;

  // Try Open-Elevation API first
  try {
    const response = await fetch(`${OPEN_ELEVATION_API}?locations=${lat},${lng}`);
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const elevationValue = Math.round(data.results[0].elevation * 10) / 10;
        return {
          source: 'Open-Elevation API',
          mode: 'LIVE',
          isLive: true,
          isError: false,
          errorMessage: null,
          studyArea: targetArea.name,
          latitude: lat,
          longitude: lng,
          elevation: elevationValue,
          unit: 'm ASL',
          timestamp: new Date().toISOString(),
          statusLabel: 'LIVE ELEVATION STREAM (Open-Elevation)'
        };
      }
    }
  } catch (err) {
    console.warn(`Open-Elevation lookup failed for ${targetArea.name}, checking Open-Meteo Copernicus DEM:`, err.message);
  }

  // Fallback to Open-Meteo Copernicus 30m DEM elevation endpoint
  try {
    const response = await fetch(`${OPEN_METEO_API}?latitude=${lat}&longitude=${lng}`);
    if (!response.ok) {
      throw new Error(`Open-Meteo DEM HTTP status ${response.status}`);
    }
    const data = await response.json();
    if (data.elevation !== undefined && data.elevation !== null) {
      const elevationValue = Math.round(data.elevation * 10) / 10;
      return {
        source: 'Copernicus DEM 30m (Open-Meteo)',
        mode: 'LIVE',
        isLive: true,
        isError: false,
        errorMessage: null,
        studyArea: targetArea.name,
        latitude: lat,
        longitude: lng,
        elevation: elevationValue,
        unit: 'm ASL',
        timestamp: new Date().toISOString(),
        statusLabel: 'LIVE ELEVATION STREAM (Copernicus DEM 30m)'
      };
    }
  } catch (error) {
    console.warn(`Elevation query failed for ${targetArea.name}:`, error.message);
  }

  // If all live endpoints fail, return explicit DEMO mode
  const locationKey = targetArea.name ? targetArea.name.toLowerCase().trim() : 'pallikaranai–velachery';
  const fallback = DEMO_ELEVATION_FALLBACK[locationKey] || DEMO_ELEVATION_FALLBACK['pallikaranai–velachery'];

  return {
    source: 'Topographic Reference Model',
    mode: 'DEMO',
    isLive: false,
    isError: true,
    errorMessage: `Elevation API unreachable for ${targetArea.name}. Displaying DEMONSTRATION ELEVATION DATA.`,
    studyArea: targetArea.name,
    latitude: lat,
    longitude: lng,
    elevation: fallback.elevation,
    unit: 'm ASL',
    timestamp: new Date().toISOString(),
    statusLabel: 'DEMONSTRATION DATA (Elevation Fallback)'
  };
};
