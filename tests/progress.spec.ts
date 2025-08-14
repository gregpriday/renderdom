import { describe, it, expect, vi } from 'vitest';
import { ProgressBus } from '../src/progress.js';

describe('ProgressBus', () => {
  it('should emit events and forward to EventEmitter', () => {
    const progress = new ProgressBus(false);
    const listener = vi.fn();
    
    progress.events.on('capture-start', listener);
    
    const event = { type: 'capture-start' as const, totalFrames: 120 };
    progress.emit(event);
    
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('should write JSONL to stdout when verbose=true', () => {
    const mockWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    
    const progress = new ProgressBus(true);
    const event = { type: 'capture-start' as const, totalFrames: 120 };
    progress.emit(event);
    
    expect(mockWrite).toHaveBeenCalledWith(JSON.stringify(event) + '\n');
    
    mockWrite.mockRestore();
  });

  it('should not write to stdout when verbose=false', () => {
    const mockWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    
    const progress = new ProgressBus(false);
    const event = { type: 'capture-start' as const, totalFrames: 120 };
    progress.emit(event);
    
    expect(mockWrite).not.toHaveBeenCalled();
    
    mockWrite.mockRestore();
  });

  it('should handle multiple event types', () => {
    const progress = new ProgressBus(false);
    const listeners = {
      captureStart: vi.fn(),
      captureProgress: vi.fn(),
      done: vi.fn()
    };
    
    progress.events.on('capture-start', listeners.captureStart);
    progress.events.on('capture-progress', listeners.captureProgress);
    progress.events.on('done', listeners.done);
    
    progress.emit({ type: 'capture-start', totalFrames: 60 });
    progress.emit({ type: 'capture-progress', done: 30, total: 60, percent: 50, frame: 29 });
    progress.emit({ type: 'done', outputPath: './out.mp4' });
    
    expect(listeners.captureStart).toHaveBeenCalledTimes(1);
    expect(listeners.captureProgress).toHaveBeenCalledTimes(1);
    expect(listeners.done).toHaveBeenCalledTimes(1);
  });
});