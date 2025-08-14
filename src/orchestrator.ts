import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import PQueue from 'p-queue';
import type { InternalConfig } from './config.js';
import { ProgressBus } from './progress.js';
import { PlaywrightProvider } from './browser/provider.js';
import { injectAdapter, callRenderFrame, getDurationMs, ensureAssets } from './browser/page-bridge.js';
import { captureFrameBuffer } from './capture.js';
import { spawnFfmpeg } from './encode/ffmpeg.js';

export function orchestrate(config: any, verbose: boolean) {
  const progress = new ProgressBus(verbose);
  const promise = (async () => {
    const concurrency = config.concurrency ?? Math.max(1, Math.floor(os.cpus().length / 2));
    const provider = new PlaywrightProvider();
    await provider.launch(config.chromiumFlags);

    const pages = await Promise.all(Array.from({ length: concurrency }, () => provider.newPage(config.width, config.height)));

    // bootstrap each page
    await Promise.all(pages.map(async (p) => {
      if (config.html) {
        const htmlDataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(config.html);
        await p.goto(htmlDataUrl, { waitUntil: 'networkidle' });
      } else if (config.pageUrl) {
        await p.goto(config.pageUrl, { waitUntil: 'networkidle' });
      } else {
        await p.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
      }
      await injectAdapter(p, config.adapterPath);
      await ensureAssets(p);
      // Wait for fonts to be ready
      await p.evaluate(() => document.fonts.ready);
    }));

    // Determine total frames from first page
    const durationMs = await getDurationMs(pages[0]);
    const totalFrames = config.endFrame !== undefined
      ? config.endFrame - (config.startFrame ?? 0) + 1
      : Math.floor((durationMs / 1000) * config.fps) - (config.startFrame ?? 0);

    progress.emit({ type: 'capture-start', totalFrames });

    const frameIndices = Array.from({ length: totalFrames }, (_, i) => (config.startFrame ?? 0) + i);

    // Debug frames mode: write PNGs to disk
    if (config.debugFramesDir) {
      await fs.mkdir(config.debugFramesDir, { recursive: true });
    }

    // Only spawn FFmpeg if not in debug frames mode
    const ff = config.debugFramesDir ? null : spawnFfmpeg({
      fps: config.fps,
      width: config.width,
      height: config.height,
      codec: config.codec,
      crf: config.crf,
      preset: config.preset,
      pixelFormat: config.pixelFormat,
      audioPath: config.audioPath,
      imageFormat: config.imageFormat,
      outputPath: config.outputPath,
      expectedDurationMs: (frameIndices.length / config.fps) * 1000
    });

    if (ff) {
      ff.events.on('encode-start', (e) => progress.emit(e));
      ff.events.on('encode-progress', (e) => progress.emit(e));
    }

    let done = 0;
    const queue = new PQueue({ concurrency });

    for (const [idx, frame] of frameIndices.entries()) {
      queue.add(async () => {
        const worker = idx % pages.length; // simple round‑robin
        const page = pages[worker];
        await callRenderFrame(page, frame, config.fps);
        const buf = await captureFrameBuffer(page, config.imageFormat, config.imageQuality);
        
        if (config.debugFramesDir) {
          // Write frame to disk
          const framePath = path.join(config.debugFramesDir, `${frame.toString().padStart(6, '0')}.png`);
          await fs.writeFile(framePath, buf);
        } else if (ff) {
          // Write to FFmpeg
          ff.stdin.write(buf);
        }
        
        done++;
        progress.emit({ type: 'capture-progress', done, total: totalFrames, percent: (done / totalFrames) * 100, frame });
      });
    }

    await queue.onIdle();
    
    if (ff) {
      ff.stdin.end();
      await ff.wait();
    }

    const finalOutputPath = config.debugFramesDir || config.outputPath;
    progress.emit({ type: 'done', outputPath: finalOutputPath });

    await Promise.all(pages.map((p) => p.close()));
    await provider.close();
    
    return { outputPath: finalOutputPath };
  })();
  return { progress, promise };
}