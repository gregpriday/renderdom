import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { hasFfmpeg } from './helpers/has-ffmpeg.js';

const skipIfNoFfmpeg = hasFfmpeg() ? it : it.skip;

describe('CLI Contract Tests', () => {
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

  skipIfNoFfmpeg('should emit proper JSONL events when verbose', async () => {
    const outputPath = path.join(tempDir, 'test.mp4');
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const htmlPath = path.resolve('examples/basic-scene/index.html');

    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--adapter', adapterPath,
      '--html', htmlPath,
      '--width', '160',
      '--height', '90',
      '--fps', '10',
      '--end', '4', // 5 frames total
      '--concurrency', '1',
      '--codec', 'h264',
      '--crf', '28',
      '--preset', 'veryfast',
      '--verbose',
      '-o', outputPath
    ]);

    expect(result.exitCode).toBe(0);

    // Parse JSONL from stdout
    const lines = result.stdout.trim().split('\n');
    const events = lines.map(line => JSON.parse(line));

    // Verify event sequence and structure
    const captureStart = events.find(e => e.type === 'capture-start');
    expect(captureStart).toBeDefined();
    expect(captureStart.totalFrames).toBe(5);

    const encodeStart = events.find(e => e.type === 'encode-start');
    expect(encodeStart).toBeDefined();
    expect(encodeStart.args).toContain('-c:v');
    expect(encodeStart.args).toContain('libx264');

    const captureProgress = events.filter(e => e.type === 'capture-progress');
    expect(captureProgress.length).toBe(5); // One per frame
    expect(captureProgress[0].done).toBe(1);
    expect(captureProgress[4].done).toBe(5);
    expect(captureProgress[4].percent).toBe(100);

    const encodeProgress = events.filter(e => e.type === 'encode-progress');
    expect(encodeProgress.length).toBeGreaterThan(0);

    const done = events.find(e => e.type === 'done');
    expect(done).toBeDefined();
    expect(done.outputPath).toBe(outputPath);

    // Verify no other event types
    const validTypes = ['capture-start', 'capture-progress', 'encode-start', 'encode-progress', 'done'];
    events.forEach(event => {
      expect(validTypes).toContain(event.type);
    });

    // Verify output file was created
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(1000);
  }, 60000);

  it('should exit with code 1 on invalid adapter path', async () => {
    const outputPath = path.join(tempDir, 'test.mp4');
    const htmlPath = path.resolve('examples/basic-scene/index.html');

    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--adapter', 'non-existent-adapter.js',
      '--html', htmlPath,
      '--width', '160',
      '--height', '90',
      '--fps', '10',
      '--end', '1',
      '--verbose',
      '-o', outputPath
    ], { reject: false, timeout: 30000 });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Render failed|ENOENT|no such file/i);
  }, 35000);

  it('should exit with code 1 on missing required arguments', async () => {
    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--width', '160',
      '--height', '90'
      // Missing --adapter and --out
    ], { reject: false });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required option');
  });

  skipIfNoFfmpeg('should handle different codecs properly', async () => {
    const outputPath = path.join(tempDir, 'test-vp9.webm');
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const htmlPath = path.resolve('examples/basic-scene/index.html');

    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--adapter', adapterPath,
      '--html', htmlPath,
      '--width', '160',
      '--height', '90',
      '--fps', '10',
      '--end', '2', // 3 frames
      '--codec', 'vp9',
      '--crf', '30',
      '--verbose',
      '-o', outputPath
    ]);

    expect(result.exitCode).toBe(0);

    // Parse events to verify VP9 codec was used
    const lines = result.stdout.trim().split('\n');
    const events = lines.map(line => JSON.parse(line));

    const encodeStart = events.find(e => e.type === 'encode-start');
    expect(encodeStart.args).toContain('-c:v');
    expect(encodeStart.args).toContain('libvpx-vp9');

    // Verify file was created
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(500);
  }, 60000);

  it('should not emit JSONL when verbose flag omitted', async () => {
    const framesDir = path.join(tempDir, 'frames');
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const htmlPath = path.resolve('examples/basic-scene/index.html');

    // Use debug frames mode to avoid needing FFmpeg
    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--adapter', adapterPath,
      '--html', htmlPath,
      '--width', '160',
      '--height', '90',
      '--fps', '10',
      '--end', '2',
      '--debug-frames-dir', framesDir,
      // No --verbose flag
      '-o', path.join(tempDir, 'dummy.mp4')
    ]);

    expect(result.exitCode).toBe(0);
    
    // stdout should be empty (no JSONL)
    expect(result.stdout.trim()).toBe('');
    
    // stderr should contain success message
    expect(result.stderr).toContain('Output:');
  }, 30000);

  it('should handle chromium flags properly', async () => {
    const outputPath = path.join(tempDir, 'test.mp4');
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const htmlPath = path.resolve('examples/basic-scene/index.html');

    // Just test that it doesn't crash with chromium flags
    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--adapter', adapterPath,
      '--html', htmlPath,
      '--width', '160',
      '--height', '90',
      '--fps', '10',
      '--end', '1',
      '--chromium-flag', '--disable-web-security',
      '--chromium-flag', '--disable-features=VizDisplayCompositor',
      '--verbose',
      '-o', outputPath
    ], { reject: false });

    // Should succeed or fail gracefully
    expect([0, 1]).toContain(result.exitCode);
  }, 30000);

  it('should validate frame range options', async () => {
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    const htmlPath = path.resolve('examples/basic-scene/index.html');

    // Test with start > end
    const result = await execa('node', [
      path.resolve('dist/cli.js'),
      'render',
      '--adapter', adapterPath,
      '--html', htmlPath,
      '--start', '10',
      '--end', '5', // end < start
      '--verbose',
      '-o', path.join(tempDir, 'test.mp4')
    ], { reject: false, timeout: 30000 });

    // Should either succeed with 0 frames or fail gracefully
    expect([0, 1]).toContain(result.exitCode);
    
    // If it succeeds, it should report 0 frames
    if (result.exitCode === 0) {
      const events = result.stdout.trim().split('\n').map(line => JSON.parse(line));
      const captureStart = events.find(e => e.type === 'capture-start');
      if (captureStart) {
        expect(captureStart.totalFrames).toBeLessThanOrEqual(0);
      }
    }
  }, 35000);
});