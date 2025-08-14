import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import tmp from 'tmp';
import { PlaywrightProvider } from '../src/browser/provider.js';
import { injectAdapter, getDurationMs, callRenderFrame, waitForStableFrame } from '../src/browser/page-bridge.js';
import { renderDOM } from '../src/index.js';

describe('Adapter Contract Validation', () => {
  let provider: PlaywrightProvider;
  let tempDir: string;
  let cleanup: () => void;

  beforeAll(async () => {
    provider = new PlaywrightProvider();
    await provider.launch();
    
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    tempDir = tmpDir.name;
    cleanup = tmpDir.removeCallback;
  });

  afterAll(async () => {
    await provider.close();
    cleanup();
  });

  describe('Required Methods', () => {
    it('should reject adapter missing getDurationMs', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const badAdapterPath = path.join(tempDir, 'no-duration-adapter.js');
      await fs.writeFile(badAdapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              renderFrame() {}
            }
          };
        })();
      `);

      await expect(injectAdapter(page, badAdapterPath)).rejects.toThrow(/getDurationMs.*required/);
      await page.close();
    });

    it('should reject adapter missing renderFrame', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const badAdapterPath = path.join(tempDir, 'no-render-adapter.js');
      await fs.writeFile(badAdapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; }
            }
          };
        })();
      `);

      await expect(injectAdapter(page, badAdapterPath)).rejects.toThrow(/renderFrame.*required/);
      await page.close();
    });

    it('should reject adapter with invalid getDurationMs return type', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const badAdapterPath = path.join(tempDir, 'invalid-duration-adapter.js');
      await fs.writeFile(badAdapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return "not a number"; },
              renderFrame() {}
            }
          };
        })();
      `);

      await injectAdapter(page, badAdapterPath);
      
      await expect(getDurationMs(page)).rejects.toThrow(/must return a number/);
      await page.close();
    });
  });

  describe('Determinism Requirements', () => {
    it('should produce identical results for same frame index', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body style="margin:0;"></body></html>');
      
      const adapterPath = path.resolve('tests/fixtures/test-adapter.js');
      await injectAdapter(page, adapterPath);
      
      // Render frame 10 multiple times
      await callRenderFrame(page, 10, 30);
      const screenshot1 = await page.screenshot({ type: 'png' });
      
      await callRenderFrame(page, 10, 30);
      const screenshot2 = await page.screenshot({ type: 'png' });
      
      await callRenderFrame(page, 10, 30);
      const screenshot3 = await page.screenshot({ type: 'png' });
      
      expect(screenshot1).toEqual(screenshot2);
      expect(screenshot2).toEqual(screenshot3);
      
      await page.close();
    });

    it('should handle frame indices independently', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body style="margin:0;"></body></html>');
      
      const adapterPath = path.resolve('tests/fixtures/test-adapter.js');
      await injectAdapter(page, adapterPath);
      
      // Render frames out of order
      await callRenderFrame(page, 20, 30);
      const frame20 = await page.screenshot({ type: 'png' });
      
      await callRenderFrame(page, 5, 30);
      const frame5 = await page.screenshot({ type: 'png' });
      
      await callRenderFrame(page, 20, 30);
      const frame20Again = await page.screenshot({ type: 'png' });
      
      // Frame 20 should be identical both times
      expect(frame20).toEqual(frame20Again);
      
      // Frame 5 and 20 should be different
      expect(frame5).not.toEqual(frame20);
      
      await page.close();
    });

    it('should demonstrate time-dependent rendering issue', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      // Create adapter that uses Date.now() (demonstrating non-determinism)
      const timeDependentPath = path.join(tempDir, 'time-dependent-adapter.js');
      await fs.writeFile(timeDependentPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame(frameIndex, fps) {
                // BAD: Uses Date.now() - makes frames non-deterministic
                const timestamp = Date.now();
                document.body.innerHTML = '<div style="background: hsl(' + (timestamp % 360) + ', 50%, 50%); color: white; font-size: 12px;">Frame ' + frameIndex + ' at ' + timestamp + '</div>';
              }
            }
          };
        })();
      `);

      await injectAdapter(page, timeDependentPath);
      
      // Render same frame twice with delay
      await callRenderFrame(page, 0, 30);
      const screenshot1 = await page.screenshot({ type: 'png' });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await callRenderFrame(page, 0, 30);
      const screenshot2 = await page.screenshot({ type: 'png' });
      
      // Should be different due to Date.now() usage (demonstrates the problem)
      expect(screenshot1).not.toEqual(screenshot2);
      
      await page.close();
    });
  });

  describe('Optional Method Support', () => {
    it('should handle adapter with ensureAssets', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const withAssetsPath = path.join(tempDir, 'with-assets-adapter.js');
      await fs.writeFile(withAssetsPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              async ensureAssets() {
                window.assetsLoaded = true;
              },
              renderFrame(frameIndex, fps) {
                document.body.innerHTML = window.assetsLoaded ? 
                  '<div>Assets loaded</div>' : 
                  '<div>No assets</div>';
              }
            }
          };
        })();
      `);

      await injectAdapter(page, withAssetsPath);
      
      // ensureAssets should be called automatically during injection
      await callRenderFrame(page, 0, 30);
      
      const content = await page.textContent('body');
      expect(content).toBe('Assets loaded');
      
      await page.close();
    });

    it('should handle adapter with afterFrame', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const withAfterFramePath = path.join(tempDir, 'with-after-frame-adapter.js');
      await fs.writeFile(withAfterFramePath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame(frameIndex, fps) {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 100, 100);
                window.pendingCanvas = canvas;
              },
              async afterFrame() {
                if (window.pendingCanvas) {
                  document.body.appendChild(window.pendingCanvas);
                  window.pendingCanvas = null;
                }
              }
            }
          };
        })();
      `);

      await injectAdapter(page, withAfterFramePath);
      
      await callRenderFrame(page, 0, 30);
      
      // Wait for stable frame (which calls afterFrame)
      await waitForStableFrame(page);
      
      // afterFrame should have been called, canvas should be in DOM
      const canvas = await page.$('canvas');
      expect(canvas).not.toBeNull();
      
      await page.close();
    }, 15000);

    it('should work without optional methods', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const minimalPath = path.join(tempDir, 'minimal-adapter.js');
      await fs.writeFile(minimalPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame(frameIndex, fps) {
                document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
              }
            }
          };
        })();
      `);

      await injectAdapter(page, minimalPath);
      
      await expect(callRenderFrame(page, 0, 30)).resolves.not.toThrow();
      
      const content = await page.textContent('body');
      expect(content).toBe('Frame 0');
      
      await page.close();
    });
  });

  describe('Error Handling', () => {
    it('should propagate adapter renderFrame errors', async () => {
      const config = {
        width: 320,
        height: 180,
        fps: 30,
        endFrame: 2,
        concurrency: 1,
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: path.join(tempDir, 'throwing-adapter.js'),
        outputPath: path.join(tempDir, 'dummy.mp4'),
        // Don't use debugFramesDir for error propagation tests
        verbose: false
      };
      
      await fs.writeFile(config.adapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame(frameIndex, fps) {
                if (frameIndex === 1) {
                  throw new Error('Adapter error at frame 1');
                }
                document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
              }
            }
          };
        })();
      `);

      await expect(renderDOM(config).promise).rejects.toThrow(/adapter error at frame 1|command failed.*ffmpeg/i);
    });

    it('should timeout on slow renderFrame', async () => {
      const config = {
        width: 320,
        height: 180,
        fps: 30,
        endFrame: 0,
        concurrency: 1,
        frameTimeoutMs: 1000,
        pixelFormat: 'yuv420p' as const,
        html: '<html><body></body></html>',
        adapterPath: path.join(tempDir, 'slow-adapter.js'),
        outputPath: path.join(tempDir, 'dummy.mp4'),
        // Don't use debugFramesDir for timeout tests
        verbose: false
      };
      
      await fs.writeFile(config.adapterPath, `
        (function(){
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              async renderFrame(frameIndex, fps) {
                // Simulate slow operation
                await new Promise(resolve => setTimeout(resolve, 2000));
                document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
              }
            }
          };
        })();
      `);

      await expect(renderDOM(config).promise).rejects.toThrow(/timeout|command failed.*ffmpeg/i);
    });

    it('should provide helpful error for missing __RenderDOM__', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const emptyAdapterPath = path.join(tempDir, 'empty-adapter.js');
      await fs.writeFile(emptyAdapterPath, '// Empty file');

      await expect(injectAdapter(page, emptyAdapterPath)).rejects.toThrow();
      await page.close();
    }, 35000);
  });

  describe('Frame Parameter Validation', () => {
    it('should pass correct frameIndex and fps to renderFrame', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const paramCheckPath = path.join(tempDir, 'param-check-adapter.js');
      await fs.writeFile(paramCheckPath, `
        (function(){
          window.capturedParams = [];
          window.__RenderDOM__ = { 
            adapter: {
              getDurationMs() { return 1000; },
              renderFrame(frameIndex, fps) {
                window.capturedParams.push({ frameIndex, fps });
                document.body.innerHTML = 'Frame ' + frameIndex + ' at ' + fps + 'fps';
              }
            }
          };
        })();
      `);

      await injectAdapter(page, paramCheckPath);
      
      await callRenderFrame(page, 15, 60);
      await callRenderFrame(page, 0, 30);
      await callRenderFrame(page, 99, 24);
      
      const params = await page.evaluate(() => window.capturedParams);
      expect(params).toEqual([
        { frameIndex: 15, fps: 60 },
        { frameIndex: 0, fps: 30 },
        { frameIndex: 99, fps: 24 }
      ]);
      
      await page.close();
    });

    it('should handle large frame indices', async () => {
      const page = await provider.newPage(320, 180);
      await page.setContent('<html><body></body></html>');
      
      const adapterPath = path.resolve('tests/fixtures/test-adapter.js');
      await injectAdapter(page, adapterPath);
      
      // Test large frame index
      await expect(callRenderFrame(page, 99999, 30)).resolves.not.toThrow();
      
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
      
      await page.close();
    });
  });
});