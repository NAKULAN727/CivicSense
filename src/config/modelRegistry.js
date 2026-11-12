// CivicSense AI - Production Model Configuration & Registry
// Formal registry tracking validated perception models, architectures, class maps, and rollback options.
// Maintained under Phase 12 Model Management & Selection Standards.

export const MODEL_REGISTRY = {
  potholeRoad: {
    activeModelId: 'MODEL_A_RDD2022',
    models: {
      MODEL_A_RDD2022: {
        id: 'MODEL_A_RDD2022',
        name: 'RDD2022 YOLOv8s Road Damage Detector',
        version: 'v1.0-rdd2022',
        architecture: 'YOLOv8s (11.2M params)',
        format: 'ONNX (opset 12)',
        fileUrl: '/models/rdd2022-road-damage.onnx',
        fileSizeBytes: 44723865,
        fileSizeMB: 42.65,
        source: 'Road Damage Dataset 2022 (Japan, India, Czech road defect benchmark)',
        classes: {
          0: { code: 'D00', name: 'Longitudinal Crack', label: 'Longitudinal Crack' },
          1: { code: 'D10', name: 'Transverse Crack', label: 'Transverse Crack' },
          2: { code: 'D20', name: 'Alligator Crack', label: 'Alligator Crack' },
          3: { code: 'D40', name: 'Pothole', label: 'Pothole' }
        },
        primaryPotholeClassCode: 'D40',
        activationDate: '2026-09-16 (Re-confirmed & Validated 2026-11-12)',
        status: 'ACTIVE_PRODUCTION',
        benchmarkReport: 'reports/pothole_model_comparison_report.md',
        performance: {
          potholeDetectionRate050: '37.5% (12 / 32 real pothole scenes; 25 boxes)',
          potholeDetectionRate025: '53.1% (17 / 32 real pothole scenes; 40 boxes)',
          roadDefectCoverage050: '53.1% (17 / 32 images)',
          roadDefectCoverage025: '71.9% (23 / 32 images)',
          cleanRoadFalsePositives: '0.0% (100% specificity on undamaged asphalt)',
          floodFalsePositives: '0.0% (0 / 32 flooded scenes)',
          meanCpuLatencyMs: 166.8,
          webAssemblyCompatibility: 'OPTIMAL (42.7 MB payload, responsive browser execution)'
        }
      },
      MODEL_B_YOLO8X_VP: {
        id: 'MODEL_B_YOLO8X_VP',
        name: 'YOLOv8x Visual Pollution Detector',
        version: 'v1.0-y8best',
        architecture: 'YOLOv8x Extra Large (68.2M params)',
        format: 'PyTorch .pt / Exported ONNX (opset 12)',
        fileUrl: '/models/y8best.onnx',
        fileSizeBytes: 272818988,
        fileSizeMB: 260.18,
        source: 'Roboflow / Visual-Pollution-1 Generic Dataset',
        classes: {
          0: { code: 'BAD_BILLBOARD', name: 'Bad Billboard' },
          1: { code: 'BROKEN_SIGNAGE', name: 'Broken Signage' },
          2: { code: 'CLUTTER_SIDEWALK', name: 'Clutter Sidewalk' },
          3: { code: 'CONSTRUCTION_ROAD', name: 'Construction Road' },
          4: { code: 'FADED_SIGNAGE', name: 'Faded Signage' },
          5: { code: 'GARBAGE', name: 'Garbage' },
          6: { code: 'GRAFFITI', name: 'Graffiti' },
          7: { code: 'POTHOLES', name: 'Potholes' },
          8: { code: 'SAND_ON_ROAD', name: 'Sand on Road' },
          9: { code: 'UNKEPT_FACADE', name: 'Unkept Facade' }
        },
        primaryPotholeClassCode: 'POTHOLES',
        activationDate: 'EVALUATED 2026-11-12 — NOT ACTIVATED',
        status: 'ARCHIVED_CANDIDATE (ROLLBACK AVAILABLE)',
        benchmarkReport: 'reports/pothole_model_comparison_report.md',
        performance: {
          potholeDetectionRate050: '15.6% (5 / 32 real pothole scenes; 7 boxes)',
          potholeDetectionRate025: '37.5% (12 / 32 real pothole scenes; 18 boxes)',
          roadDefectCoverage050: '15.6% (Cannot detect cracks D00-D20)',
          cleanRoadFalsePositives: '0.0%',
          floodFalsePositives: '3.1% (1 / 32 false alarm at 0.25)',
          meanCpuLatencyMs: 2026.4,
          webAssemblyCompatibility: 'POOR (260.2 MB payload exceeds web browser memory targets; 12x slower)'
        }
      }
    }
  },

  waste: {
    activeModelId: 'YOLOV8_WASTE_V1',
    name: 'YOLOv8 Multi-Class Waste Detector',
    fileUrl: '/models/waste-detection.onnx',
    classes: {
      0: 'W00 Cardboard', 1: 'W10 E-Waste', 2: 'W20 Glass', 3: 'W30 Medical',
      4: 'W40 Metal', 5: 'W50 Organic', 6: 'W60 Paper', 7: 'W70 Plastic'
    },
    status: 'ACTIVE_PRODUCTION'
  },

  flood: {
    activeModelId: 'SEGFORMER_FLOODNET_B0',
    name: 'SegFormer B0 Flood Water Segmentation',
    fileUrl: '/models/flood-water-segmentation.onnx?v=phase8c6d',
    status: 'ACTIVE_PRODUCTION (UNTOUCHED)'
  }
};

/**
 * Returns the active production pothole & road damage model configuration.
 */
export function getActiveRoadModelConfig() {
  const reg = MODEL_REGISTRY.potholeRoad;
  return reg.models[reg.activeModelId];
}

