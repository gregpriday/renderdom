import type { Page } from 'playwright';
import fs from 'node:fs/promises';

export async function injectAdapter(page: Page, adapterPath: string) {
  const adapterCode = await fs.readFile(adapterPath, 'utf8');
  await page.evaluate(adapterCode);
  await page.waitForFunction(() => {
    // @ts-ignore
    return typeof window !== 'undefined' && !!(window as any).__RenderDOM__?.adapter;
  }, { timeout: 30000 });
}

export async function callRenderFrame(page: Page, frameIndex: number, fps: number) {
  await page.evaluate(([f, s]) => {
    // @ts-ignore
    return (window as any).__RenderDOM__.adapter.renderFrame(f, s);
  }, [frameIndex, fps]);
}

export async function getDurationMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    // @ts-ignore
    return (window as any).__RenderDOM__.adapter.getDurationMs();
  });
}

export async function ensureAssets(page: Page) {
  return page.evaluate(async () => {
    // @ts-ignore
    const a = (window as any).__RenderDOM__.adapter;
    if (a.ensureAssets) return a.ensureAssets();
  });
}