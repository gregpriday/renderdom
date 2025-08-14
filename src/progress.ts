import { EventEmitter } from 'eventemitter3';
import type { RenderEvent } from './types.js';

export class ProgressBus {
  readonly events = new EventEmitter<any>();
  constructor(private verbose: boolean) {}

  emit(event: RenderEvent) {
    if (this.verbose) process.stdout.write(JSON.stringify(event) + '\n');
    this.events.emit(event.type, event);
  }
}