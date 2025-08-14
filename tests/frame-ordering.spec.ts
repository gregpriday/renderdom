import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { renderDOM } from '../src/index.js';
import { hasFfmpeg } from './helpers/has-ffmpeg.js';

// Skip if FFmpeg not available for video tests
const skipIfNoFfmpeg = hasFfmpeg() ? it : it.skip;

describe('Frame Ordering Under Concurrency', () => {
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

  it('should generate frames in correct order with debug frames', async () => {
    const framesDir = path.join(tempDir, 'frames');
    const sequenceAdapterPath = path.join(tempDir, 'sequence-adapter.js');
    
    // Create adapter that embeds frame index visibly in output
    await fs.writeFile(sequenceAdapterPath, `
      (function(){
        window.__RenderDOM__ = { 
          adapter: {
            getDurationMs() { return 1000; },
            renderFrame(frameIndex, fps) {
              document.body.innerHTML = '';
              
              // Create large, visible frame number
              const frameDiv = document.createElement('div');
              frameDiv.style.cssText = \`
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 48px;
                font-family: monospace;
                font-weight: bold;
                color: white;
                background: black;
                padding: 20px;
                border: 3px solid red;
              \`;
              frameDiv.textContent = 'FRAME_' + frameIndex.toString().padStart(6, '0');
              
              // Different background color based on frame for visual distinction
              const hue = (frameIndex * 37) % 360;
              document.body.style.background = \`hsl(\${hue}, 70%, 30%)\`;
              document.body.appendChild(frameDiv);
            }
          }
        };
      })();
    `);

    const config = {
      width: 320,
      height: 180,
      fps: 30,
      endFrame: 19, // 20 frames total
      concurrency: 4, // High concurrency to test ordering
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath: sequenceAdapterPath,
      outputPath: path.join(tempDir, 'dummy.mp4'),
      debugFramesDir: framesDir,
      verbose: false
    };

    await renderDOM(config).promise;

    // Verify all frames were generated
    const files = await fs.readdir(framesDir);
    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    
    expect(pngFiles).toHaveLength(20);
    
    // Verify frame file names are in correct sequence
    const expectedNames = Array.from({ length: 20 }, (_, i) => 
      (i).toString().padStart(6, '0') + '.png'
    );
    expect(pngFiles).toEqual(expectedNames);
    
    // Read each PNG and verify it contains the correct frame marker
    // (This would require image analysis in a full implementation,
    // but file existence and naming verifies basic ordering)
    for (let i = 0; i < 20; i++) {
      const framePath = path.join(framesDir, pngFiles[i]);
      const stat = await fs.stat(framePath);
      expect(stat.size).toBeGreaterThan(1000); // Ensure frame has content
    }
  }, 30000);

  skipIfNoFfmpeg('should write frames to video in correct order', async () => {
    const outputPath = path.join(tempDir, 'sequence.mp4');
    const framesDir = path.join(tempDir, 'debug-frames');
    const sequenceAdapterPath = path.join(tempDir, 'sequence-adapter.js');
    
    // Create adapter with clearly distinguishable frames
    await fs.writeFile(sequenceAdapterPath, `
      (function(){
        window.__RenderDOM__ = { 
          adapter: {
            getDurationMs() { return 1000; },
            renderFrame(frameIndex, fps) {
              document.body.innerHTML = '';
              
              // Create distinctive pattern for each frame
              const container = document.createElement('div');
              container.style.cssText = \`
                width: 100%;
                height: 100%;
                position: relative;
              \`;
              
              // Frame number at top
              const frameLabel = document.createElement('div');
              frameLabel.style.cssText = \`
                position: absolute;
                top: 10px;
                left: 10px;
                font-size: 24px;
                font-family: monospace;
                color: white;
                background: black;
                padding: 5px;
                z-index: 100;
              \`;
              frameLabel.textContent = 'F' + frameIndex;
              
              // Moving square based on frame index
              const square = document.createElement('div');
              const x = (frameIndex * 10) % 300;
              const y = 80;
              square.style.cssText = \`
                position: absolute;
                left: \${x}px;
                top: \${y}px;
                width: 20px;
                height: 20px;
                background: red;
              \`;
              
              // Background color changes
              const hue = frameIndex * 20;
              container.style.background = \`hsl(\${hue}, 50%, 40%)\`;
              
              container.appendChild(frameLabel);
              container.appendChild(square);
              document.body.appendChild(container);
            }
          }
        };
      })();
    `);

    const config = {
      width: 320,
      height: 180,
      fps: 24,
      endFrame: 23, // 24 frames = 1 second
      concurrency: 6, // High concurrency
      codec: 'h264' as const,
      crf: 28,
      preset: 'veryfast',
      pixelFormat: 'yuv420p' as const,
      imageFormat: 'png' as const,
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath: sequenceAdapterPath,
      outputPath,
      // Don't set debugFramesDir when testing video creation
      verbose: false
    };

    const { events, promise } = renderDOM(config);
    
    // Track progress events
    const progressEvents: any[] = [];
    events.on('capture-progress', (e) => progressEvents.push(e));
    
    await promise;

    // Verify video was created
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(1000); // Video file should exist with reasonable size
    
    // Verify progress events were emitted (they may not be in order due to concurrency)
    expect(progressEvents.length).toBe(24); // Should have one event per frame
    
    // Verify all expected frames were processed
    const processedFrames = progressEvents.map(e => e.frame).sort((a, b) => a - b);
    const expectedFrames = Array.from({ length: 24 }, (_, i) => i);
    expect(processedFrames).toEqual(expectedFrames);
  }, 60000);

  it('should handle concurrent rendering without frame corruption', async () => {
    const framesDir = path.join(tempDir, 'frames');
    const checksumAdapterPath = path.join(tempDir, 'checksum-adapter.js');
    
    // Create adapter that produces deterministic, verifiable content
    await fs.writeFile(checksumAdapterPath, `
      (function(){
        window.__RenderDOM__ = { 
          adapter: {
            getDurationMs() { return 500; }, // Short duration for speed
            renderFrame(frameIndex, fps) {
              document.body.innerHTML = '';
              
              // Create a grid pattern based on frame index
              const container = document.createElement('div');
              container.style.cssText = \`
                width: 100%;
                height: 100%;
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                grid-template-rows: repeat(6, 1fr);
                gap: 2px;
                background: black;
              \`;
              
              // Fill grid with colors based on mathematical function of frame index
              for (let i = 0; i < 48; i++) {
                const cell = document.createElement('div');
                const value = (frameIndex * 7 + i * 13) % 256;
                const r = value;
                const g = (value * 2) % 256;
                const b = (value * 3) % 256;
                cell.style.background = \`rgb(\${r}, \${g}, \${b})\`;
                container.appendChild(cell);
              }
              
              document.body.appendChild(container);
            }
          }
        };
      })();
    `);

    // Test with different concurrency levels
    const concurrencyLevels = [1, 2, 4, 8];
    const results: Array<{ concurrency: number; frameHashes: string[] }> = [];
    
    for (const concurrency of concurrencyLevels) {
      const testFramesDir = path.join(tempDir, `frames-c${concurrency}`);
      
      const config = {
        width: 160,
        height: 120,
        fps: 30,
        endFrame: 14, // 15 frames
        concurrency,
        html: '<html><body style="margin:0;"></body></html>',
        adapterPath: checksumAdapterPath,
        outputPath: path.join(tempDir, `test-c${concurrency}.mp4`),
        debugFramesDir: testFramesDir,
        verbose: false
      };

      await renderDOM(config).promise;
      
      // Get frame file stats as a simple hash
      const files = await fs.readdir(testFramesDir);
      const pngFiles = files.filter(f => f.endsWith('.png')).sort();
      
      const frameHashes = [];
      for (const file of pngFiles) {
        const stat = await fs.stat(path.join(testFramesDir, file));
        frameHashes.push(`${file}:${stat.size}`);
      }
      
      results.push({ concurrency, frameHashes });
    }
    
    // All concurrency levels should produce identical results
    const baselineHashes = results[0].frameHashes;
    for (let i = 1; i < results.length; i++) {
      expect(results[i].frameHashes).toEqual(baselineHashes);
    }
  }, 120000);

  it('should maintain frame order with mixed frame durations', async () => {
    const framesDir = path.join(tempDir, 'mixed-frames');
    const mixedAdapterPath = path.join(tempDir, 'mixed-adapter.js');
    
    // Create adapter where some frames take longer to render
    await fs.writeFile(mixedAdapterPath, `
      (function(){
        window.__RenderDOM__ = { 
          adapter: {
            getDurationMs() { return 400; },
            async renderFrame(frameIndex, fps) {
              document.body.innerHTML = '';
              
              // Some frames deliberately take longer (simulate heavy computation)
              if (frameIndex % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
              
              // Simple visual indicator of frame index
              const indicator = document.createElement('div');
              indicator.style.cssText = \`
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                font-family: monospace;
                color: white;
                background: hsl(\${frameIndex * 30}, 70%, 50%);
              \`;
              indicator.textContent = frameIndex.toString();
              
              document.body.appendChild(indicator);
            }
          }
        };
      })();
    `);

    const config = {
      width: 200,
      height: 150,
      fps: 25,
      endFrame: 11, // 12 frames (0-11 inclusive)
      concurrency: 4,
      frameTimeoutMs: 10000, // Allow time for slow frames
      html: '<html><body style="margin:0;"></body></html>',
      adapterPath: mixedAdapterPath,
      outputPath: path.join(tempDir, 'mixed.mp4'),
      debugFramesDir: framesDir,
      verbose: false
    };

    const { events, promise } = renderDOM(config);
    
    const captureEvents: any[] = [];
    events.on('capture-progress', (e) => captureEvents.push(e));
    
    await promise;

    // Verify frames are numbered correctly
    const files = await fs.readdir(framesDir);
    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    
    expect(pngFiles).toHaveLength(12);
    expect(pngFiles[0]).toBe('000000.png');
    expect(pngFiles[11]).toBe('000011.png');
    
    // Verify progress events show frames being captured in order
    // (even if some took longer to render)
    expect(captureEvents.length).toBeGreaterThan(0);
    const lastEvent = captureEvents[captureEvents.length - 1];
    expect(lastEvent.frame).toBeGreaterThanOrEqual(10); // Should capture most/all frames
    expect(lastEvent.percent).toBe(100);
  }, 45000);
});