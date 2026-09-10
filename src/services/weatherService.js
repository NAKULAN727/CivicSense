// CivicSense AI - Real-Time Weather Intelligence Service
// Primary Data Source: Open-Meteo Public API (https://api.open-meteo.com/v1/forecast)

import { STUDY_AREAS } from '../data/mockData.js';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

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
 * @param {Object} studyArea Target study area object containing lat, lng, name
 */
export const fetchWeatherData = async (studyArea = STUDY_AREAS.pallikaranai_velachery) => {
  const targetArea = studyArea || STUDY_AREAS.pallikaranai_velachery;
  const lat = targetArea.lat;
  const lng = targetArea.lng;

  const url = `${OPEN_METEO_API}?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain&hourly=precipitation_probability,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

  try {
    const response = await fetch(url);
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

    // Parse 3-day forecast
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

    return {
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

  } catch (error) {
    console.warn(`Open-Meteo weather fetch failed for ${targetArea.name}:`, error.message);
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
  }
};
