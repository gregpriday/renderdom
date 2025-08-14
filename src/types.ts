export interface SceneAdapter {
  /** total duration in milliseconds */
  getDurationMs(): number;
  /** called on each frame before screenshot; must be deterministic */
  renderFrame(frameIndex: number, fps: number): Promise<void> | void;
  /** optional: prefetch fonts/images/etc. */
  ensureAssets?(): Promise<void> | void;
  /** optional: post-frame hook (e.g., canvas.commit(), flush caches) */
  afterFrame?(): Promise<void> | void;
}

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  /** first frame index (inclusive) */
  startFrame?: number; // default 0
  /** last frame index (inclusive). If omitted, derived from duration & fps */
  endFrame?: number;
  concurrency?: number; // workers
  codec?: 'h264' | 'vp9' | 'prores';
  crf?: number; // e.g., 18 for h264
  preset?: string; // e.g., 'medium'
  pixelFormat?: 'yuv420p' | 'yuva420p';
  /** png or jpeg for pipe */
  imageFormat?: 'png' | 'jpeg';
  /** quality for jpeg 0..100 */
  imageQuality?: number;
  /** optional audio file to merge */
  audioPath?: string | null;
  /** headless chromium flags */
  chromiumFlags?: string[];
  /** custom page URL, default about:blank with inline HTML */
  pageUrl?: string;
  /** user‑provided HTML (data URL) if no pageUrl */
  html?: string;
  /** timeout per frame (ms) */
  frameTimeoutMs?: number;
  /** enable JSONL progress output */
  verbose?: boolean;
  /** debug: write frames to directory instead of encoding to video */
  debugFramesDir?: string;
  /** disable CSS animations/transitions for determinism (default: true) */
  disableCssAnimations?: boolean;
}

export interface EncodeResult { outputPath: string; }

export type RenderEvent =
  | { type: 'capture-start'; totalFrames: number }
  | { type: 'capture-progress'; done: number; total: number; percent: number; frame: number }
  | { type: 'encode-start'; args: string[] }
  | { type: 'encode-progress'; outTimeMs: number; percent?: number }
  | { type: 'done'; outputPath: string }
  | { type: 'error'; message: string };