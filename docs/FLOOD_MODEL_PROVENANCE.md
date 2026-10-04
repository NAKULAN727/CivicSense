# FLOOD / WATER AI MODEL PROVENANCE DOCUMENTATION

## Model Identification & Provenance
- **Model Name / Checkpoint**: `rbh227/floodnet-segformer`
- **Target File Location**: `public/models/flood-water-segmentation.onnx`
- **Source Repository**: Hugging Face Hub (`https://huggingface.co/rbh227/floodnet-segformer`)
- **Original Model Architecture**: SegFormer (`SegformerForSemanticSegmentation` based on `MiT-B0` backbone)
- **Training Dataset**: CVPR FloodNet Challenge Dataset (High-resolution aerial & ground RGB flood images)
- **Model Purpose**: Fine-grained semantic segmentation of visible flood water, flooded roads, flooded buildings, and surrounding land/structures in normal RGB imagery.

---

## Model Specifications & Binary Metadata
- **File Name**: `flood-water-segmentation.onnx`
- **File Size**: `261,759,815 bytes` (~249.63 MB)
- **ONNX Opset Version**: `18`
- **Validation**: Verified using `onnx.checker.check_model()` and `onnxruntime` CPU session execution.
- **Self-Contained**: Yes (`save_as_external_data=False` applied during PyTorch conversion).

---

## Input & Output Specification

### Input Tensor
- **Name**: `'images'`
- **Datatype**: `Float32` (`tensor(float)`)
- **Shape**: `[1, 3, 512, 512]` (Batch size 1, 3 RGB Channels, Height 512, Width 512)
- **Pixel Normalization**:
  - Image Resized to `512 x 512`
  - Normalized with standard ImageNet RGB statistics:
    - Mean: `[0.485, 0.456, 0.406]`
    - Standard Deviation: `[0.229, 0.224, 0.225]`

### Output Tensor
- **Name**: `'output0'`
- **Datatype**: `Float32` (`tensor(float)`)
- **Shape**: `[1, 10, 128, 128]` (Batch size 1, 10 Class Logits, Mask Height 128, Mask Width 128)

---

## Class Definitions (`id2label` Mapping)

| Class ID | Label Name | Category Classification for CivicSense AI |
|---|---|---|
| `0` | `background` | Non-Water / Non-Target |
| `1` | `building flooded` | **FLOOD WATER / FLOODED REGION** |
| `2` | `building non-flooded` | Dry Structure |
| `3` | `road flooded` | **FLOOD WATER / FLOODED REGION** |
| `4` | `road non-flooded` | Dry Infrastructure |
| `5` | `water` | **FLOOD WATER / WATER BODY** |
| `6` | `tree` | Vegetation |
| `7` | `vehicle` | Transport |
| `8` | `pool` | Artificial Water Feature |
| `9` | `grass` | Ground Cover |

### Target Flood Water Class Indices
- Primary Flood Water Indices: `[1, 3, 5]` (`building flooded`, `road flooded`, `water`).
- Total Pixels per Mask: `128 × 128 = 16,384` pixels.
- `floodedAreaRatio` = `count(argmax(logits) ∈ [1, 3, 5]) / 16384`.
- `floodedAreaPercent` = `floodedAreaRatio × 100`.

---

## Postprocessing & Metrics
1. **Argmax Class Extraction**: For each grid cell in the `128x128` logit map, the predicted class is `argmax(logits[0, :, y, x])`.
2. **Confidence Reporting**: Model outputs raw spatial logits rather than bounding box confidences. Confidence is set to `null` to respect technical integrity (avoiding fabricated confidence values).
3. **Geospatial Scope**: `floodedAreaPercent` measures **visible RGB image pixel coverage** only and is explicitly distinct from calibrated geographic area ($m^2$ / $km^2$).

---

## Model Provenance Verification Record
- **Verified Date**: September 16, 2026
- **Exporter Script**: `scratch/export_floodnet_onnx.py`
- **Runtime Environment**: Python 3.12, PyTorch 2.11.0, Transformers 4.40.0, ONNX 1.22.0, ONNX Runtime 1.24.4.
