import fs from 'fs';
import path from 'path';
import ort from 'onnxruntime-web';

console.log("=== TESTING ONNXRUNTIME-WEB IN NODE.JS ===");

async function runTest() {
  try {
    const modelPath = 'public/models/flood-water-segmentation.onnx';
    const modelBuffer = fs.readFileSync(modelPath);
    console.log(`Loaded ONNX model buffer: ${modelBuffer.length} bytes (${(modelBuffer.length / (1024*1024)).toFixed(2)} MB)`);

    const session = await ort.InferenceSession.create(modelBuffer);
    console.log("ONNXRuntime-Web Session created successfully!");
    console.log("Input Names:", session.inputNames);
    console.log("Output Names:", session.outputNames);

    // Create dummy input tensor Float32 [1, 3, 512, 512]
    const float32Data = new Float32Array(1 * 3 * 512 * 512);
    // Fill with normalized synthetic flood image value (~0.5 normalized)
    for (let i = 0; i < float32Data.length; i++) {
      float32Data[i] = 0.5;
    }

    const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, 512, 512]);
    const feeds = {};
    feeds[session.inputNames[0]] = inputTensor;

    console.log("Running onnxruntime-web session.run()...");
    const start = Date.now();
    const results = await session.run(feeds);
    const duration = Date.now() - start;
    console.log(`Inference completed in ${duration} ms!`);

    const outputTensor = results[session.outputNames[0]];
    console.log("Output Tensor Dims:", outputTensor.dims);
    console.log("Output Tensor Type:", outputTensor.type);
    console.log("Output Tensor Data Length:", outputTensor.data.length);

    const rawData = outputTensor.data;
    const numClasses = outputTensor.dims[1]; // 10
    const maskH = outputTensor.dims[2]; // 128
    const maskW = outputTensor.dims[3]; // 128
    const spatialSize = maskH * maskW; // 16384

    let floodPixelsCount = 0;
    const classCounts = {};

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

    console.log("Class Argmax Counts:", classCounts);
    console.log(`Target Flood Pixels (Classes 1,3,5): ${floodPixelsCount} / ${spatialSize} (${(floodPixelsCount/spatialSize*100).toFixed(2)}%)`);

  } catch (err) {
    console.error("ONNXRuntime-Web Node Test Error:", err);
  }
}

runTest();
