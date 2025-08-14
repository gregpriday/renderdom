import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';

export function diffPng(aPath: string, bPath: string): number {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const { width, height } = a;
  if (b.width !== width || b.height !== height) {
    throw new Error(`Image dimensions don't match: ${width}x${height} vs ${b.width}x${b.height}`);
  }
  const diff = new PNG({ width, height });
  const mismatches = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
  return mismatches; // 0 means identical
}

export function createImageHash(imagePath: string): string {
  const png = PNG.sync.read(fs.readFileSync(imagePath));
  // Simple hash based on average pixel values
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    r += png.data[i];
    g += png.data[i + 1];
    b += png.data[i + 2];
  }
  const pixels = png.data.length / 4;
  return `${Math.round(r/pixels)}-${Math.round(g/pixels)}-${Math.round(b/pixels)}-${png.width}x${png.height}`;
}