import fs from 'fs';
import ort from 'onnxruntime-web';

console.log("=== RUNNING ONNXRUNTIME-WEB INFERENCE ON REAL FLOOD IMAGE BINARY ===");

async function runTest() {
  try {
    const modelBuffer = fs.readFileSync('public/models/flood-water-segmentation.onnx');
    const session = await ort.InferenceSession.create(modelBuffer);

    const binBuffer = fs.readFileSync('scratch/flooding_drone_preprocessed.bin');
    const float32Data = new Float32Array(
      binBuffer.buffer, 
      binBuffer.byteOffset, 
      binBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
    );

    console.log(`Input Float32Array length: ${float32Data.length} (Expected: 3 * 512 * 512 = 786432)`);

    const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, 512, 512]);
    const feeds = { images: inputTensor };

    console.log("Executing session.run()...");
    const start = Date.now();
    const results = await session.run(feeds);
    const duration = Date.now() - start;

    console.log(`ONNXRuntime-Web execution time: ${duration} ms`);

    const outputTensor = results.output0;
    const dims = outputTensor.dims; // [1, 10, 128, 128]
    console.log("Output Tensor Dims:", dims);

    const rawData = outputTensor.data;
    const numClasses = dims[1]; // 10
    const spatialSize = dims[2] * dims[3]; // 16384

    const classCounts = {};
    let floodPixelsCount = 0;

    // Per-class logit stats
    const classStats = {};
    for (let c = 0; c < numClasses; c++) {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      for (let i = 0; i < spatialSize; i++) {
        const val = rawData[c * spatialSize + i];
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
      }
      classStats[c] = {
        min: min.toFixed(4),
        max: max.toFixed(4),
        mean: (sum / spatialSize).toFixed(4)
      };
    }

    for (let i = 0; i < spatialSize; i++) {
      let maxLogit = -Infinity;
      let bestClass = 0;
      for (let c = 0; c < numClasses; c++) {
        const logit = rawData[c * spatialSize + i];
        if (logit > maxLogit) {
          maxLogit = logit;
          bestClass = c;
        }
      }
      classCounts[bestClass] = (classCounts[bestClass] || 0) + 1;
      if (bestClass === 1 || bestClass === 3 || bestClass === 5) {
        floodPixelsCount++;
      }
    }

    console.log("\n--- ONNXRUNTIME-WEB PER-CLASS LOGIT STATS ---");
    console.log(JSON.stringify(classStats, null, 2));

    console.log("\n--- ONNXRUNTIME-WEB ARGMAX DISTRIBUTION ---");
    console.log(JSON.stringify(classCounts, null, 2));

    const floodedPercent = (floodPixelsCount / spatialSize) * 100;
    console.log(`\nTARGET FLOOD PIXELS (Classes 1,3,5): ${floodPixelsCount} / ${spatialSize}`);
    console.log(`FLOODED AREA PERCENTAGE: ${floodedPercent.toFixed(2)}%`);

  } catch (err) {
    console.error("Test Error:", err);
  }
}

runTest();
