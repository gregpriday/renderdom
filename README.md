# RenderDOM

**Frame‑accurate DOM renderer** powered by **Playwright** + **FFmpeg**, with real‑time **JSONL** progress.

RenderDOM captures web/DOM animations deterministically—one frame at a time—inside headless Chromium, then pipes images to FFmpeg to produce a video. It supports parallel capture, multiple codecs, and a minimal "scene adapter" contract for precise control. Defaults and CLI/API contracts below mirror the implementation in @src/cli.ts, @src/config.ts, @src/orchestrator.ts, and @src/encode/ffmpeg.ts.

---

## Highlights

* **Framework‑agnostic:** Works with plain JS, Anime.js, GSAP, React/Remotion, etc.
* **Deterministic, frame‑accurate:** You set state for each frame `t = frameIndex / fps`. CSS animations are frozen by default for repeatability.
* **Parallel capture:** Multiple Chromium pages capture frames concurrently. Default concurrency ≈ half the CPU cores.
* **Real‑time progress:** Optional JSON Lines (JSONL) to stdout, plus programmatic events.
* **Codecs:** H.264, VP9, ProRes; pixel formats `yuv420p|yuva420p`.
* **Flexible input:** Inline HTML, local file, or external page URL.

---

## Requirements

* **Node.js 20+** (as enforced by @package.json `"engines"`).
* **FFmpeg** available on your PATH.
* **Playwright** is bundled as a dependency; if a browser launch fails, run `npx playwright install` once.

---

## Install

```bash
npm install renderdom
```

You'll also need FFmpeg:

* macOS: `brew install ffmpeg`
* Debian/Ubuntu: `sudo apt install ffmpeg`
* Windows: downloads at ffmpeg.org

(The CLI is exposed as the `renderdom` binary from the package `bin` field.)

---

## Quick start

### 1) CLI

```bash
renderdom render \
  --adapter ./my-adapter.js \
  --html ./scene.html \
  --width 1920 --height 1080 --fps 60 \
  --codec h264 --crf 18 --preset medium \
  --pixfmt yuv420p \
  --audio ./music.mp3 --audio-mode pad-video \
  --verbose \
  -o output.mp4
```

* `--adapter` must point to a browser‑runnable script that registers `window.__RenderDOM__.adapter` (UMD/IIFE is simplest). See "Scene Adapters."

### 2) Node API

```ts
import { renderDOM } from 'renderdom';

const { events, promise, cancel } = renderDOM({
  adapterPath: './my-adapter.js',
  html: '<!doctype html><html><body></body></html>',
  width: 1920,
  height: 1080,
  fps: 60,
  audioPath: './track.wav',
  audioMode: 'pad-video',
  outputPath: 'output.mp4',
  verbose: true
});

// Optional progress
events.on('capture-progress', (e) => {
  console.log(`Capture ${e.done}/${e.total} (${e.percent.toFixed(1)}%)`);
});

// Await completion
const { outputPath } = await promise;
console.log('Saved:', outputPath);

// cancel() exists (cooperative for now)
```

The API returns `{ events, promise, cancel }`. Events include `capture-start`, `capture-progress`, `encode-start`, `encode-progress`, `done`, and `error` (see @src/types.ts).

---

## Scene Adapters

A **scene adapter** is a tiny script that **deterministically** sets your DOM to the exact state for a given frame/time. Register it on `window.__RenderDOM__.adapter`.

**Contract (minimal & deterministic)**

```ts
{
  getDurationMs(): number;                         // total duration in ms
  renderFrame(frameIndex: number, fps: number):    // set DOM to state at t = fi/fps
    void | Promise<void>;
  ensureAssets?(): Promise<void>;                  // optional preload step
  afterFrame?(): Promise<void>;                    // optional post-commit hook
}
```

Rules enforced by the capture pipeline in @src/browser/page-bridge.ts and @src/orchestrator.ts:

* `renderFrame(fi,fps)` must compute state **purely** from `fi` and `fps` (no `Date.now()`, timers, or ambient timelines).
* RenderDOM inserts CSS to **freeze animations/transitions by default**; rely on your adapter to set styles.
* If you return a promise (e.g., to finish a decode), it's awaited; then RenderDOM waits for paint, fonts (and optionally image decode via `waitImages`) before screenshotting.

**Example (UMD/IIFE style)**
@examples/basic-scene/adapter.js shows a simple moving box animation, loaded by @examples/basic-scene/index.html. You can run it via @examples/basic-scene/run.mjs.

---

## CLI reference

Command: `renderdom render` (see @src/cli.ts)

**Required**

* `--adapter <path>` Path to adapter script (UMD/IIFE recommended; must set `window.__RenderDOM__.adapter`).
* `-o, --out <path>` Output video path.

**Video**

* `--width <n>` default **1920**
* `--height <n>` default **1080**
* `--fps <n>` default **60**
* `--start <n>` start frame (default **0**)
* `--end <n>` end frame (**inclusive**)

**Source**

* `--html <path>` Local HTML file to **inline** (read and embedded as a data URL).
* `--page-url <url>` Load an external URL instead.

**Encoding**

* `--codec <c>` `h264|vp9|prores` (default **h264**)
* `--crf <n>` (0–51, default **18**)
* `--preset <s>` FFmpeg preset (default **medium**)
* `--pixfmt <p>` `yuv420p|yuva420p` (default **yuv420p**)
* `--image-format <f>` `png|jpeg` (default **png**)
* `--image-quality <n>` JPEG quality 0–100 (default **92**)
* `--audio <path>` Optional audio file (MP3/WAV, etc.)
* `--audio-mode shortest|pad-video` 
  *shortest* (default): truncate to the shorter stream.
  *pad-video*: if audio is longer, freeze the last video frame to match audio.
* `--audio-codec auto|aac|libopus|pcm_s16le|copy` (optional)

**Performance**

* `--concurrency <n>` Number of parallel pages (default: `max(1, floor(cpuCount/2))`).

**Browser**

* `--chromium-flag <flag>` Repeatable Chromium flag (merged with safe defaults in @src/browser/provider.ts).

**Determinism**

* `--disable-css-animations` Disables CSS animations/transitions. **This behavior is enabled by default** in the pipeline unless you explicitly turn it off in code/config. (The CLI help string currently says "default: false," but the effective default in @src/config.ts and @src/orchestrator.ts is **true**.)

**Output & diagnostics**

* `--debug-frames-dir <path>` Write numbered frames to a directory **instead of** encoding to a video (useful in tests/golden runs).
  Files are zero‑padded (e.g., `000000.png`) and use `.png` or `.jpg` based on `--image-format`.
* `--verbose` Emit JSONL progress to stdout.

---

## API reference

`renderDOM(config)` returns `{ events, promise, cancel }`. The resolved value from `promise` is `{ outputPath }`. Event names and payloads are defined in @src/types.ts.

**Config (with defaults from @src/config.ts):**

* `width` **1920**, `height` **1080**, `fps` **60**
* `startFrame` **0**, `endFrame` optional (if omitted: derived from adapter duration and fps)
* `concurrency` optional (default computed from CPU cores)
* `codec` **'h264'**, `crf` **18**, `preset` **'medium'**, `pixelFormat` **'yuv420p'**
* `imageFormat` **'png'**, `imageQuality` **92**
* `audioPath` optional
* `audioMode` **'shortest'** | `'pad-video'`
* `audioCodec` **'auto'** | `'aac'` | `'libopus'` | `'pcm_s16le'` | `'copy'`
* `chromiumFlags` `string[]` (default `[]`)
* `pageUrl` optional, `html` optional (inline HTML string)
* `frameTimeoutMs` **15000**
* `verbose` optional
* `debugFramesDir` optional
* `disableCssAnimations` **true** (effective default)

**Adapter duration → frame count:**
When `endFrame` is omitted, total frames are computed from `adapter.getDurationMs()` and `fps`. When `startFrame`/`endFrame` are provided, `endFrame` is **inclusive**. See @src/orchestrator.ts.

**Events & JSONL:**
If `verbose: true`, JSONL is written to stdout, and the same events are emitted on the `events` emitter:
`capture-start`, `capture-progress`, `encode-start`, `encode-progress`, `done`, `error`. See @src/progress.ts and tests under @tests/*.

---

## Examples

* **Basic moving box**: @examples/basic-scene (HTML + adapter + runner).
  Try `node examples/basic-scene/run.mjs` from the repo root to render a 1080p60 H.264 MP4 with JSONL progress.

* **Golden‑frame testing**: `npm run update-golden` uses @scripts/generate-golden.mjs to produce PNG frames for regression comparison in @tests/golden.

---

## How it works (architecture)

* **Orchestrator** allocates pages, sequences frames, and manages queues.
* **Browser provider** launches Chromium and sets viewport.
* **Page bridge** injects your adapter, calls `renderFrame`, waits for paint/fonts/images, and applies `afterFrame`.
* **Capture** takes a screenshot buffer (`png` or `jpeg`).
* **Encoder** streams images via `image2pipe` into FFmpeg with the requested codec, pixel format, and CRF/preset.
* **Progress bus** optionally writes JSONL to stdout and emits events.
  See @src/orchestrator.ts, @src/browser/*, @src/capture.ts, @src/encode/ffmpeg.ts, and @src/progress.ts.

---

## Progress output (JSONL)

Example (stdout when `--verbose` or `verbose: true`):

```
{"type":"capture-start","totalFrames":180}
{"type":"capture-progress","done":45,"total":180,"percent":25,"frame":44}
{"type":"encode-start","args":["-f","image2pipe", "..."]}
{"type":"encode-progress","outTimeMs":1500000,"percent":83.33}
{"type":"done","outputPath":"output.mp4"}
```

`encode-progress.percent` is computed when an expected duration is known (the orchestrator provides it).

---

## Troubleshooting

* **Adapter not found / not registering**
  Ensure your file exists and sets `window.__RenderDOM__.adapter`. The CLI inlines `--html` or loads `--page-url`, injects the adapter code via `page.evaluate`, and waits until the adapter is present.

* **Timeouts** (e.g., "Timeout: renderFrame(...) after 15000ms")
  Long per‑frame work can exceed `frameTimeoutMs` (default 15000). Optimize your adapter, reduce concurrency, or raise the timeout via the API.

* **FFmpeg not found**
  Confirm `ffmpeg -version` works and is on PATH. The encoder is spawned as `ffmpeg` with `image2pipe`.

* **Crashes or OOM under load**
  Lower `--concurrency`, try `--preset veryfast`, or switch to `--image-format jpeg --image-quality 85` to reduce pipe size. You can also pass Chromium flags like `--max-old-space-size=4096`.

* **Need visual diffs/tests**
  Use `--debug-frames-dir` to capture PNGs and compare them to a golden baseline (see @tests/golden and @tests/golden.spec.ts).

---

## Roadmap

* v0.2: Retry logic for failed frames and checksums
* v0.3: Disk‑based frame cache (debugging)
* v0.4: Audio mixing (multi‑track, offsets, fades)
* v0.5: Browser pool for cloud workloads
* v1.0: Virtual‑time driver for CSS/RAF animations
  (Adapted from the existing roadmap and kept as guidance.)

---

## Contributing

PRs and issues welcome. Run tests locally:

```bash
npm test
npm run build
```

The repo includes smoke, CLI, encoder, page‑bridge, progress, and golden‑frame tests under @tests/*.

---

## License

MIT (see @LICENSE).

---

### Notes on this revision

* Clarified **effective defaults** from the code (e.g., `disableCssAnimations` defaults to **true** in config/orchestrator even though the CLI help text says "default: false").
* Documented the **`cancel()`** API and **inclusive `endFrame`** behavior.
* Linked concrete examples and testing flows in **@examples/** and **@tests/**.

If you'd like, I can also convert this into a PR‑ready markdown file staged to replace @README.md.