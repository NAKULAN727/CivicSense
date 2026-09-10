// CivicSense AI - Microsoft Planetary Computer Satellite Intelligence Service
// Primary Data Source: Microsoft Planetary Computer STAC API (Sentinel-2 L2A Collection)
import { STUDY_AREAS } from '../data/mockData.js';

const PLANETARY_COMPUTER_STAC_API = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';

/**
 * Fallback Demonstration Dataset (Explicitly labeled DEMONSTRATION DATA)
 */
const DEMO_FALLBACK_DATA = {
  "pallikaranai–velachery": {
    studyArea: 'Pallikaranai–Velachery',
    coordinates: { lat: 12.94, lng: 80.21 },
    bbox: [80.190, 12.920, 80.250, 12.982],
    previousObservation: {
      id: 'S2A_MSIL2A_20251015T051021_R105_T44RQU_DEMO',
      datetime: '2025-10-15T05:10:21Z',
      date: '15 Oct 2025, 05:10 UTC',
      platform: 'Sentinel-2A (DEMONSTRATION DATA)',
      cloudCoverPercent: 2.1,
      bbox: [80.190, 12.920, 80.250, 12.982],
      assets: ['B02', 'B03', 'B04', 'B08', 'visual', 'rendered_preview'],
      mgrsTile: '44RQU',
      constellation: 'Sentinel 2'
    },
    recentObservation: {
      id: 'S2B_MSIL2A_20260715T050241_R119_T44PMV_DEMO',
      datetime: '2026-07-15T05:02:41Z',
      date: '15 Jul 2026, 05:02 UTC',
      platform: 'Sentinel-2B (DEMONSTRATION DATA)',
      cloudCoverPercent: 0.84,
      bbox: [80.190, 12.920, 80.250, 12.982],
      assets: ['B02', 'B03', 'B04', 'B08', 'B11', 'B12', 'visual', 'rendered_preview', 'tilejson'],
      mgrsTile: '44PMV',
      constellation: 'Sentinel 2'
    }
  }
};

/**
 * Search Sentinel-2 L2A STAC Collection via Microsoft Planetary Computer
 * @param {Object} studyArea Target study area object containing name, lat, lng, bbox
 */
export const fetchPlanetaryComputerSatelliteData = async (studyArea = STUDY_AREAS.pallikaranai_velachery) => {
  const targetArea = studyArea || STUDY_AREAS.pallikaranai_velachery;
  const bbox = targetArea.bbox || [
    targetArea.lng - 0.03,
    targetArea.lat - 0.03,
    targetArea.lng + 0.03,
    targetArea.lat + 0.03
  ];

  const searchRequestBody = {
    collections: ['sentinel-2-l2a'],
    bbox: bbox,
    limit: 10,
    query: {
      'eo:cloud_cover': { lt: 25 }
    },
    sortby: [
      { field: 'properties.datetime', direction: 'desc' }
    ]
  };

  try {
    const response = await fetch(PLANETARY_COMPUTER_STAC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json, application/json'
      },
      body: JSON.stringify(searchRequestBody)
    });

    if (!response.ok) {
      throw new Error(`Planetary Computer STAC API responded with HTTP status ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const items = data.features || [];

    if (items.length === 0) {
      throw new Error(`No Sentinel-2 L2A scenes found under 25% cloud cover for bounding box [${bbox.join(', ')}]`);
    }

    const recentItem = items[0];
    const previousItem = items.length > 1 ? items[items.length - 1] : recentItem;

    const parseStacItem = (item) => {
      const props = item.properties || {};
      const assetsDict = item.assets || {};
      const assetKeys = Object.keys(assetsDict);
      
      const formattedDate = props.datetime 
        ? new Date(props.datetime).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })
        : 'Unknown Date';

      const previewUrl = assetsDict.rendered_preview?.href 
        || assetsDict.visual?.href 
        || null;

      return {
        id: item.id,
        datetime: props.datetime || 'N/A',
        date: formattedDate,
        platform: props.platform || props.constellation || 'Sentinel-2',
        cloudCoverPercent: props['eo:cloud_cover'] !== undefined 
          ? Math.round(props['eo:cloud_cover'] * 100) / 100 
          : 'N/A',
        bbox: item.bbox || bbox,
        assets: assetKeys,
        previewUrl: previewUrl,
        mgrsTile: props['s2:mgrs_tile'] || 'N/A',
        constellation: props.constellation || 'Sentinel-2',
        waterPercentage: props['s2:water_percentage'] !== undefined 
          ? Math.round(props['s2:water_percentage'] * 10) / 10 
          : null,
        vegetationPercentage: props['s2:vegetation_percentage'] !== undefined 
          ? Math.round(props['s2:vegetation_percentage'] * 10) / 10 
          : null,
        notVegetatedPercentage: props['s2:not_vegetated_percentage'] !== undefined 
          ? Math.round(props['s2:not_vegetated_percentage'] * 10) / 10 
          : null
      };
    };

    const recentObs = parseStacItem(recentItem);
    const prevObs = parseStacItem(previousItem);

    return {
      source: 'Microsoft Planetary Computer',
      mode: 'LIVE',
      isLive: true,
      isError: false,
      statusLabel: 'LIVE SATELLITE DATA (Microsoft Planetary Computer)',
      studyArea: targetArea.name,
      coordinates: { lat: targetArea.lat, lng: targetArea.lng },
      bbox: bbox,
      totalItemsFound: items.length,
      satellites: [`${recentObs.platform} (Sentinel-2 L2A)`],
      recentObservation: recentObs,
      previousObservation: prevObs,
      stacCollection: 'sentinel-2-l2a',
      apiEndpoint: PLANETARY_COMPUTER_STAC_API
    };

  } catch (error) {
    console.warn(`Planetary Computer STAC search failed: ${error.message}`);

    const locationKey = targetArea.name ? targetArea.name.toLowerCase().trim() : 'pallikaranai–velachery';
    const demoFallback = DEMO_FALLBACK_DATA[locationKey] || DEMO_FALLBACK_DATA['pallikaranai–velachery'];

    return {
      source: 'Microsoft Planetary Computer',
      mode: 'DEMO',
      isLive: false,
      isError: true,
      errorMessage: `STAC Retrieval Notice: ${error.message}. Displaying DEMONSTRATION DATA.`,
      statusLabel: 'DEMONSTRATION DATA (Microsoft Planetary Computer Fallback)',
      studyArea: targetArea.name,
      coordinates: { lat: targetArea.lat, lng: targetArea.lng },
      bbox: bbox,
      satellites: ['Sentinel-2A / Sentinel-2B (DEMONSTRATION DATA)'],
      recentObservation: demoFallback.recentObservation,
      previousObservation: demoFallback.previousObservation,
      stacCollection: 'sentinel-2-l2a (DEMO)',
      apiEndpoint: PLANETARY_COMPUTER_STAC_API
    };
  }
};
