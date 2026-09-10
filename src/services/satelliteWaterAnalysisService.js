// CivicSense AI - Real Sentinel-2 NDWI Satellite Water Change Analysis Service
// Computes real water surface extent and percentage change using Cloud-Optimized GeoTIFF (COG) band rasters (B03 Green, B08 NIR, SCL) via geotiff.js

import { fromUrl } from 'geotiff';
import { signPlanetaryComputerUrl } from './planetaryComputerService.js';

/**
 * Maps WGS84 Bounding Box [minLng, minLat, maxLng, maxLat] to Pixel Window on Sentinel-2 Tile
 */
const mapBboxToPixelWindow = (studyBbox, itemBbox, imgWidth, imgHeight) => {
  const minLng = studyBbox[0];
  const minLat = studyBbox[1];
  const maxLng = studyBbox[2];
  const maxLat = studyBbox[3];

  const itemMinLng = itemBbox[0];
  const itemMinLat = itemBbox[1];
  const itemMaxLng = itemBbox[2];
  const itemMaxLat = itemBbox[3];

  const left = Math.max(0, Math.floor(imgWidth * (minLng - itemMinLng) / (itemMaxLng - itemMinLng)));
  const right = Math.min(imgWidth, Math.floor(imgWidth * (maxLng - itemMinLng) / (itemMaxLng - itemMinLng)));
  
  // Note: Image row 0 is at Top (maxLat)
  const top = Math.max(0, Math.floor(imgHeight * (1 - (maxLat - itemMinLat) / (itemMaxLat - itemMinLat))));
  const bottom = Math.min(imgHeight, Math.floor(imgHeight * (1 - (minLat - itemMinLat) / (itemMaxLat - itemMinLat))));

  return [left, top, right, bottom];
};

/**
 * Calculates NDWI Water Surface Area (km²) and SCL Cloud Masking for a Sentinel-2 L2A STAC Item
 * @param {Object} stacObs STAC observation object containing assetDict or id
 * @param {Array} studyBbox Target bounding box coordinates [minLng, minLat, maxLng, maxLat]
 */
export const calculateSceneWaterExtent = async (stacObs, studyBbox = [80.190, 12.920, 80.250, 12.982]) => {
  if (!stacObs || !stacObs.assetDict) {
    throw new Error('STAC observation lacks asset dictionary');
  }

  const assetDict = stacObs.assetDict;
  const b03Href = assetDict.B03?.href;
  const b08Href = assetDict.B08?.href;
  const sclHref = assetDict.SCL?.href;

  if (!b03Href || !b08Href) {
    throw new Error(`Missing B03 (Green) or B08 (NIR) asset href for STAC item ${stacObs.id}`);
  }

  // 1. Sign asset URLs using Microsoft Planetary Computer SAS API
  const signedB03 = await signPlanetaryComputerUrl(b03Href);
  const signedB08 = await signPlanetaryComputerUrl(b08Href);
  const signedSCL = sclHref ? await signPlanetaryComputerUrl(sclHref) : null;

  // 2. Open Cloud-Optimized GeoTIFFs (COGs) via geotiff.js
  const tiffB03 = await fromUrl(signedB03);
  const tiffB08 = await fromUrl(signedB08);
  
  const imgB03 = await tiffB03.getImage();
  const imgB08 = await tiffB08.getImage();

  const imgWidth = imgB03.getWidth();
  const imgHeight = imgB03.getHeight();

  const itemBbox = stacObs.bbox || [80.0753666, 12.5739838, 81.0902123, 13.568435];
  const window = mapBboxToPixelWindow(studyBbox, itemBbox, imgWidth, imgHeight);

  // 3. Perform HTTP Range GETs to read only the study area crop window
  const rasterB03Data = await imgB03.readRasters({ window });
  const rasterB08Data = await imgB08.readRasters({ window });

  const b03Array = rasterB03Data[0];
  const b08Array = rasterB08Data[0];

  let sclArray = null;
  if (signedSCL) {
    try {
      const tiffSCL = await fromUrl(signedSCL);
      const imgSCL = await tiffSCL.getImage();
      const sclWidth = imgSCL.getWidth();
      const sclHeight = imgSCL.getHeight();
      const sclWindow = mapBboxToPixelWindow(studyBbox, itemBbox, sclWidth, sclHeight);
      const rasterSCLData = await imgSCL.readRasters({ window: sclWindow });
      sclArray = rasterSCLData[0];
    } catch (e) {
      console.warn("SCL cloud mask fetch failed, proceeding with spectral filtering:", e.message);
    }
  }

  let validPixels = 0;
  let maskedPixels = 0;
  let waterPixels = 0;

  const totalPixels = b03Array.length;

  for (let i = 0; i < totalPixels; i++) {
    const green = b03Array[i];
    const nir = b08Array[i];

    // Zero-division & NoData check
    if (green + nir === 0 || green <= 0 || nir <= 0) {
      maskedPixels++;
      continue;
    }

    // SCL Cloud & Shadow Masking (If available)
    if (sclArray) {
      // Map 10m pixel index to 20m SCL pixel index
      const sclIdx = Math.min(sclArray.length - 1, Math.floor(i / 4));
      const sclClass = sclArray[sclIdx];
      // Exclude: 0 (No Data), 1 (Saturated), 3 (Shadows), 8 (Cloud Med), 9 (Cloud High), 10 (Cirrus), 11 (Snow/Ice)
      if ([0, 1, 3, 8, 9, 10, 11].includes(sclClass)) {
        maskedPixels++;
        continue;
      }
    }

    validPixels++;

    // Calculate NDWI: (Green - NIR) / (Green + NIR)
    const ndwi = (green - nir) / (green + nir);

    // Water threshold: NDWI > 0.10 (or scene water reflectance signal)
    if (ndwi > 0.10) {
      waterPixels++;
    }
  }

  if (validPixels < 100) {
    throw new Error(`INSUFFICIENT_VALID_PIXELS: Only ${validPixels} valid unmasked pixels in scene ${stacObs.id}`);
  }

  // 10m pixel area = 100 m² = 0.0001 km²
  const waterAreaKm2 = Math.round(waterPixels * 0.0001 * 100) / 100;
  const maskedPercent = Math.round((maskedPixels / Math.max(1, totalPixels)) * 1000) / 10;

  return {
    itemId: stacObs.id,
    waterPixels,
    validPixels,
    maskedPixels,
    maskedPercent,
    waterAreaKm2
  };
};

/**
 * Computes Real Multi-Temporal NDWI Water Change Between Recent & Baseline Scenes
 * @param {Object} satData Satellite data object returned by planetaryComputerService.js
 */
export const calculateRealSatelliteWaterChange = async (satData) => {
  if (!satData || !satData.isLive || !satData.recentObservation || !satData.previousObservation) {
    return {
      source: 'Microsoft Planetary Computer',
      dataset: 'Sentinel-2 L2A',
      mode: 'DEMO',
      isLive: false,
      isError: true,
      errorMessage: 'Live STAC satellite observations not available for NDWI change calculation.',
      statusLabel: 'DEMO / ANALYSIS UNAVAILABLE'
    };
  }

  try {
    const recentObs = satData.recentObservation;
    const prevObs = satData.previousObservation;
    const bbox = satData.bbox || [80.190, 12.920, 80.250, 12.982];

    const [recentRes, prevRes] = await Promise.all([
      calculateSceneWaterExtent(recentObs, bbox),
      calculateSceneWaterExtent(prevObs, bbox)
    ]);

    const recentWaterKm2 = recentRes.waterAreaKm2;
    const baselineWaterKm2 = prevRes.waterAreaKm2;

    let waterAreaChangePercent = 0;
    if (baselineWaterKm2 <= 0.0001) {
      waterAreaChangePercent = recentWaterKm2 > 0 ? 100 : 0;
    } else {
      const diff = recentWaterKm2 - baselineWaterKm2;
      waterAreaChangePercent = Math.round((diff / baselineWaterKm2) * 1000) / 10;
    }

    return {
      source: 'Microsoft Planetary Computer',
      dataset: 'Sentinel-2 L2A',
      mode: 'LIVE',
      isLive: true,
      isError: false,
      recentWaterKm2: recentWaterKm2,
      baselineWaterKm2: baselineWaterKm2,
      waterAreaChangePercent: waterAreaChangePercent,
      recentValidPixels: recentRes.validPixels,
      baselineValidPixels: prevRes.validPixels,
      recentMaskedPercent: recentRes.maskedPercent,
      baselineMaskedPercent: prevRes.maskedPercent,
      ndwiThresholdUsed: 0.10,
      recentItemId: recentObs.id,
      baselineItemId: prevObs.id,
      statusLabel: 'LIVE SATELLITE NDWI ANALYSIS',
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('en-IN')
    };

  } catch (error) {
    console.warn("Real satellite NDWI water change calculation failed:", error.message);
    return {
      source: 'Microsoft Planetary Computer',
      dataset: 'Sentinel-2 L2A',
      mode: 'DEMO',
      isLive: false,
      isError: true,
      errorMessage: `NDWI Raster Analysis Warning: ${error.message}`,
      statusLabel: 'DEMO / ANALYSIS UNAVAILABLE'
    };
  }
};
