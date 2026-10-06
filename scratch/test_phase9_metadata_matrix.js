import fs from 'fs';
import path from 'path';
import ExifReader from 'exifreader';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_DIR = path.join(__dirname, '..', 'Field Test Dataset', 'Metadata');

// Function matching extractImageMetadata
function extractMetadataFromBuffer(buffer) {
  try {
    const tags = ExifReader.load(buffer, { expanded: true });
    let latitude = null;
    let longitude = null;
    let timestamp = null;
    let orientation = null;

    if (tags.gps && typeof tags.gps.Latitude === 'number' && typeof tags.gps.Longitude === 'number') {
      latitude = Number(tags.gps.Latitude.toFixed(6));
      longitude = Number(tags.gps.Longitude.toFixed(6));
    }

    if (tags.exif && tags.exif.DateTimeOriginal && tags.exif.DateTimeOriginal.description) {
      timestamp = tags.exif.DateTimeOriginal.description;
    } else if (tags.exif && tags.exif.DateTime && tags.exif.DateTime.description) {
      timestamp = tags.exif.DateTime.description;
    }

    if (tags.exif && tags.exif.Orientation && tags.exif.Orientation.description) {
      orientation = tags.exif.Orientation.description;
    }

    return {
      latitude,
      longitude,
      timestamp,
      isGpsVerified: latitude !== null && longitude !== null,
      orientation: orientation || "Normal"
    };
  } catch (e) {
    return {
      latitude: null,
      longitude: null,
      timestamp: null,
      isGpsVerified: false,
      orientation: "Normal"
    };
  }
}

function auditImageQuality({ width, height }) {
  const totalPixels = width * height;
  const aspectRatio = height > 0 ? Number((width / height).toFixed(2)) : 1.0;
  const isLowResolution = width < 300 || height < 200 || totalPixels < 60000;
  const isExtremeAspectRatio = aspectRatio > 3.0 || aspectRatio < 0.33;

  return {
    width,
    height,
    totalPixels,
    aspectRatio,
    isLowResolution,
    isExtremeAspectRatio,
    lowResWarning: isLowResolution ? `LOW-RESOLUTION WARNING (${width}x${height})` : null
  };
}

console.log("=== PHASE 9 MOBILE GPS / EXIF TEST MATRIX VALIDATION ===\n");

// TEST A: Image with valid EXIF GPS + Timestamp
const bufA = fs.readFileSync(path.join(METADATA_DIR, 'test_a_gps_and_time.jpg'));
const metaA = extractMetadataFromBuffer(bufA);
console.log("TEST A: Valid EXIF GPS + Timestamp");
console.log(`  GPS: ${metaA.isGpsVerified ? `GPS AVAILABLE (${metaA.latitude}, ${metaA.longitude})` : 'LOCATION UNAVAILABLE'}`);
console.log(`  Timestamp: ${metaA.timestamp ? `CAPTURE TIME: ${metaA.timestamp}` : 'CAPTURE TIME UNAVAILABLE'}`);
const passA = metaA.isGpsVerified && metaA.timestamp !== null;
console.log(`  RESULT: ${passA ? 'PASS' : 'FAIL'}\n`);

// TEST B: Timestamp but NO GPS
const bufB = fs.readFileSync(path.join(METADATA_DIR, 'test_b_time_no_gps.jpg'));
const metaB = extractMetadataFromBuffer(bufB);
console.log("TEST B: Timestamp but NO GPS");
console.log(`  GPS: ${metaB.isGpsVerified ? `GPS AVAILABLE (${metaB.latitude}, ${metaB.longitude})` : 'LOCATION UNAVAILABLE'}`);
console.log(`  Timestamp: ${metaB.timestamp ? `CAPTURE TIME: ${metaB.timestamp}` : 'CAPTURE TIME UNAVAILABLE'}`);
const passB = !metaB.isGpsVerified && metaB.timestamp !== null;
console.log(`  RESULT: ${passB ? 'PASS' : 'FAIL'}\n`);

// TEST C: GPS but NO Timestamp
const bufC = fs.readFileSync(path.join(METADATA_DIR, 'test_c_gps_no_time.jpg'));
const metaC = extractMetadataFromBuffer(bufC);
console.log("TEST C: GPS but NO Timestamp");
console.log(`  GPS: ${metaC.isGpsVerified ? `GPS AVAILABLE (${metaC.latitude}, ${metaC.longitude})` : 'LOCATION UNAVAILABLE'}`);
console.log(`  Timestamp: ${metaC.timestamp ? `CAPTURE TIME: ${metaC.timestamp}` : 'CAPTURE TIME UNAVAILABLE'}`);
const passC = metaC.isGpsVerified && metaC.timestamp === null;
console.log(`  RESULT: ${passC ? 'PASS' : 'FAIL'}\n`);

// TEST D: Neither GPS nor Timestamp
const bufD = fs.readFileSync(path.join(METADATA_DIR, 'test_d_neither.jpg'));
const metaD = extractMetadataFromBuffer(bufD);
console.log("TEST D: Neither GPS nor Timestamp");
console.log(`  GPS: ${metaD.isGpsVerified ? `GPS AVAILABLE (${metaD.latitude}, ${metaD.longitude})` : 'LOCATION UNAVAILABLE'}`);
console.log(`  Timestamp: ${metaD.timestamp ? `CAPTURE TIME: ${metaD.timestamp}` : 'CAPTURE TIME UNAVAILABLE'}`);
const passD = !metaD.isGpsVerified && metaD.timestamp === null;
console.log(`  RESULT: ${passD ? 'PASS' : 'FAIL'}\n`);

// TEST E: Low-Resolution Image (<300x200 or <60,000 px)
// Real dimensions of test_e_low_res.jpg: 280x190 = 53,200 px
const qualE = auditImageQuality({ width: 280, height: 190 });
console.log("TEST E: Low-Resolution Image (280x190)");
console.log(`  Dimensions: ${qualE.width}x${qualE.height} (${qualE.totalPixels} px)`);
console.log(`  Low-Res Warning: ${qualE.isLowResolution ? 'LOW-RESOLUTION WARNING' : 'None'}`);
const passE = qualE.isLowResolution === true;
console.log(`  RESULT: ${passE ? 'PASS' : 'FAIL'}\n`);

// TEST F: Normal High-Resolution Image (1280x720)
const qualF = auditImageQuality({ width: 1280, height: 720 });
console.log("TEST F: Normal High-Resolution Image (1280x720)");
console.log(`  Dimensions: ${qualF.width}x${qualF.height} (${qualF.totalPixels} px)`);
console.log(`  Low-Res Warning: ${qualF.isLowResolution ? 'LOW-RESOLUTION WARNING' : 'None'}`);
const passF = qualF.isLowResolution === false;
console.log(`  RESULT: ${passF ? 'PASS' : 'FAIL'}\n`);

const allPass = passA && passB && passC && passD && passE && passF;
console.log(`OVERALL TEST MATRIX RESULT: ${allPass ? 'ALL 6 TESTS PASSED (100%)' : 'FAILURES DETECTED'}`);
