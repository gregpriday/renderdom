import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { renderDOM } from '../src/index.js';
import { diffPng } from './helpers/image-hash.js';

describe('Golden Frame Tests', () => {
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

  it('should render frames identical to golden baseline', async () => {
    const currentFramesDir = path.join(tempDir, 'current');
    const goldenFramesDir = path.resolve('tests/golden/test-adapter');
    const adapterPath = path.resolve('tests/fixtures/test-adapter.js');

    const config = {
      width: 320,
      height: 180,
      fps: 30,
      endFrame: 19, // Same as golden generation
      concurrency: 1,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath,
      outputPath: 'dummy.mp4',
      debugFramesDir: currentFramesDir,
      verbose: false
    };

    await renderDOM(config).promise;

    // Get list of generated frames
    const currentFiles = await fs.readdir(currentFramesDir);
    const currentPngs = currentFiles.filter(f => f.endsWith('.png')).sort();

    // Get list of golden frames
    const goldenFiles = await fs.readdir(goldenFramesDir);
    const goldenPngs = goldenFiles.filter(f => f.endsWith('.png')).sort();

    // Should have same number of frames
    expect(currentPngs.length).toBe(goldenPngs.length);
    expect(currentPngs).toEqual(goldenPngs);

    // Compare each frame
    const mismatches: { frame: string; mismatches: number }[] = [];

    for (const filename of currentPngs) {
      const currentPath = path.join(currentFramesDir, filename);
      const goldenPath = path.join(goldenFramesDir, filename);

      try {
        const diff = diffPng(currentPath, goldenPath);
        if (diff > 0) {
          mismatches.push({ frame: filename, mismatches: diff });
        }
      } catch (error) {
        throw new Error(`Failed to compare ${filename}: ${error}`);
      }
    }

    if (mismatches.length > 0) {
      const mismatchSummary = mismatches
        .map(m => `${m.frame}: ${m.mismatches} pixels`)
        .join(', ');
      throw new Error(`Frame mismatches found: ${mismatchSummary}`);
    }

    // All frames should be identical
    expect(mismatches).toHaveLength(0);
  }, 60000);

  it('should detect changes when frames differ', async () => {
    const currentFramesDir = path.join(tempDir, 'current');
    const goldenFramesDir = path.resolve('tests/golden/test-adapter');
    
    // Create a modified test adapter that produces different frames
    const modifiedAdapterPath = path.join(tempDir, 'modified-adapter.js');
    const modifiedAdapterCode = `
(function(){
  const DURATION_MS = 1000;
  
  const adapter = {
    getDurationMs() { 
      return DURATION_MS; 
    },
    
    async ensureAssets() {},
    
    async renderFrame(frameIndex, fps) {
      document.body.innerHTML = '';
      
      // Different animation - static red square instead of bouncing ball
      const container = document.createElement('div');
      container.style.cssText = \`
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #ff0000;
      \`;
      
      const box = document.createElement('div');
      box.style.cssText = \`
        position: absolute;
        left: 50px;
        top: 50px;
        width: 100px;
        height: 100px;
        background: #ffffff;
      \`;
      
      container.appendChild(box);
      document.body.appendChild(container);
    }
  };

  window.__RenderDOM__ = { adapter };
})();
    `;
    
    await fs.writeFile(modifiedAdapterPath, modifiedAdapterCode);

    const config = {
      width: 320,
      height: 180,
      fps: 30,
      endFrame: 19,
      concurrency: 1,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath: modifiedAdapterPath,
      outputPath: 'dummy.mp4',
      debugFramesDir: currentFramesDir,
      verbose: false
    };

    await renderDOM(config).promise;

    // Check first frame - should be different
    const currentPath = path.join(currentFramesDir, '000000.png');
    const goldenPath = path.join(goldenFramesDir, '000000.png');

    const diff = diffPng(currentPath, goldenPath);
    expect(diff).toBeGreaterThan(0); // Should detect differences
  }, 30000);

  it('should handle missing golden files gracefully', async () => {
    const currentFramesDir = path.join(tempDir, 'current');
    const fakeGoldenDir = path.join(tempDir, 'fake-golden');
    
    await fs.mkdir(currentFramesDir);
    await fs.mkdir(fakeGoldenDir);
    
    // Create a test PNG in current
    await fs.writeFile(path.join(currentFramesDir, '000000.png'), Buffer.from('fake png'));
    
    // Try to diff against non-existent golden
    await expect(async () => {
      diffPng(
        path.join(currentFramesDir, '000000.png'),
        path.join(fakeGoldenDir, '000000.png')
      );
    }).rejects.toThrow();
  });
});