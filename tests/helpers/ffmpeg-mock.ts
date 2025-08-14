import { EventEmitter } from 'eventemitter3';

export interface MockStdin {
  chunks: Buffer[];
  writeSequence: Array<{ timestamp: number; size: number; frameHint?: string }>;
  write(buf: Buffer): void;
  end(): void;
}

export function makeFakeFfmpeg() {
  const events = new EventEmitter<any>();
  const stdin: MockStdin = {
    chunks: [] as Buffer[],
    writeSequence: [] as Array<{ timestamp: number; size: number; frameHint?: string }>,
    write(buf: Buffer) { 
      this.chunks.push(buf);
      
      // Extract frame hint from PNG header if possible
      let frameHint: string | undefined;
      if (buf.length > 8) {
        const header = buf.toString('ascii', 0, Math.min(100, buf.length));
        const match = header.match(/FRAME_(\d+)/);
        if (match) {
          frameHint = match[1];
        }
      }
      
      this.writeSequence.push({ 
        timestamp: Date.now(), 
        size: buf.length,
        frameHint 
      });
    },
    end() { /* no-op */ }
  };
  const wait = async () => { /* simulate encode time */ };
  return { stdin, events, wait };
}