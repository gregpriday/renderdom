import { z } from 'zod';

export const ConfigSchema = z.object({
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  fps: z.number().int().positive().default(60),
  startFrame: z.number().int().nonnegative().default(0),
  endFrame: z.number().int().optional(),
  concurrency: z.number().int().positive().optional(),
  codec: z.enum(['h264', 'vp9', 'prores']).default('h264'),
  crf: z.number().int().min(0).max(51).default(18),
  preset: z.string().default('medium'),
  pixelFormat: z.enum(['yuv420p', 'yuva420p']).default('yuv420p'),
  imageFormat: z.enum(['png', 'jpeg']).default('png'),
  imageQuality: z.number().int().min(0).max(100).default(92),
  audioPath: z.string().optional(),
  chromiumFlags: z.array(z.string()).default([]),
  pageUrl: z.string().optional(),
  html: z.string().optional(),
  frameTimeoutMs: z.number().int().positive().default(15000),
  verbose: z.boolean().optional(),
  debugFramesDir: z.string().optional(),
  adapterPath: z.string(),
  outputPath: z.string()
});

export type InternalConfig = z.infer<typeof ConfigSchema> & { totalFrames: number };