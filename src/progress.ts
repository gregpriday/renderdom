import { EventEmitter } from 'eventemitter3';
import type { RenderEvent } from './types.js';

export class ProgressBus {
  readonly events = new EventEmitter<any>();
  constructor(private verbose: boolean) {}

  emit(event: RenderEvent) {
    if (this.verbose) {
      const data = JSON.stringify(event) + '\n';
      const needsDrain = !process.stdout.write(data);
      if (needsDrain) {
        // If stdout buffer is full, wait for drain to prevent memory buildup
        process.stdout.once('drain', () => {
          // Continue processing after drain
        });
      }
    }
    this.events.emit(event.type, event);
  }
}