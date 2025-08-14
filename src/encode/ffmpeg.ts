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
  audioMode?: 'shortest' | 'pad-video';
  videoPadSeconds?: number;
  audioCodec?: 'auto' | 'aac' | 'libopus' | 'pcm_s16le' | 'copy';
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

  if (opts.audioPath) {
    args.push('-i', opts.audioPath);
    if (opts.audioMode !== 'pad-video') {
      // default (shortest) – current behavior
      args.push('-shortest');
    }
  }

  // Pad the video tail by freezing the last frame, if requested
  if ((opts.videoPadSeconds ?? 0) > 0) {
    args.push('-vf', `tpad=stop_mode=clone:stop_duration=${opts.videoPadSeconds!.toFixed(3)}`);
  }

  // Video codec (unchanged)
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

  // Audio codec (new, but safe defaults)
  if (opts.audioPath) {
    const pick = (opts.audioCodec && opts.audioCodec !== 'auto')
      ? opts.audioCodec
      : (opts.codec === 'vp9' ? 'libopus'
         : opts.codec === 'prores' ? 'pcm_s16le'
         : 'aac');
    if (pick !== 'copy') {
      args.push('-c:a', pick);
      if (pick === 'aac' || pick === 'libopus') {
        args.push('-b:a', pick === 'aac' ? '192k' : '128k', '-ar', '48000', '-ac', '2');
      }
    } else {
      args.push('-c:a', 'copy');
    }
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