import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnFfmpeg } from '../src/encode/ffmpeg.js';
import { makeFakeFfmpeg } from './helpers/ffmpeg-mock.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('FFmpeg encoder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct h264 args', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      outputPath: './out.mp4'
    });

    expect(execa).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'medium',
      '-pix_fmt', 'yuv420p'
    ]), { stdin: 'pipe' });
  });

  it('should generate correct vp9 args', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 60,
      width: 1280,
      height: 720,
      codec: 'vp9',
      crf: 30,
      preset: 'slow',
      pixelFormat: 'yuva420p',
      imageFormat: 'jpeg',
      outputPath: './out.webm'
    });

    expect(execa).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '0',
      '-vcodec', 'mjpeg'
    ]), { stdin: 'pipe' });
  });

  it('should generate correct prores args', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 24,
      width: 4096,
      height: 2160,
      codec: 'prores',
      crf: 0,
      preset: 'slow',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      outputPath: './out.mov'
    });

    expect(execa).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-c:v', 'prores_ks',
      '-profile:v', '3'
    ]), { stdin: 'pipe' });
  });

  it('should include audio input when provided', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      audioPath: './audio.mp3',
      outputPath: './out.mp4'
    });

    expect(execa).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-i', './audio.mp3',
      '-shortest'
    ]), { stdin: 'pipe' });
  });

  it('should emit encode-start event', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    const session = spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      outputPath: './out.mp4'
    });

    const listener = vi.fn();
    session.events.on('encode-start', listener);

    // Wait for next tick for setImmediate
    await new Promise(resolve => setImmediate(resolve));

    expect(listener).toHaveBeenCalledWith({
      type: 'encode-start',
      args: expect.any(Array)
    });
  });

  it('should calculate progress percentage when expectedDurationMs provided', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockStdout = { on: vi.fn() };
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: mockStdout
    };
    execa.mockReturnValue(mockProc as any);

    const session = spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      outputPath: './out.mp4',
      expectedDurationMs: 2000
    });

    const listener = vi.fn();
    session.events.on('encode-progress', listener);

    // Simulate FFmpeg progress output
    const dataHandler = mockStdout.on.mock.calls.find(call => call[0] === 'data')[1];
    dataHandler(Buffer.from('out_time_ms=1000\n'));

    expect(listener).toHaveBeenCalledWith({
      type: 'encode-progress',
      outTimeMs: 1000,
      percent: 50
    });
  });

  it('should use pad-video mode and omit -shortest', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      audioPath: './audio.mp3',
      audioMode: 'pad-video',
      videoPadSeconds: 2.5,
      outputPath: './out.mp4'
    });

    const args = execa.mock.calls[0][1];
    expect(args).toContain('-i');
    expect(args).toContain('./audio.mp3');
    expect(args).not.toContain('-shortest');
    expect(args).toContain('-vf');
    expect(args).toContain('tpad=stop_mode=clone:stop_duration=2.500');
  });

  it('should use shortest mode by default', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      audioPath: './audio.mp3',
      audioMode: 'shortest',
      outputPath: './out.mp4'
    });

    const args = execa.mock.calls[0][1];
    expect(args).toContain('-shortest');
    expect(args).not.toContain('-vf');
  });

  it('should select appropriate audio codec based on video codec', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    // Test h264 -> aac
    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      audioPath: './audio.mp3',
      audioCodec: 'auto',
      outputPath: './out.mp4'
    });

    let args = execa.mock.calls[0][1];
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
    expect(args).toContain('-b:a');
    expect(args).toContain('192k');

    vi.clearAllMocks();
    execa.mockReturnValue(mockProc as any);

    // Test vp9 -> libopus
    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'vp9',
      crf: 30,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      audioPath: './audio.mp3',
      audioCodec: 'auto',
      outputPath: './out.webm'
    });

    args = execa.mock.calls[0][1];
    expect(args).toContain('-c:a');
    expect(args).toContain('libopus');
    expect(args).toContain('-b:a');
    expect(args).toContain('128k');
  });

  it('should use explicit audio codec when specified', async () => {
    const { execa } = vi.mocked(await import('execa'));
    const mockProc = {
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() }
    };
    execa.mockReturnValue(mockProc as any);

    spawnFfmpeg({
      fps: 30,
      width: 1920,
      height: 1080,
      codec: 'h264',
      crf: 18,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      imageFormat: 'png',
      audioPath: './audio.mp3',
      audioCodec: 'copy',
      outputPath: './out.mp4'
    });

    const args = execa.mock.calls[0][1];
    expect(args).toContain('-c:a');
    expect(args).toContain('copy');
    expect(args).not.toContain('-b:a');
  });
});