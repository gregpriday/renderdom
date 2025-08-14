import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderDOM } from '../src/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { hasFfmpeg } from './helpers/has-ffmpeg.js';

const skipIfNoFfmpeg = hasFfmpeg() ? it : it.skip;

describe('renderdom smoke', () => {
  let tempDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    tempDir = tmpDir.name;
    cleanup = tmpDir.removeCallback;
  });

  afterEach(() => {
    cleanup();
  });

  skipIfNoFfmpeg('renders a short video', async () => {
    const out = path.join(tempDir, 'out.mp4');
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const html = await fs.readFile(path.resolve('examples/basic-scene/index.html'), 'utf8');

    const cfg: any = {
      width: 640, height: 360, fps: 30,
      html, adapterPath, outputPath: out,
      imageFormat: 'png', codec: 'h264', crf: 28, preset: 'veryfast', pixelFormat: 'yuv420p'
    };
    const { promise } = (await import('../src/index.js')).renderDOM(cfg as any);
    const { outputPath } = await promise;
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(1000);
  }, 120_000);
});