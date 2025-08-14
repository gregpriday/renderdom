import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config.js';

describe('ConfigSchema', () => {
  it('should apply defaults to minimal config', () => {
    const result = ConfigSchema.parse({
      adapterPath: './adapter.js',
      outputPath: './out.mp4'
    });

    expect(result).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 60,
      startFrame: 0,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      imageQuality: 92,
      chromiumFlags: [],
      frameTimeoutMs: 15000
    });
  });

  it('should reject invalid width', () => {
    expect(() => ConfigSchema.parse({
      width: -1,
      adapterPath: './adapter.js',
      outputPath: './out.mp4'
    })).toThrow();
  });

  it('should reject invalid codec', () => {
    expect(() => ConfigSchema.parse({
      codec: 'invalid',
      adapterPath: './adapter.js',
      outputPath: './out.mp4'
    })).toThrow();
  });

  it('should reject crf out of range', () => {
    expect(() => ConfigSchema.parse({
      crf: 100,
      adapterPath: './adapter.js',
      outputPath: './out.mp4'
    })).toThrow();
  });

  it('should accept optional fields', () => {
    const result = ConfigSchema.parse({
      adapterPath: './adapter.js',
      outputPath: './out.mp4',
      html: '<html></html>',
      verbose: true,
      debugFramesDir: './frames',
      endFrame: 120
    });

    expect(result.html).toBe('<html></html>');
    expect(result.verbose).toBe(true);
    expect(result.debugFramesDir).toBe('./frames');
    expect(result.endFrame).toBe(120);
  });
});