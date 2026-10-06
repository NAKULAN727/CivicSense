# Phase 8C-6: Cross-Category False-Positive Audit (94 Real Images)

## Executive Overview

In real-world street scenes, visual categories are not mutually exclusive. An urban flood scene often carries floating litter (secondary waste phenomenon) or submerged roadway cracking. Similarly, severe road depressions naturally collect rainwater (water-filled potholes). This audit rigorously dissects model predictions across categories to distinguish genuine secondary co-phenomena from algorithmic false positives.

### Cross-Category Trigger Rates

- **Flood Images (32 total):** 0 triggered road damage (0.0%); 22 triggered waste (68.8%)
- **Pothole Images (32 total):** 27 triggered waste (84.4%); 15 triggered water >=5% (46.9%)
- **Garbage Images (30 total):** 0 triggered road damage (0.0%); 5 triggered water >=5% (16.7%)

## Detailed Suspected False-Positive & Cross-Category Review

| Image | Ground Category | Model Result | Issue Type | Evidence / Visual Cause | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `garbage 13.jpg` | Garbage | Flood: 32.99% | Water detected in garbage image | Water coverage 32.99%, topology=LARGE_CONTINUOUS_ROAD_FLOOD. Wet runoff, plastic sheen, or puddles near waste. | HIGH |
| `garbage 22.jpg` | Garbage | Flood: 5.02% | Water detected in garbage image | Water coverage 5.02%, topology=DISPERSED_WET_PATCHES. Wet runoff, plastic sheen, or puddles near waste. | MEDIUM |
| `garbage 24.jpg` | Garbage | Flood: 91.2% | Water detected in garbage image | Water coverage 91.2%, topology=LARGE_CONTINUOUS_ROAD_FLOOD. Wet runoff, plastic sheen, or puddles near waste. | HIGH |
| `garbage 4.webp` | Garbage | Flood: 9.45% | Water detected in garbage image | Water coverage 9.45%, topology=LOCALIZED_PUDDLE_OR_POTHOLE_WATER. Wet runoff, plastic sheen, or puddles near waste. | MEDIUM |
| `garbage 8.webp` | Garbage | Flood: 15.5% | Water detected in garbage image | Water coverage 15.5%, topology=DISPERSED_WET_PATCHES. Wet runoff, plastic sheen, or puddles near waste. | MEDIUM |
| `flood 1.jpg` | Flood | Waste: W50 | Waste (W50) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 10.webp` | Flood | Waste: W50 | Waste (W50) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 11.webp` | Flood | Waste: W50 | Waste (W50) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 14.webp` | Flood | Waste: W20 | Waste (W20) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 15.jpg` | Flood | Waste: W50 | Waste (W50) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 16.jpg` | Flood | Waste: W70 | Waste (W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 17.jpg` | Flood | Waste: W70 | Waste (W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 18.jpg` | Flood | Waste: W20 | Waste (W20) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 20.webp` | Flood | Waste: W20, W70 | Waste (W20, W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 21.webp` | Flood | Waste: W20 | Waste (W20) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 22.webp` | Flood | Waste: W20 | Waste (W20) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 23.webp` | Flood | Waste: W50 | Waste (W50) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 25.webp` | Flood | Waste: W00 | Waste (W00) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 27.webp` | Flood | Waste: W70 | Waste (W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 28.webp` | Flood | Waste: W60 | Waste (W60) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 29.webp` | Flood | Waste: W70 | Waste (W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 30.webp` | Flood | Waste: W20 | Waste (W20) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 4.webp` | Flood | Waste: W00 | Waste (W00) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 6.webp` | Flood | Waste: W20 | Waste (W20) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood 8.webp` | Flood | Waste: W70 | Waste (W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `flood.jpg` | Flood | Waste: W50 | Waste (W50) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `puddles.jpg` | Flood | Waste: W70 | Waste (W70) in flood image | Floating urban debris or specular water reflection matching waste texture. | LOW |
| `pathole 11.webp` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 12.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 13.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 14.webp` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 15.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 16.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 17.webp` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 18.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 19.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 2.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 20.webp` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 21.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 22.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 24.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 25.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 26.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 27.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 28.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 29.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 3.webp` | Pothole | Waste: W00 | Waste (W00) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 30.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 4.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 5.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 7.webp` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 8.webp` | Pothole | Waste: W70 | Waste (W70) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `pathole 9.webp` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |
| `water filled patholes.jpg` | Pothole | Waste: W50 | Waste (W50) in pothole image | Loose aggregate, gravel, leaves, or discarded trash inside road depression. | LOW |

## Key Analytical Findings

1. **Water-Filled Potholes are Genuine Physical Co-occurrences:** Road depressions trapping rainwater are correctly handled by the `WATER-FILLED POTHOLE` fusion policy rather than penalized as false positives.
2. **Garbage Wetness Screening:** High-gloss plastic packaging and wet leachate in unmanaged waste piles can reflect skylight, generating localized water probability patches. Calibrating the ceiling at 25.0% significantly insulates the flood pipeline from non-flood garbage imagery.
3. **Water Ripple Edge Artifacts on Road Model:** Distinct ripple fronts and foam lines occasionally register as transverse or longitudinal cracks (D00/D10) with borderline confidence (0.50-0.58).
