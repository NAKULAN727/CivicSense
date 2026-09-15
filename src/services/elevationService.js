// CivicSense AI - Real-Time Topographic Elevation Intelligence Service
// Primary Data Source: Open-Elevation API & Copernicus DEM 30m via Open-Meteo

import { STUDY_AREAS } from '../data/mockData.js';

const OPEN_ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup';
const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

// In-Memory Request Deduplication & Response Cache
const elevationCache = new Map(); // key: `${lat},${lng}` -> { timestamp, data }
const inFlightElevationRequests = new Map(); // key: `${lat},${lng}` -> Promise
const ELEVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

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
 * Deduplicated & Cached per lat/lng
 * @param {Object} studyArea Target study area object containing lat, lng, name
 */
export const fetchElevationData = async (studyArea = STUDY_AREAS.pallikaranai_velachery) => {
  const targetArea = studyArea || STUDY_AREAS.pallikaranai_velachery;
  const lat = targetArea.lat;
  const lng = targetArea.lng;
  const cacheKey = `${lat},${lng}`;

  // 1. Check valid cached result
  const cached = elevationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < ELEVATION_TTL_MS)) {
    return cached.data;
  }

  // 2. Check in-flight request Promise
  if (inFlightElevationRequests.has(cacheKey)) {
    return inFlightElevationRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    // Try Open-Elevation API first
    try {
      const response = await fetch(`${OPEN_ELEVATION_API}?locations=${lat},${lng}`);
      
      if (response.status === 429) {
        console.warn(`Open-Elevation API Rate Limited (HTTP 429) for ${targetArea.name}`);
        if (cached) return cached.data;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const elevationValue = Math.round(data.results[0].elevation * 10) / 10;
          const result = {
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
          elevationCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return result;
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
        const result = {
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
        elevationCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
      }
    } catch (error) {
      console.warn(`Elevation query failed for ${targetArea.name}:`, error.message);
    }

    if (cached) {
      return cached.data;
    }

    // If all live endpoints fail, return explicit DEMO mode
    const locationKey = targetArea.name ? targetArea.name.toLowerCase().trim() : 'pallikaranai–velachery';
    const fallback = DEMO_ELEVATION_FALLBACK[locationKey] || DEMO_ELEVATION_FALLBACK['pallikaranai–velachery'];

    return {
      source: 'Topographic Reference Model',
      mode: 'ELEVATION_UNAVAILABLE',
      isLive: false,
      isError: true,
      errorMessage: `Elevation API unreachable for ${targetArea.name}.`,
      studyArea: targetArea.name,
      latitude: lat,
      longitude: lng,
      elevation: fallback.elevation,
      unit: 'm ASL',
      timestamp: new Date().toISOString(),
      statusLabel: 'DEMONSTRATION DATA (Elevation Fallback)'
    };
  })().finally(() => {
    inFlightElevationRequests.delete(cacheKey);
  });

  inFlightElevationRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
};
