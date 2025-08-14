import { describe, it, expect } from 'vitest';
import { renderDOM } from '../src/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Minimal smoke test, skips if ffmpeg not in PATH
function hasFfmpeg() {
  return !!process.env.CI || process.env.PATH?.includes('ffmpeg');
}

describe('renderdom smoke', () => {
  it('renders a short video', async () => {
    const out = path.resolve('tests/out.mp4');
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const html = await fs.readFile(path.resolve('examples/basic-scene/index.html'), 'utf8');

    const cfg: any = {
      width: 640, height: 360, fps: 30,
      html, adapterPath, outputPath: out,
      imageFormat: 'png', codec: 'h264', crf: 28, preset: 'veryfast'
    };
    const { promise } = (await import('../src/index.js')).renderDOM(cfg as any);
    const { outputPath } = await promise;
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(10000);
  }, 120_000);
});