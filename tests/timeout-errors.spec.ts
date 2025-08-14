import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { renderDOM } from '../src/index.js';
import * as badAdapters from './fixtures/bad-adapters.js';

describe('Timeout and Error Propagation', () => {
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

  describe('Frame Timeout Handling', () => {
    it('should timeout on slow renderFrame with helpful error message', async () => {
      const slowAdapterPath = path.join(tempDir, 'slow-adapter.js');
      await fs.writeFile(slowAdapterPath, badAdapters.slowRenderFrame);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 1,
        concurrency: 1,
        frameTimeoutMs: 1000, // Short timeout
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: slowAdapterPath,
        outputPath: path.join(tempDir, 'slow.mp4'),
        // Don't use debugFramesDir for timeout tests - need full pipeline
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/timeout.*renderFrame|command failed.*ffmpeg/i);
    });

    it('should timeout on slow ensureAssets with helpful error message', async () => {
      const slowAssetsPath = path.join(tempDir, 'slow-assets-adapter.js');
      await fs.writeFile(slowAssetsPath, badAdapters.slowEnsureAssets);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        frameTimeoutMs: 2000, // Short timeout
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: slowAssetsPath,
        outputPath: path.join(tempDir, 'slow-assets.mp4'),
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/timeout|command failed.*ffmpeg/i);
    });

    it('should use default timeout when frameTimeoutMs not specified', async () => {
      const slowAdapterPath = path.join(tempDir, 'slow-adapter.js');
      await fs.writeFile(slowAdapterPath, badAdapters.slowRenderFrame);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        pixelFormat: 'yuv420p' as const,
        // frameTimeoutMs not specified - should use default
        html: '<html><body></body></html>',
        adapterPath: slowAdapterPath,
        outputPath: path.join(tempDir, 'slow.mp4'),
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/timeout|command failed.*ffmpeg/i);
    });
  });

  describe('Adapter Error Propagation', () => {
    it('should propagate getDurationMs errors with helpful context', async () => {
      const throwingDurationPath = path.join(tempDir, 'throwing-duration.js');
      await fs.writeFile(throwingDurationPath, badAdapters.throwingGetDuration);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: throwingDurationPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        debugFramesDir: path.join(tempDir, 'frames'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/duration calculation failed/i);
      }
    });

    it('should propagate renderFrame errors with frame context', async () => {
      const throwingRenderPath = path.join(tempDir, 'throwing-render.js');
      await fs.writeFile(throwingRenderPath, badAdapters.throwingRenderFrame);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 10, // Will fail at frame 6
        concurrency: 1,
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: throwingRenderPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/render failed at frame 6|command failed.*ffmpeg/i);
    });

    it('should propagate afterFrame errors with helpful context', async () => {
      const throwingAfterPath = path.join(tempDir, 'throwing-after.js');
      await fs.writeFile(throwingAfterPath, badAdapters.throwingAfterFrame);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: throwingAfterPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/afterframe failed|command failed.*ffmpeg/i);
    });
  });

  describe('Adapter Contract Validation Errors', () => {
    it('should provide helpful error for missing getDurationMs', async () => {
      const missingDurationPath = path.join(tempDir, 'missing-duration.js');
      await fs.writeFile(missingDurationPath, badAdapters.missingGetDurationMs);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: missingDurationPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        debugFramesDir: path.join(tempDir, 'frames'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/getDurationMs/i);
      }
    });

    it('should provide helpful error for missing renderFrame', async () => {
      const missingRenderPath = path.join(tempDir, 'missing-render.js');
      await fs.writeFile(missingRenderPath, badAdapters.missingRenderFrame);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: missingRenderPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        debugFramesDir: path.join(tempDir, 'frames'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/renderFrame/i);
      }
    });

    it('should provide helpful error for invalid duration return type', async () => {
      const invalidDurationPath = path.join(tempDir, 'invalid-duration.js');
      await fs.writeFile(invalidDurationPath, badAdapters.invalidDurationReturn);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: invalidDurationPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        debugFramesDir: path.join(tempDir, 'frames'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/duration|number/i);
      }
    });

    it('should provide helpful error for missing __RenderDOM__', async () => {
      const emptyAdapterPath = path.join(tempDir, 'empty-adapter.js');
      await fs.writeFile(emptyAdapterPath, badAdapters.emptyAdapter);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: emptyAdapterPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/__RenderDOM__|adapter/i);
    }, 35000);

    it('should reject negative duration with helpful error', async () => {
      const negativeDurationPath = path.join(tempDir, 'negative-duration.js');
      await fs.writeFile(negativeDurationPath, badAdapters.negativeDuration);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: negativeDurationPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        debugFramesDir: path.join(tempDir, 'frames'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/duration|negative|positive/i);
      }
    });

    it('should reject zero duration with helpful error', async () => {
      const zeroDurationPath = path.join(tempDir, 'zero-duration.js');
      await fs.writeFile(zeroDurationPath, badAdapters.zeroDuration);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: zeroDurationPath,
        outputPath: path.join(tempDir, 'error.mp4'),
        debugFramesDir: path.join(tempDir, 'frames'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/duration|zero|positive/i);
      }
    });
  });

  describe('File System Error Handling', () => {
    it('should provide helpful error for non-existent adapter file', async () => {
      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: '/path/that/does/not/exist.js',
        outputPath: path.join(tempDir, 'error.mp4'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/adapter|file|exist|found/i);
      }
    });

    it('should provide helpful error for invalid output directory', async () => {
      const validAdapterPath = path.join(tempDir, 'valid-adapter.js');
      await fs.writeFile(validAdapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame() { document.body.innerHTML = '<div>test</div>'; }
            }
          };
        })();
      `);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: validAdapterPath,
        outputPath: '/invalid/directory/that/does/not/exist/output.mp4',
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/output|directory|path/i);
      }
    });
  });

  describe('Concurrency Error Handling', () => {
    it('should handle errors in concurrent frame processing', async () => {
      const partiallyFailingPath = path.join(tempDir, 'partially-failing.js');
      await fs.writeFile(partiallyFailingPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame(frameIndex, fps) {
                // Fail on specific frames to test concurrent error handling
                if (frameIndex === 3 || frameIndex === 7) {
                  throw new Error('Simulated failure at frame ' + frameIndex);
                }
                document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
              }
            }
          };
        })();
      `);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        endFrame: 9, // 10 frames, failures at 3 and 7
        concurrency: 4, // High concurrency
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: partiallyFailingPath,
        outputPath: path.join(tempDir, 'concurrent-error.mp4'),
        verbose: false
      };

      await expect(renderDOM(config).promise).rejects.toThrow(/simulated failure at frame [37]|command failed.*ffmpeg/i);
    });
  });

  describe('Configuration Validation Errors', () => {
    it('should provide helpful error for invalid frame range', async () => {
      const validAdapterPath = path.join(tempDir, 'valid-adapter.js');
      await fs.writeFile(validAdapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame() { document.body.innerHTML = '<div>test</div>'; }
            }
          };
        })();
      `);

      const config = {
        width: 160,
        height: 90,
        fps: 30,
        startFrame: 10,
        endFrame: 5, // Invalid: endFrame < startFrame
        concurrency: 1,
        html: '<html><body></body></html>',
        adapterPath: validAdapterPath,
        outputPath: path.join(tempDir, 'invalid-range.mp4'),
        verbose: false
      };

      try {
        await renderDOM(config).promise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/frame|range|end.*start/i);
      }
    });
  });
});