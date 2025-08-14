import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { renderDOM } from '../src/index.js';
import { hasFfmpeg } from './helpers/has-ffmpeg.js';

// Skip if FFmpeg not available
const skipIfNoFfmpeg = hasFfmpeg() ? it : it.skip;

describe('Orchestrator Integration', () => {
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

  skipIfNoFfmpeg('should render short video and emit events', async () => {
    const outputPath = path.join(tempDir, 'test.mp4');
    const adapterPath = path.resolve('tests/fixtures/test-adapter.js');

    const config = {
      width: 320,
      height: 180,
      fps: 15,
      endFrame: 14, // 1 second at 15fps
      concurrency: 1,
      codec: 'h264' as const,
      crf: 28,
      preset: 'veryfast',
      pixelFormat: 'yuv420p' as const,
      imageFormat: 'png' as const,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath,
      outputPath,
      verbose: false
    };

    const { events, promise } = renderDOM(config);

    // Collect events
    const capturedEvents: any[] = [];
    events.on('capture-start', (e) => capturedEvents.push(e));
    events.on('capture-progress', (e) => capturedEvents.push(e));
    events.on('encode-start', (e) => capturedEvents.push(e));
    events.on('encode-progress', (e) => capturedEvents.push(e));
    events.on('done', (e) => capturedEvents.push(e));

    const result = await promise;

    // Verify output file exists
    const stat = await fs.stat(result.outputPath);
    expect(stat.size).toBeGreaterThan(1000);

    // Verify events were emitted
    const captureStart = capturedEvents.find(e => e.type === 'capture-start');
    expect(captureStart).toBeDefined();
    expect(captureStart.totalFrames).toBe(15);

    const captureProgress = capturedEvents.filter(e => e.type === 'capture-progress');
    expect(captureProgress.length).toBeGreaterThan(0);
    expect(captureProgress[captureProgress.length - 1].percent).toBe(100);

    const encodeStart = capturedEvents.find(e => e.type === 'encode-start');
    expect(encodeStart).toBeDefined();
    expect(encodeStart.args).toContain('-c:v');

    const done = capturedEvents.find(e => e.type === 'done');
    expect(done).toBeDefined();
    expect(done.outputPath).toBe(outputPath);
  }, 60000);

  it('should render with debug frames mode', async () => {
    const framesDir = path.join(tempDir, 'frames');
    const adapterPath = path.resolve('tests/fixtures/test-adapter.js');

    const config = {
      width: 160,
      height: 90,
      fps: 10,
      endFrame: 4, // 5 frames total
      concurrency: 1,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath,
      outputPath: path.join(tempDir, 'dummy.mp4'), // unused in debug mode
      debugFramesDir: framesDir,
      verbose: false
    };

    const { events, promise } = renderDOM(config);

    const capturedEvents: any[] = [];
    events.on('capture-start', (e) => capturedEvents.push(e));
    events.on('done', (e) => capturedEvents.push(e));

    const result = await promise;

    // Verify frames directory was created and contains PNGs
    const files = await fs.readdir(framesDir);
    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    
    expect(pngFiles).toEqual(['000000.png', '000001.png', '000002.png', '000003.png', '000004.png']);

    // Verify each frame file exists and has content
    for (const file of pngFiles) {
      const stat = await fs.stat(path.join(framesDir, file));
      expect(stat.size).toBeGreaterThan(100);
    }

    // Result should point to frames directory
    expect(result.outputPath).toBe(framesDir);

    const done = capturedEvents.find(e => e.type === 'done');
    expect(done.outputPath).toBe(framesDir);
  }, 30000);

  skipIfNoFfmpeg('should handle concurrency properly', async () => {
    const outputPath1 = path.join(tempDir, 'test1.mp4');
    const outputPath2 = path.join(tempDir, 'test2.mp4');
    const adapterPath = path.resolve('tests/fixtures/test-adapter.js');

    const baseConfig = {
      width: 160,
      height: 90,
      fps: 10,
      endFrame: 9, // 1 second
      codec: 'h264' as const,
      crf: 28,
      preset: 'veryfast',
      pixelFormat: 'yuv420p' as const,
      imageFormat: 'png' as const,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath,
      verbose: false
    };

    // Render with concurrency=1
    const { promise: promise1 } = renderDOM({ ...baseConfig, concurrency: 1, outputPath: outputPath1 });
    
    // Render with concurrency=2  
    const { promise: promise2 } = renderDOM({ ...baseConfig, concurrency: 2, outputPath: outputPath2 });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Both should succeed
    const stat1 = await fs.stat(result1.outputPath);
    const stat2 = await fs.stat(result2.outputPath);
    
    expect(stat1.size).toBeGreaterThan(1000);
    expect(stat2.size).toBeGreaterThan(1000);
    
    // File sizes should be similar (same content, different concurrency)
    const sizeDiff = Math.abs(stat1.size - stat2.size);
    expect(sizeDiff).toBeLessThan(stat1.size * 0.1); // Within 10%
  }, 120000);

  it('should handle frame range properly', async () => {
    const framesDir = path.join(tempDir, 'frames');
    const adapterPath = path.resolve('tests/fixtures/test-adapter.js');

    const config = {
      width: 160,
      height: 90,
      fps: 30,
      startFrame: 15,
      endFrame: 29, // 15 frames (0.5 second at 30fps)
      concurrency: 1,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath,
      outputPath: path.join(tempDir, 'dummy.mp4'),
      debugFramesDir: framesDir,
      verbose: false
    };

    const { events, promise } = renderDOM(config);

    const capturedEvents: any[] = [];
    events.on('capture-start', (e) => capturedEvents.push(e));

    await promise;

    // Should have captured 15 frames
    const captureStart = capturedEvents.find(e => e.type === 'capture-start');
    expect(captureStart.totalFrames).toBe(15);

    // Frame files should be named according to actual frame indices
    const files = await fs.readdir(framesDir);
    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    
    expect(pngFiles[0]).toBe('000015.png');
    expect(pngFiles[pngFiles.length - 1]).toBe('000029.png');
    expect(pngFiles.length).toBe(15);
  }, 30000);
});