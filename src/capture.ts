import type { Page } from 'playwright';

export async function captureFrameBuffer(
  page: Page,
  fmt: 'png' | 'jpeg',
  quality?: number
): Promise<Buffer> {
  const opts: any = { type: fmt };
  if (fmt === 'jpeg' && typeof quality === 'number') opts.quality = quality;
  return page.screenshot(opts);
}