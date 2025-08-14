import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { PlaywrightProvider } from '../src/browser/provider.js';
import { injectAdapter, getDurationMs, callRenderFrame } from '../src/browser/page-bridge.js';

describe('Page Bridge Integration', () => {
  let provider: PlaywrightProvider;

  beforeAll(async () => {
    provider = new PlaywrightProvider();
    await provider.launch();
  });

  afterAll(async () => {
    await provider.close();
  });

  it('should inject adapter and read duration', async () => {
    const page = await provider.newPage(640, 360);
    
    // Set basic HTML content
    await page.setContent('<html><body><div id="box"></div></body></html>');
    
    // Inject the basic scene adapter
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    await injectAdapter(page, adapterPath);
    
    // Should be able to read duration
    const duration = await getDurationMs(page);
    expect(duration).toBe(2000);
    
    await page.close();
  });

  it('should render frames deterministically', async () => {
    const page = await provider.newPage(320, 180);
    
    // Set basic HTML - the test adapter will control all content
    await page.setContent('<html><body style="margin:0;"></body></html>');
    
    const adapterPath = path.resolve('tests/fixtures/test-adapter.js');
    await injectAdapter(page, adapterPath);
    
    // Render first frame (red background, small box at left)
    await callRenderFrame(page, 0, 30);
    const frame0 = await page.screenshot({ type: 'png' });
    
    // Render middle frame (red background, medium box in middle) 
    await callRenderFrame(page, 15, 30);
    const frame15 = await page.screenshot({ type: 'png' });
    
    // Render last frame (blue background, large box at right)
    await callRenderFrame(page, 29, 30);
    const frame29 = await page.screenshot({ type: 'png' });
    
    // All screenshots should have content
    expect(frame0.length).toBeGreaterThan(1000);
    expect(frame15.length).toBeGreaterThan(1000);
    expect(frame29.length).toBeGreaterThan(1000);
    
    // Frames should be visually different due to:
    // - Background color change (red -> blue)
    // - Box position change (left -> right) 
    // - Box size change (small -> large)
    expect(frame0).not.toEqual(frame15);
    expect(frame15).not.toEqual(frame29);
    expect(frame0).not.toEqual(frame29);
    
    await page.close();
  });

  it('should handle adapter with ensureAssets', async () => {
    const page = await provider.newPage(640, 360);
    
    await page.setContent('<html><body><div id="box"></div></body></html>');
    
    const adapterPath = path.resolve('examples/basic-scene/adapter.js');
    await injectAdapter(page, adapterPath);
    
    // Should not throw when calling ensureAssets
    await expect(page.evaluate(async () => {
      // @ts-ignore
      const adapter = (window as any).__RenderDOM__.adapter;
      if (adapter.ensureAssets) {
        return adapter.ensureAssets();
      }
    })).resolves.not.toThrow();
    
    await page.close();
  });

  it('should timeout on invalid adapter', async () => {
    const page = await provider.newPage(640, 360);
    await page.setContent('<html><body></body></html>');
    
    // Create a broken adapter file path
    const invalidAdapterPath = 'non-existent-adapter.js';
    
    await expect(injectAdapter(page, invalidAdapterPath))
      .rejects.toThrow();
    
    await page.close();
  }, 35000);
});