import { z } from 'zod';

export const ConfigSchema = z.object({
  width: z.number().int().positive().max(8192, 'Width cannot exceed 8192 pixels').default(1920),
  height: z.number().int().positive().max(8192, 'Height cannot exceed 8192 pixels').default(1080),
  fps: z.number().int().positive().max(240, 'FPS cannot exceed 240').default(60),
  startFrame: z.number().int().nonnegative().default(0),
  endFrame: z.number().int().optional(),
  concurrency: z.number().int().positive().max(32, 'Concurrency cannot exceed 32').optional(),
  codec: z.enum(['h264', 'vp9', 'prores']).default('h264'),
  crf: z.number().int().min(0).max(51).default(18),
  preset: z.string().default('medium'),
  pixelFormat: z.enum(['yuv420p', 'yuva420p']).default('yuv420p'),
  imageFormat: z.enum(['png', 'jpeg']).default('png'),
  imageQuality: z.number().int().min(0).max(100).default(92),
  audioPath: z.string().optional(),
  audioMode: z.enum(['shortest', 'pad-video']).default('shortest'),
  audioCodec: z.enum(['auto', 'aac', 'libopus', 'pcm_s16le', 'copy']).default('auto'),
  chromiumFlags: z.array(z.string()).default([]),
  disableChromiumSandbox: z.boolean().default(true),
  pageUrl: z.string().optional(),
  html: z.string().optional(),
  frameTimeoutMs: z.number().int().positive().default(15000),
  verbose: z.boolean().optional(),
  debugFramesDir: z.string().optional(),
  disableCssAnimations: z.boolean().default(true),
  adapterPath: z.string(),
  outputPath: z.string()
}).refine(
  (d) => d.endFrame === undefined || d.startFrame <= d.endFrame,
  { message: 'endFrame must be >= startFrame', path: ['endFrame'] }
);

export type InternalConfig = z.infer<typeof ConfigSchema> & { totalFrames: number };