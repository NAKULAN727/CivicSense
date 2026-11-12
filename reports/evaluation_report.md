# CivicSense AI — Image-Upload Detection Evaluation Report

- **Total Test Images**: 94 (Flood: 32, Garbage: 30, Pothole/Road: 32)
- **Category Accuracy**: 91/94 (96.81%)
- **5-Fold Cross-Validation Accuracy**: 97.85%
- **Optimal Calibration Temperature (T)**: 0.2562
- **ECE Before Calibration**: 27.46%
- **ECE After Calibration**: 1.69%

## 1. Category-Level Performance

| Category | Total Images | Correct Matches | Recall Rate |
|:---|:---:|:---:|:---:|
| FLOOD | 32 | 31 | 96.9% |
| GARBAGE | 30 | 30 | 100.0% |
| POTHOLE | 31 | 29 | 93.5% |
| OTHER | 1 | 1 | 100.0% |

## 2. Low-Resolution Edge Cases (< 60,000 px)

The system applies low-resolution protection capping confidence at 70% and flagging `LOW IMAGE RESOLUTION - needs review`:

| Filename | Resolution | Pred Category | Conf | Pred Type | Match |
|:---|:---:|:---:|:---:|:---|:---:|
| flood 1.jpg | 250x175 | FLOOD | 0.7 | F01 Roadway Waterlogging | MATCH |
| flood 10.webp | 192x234 | FLOOD | 0.7 | F06 General Significant Flooding | MATCH |
| flood 15.jpg | 289x174 | FLOOD | 0.7 | F01 Roadway Waterlogging | MATCH |
| flood.jpg | 193x135 | FLOOD | 0.7 | F06 General Significant Flooding | MATCH |
| pathole 14.webp | 151x200 | POTHOLE | 0.7 | WATER_FILLED_POTHOLE | MATCH |
| pathole 17.webp | 200x200 | OTHER | 0.95 | CLEAN_ROAD (No Damage) | MISMATCH |
| pathole 2.webp | 297x234 | POTHOLE | 0.7 | DRY_POTHOLE (D40) | MATCH |
| pathole 20.webp | 320x173 | POTHOLE | 0.7 | WATER_FILLED_POTHOLE (Submerged Defect) | MATCH |
| pathole 7.webp | 232x234 | POTHOLE | 0.7 | WATER_FILLED_POTHOLE | MATCH |

## 3. Full Per-Image Test Results

| File | True Category | Predicted Category | Conf | Predicted Type | Type Conf | Water % | Status |
|:---|:---|:---|:---:|:---|:---:|:---:|:---:|
| flood 1.jpg | FLOOD | FLOOD | 0.7 | F01 Roadway Waterlogging | 0.7 | 7.6% | MATCH |
| flood 10.webp | FLOOD | FLOOD | 0.7 | F06 General Significant Flooding | 0.7 | 45.2% | MATCH |
| flood 11.webp | FLOOD | FLOOD | 0.997 | F01 Roadway Waterlogging | 0.82 | 31.4% | MATCH |
| flood 12.webp | FLOOD | FLOOD | 0.997 | F00 No Significant Water | 0.621 | 2.8% | MATCH |
| flood 13.webp | FLOOD | FLOOD | 0.908 | F06 General Significant Flooding | 0.85 | 49.8% | MATCH |
| flood 14.webp | FLOOD | FLOOD | 0.988 | F05 Large-Area Inundation | 0.864 | 65.5% | MATCH |
| flood 15.jpg | FLOOD | FLOOD | 0.7 | F01 Roadway Waterlogging | 0.7 | 29.3% | MATCH |
| flood 16.jpg | FLOOD | FLOOD | 1.0 | F06 General Significant Flooding | 0.85 | 51.7% | MATCH |
| flood 17.jpg | FLOOD | FLOOD | 0.748 | F06 General Significant Flooding | 0.85 | 59.5% | MATCH |
| flood 18.jpg | FLOOD | FLOOD | 0.999 | F06 General Significant Flooding | 0.85 | 59.9% | MATCH |
| flood 19.jpg | FLOOD | FLOOD | 1.0 | F01 Roadway Waterlogging | 0.82 | 12.6% | MATCH |
| flood 2 | FLOOD | FLOOD | 0.998 | F01 Roadway Waterlogging | 0.82 | 10.4% | MATCH |
| flood 20.webp | FLOOD | FLOOD | 0.999 | F06 General Significant Flooding | 0.85 | 58.7% | MATCH |
| flood 21.webp | FLOOD | FLOOD | 0.975 | F06 General Significant Flooding | 0.85 | 50.5% | MATCH |
| flood 22.webp | FLOOD | FLOOD | 0.999 | F06 General Significant Flooding | 0.85 | 53.8% | MATCH |
| flood 23.webp | FLOOD | FLOOD | 0.999 | F05 Large-Area Inundation | 0.886 | 74.4% | MATCH |
| flood 24.webp | FLOOD | FLOOD | 1.0 | F05 Large-Area Inundation | 0.9 | 80.1% | MATCH |
| flood 25.webp | FLOOD | FLOOD | 0.983 | F05 Large-Area Inundation | 0.901 | 80.3% | MATCH |
| flood 26.webp | FLOOD | FLOOD | 1.0 | F01 Roadway Waterlogging | 0.82 | 18.7% | MATCH |
| flood 27.webp | FLOOD | FLOOD | 0.999 | F06 General Significant Flooding | 0.85 | 36.0% | MATCH |
| flood 28.webp | FLOOD | FLOOD | 0.997 | F06 General Significant Flooding | 0.85 | 42.5% | MATCH |
| flood 29.webp | FLOOD | FLOOD | 1.0 | F01 Roadway Waterlogging | 0.82 | 26.6% | MATCH |
| flood 3.webp | FLOOD | FLOOD | 0.996 | F05 Large-Area Inundation | 0.874 | 69.5% | MATCH |
| flood 30.webp | FLOOD | FLOOD | 0.999 | F05 Large-Area Inundation | 0.858 | 63.4% | MATCH |
| flood 4.webp | FLOOD | FLOOD | 0.997 | F05 Large-Area Inundation | 0.89 | 75.8% | MATCH |
| flood 5.webp | FLOOD | FLOOD | 0.998 | F06 General Significant Flooding | 0.85 | 40.8% | MATCH |
| flood 6.webp | FLOOD | FLOOD | 0.999 | F05 Large-Area Inundation | 0.869 | 67.7% | MATCH |
| flood 7.webp | FLOOD | FLOOD | 0.999 | F06 General Significant Flooding | 0.85 | 46.0% | MATCH |
| flood 8.webp | FLOOD | FLOOD | 0.997 | F00 No Significant Water | 0.843 | 1.2% | MATCH |
| flood 9.webp | FLOOD | FLOOD | 0.999 | F06 General Significant Flooding | 0.85 | 54.4% | MATCH |
| flood.jpg | FLOOD | FLOOD | 0.7 | F06 General Significant Flooding | 0.7 | 46.5% | MATCH |
| puddles.jpg | FLOOD | POTHOLE | 0.9 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.72 | 34.6% | MISMATCH |
| garbage 1.webp | GARBAGE | GARBAGE | 0.994 | DUMP_PILE (W50 Plastic/Organic) | 0.871 | 21.0% | MATCH |
| garbage 10.jpg | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W20 Glass) | 0.437 | 50.0% | MATCH |
| garbage 11.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W20 Glass) | 0.538 | 14.7% | MATCH |
| garbage 12.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.669 | 39.4% | MATCH |
| garbage 13.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W20 Glass) | 0.661 | 21.2% | MATCH |
| garbage 14.jpg | GARBAGE | GARBAGE | 0.993 | DUMP_PILE (W20 Glass) | 0.693 | 37.0% | MATCH |
| garbage 15.jpg | GARBAGE | GARBAGE | 0.997 | DUMP_PILE (W70 Textile/Other) | 0.554 | 39.0% | MATCH |
| garbage 16.jpg | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W70 Textile/Other) | 0.606 | 24.7% | MATCH |
| garbage 17.jpg | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W70 Textile/Other) | 0.715 | 1.1% | MATCH |
| garbage 18.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.95 | 27.8% | MATCH |
| garbage 19.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.918 | 31.7% | MATCH |
| garbage 2.webp | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W70 Textile/Other) | 0.692 | 64.8% | MATCH |
| garbage 20.jpg | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W70 Textile/Other) | 0.563 | 35.7% | MATCH |
| garbage 21.jpg | GARBAGE | GARBAGE | 0.997 | DUMP_PILE (W70 Textile/Other) | 0.86 | 58.3% | MATCH |
| garbage 22.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.661 | 28.5% | MATCH |
| garbage 23.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W20 Glass) | 0.431 | 54.5% | MATCH |
| garbage 24.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.813 | 44.8% | MATCH |
| garbage 25.jpg | GARBAGE | GARBAGE | 1.0 | DUMP_PILE (W70 Textile/Other) | 0.8 | 18.6% | MATCH |
| garbage 26.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.585 | 42.2% | MATCH |
| garbage 27.jpg | GARBAGE | GARBAGE | 0.994 | DUMP_PILE (W70 Textile/Other) | 0.509 | 48.9% | MATCH |
| garbage 28.jpg | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W20 Glass) | 0.435 | 12.8% | MATCH |
| garbage 29.jpg | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W20 Glass) | 0.566 | 22.6% | MATCH |
| garbage 3.webp | GARBAGE | GARBAGE | 0.995 | DUMP_PILE (W20 Glass) | 0.422 | 50.9% | MATCH |
| garbage 30.jpg | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.95 | 23.6% | MATCH |
| garbage 4.webp | GARBAGE | GARBAGE | 0.992 | DUMP_PILE (W40 Paper) | 0.462 | 29.8% | MATCH |
| garbage 5.webp | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.875 | 11.0% | MATCH |
| garbage 6.webp | GARBAGE | GARBAGE | 0.996 | DUMP_PILE (W20 Glass) | 0.842 | 53.3% | MATCH |
| garbage 7.webp | GARBAGE | GARBAGE | 0.998 | DUMP_PILE (W70 Textile/Other) | 0.819 | 38.8% | MATCH |
| garbage 8.webp | GARBAGE | GARBAGE | 0.999 | DUMP_PILE (W70 Textile/Other) | 0.495 | 33.6% | MATCH |
| garbage 9.webp | GARBAGE | GARBAGE | 0.997 | DUMP_PILE (W70 Textile/Other) | 0.904 | 48.2% | MATCH |
| pathole 1.webp | POTHOLE | POTHOLE | 0.999 | DRY_POTHOLE (D40) | 0.817 | 0.0% | MATCH |
| pathole 10.webp | POTHOLE | POTHOLE | 0.999 | WATER_FILLED_POTHOLE | 0.543 | 15.9% | MATCH |
| pathole 11.webp | POTHOLE | POTHOLE | 0.99 | ALLIGATOR_CRACKING (D20) | 0.642 | 79.7% | MATCH |
| pathole 12.webp | POTHOLE | POTHOLE | 0.998 | WATER_FILLED_POTHOLE | 0.779 | 21.1% | MATCH |
| pathole 13.webp | POTHOLE | POTHOLE | 0.996 | DRY_POTHOLE (D40) | 0.519 | 1.2% | MATCH |
| pathole 14.webp | POTHOLE | POTHOLE | 0.7 | WATER_FILLED_POTHOLE | 0.301 | 10.2% | MATCH |
| pathole 15.webp | POTHOLE | POTHOLE | 0.999 | ALLIGATOR_CRACKING (D20) | 0.504 | 47.1% | MATCH |
| pathole 16.webp | POTHOLE | POTHOLE | 0.999 | ALLIGATOR_CRACKING (D20) | 0.65 | 51.2% | MATCH |
| pathole 17.webp | POTHOLE | OTHER | 0.95 | CLEAN_ROAD (No Damage) | 0.7 | 53.2% | MISMATCH |
| pathole 18.webp | POTHOLE | POTHOLE | 0.988 | WATER_FILLED_POTHOLE | 0.77 | 43.5% | MATCH |
| pathole 19.webp | POTHOLE | POTHOLE | 1.0 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.72 | 9.8% | MATCH |
| pathole 2.webp | POTHOLE | POTHOLE | 0.7 | DRY_POTHOLE (D40) | 0.45 | 0.0% | MATCH |
| pathole 20.webp | POTHOLE | POTHOLE | 0.7 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.7 | 79.1% | MATCH |
| pathole 21.webp | POTHOLE | POTHOLE | 0.999 | WATER_FILLED_POTHOLE | 0.593 | 33.4% | MATCH |
| pathole 22.webp | POTHOLE | POTHOLE | 1.0 | WATER_FILLED_POTHOLE | 0.279 | 40.4% | MATCH |
| pathole 23.webp | POTHOLE | POTHOLE | 0.999 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.72 | 73.3% | MATCH |
| pathole 24.webp | POTHOLE | POTHOLE | 0.994 | WATER_FILLED_POTHOLE | 0.327 | 12.6% | MATCH |
| pathole 25.webp | POTHOLE | POTHOLE | 1.0 | WATER_FILLED_POTHOLE | 0.546 | 21.2% | MATCH |
| pathole 26.webp | POTHOLE | POTHOLE | 1.0 | DRY_POTHOLE (D40) | 0.753 | 1.4% | MATCH |
| pathole 27.webp | POTHOLE | POTHOLE | 0.999 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.72 | 22.5% | MATCH |
| pathole 28.webp | POTHOLE | POTHOLE | 0.993 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.72 | 37.5% | MATCH |
| pathole 29.webp | POTHOLE | POTHOLE | 0.999 | DRY_POTHOLE (D40) | 0.847 | 3.4% | MATCH |
| pathole 3.webp | POTHOLE | POTHOLE | 0.993 | ALLIGATOR_CRACKING (D20) | 0.331 | 56.1% | MATCH |
| pathole 30.webp | POTHOLE | POTHOLE | 0.999 | WATER_FILLED_POTHOLE | 0.425 | 32.5% | MATCH |
| pathole 4.webp | POTHOLE | POTHOLE | 0.998 | WATER_FILLED_POTHOLE | 0.745 | 10.1% | MATCH |
| pathole 5.webp | POTHOLE | POTHOLE | 0.997 | ALLIGATOR_CRACKING (D20) | 0.587 | 17.2% | MATCH |
| pathole 6.webp | POTHOLE | POTHOLE | 0.998 | WATER_FILLED_POTHOLE | 0.383 | 39.0% | MATCH |
| pathole 7.webp | POTHOLE | POTHOLE | 0.7 | WATER_FILLED_POTHOLE | 0.527 | 13.8% | MATCH |
| pathole 8.webp | POTHOLE | POTHOLE | 0.999 | WATER_FILLED_POTHOLE | 0.607 | 15.7% | MATCH |
| pathole 9.webp | POTHOLE | OTHER | 0.95 | CLEAN_ROAD (No Damage) | 0.95 | 49.5% | MISMATCH |
| road without pothole.webp | OTHER | OTHER | 0.95 | CLEAN_ROAD (No Damage) | 0.95 | 42.1% | MATCH |
| water filled patholes.jpg | POTHOLE | POTHOLE | 0.997 | WATER_FILLED_POTHOLE (Submerged Defect) | 0.72 | 55.4% | MATCH |
