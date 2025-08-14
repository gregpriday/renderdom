import { EventEmitter } from 'eventemitter3';
import { orchestrate } from './orchestrator.js';
import type { RenderEvent } from './types.js';
import type { InternalConfig } from './config.js';

export interface RenderController {
  events: EventEmitter<any>;
  promise: Promise<{ outputPath: string }>;
  cancel: () => Promise<void>;
}

export function renderDOM(config: any): RenderController {
  const events = new EventEmitter<any>();
  let cancelled = false;
  const { progress, promise: run } = orchestrate(config, !!config.verbose);
  // forward immediately
  progress.events.on('capture-start', (e: any) => events.emit('capture-start', e));
  progress.events.on('capture-progress', (e: any) => events.emit('capture-progress', e));
  progress.events.on('encode-start', (e: any) => events.emit('encode-start', e));
  progress.events.on('encode-progress', (e: any) => events.emit('encode-progress', e));
  progress.events.on('done', (e: any) => events.emit('done', e));
  const promise = run
    .catch((err: any) => {
      events.emit('error', { type: 'error', message: err?.message ?? String(err) });
      throw err;
    });

  async function cancel() {
    cancelled = true;
    // v1: cooperative only (queue drains, then exit). v2: wire abort signals to FFmpeg & pages.
  }

  return { events, promise, cancel };
}

export * from './types.js';
export * from './config.js';