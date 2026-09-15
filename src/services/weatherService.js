// CivicSense AI - Real-Time Weather Intelligence Service
// Primary Data Source: Open-Meteo Public API (https://api.open-meteo.com/v1/forecast)

import { STUDY_AREAS } from '../data/mockData.js';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

// In-Memory Request Deduplication, Response Cache, & Rate Limit Cooldown
const weatherCache = new Map(); // key: `lat,lng` -> { timestamp, data }
const inFlightWeatherRequests = new Map(); // key: `lat,lng` -> Promise
const weatherRateLimitCooldown = new Map(); // key: `lat,lng` -> expiryTimestamp
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes TTL
const COOLDOWN_TTL_MS = 60 * 1000; // 60 seconds rate limit cooldown

/**
 * Fallback Weather Demonstration Data
 */
const DEMO_WEATHER_FALLBACK = {
  "pallikaranai–velachery": {
    temperature: 31.2,
    precipitation: 0.0,
    rainfall: 0.0,
    humidity: 74,
    precipitationProbability: 25,
    forecast: [
      { day: 'Today', tempMax: 33, tempMin: 26, rainMm: 0 },
      { day: 'Tomorrow', tempMax: 32, tempMin: 25, rainMm: 12 },
      { day: 'Day 3', tempMax: 30, tempMin: 24, rainMm: 45 }
    ]
  }
};

/**
 * Fetch Live Weather Data from Open-Meteo for target study area coordinates
 * Deduplicated, Cached, & Cooldown Protected per lat/lng
 * @param {Object} studyArea Target study area object containing lat, lng, name
 */
export const fetchWeatherData = async (studyArea = STUDY_AREAS.pallikaranai_velachery) => {
  const targetArea = studyArea || STUDY_AREAS.pallikaranai_velachery;
  const lat = targetArea.lat;
  const lng = targetArea.lng;
  const cacheKey = `${lat},${lng}`;

  // 1. Return valid cached result if available within TTL
  const cached = weatherCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // 2. Check rate limit cooldown
  const cooldownExpiry = weatherRateLimitCooldown.get(cacheKey);
  if (cooldownExpiry && Date.now() < cooldownExpiry) {
    if (cached) {
      return {
        ...cached.data,
        isRateLimited: true,
        statusLabel: 'CACHED WEATHER (Open-Meteo Rate Limited)'
      };
    }
    return {
      source: 'Open-Meteo',
      mode: 'WEATHER_RATE_LIMITED',
      isLive: false,
      isError: true,
      isRateLimited: true,
      errorMessage: 'Weather service temporarily rate limited (HTTP 429).',
      studyArea: targetArea.name,
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('en-IN'),
      temperature: 'N/A',
      tempUnit: '°C',
      precipitation: 0,
      rainfall: 0,
      rainUnit: 'mm',
      humidity: 'N/A',
      humidityUnit: '%',
      precipitationProbability: 0,
      forecast: [],
      statusLabel: 'Weather service temporarily rate limited (HTTP 429).'
    };
  }

  // 3. Return in-flight request Promise if identical request is currently active
  if (inFlightWeatherRequests.has(cacheKey)) {
    return inFlightWeatherRequests.get(cacheKey);
  }

  const url = `${OPEN_METEO_API}?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain&hourly=precipitation_probability,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        weatherRateLimitCooldown.set(cacheKey, Date.now() + COOLDOWN_TTL_MS);

        if (cached) {
          return {
            ...cached.data,
            isRateLimited: true,
            statusLabel: 'CACHED WEATHER (Open-Meteo Rate Limited)'
          };
        }

        return {
          source: 'Open-Meteo',
          mode: 'WEATHER_RATE_LIMITED',
          isLive: false,
          isError: true,
          isRateLimited: true,
          errorMessage: 'Weather service temporarily rate limited (HTTP 429).',
          studyArea: targetArea.name,
          latitude: lat,
          longitude: lng,
          timestamp: new Date().toISOString(),
          formattedTime: new Date().toLocaleTimeString('en-IN'),
          temperature: 'N/A',
          tempUnit: '°C',
          precipitation: 0,
          rainfall: 0,
          rainUnit: 'mm',
          humidity: 'N/A',
          humidityUnit: '%',
          precipitationProbability: 0,
          forecast: [],
          statusLabel: 'Weather service temporarily rate limited (HTTP 429).'
        };
      }

      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP status ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const current = data.current || {};
      const daily = data.daily || {};
      const hourly = data.hourly || {};

      const formattedTimestamp = current.time 
        ? new Date(current.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date().toLocaleTimeString('en-IN');

      const forecastDays = (daily.time || []).slice(0, 3).map((dateStr, idx) => {
        const dateObj = new Date(dateStr);
        const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          day: dayName,
          date: dateStr,
          tempMax: daily.temperature_2m_max ? daily.temperature_2m_max[idx] : null,
          tempMin: daily.temperature_2m_min ? daily.temperature_2m_min[idx] : null,
          rainMm: daily.precipitation_sum ? daily.precipitation_sum[idx] : 0
        };
      });

      const precipProb = (hourly.precipitation_probability && hourly.precipitation_probability.length > 0)
        ? Math.max(...hourly.precipitation_probability.slice(0, 24))
        : 0;

      const result = {
        source: 'Open-Meteo',
        mode: 'LIVE',
        isLive: true,
        isError: false,
        errorMessage: null,
        studyArea: targetArea.name,
        latitude: lat,
        longitude: lng,
        timestamp: current.time || new Date().toISOString(),
        formattedTime: formattedTimestamp,
        temperature: current.temperature_2m !== undefined ? current.temperature_2m : 'N/A',
        tempUnit: data.current_units?.temperature_2m || '°C',
        precipitation: current.precipitation !== undefined ? current.precipitation : 0,
        rainfall: current.rain !== undefined ? current.rain : 0,
        rainUnit: data.current_units?.rain || 'mm',
        humidity: current.relative_humidity_2m !== undefined ? current.relative_humidity_2m : 'N/A',
        humidityUnit: data.current_units?.relative_humidity_2m || '%',
        precipitationProbability: precipProb,
        forecast: forecastDays,
        statusLabel: 'LIVE WEATHER FEED (Open-Meteo API)'
      };

      weatherCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;

    } catch (error) {
      if (cached) return cached.data;

      const locationKey = targetArea.name ? targetArea.name.toLowerCase().trim() : 'pallikaranai–velachery';
      const fallback = DEMO_WEATHER_FALLBACK[locationKey] || DEMO_WEATHER_FALLBACK['pallikaranai–velachery'];

      return {
        source: 'Open-Meteo',
        mode: 'DEMO',
        isLive: false,
        isError: true,
        errorMessage: `Weather API Notice: ${error.message}. Displaying DEMONSTRATION WEATHER DATA.`,
        studyArea: targetArea.name,
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleTimeString('en-IN'),
        temperature: fallback.temperature,
        tempUnit: '°C',
        precipitation: fallback.precipitation,
        rainfall: fallback.rainfall,
        rainUnit: 'mm',
        humidity: fallback.humidity,
        humidityUnit: '%',
        precipitationProbability: fallback.precipitationProbability,
        forecast: fallback.forecast,
        statusLabel: 'DEMONSTRATION DATA (Open-Meteo Fallback)'
      };
    } finally {
      inFlightWeatherRequests.delete(cacheKey);
    }
  })();

  inFlightWeatherRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
};
