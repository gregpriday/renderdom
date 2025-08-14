#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigSchema } from './config.js';
import { renderDOM } from './index.js';

const program = new Command();

program
  .name('renderdom')
  .description('Render DOM animations to video with Playwright + FFmpeg')
  .version('0.1.0');

program.command('render')
  .requiredOption('--adapter <path>', 'path to adapter script bundled for the browser (UMD/IIFE)')
  .requiredOption('-o, --out <path>', 'output video path')
  .option('--width <n>', 'width', (v) => parseInt(v, 10))
  .option('--height <n>', 'height', (v) => parseInt(v, 10))
  .option('--fps <n>', 'fps', (v) => parseInt(v, 10))
  .option('--start <n>', 'start frame', (v) => parseInt(v, 10))
  .option('--end <n>', 'end frame (inclusive)', (v) => parseInt(v, 10))
  .option('--concurrency <n>', 'parallel pages', (v) => parseInt(v, 10))
  .option('--codec <c>', 'h264|vp9|prores')
  .option('--crf <n>', 'quality factor', (v) => parseInt(v, 10))
  .option('--preset <s>', 'ffmpeg preset')
  .option('--pixfmt <p>', 'pixel format')
  .option('--image-format <f>', 'png|jpeg')
  .option('--image-quality <n>', 'jpeg quality 0..100', (v) => parseInt(v, 10))
  .option('--audio <path>', 'audio file')
  .option('--page-url <url>', 'page URL')
  .option('--html <path>', 'path to HTML file to inline')
  .option('--chromium-flag <flag>', 'repeatable chromium flag', (v, acc: string[]) => (acc ? acc.concat(v) : [v]))
  .option('--disable-css-animations', 'disable CSS animations/transitions for determinism (default: false)')
  .option('--debug-frames-dir <path>', 'write frames to a directory instead of encoding')
  .option('--verbose', 'emit JSONL progress to stdout', false)
  .action(async (opts) => {
    const html = opts.html ? await fs.readFile(path.resolve(opts.html), 'utf8') : undefined;

    const parsed = ConfigSchema.parse({
      width: opts.width, height: opts.height, fps: opts.fps,
      startFrame: opts.start, endFrame: opts.end, concurrency: opts.concurrency,
      codec: opts.codec, crf: opts.crf, preset: opts.preset, pixelFormat: opts.pixfmt,
      imageFormat: opts.imageFormat, imageQuality: opts.imageQuality,
      audioPath: opts.audio, pageUrl: opts.pageUrl, html, chromiumFlags: opts.chromiumFlag || [],
      adapterPath: path.resolve(opts.adapter), outputPath: path.resolve(opts.out)
    });

    const { events, promise } = renderDOM({ 
      ...parsed, 
      verbose: !!opts.verbose, 
      debugFramesDir: opts.debugFramesDir ?? process.env.RENDERDOM_DEBUG_FRAMES_DIR,
      disableCssAnimations: opts.disableCssAnimations ?? parsed.disableCssAnimations
    });

    events.on('error', (e: any) => console.error(e.message));
    try {
      const res = await promise;
      console.error('Output:', res.outputPath);
    } catch (e: any) {
      console.error('Render failed:', e?.message ?? e);
      process.exitCode = 1;
    }
  });

program.parse();