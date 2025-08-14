import { EventEmitter } from 'eventemitter3';

export function makeFakeFfmpeg() {
  const events = new EventEmitter<any>();
  const stdin: any = {
    chunks: [] as Buffer[],
    write(buf: Buffer) { this.chunks.push(buf); },
    end() { /* no-op */ }
  };
  const wait = async () => { /* simulate encode time */ };
  return { stdin, events, wait };
}