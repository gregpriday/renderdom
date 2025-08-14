import { chromium, Browser, Page } from 'playwright';

export interface BrowserProvider {
  launch(flags: string[]): Promise<void>;
  newPage(width: number, height: number): Promise<Page>;
  close(): Promise<void>;
}

export class PlaywrightProvider implements BrowserProvider {
  private browser!: Browser;
  async launch(flags: string[] = []) {
    const defaultFlags = [
      '--use-gl=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
    this.browser = await chromium.launch({ 
      headless: true, 
      args: [...defaultFlags, ...flags] 
    });
  }
  async newPage(width: number, height: number) {
    const page = await this.browser.newPage();
    await page.setViewportSize({ width, height });
    return page;
  }
  async close() { await this.browser?.close(); }
}