# RenderDOM

Frame-accurate DOM renderer with Playwright + FFmpeg and JSONL progress.

RenderDOM is a framework-agnostic video renderer that captures DOM animations frame-by-frame using Playwright browsers and encodes them to video using FFmpeg. It supports parallel capture with multiple workers and provides real-time progress feedback via JSON Lines (JSONL) format.

## Features

- **Framework-agnostic**: Works with any DOM-based animation (Anime.js, GSAP, React/Remotion, plain JS)
- **Frame-accurate rendering**: Deterministic frame capture based on `frameIndex / fps`
- **Parallel processing**: Multiple browser pages capture frames concurrently
- **Real-time progress**: JSONL output for integration with preview applications
- **Multiple codecs**: H.264, VP9, and ProRes support
- **Flexible input**: Load from URLs, HTML files, or inline HTML

## Installation

```bash
npm install renderdom
```

You'll also need FFmpeg installed on your system:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian  
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

## Quick Start

### CLI Usage

```bash
renderdom render \
  --adapter ./my-adapter.js \
  --html ./scene.html \
  --width 1920 --height 1080 --fps 60 \
  --codec h264 --crf 18 \
  --verbose \
  -o output.mp4
```

### Node.js API

```javascript
import { renderDOM } from 'renderdom';

const { events, promise } = renderDOM({
  adapterPath: './my-adapter.js',
  html: '<html>...</html>',
  width: 1920,
  height: 1080,
  fps: 60,
  outputPath: 'output.mp4'
});

// Listen to progress events
events.on('capture-progress', (e) => {
  console.log(`Progress: ${e.percent}% (${e.done}/${e.total})`);
});

// Wait for completion
const result = await promise;
console.log('Video saved to:', result.outputPath);
```

## Scene Adapters

RenderDOM uses **Scene Adapters** to control animation playback. An adapter is a JavaScript file that exposes a specific interface via `window.__RenderDOM__.adapter`.

### Basic Adapter Example

```javascript
// adapter.js
(function(){
  const DURATION_MS = 3000; // 3 second animation
  
  const adapter = {
    // Required: Return total duration in milliseconds
    getDurationMs() {
      return DURATION_MS;
    },
    
    // Required: Render a specific frame
    async renderFrame(frameIndex, fps) {
      const timeMs = (frameIndex / fps) * 1000;
      const progress = timeMs / DURATION_MS;
      
      // Animate your DOM elements
      const element = document.getElementById('my-element');
      element.style.transform = `translateX(${progress * 500}px)`;
    },
    
    // Optional: Preload assets
    async ensureAssets() {
      // Load images, fonts, etc.
    }
  };
  
  // Register the adapter
  window.__RenderDOM__ = { adapter };
})();
```

### Adapter Contract

```typescript
interface SceneAdapter {
  /** Total duration in milliseconds */
  getDurationMs(): number;
  
  /** Render a specific frame (must be deterministic) */
  renderFrame(frameIndex: number, fps: number): Promise<void> | void;
  
  /** Optional: Preload fonts, images, etc. */
  ensureAssets?(): Promise<void> | void;
}
```

**Important**: The `renderFrame` function must be **deterministic** - calling it with the same `frameIndex` and `fps` should always produce the same visual result.

## Progress Output (JSONL)

When using `--verbose` or the Node API, RenderDOM outputs progress as JSON Lines:

```json
{"type":"capture-start","totalFrames":180}
{"type":"capture-progress","done":45,"total":180,"percent":25,"frame":44}
{"type":"encode-progress","outTimeMs":1500000}
{"type":"done","outputPath":"output.mp4"}
```

Event types:
- `capture-start`: Frame capture begins
- `capture-progress`: Frame capture progress
- `encode-progress`: FFmpeg encoding progress  
- `done`: Rendering complete
- `error`: Error occurred

## CLI Reference

```bash
renderdom render [options]

Required:
  --adapter <path>     Path to adapter script (UMD/IIFE format)
  -o, --out <path>     Output video path

Video Options:
  --width <n>          Video width (default: 1920)
  --height <n>         Video height (default: 1080) 
  --fps <n>            Frames per second (default: 60)
  --start <n>          Start frame index (default: 0)
  --end <n>            End frame index (inclusive)

Source Options:
  --html <path>        Local HTML file to render
  --page-url <url>     External URL to load

Encoding Options:
  --codec <c>          h264|vp9|prores (default: h264)
  --crf <n>            Quality factor 0-51 (default: 18)
  --preset <s>         FFmpeg preset (default: medium)
  --pixfmt <p>         yuv420p|yuva420p (default: yuv420p)
  --image-format <f>   png|jpeg (default: png)
  --image-quality <n>  JPEG quality 0-100 (default: 92)
  --audio <path>       Audio file to merge

Performance Options:
  --concurrency <n>    Parallel browser pages (default: CPU cores / 2)

Browser Options:
  --chromium-flag <f>  Chromium flag (repeatable)

Output Options:
  --verbose            Emit JSONL progress to stdout
```

## Examples

### Basic Animation

```html
<!-- scene.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    #box {
      width: 100px;
      height: 100px;
      background: #4CAF50;
      position: absolute;
    }
  </style>
</head>
<body>
  <div id="box"></div>
</body>
</html>
```

```javascript
// adapter.js
(function(){
  const adapter = {
    getDurationMs: () => 2000,
    renderFrame(frameIndex, fps) {
      const progress = frameIndex / (fps * 2); // 2 second duration
      document.getElementById('box').style.left = (progress * 500) + 'px';
    }
  };
  window.__RenderDOM__ = { adapter };
})();
```

```bash
renderdom render \
  --adapter adapter.js \
  --html scene.html \
  --fps 30 \
  -o animation.mp4
```

### With Audio

```bash
renderdom render \
  --adapter adapter.js \
  --html scene.html \
  --audio background-music.mp3 \
  --fps 30 \
  -o video-with-audio.mp4
```

### High Quality Render

```bash
renderdom render \
  --adapter adapter.js \
  --html scene.html \
  --width 3840 --height 2160 \
  --fps 60 \
  --codec h264 --crf 12 --preset slow \
  --pixfmt yuv420p \
  -o high-quality.mp4
```

## Architecture

RenderDOM follows a modular architecture:

- **Orchestrator**: Coordinates the rendering pipeline
- **Browser Provider**: Manages Playwright browser instances  
- **Page Bridge**: Injects adapters and calls frame functions
- **Capture**: Takes screenshots of rendered frames
- **FFmpeg Encoder**: Pipes images to FFmpeg for video encoding
- **Progress Bus**: Emits real-time progress events

## Troubleshooting

### "page.waitForFunction: Timeout exceeded"

This usually means the adapter isn't loading properly:

1. Check that your adapter file exists and is readable
2. Verify the adapter exports `window.__RenderDOM__.adapter`
3. Make sure your HTML page loads without errors
4. Try increasing the timeout or reducing concurrency

### FFmpeg not found

Install FFmpeg and ensure it's in your PATH:

```bash
which ffmpeg  # Should return a path
ffmpeg -version  # Should show version info
```

### Poor performance

- Reduce `--concurrency` if experiencing crashes
- Use `--preset veryfast` for faster encoding
- Try `--image-format jpeg` with `--image-quality 85` for smaller pipes
- Profile your adapter code for performance bottlenecks

### Memory issues

- Lower concurrency (`--concurrency 1` or `--concurrency 2`)
- Use shorter duration renders for testing
- Add `--chromium-flag=--max-old-space-size=4096` for more memory

## Roadmap

- **v0.2**: Retry logic for failed frames and checksum validation
- **v0.3**: Disk-based frame caching mode for debugging
- **v0.4**: Audio mixing improvements (multiple tracks, offsets, fades)
- **v0.5**: Browser pool integration for cloud rendering
- **v1.0**: Virtual time driver for CSS/RAF animations

## License

MIT

## Contributing

Issues and pull requests welcome! Please ensure tests pass:

```bash
npm test
npm run build
```