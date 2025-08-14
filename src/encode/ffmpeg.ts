import { execa } from 'execa';
import { EventEmitter } from 'eventemitter3';

export interface FfmpegOptions {
  fps: number;
  width: number; height: number;
  codec: 'h264' | 'vp9' | 'prores';
  crf: number; preset: string; pixelFormat: string;
  audioPath?: string;
  imageFormat: 'png' | 'jpeg';
  outputPath: string;
  expectedDurationMs?: number;
}

export interface FfmpegSession {
  stdin: NodeJS.WritableStream;
  events: EventEmitter<{ type: 'encode-progress'; outTimeMs: number }>; // minimal
  wait: () => Promise<void>;
}

export function spawnFfmpeg(opts: FfmpegOptions): FfmpegSession {
  const args = [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(opts.fps),
    '-vcodec', opts.imageFormat === 'png' ? 'png' : 'mjpeg',
    '-i', 'pipe:0',
  ];
  if (opts.audioPath) args.push('-i', opts.audioPath, '-shortest');

  switch (opts.codec) {
    case 'h264':
      args.push('-c:v', 'libx264', '-crf', String(opts.crf), '-preset', opts.preset);
      break;
    case 'vp9':
      args.push('-c:v', 'libvpx-vp9', '-crf', String(opts.crf), '-b:v', '0');
      break;
    case 'prores':
      args.push('-c:v', 'prores_ks', '-profile:v', '3');
      break;
  }

  args.push('-pix_fmt', opts.pixelFormat, '-r', String(opts.fps));

  // progress output (parseable)
  args.push('-progress', 'pipe:1');
  args.push('-analyzeduration', '0', '-probesize', '32k');

  args.push(opts.outputPath);

  const proc = execa('ffmpeg', args, { stdin: 'pipe' });
  const events = new EventEmitter<any>();
  
  // encode-start event
  setImmediate(() => events.emit('encode-start', { type: 'encode-start', args }));

  proc.stdout?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().trim().split(/\r?\n/);
    for (const line of lines) {
      const [k, v] = line.split('=');
      if (k === 'out_time_ms') {
        const ms = Number(v);
        const payload: any = { type: 'encode-progress', outTimeMs: ms };
        if (opts.expectedDurationMs) payload.percent = Math.min(100, (ms / opts.expectedDurationMs) * 100);
        events.emit('encode-progress', payload);
      }
    }
  });

  return {
    stdin: proc.stdin!,
    events,
    wait: async () => { await proc; }
  };
}