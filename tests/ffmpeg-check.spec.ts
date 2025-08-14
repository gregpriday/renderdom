import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkFfmpegAvailability, validateFfmpegRequirements } from '../src/utils/ffmpeg-check.js';
import { execa } from 'execa';

vi.mock('execa');

const mockExeca = execa as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.resetAllMocks();
});

describe('FFmpeg checks', () => {
  it('detects when both ffmpeg and ffprobe are available', async () => {
    mockExeca.mockResolvedValue({} as any);
    const result = await checkFfmpegAvailability();
    expect(result).toEqual({ ffmpeg: true, ffprobe: true, errors: [] });
  });

  it('reports when ffmpeg is missing', async () => {
    mockExeca.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOENT' }));
    mockExeca.mockResolvedValueOnce({} as any);
    const result = await checkFfmpegAvailability();
    expect(result.ffmpeg).toBe(false);
    expect(result.errors[0]).toMatch(/FFmpeg not found/);
  });

  it('reports when ffprobe is required but missing', async () => {
    mockExeca.mockResolvedValueOnce({} as any);
    mockExeca.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOENT' }));
    await expect(validateFfmpegRequirements(true)).rejects.toThrow(/FFprobe is required/);
  });

  it('propagates unexpected errors', async () => {
    mockExeca.mockRejectedValueOnce(new Error('boom'));
    const result = await checkFfmpegAvailability();
    expect(result.errors[0]).toMatch(/FFmpeg check failed/);
  });
});