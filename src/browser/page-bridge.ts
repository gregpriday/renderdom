import type { Page } from 'playwright';
import fs from 'node:fs/promises';

export async function injectAdapter(page: Page, adapterPath: string) {
  const adapterCode = await fs.readFile(adapterPath, 'utf8');
  
  // Use script tag injection instead of eval for better module support and security
  await page.evaluate((code) => {
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
  }, adapterCode);
  
  await page.waitForFunction(() => {
    // @ts-ignore
    return typeof window !== 'undefined' && !!(window as any).__RenderDOM__?.adapter;
  }, { timeout: 30000 });
  
  // Validate adapter contract
  await page.evaluate(() => {
    // @ts-ignore
    const adapter = (window as any).__RenderDOM__?.adapter;
    if (!adapter) {
      throw new Error('Adapter not found: __RenderDOM__.adapter is not defined');
    }
    if (typeof adapter.getDurationMs !== 'function') {
      throw new Error('Adapter contract violation: getDurationMs() method is required');
    }
    if (typeof adapter.renderFrame !== 'function') {
      throw new Error('Adapter contract violation: renderFrame() method is required');
    }
  });
  
  // Call ensureAssets if present
  await ensureAssets(page);
}

export async function callRenderFrame(page: Page, frameIndex: number, fps: number) {
  await page.evaluate(async ([f, s]) => {
    // @ts-ignore
    const a = (window as any).__RenderDOM__.adapter;
    await a.renderFrame(f, s);     // await adapter's promise if any
  }, [frameIndex, fps]);
}

export async function getDurationMs(page: Page): Promise<number> {
  const duration = await page.evaluate(() => {
    // @ts-ignore
    const adapter = (window as any).__RenderDOM__?.adapter;
    if (!adapter?.getDurationMs) {
      throw new Error('Adapter contract violation: getDurationMs() method is required');
    }
    const result = adapter.getDurationMs();
    if (typeof result !== 'number') {
      throw new Error(`Adapter contract violation: getDurationMs() must return a number, got ${typeof result}`);
    }
    if (result <= 0) {
      throw new Error(`Adapter contract violation: getDurationMs() must return a positive number, got ${result}`);
    }
    return result;
  });
  return duration;
}

export async function ensureAssets(page: Page) {
  return page.evaluate(async () => {
    // @ts-ignore
    const a = (window as any).__RenderDOM__.adapter;
    if (a.ensureAssets) return a.ensureAssets();
  });
}

export async function waitForStableFrame(page: Page, opts?: { extraRafs?: number; waitFonts?: boolean; waitImages?: boolean }) {
  await page.evaluate(async (o: any) => {
    const { extraRafs = 1, waitFonts = true, waitImages = false } = o || {};
    const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()));
    for (let i = 0; i < extraRafs; i++) await raf();
    if ('fonts' in document && waitFonts) await (document as any).fonts.ready;
    if (waitImages) {
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map((img: any) => img.decode?.().catch(() => {})));
    }
    // @ts-ignore
    const a = (window as any).__RenderDOM__?.adapter;
    if (a?.afterFrame) await a.afterFrame();
  }, opts || {});
}

export async function freezeCssAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }`
  });
}