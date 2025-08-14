import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import PQueue from 'p-queue';
import type { InternalConfig } from './config.js';
import { ProgressBus } from './progress.js';
import { PlaywrightProvider } from './browser/provider.js';
import { injectAdapter, callRenderFrame, getDurationMs, ensureAssets, freezeCssAnimations, waitForStableFrame } from './browser/page-bridge.js';
import { captureFrameBuffer } from './capture.js';
import { spawnFfmpeg } from './encode/ffmpeg.js';
import { probeAudioDurationMs } from './encode/probe.js';

export function orchestrate(config: any, verbose: boolean, abortSignal?: AbortSignal) {
  const progress = new ProgressBus(verbose);
  const promise = (async () => {
    const concurrency = config.concurrency ?? Math.max(1, Math.floor(os.cpus().length / 2));
    const provider = new PlaywrightProvider();
    await provider.launch(config.chromiumFlags);

    const pages = await Promise.all(Array.from({ length: concurrency }, () => provider.newPage(config.width, config.height)));

    // Helper for bootstrap timeouts
    const withBootstrapTimeout = <T>(p: Promise<T>, ms: number, label: string) => {
      let timeoutId: NodeJS.Timeout;
      const timeout = new Promise<never>((_, rej) => {
        timeoutId = setTimeout(() => rej(new Error(`Bootstrap timeout: ${label} after ${ms}ms`)), ms);
      });
      
      return Promise.race([p, timeout]).finally(() => {
        clearTimeout(timeoutId);
      });
    };

    // bootstrap each page
    await Promise.all(pages.map(async (p) => {
      const bootstrapTimeout = config.frameTimeoutMs ?? 15000;
      
      if (config.html) {
        const htmlDataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(config.html);
        await p.goto(htmlDataUrl, { waitUntil: 'networkidle' });
      } else if (config.pageUrl) {
        await p.goto(config.pageUrl, { waitUntil: 'networkidle' });
      } else {
        await p.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
      }
      
      // Freeze CSS animations for determinism (default: true)
      if (config.disableCssAnimations ?? true) {
        await freezeCssAnimations(p);
      }
      
      await withBootstrapTimeout(injectAdapter(p, config.adapterPath), bootstrapTimeout, 'adapter injection');
      await withBootstrapTimeout(ensureAssets(p), bootstrapTimeout, 'ensureAssets()');
      // Wait for fonts to be ready
      await withBootstrapTimeout(p.evaluate(() => document.fonts.ready), bootstrapTimeout, 'fonts ready');
    }));

    // Determine total frames from first page
    const durationMs = await getDurationMs(pages[0]);
    const startFrame = config.startFrame ?? 0;
    
    let totalFrames: number;
    if (config.endFrame !== undefined) {
      totalFrames = Math.max(0, config.endFrame - startFrame + 1);
    } else {
      const maxFrame = Math.floor((durationMs / 1000) * config.fps);
      totalFrames = Math.max(0, maxFrame - startFrame);
    }

    // Handle edge case where there are no frames to render
    if (totalFrames <= 0) {
      progress.emit({ type: 'capture-start', totalFrames: 0 });
      progress.emit({ type: 'done', outputPath: config.debugFramesDir || config.outputPath });
      
      await Promise.all(pages.map((p) => p.close()));
      await provider.close();
      
      return { outputPath: config.debugFramesDir || config.outputPath };
    }

    progress.emit({ type: 'capture-start', totalFrames });

    const frameIndices = Array.from({ length: totalFrames }, (_, i) => startFrame + i);

    // Calculate video duration and audio padding
    const videoDurationMs = (frameIndices.length / config.fps) * 1000;
    let videoPadSeconds = 0;
    let expectedDurationMs = videoDurationMs;

    if (config.audioPath && config.audioMode === 'pad-video') {
      try {
        const audioMs = await probeAudioDurationMs(config.audioPath);
        if (audioMs > videoDurationMs) {
          videoPadSeconds = (audioMs - videoDurationMs) / 1000;
          expectedDurationMs = audioMs;
        }
      } catch {
        // If probe fails, fall back gracefully to current behavior
        // (keep expectedDurationMs = videoDurationMs)
      }
    }

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
      audioMode: config.audioMode,
      videoPadSeconds,
      audioCodec: config.audioCodec,
      imageFormat: config.imageFormat,
      outputPath: config.outputPath,
      expectedDurationMs
    });

    if (ff) {
      ff.events.on('encode-start', (e) => progress.emit(e));
      ff.events.on('encode-progress', (e) => progress.emit(e));
    }

    let done = 0;
    const queue = new PQueue({ concurrency });

    // Frame ordering: buffer frames and write in sequence to FFmpeg
    const pending = new Map<number, Buffer>();
    let nextToWrite = config.startFrame ?? 0;
    let flushInProgress = false;

    const flushInOrder = async () => {
      if (flushInProgress) return;
      flushInProgress = true;
      
      try {
        while (pending.has(nextToWrite)) {
          const buf = pending.get(nextToWrite)!;
          pending.delete(nextToWrite);
          
          if (config.debugFramesDir) {
            // Write frame to disk
            const ext = config.imageFormat === 'jpeg' ? 'jpg' : 'png';
            const framePath = path.join(config.debugFramesDir, `${nextToWrite.toString().padStart(6, '0')}.${ext}`);
            await fs.writeFile(framePath, buf);
          } else if (ff) {
            // Write to FFmpeg with backpressure handling
            const needsDrain = !ff.stdin.write(buf);
            if (needsDrain) {
              await new Promise<void>((resolve) => {
                ff.stdin.once('drain', resolve);
              });
            }
          }
          
          nextToWrite++;
        }
      } finally {
        flushInProgress = false;
      }
    };

    const withTimeout = <T>(p: Promise<T>, ms: number, label: string) => {
      let timeoutId: NodeJS.Timeout;
      const timeout = new Promise<never>((_, rej) => {
        timeoutId = setTimeout(() => rej(new Error(`Timeout: ${label} after ${ms}ms`)), ms);
      });
      
      return Promise.race([p, timeout]).finally(() => {
        clearTimeout(timeoutId);
      });
    };

    for (const [idx, frame] of frameIndices.entries()) {
      queue.add(async () => {
        // Check if cancelled before processing frame
        if (abortSignal?.aborted) {
          throw new Error('Render operation was cancelled');
        }
        
        const worker = idx % pages.length; // simple round‑robin
        const page = pages[worker];
        const timeout = config.frameTimeoutMs ?? 15000;
        await withTimeout(callRenderFrame(page, frame, config.fps), timeout, `renderFrame(${frame})`);
        await withTimeout(
          waitForStableFrame(page, { extraRafs: 1, waitFonts: true, waitImages: false }),
          timeout,
          `stability(${frame})`
        );
        const buf = await withTimeout(captureFrameBuffer(page, config.imageFormat, config.imageQuality), timeout, `screenshot(${frame})`);
        
        // Check again before writing
        if (abortSignal?.aborted) {
          throw new Error('Render operation was cancelled');
        }
        
        // Buffer frame and flush in order
        pending.set(frame, buf);
        await flushInOrder();
        
        done++;
        progress.emit({ type: 'capture-progress', done, total: totalFrames, percent: (done / totalFrames) * 100, frame });
      });
    }

    try {
      await queue.onIdle();
      
      if (ff) {
        ff.stdin.end();
        await ff.wait();
      }

      const finalOutputPath = config.debugFramesDir || config.outputPath;
      progress.emit({ type: 'done', outputPath: finalOutputPath });

      return { outputPath: finalOutputPath };
    } catch (error) {
      // Handle cancellation cleanup
      if (abortSignal?.aborted || (error as Error)?.message?.includes('cancelled')) {
        if (ff) {
          try {
            ff.stdin.destroy();
          } catch {}
        }
        
        // Clear pending queue
        queue.clear();
        
        throw new Error('Render operation was cancelled');
      }
      throw error;
    } finally {
      // Always cleanup resources
      await Promise.all(pages.map((p) => p.close().catch(() => {})));
      await provider.close().catch(() => {});
    }
  })();
  return { progress, promise };
}