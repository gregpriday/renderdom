#!/usr/bin/env node
import { renderDOM } from '../dist/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

console.log('Generating golden frames...');

const adapterPath = path.resolve('examples/basic-scene/adapter.js');
const html = await fs.readFile(path.resolve('examples/basic-scene/index.html'), 'utf8');
const goldenDir = path.resolve('tests/golden/basic-scene');

// Clean existing golden frames
try {
  await fs.rm(goldenDir, { recursive: true });
} catch {}

const config = {
  width: 320,
  height: 180, 
  fps: 30,
  endFrame: 19, // 20 frames (first ~0.67 seconds)
  concurrency: 1,
  html,
  adapterPath,
  outputPath: 'dummy.mp4', // unused
  debugFramesDir: goldenDir,
  verbose: false
};

const { promise } = renderDOM(config);
await promise;

const files = await fs.readdir(goldenDir);
const pngFiles = files.filter(f => f.endsWith('.png')).sort();

console.log(`Generated ${pngFiles.length} golden frames:`);
pngFiles.forEach(f => console.log(` - ${f}`));
console.log('Golden frames generation complete!');