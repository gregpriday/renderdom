// Collection of bad adapter examples for testing contract validation

// Adapter missing getDurationMs
export const missingGetDurationMs = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter missing renderFrame
export const missingRenderFrame = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; }
    }
  };
})();
`;

// Adapter with invalid getDurationMs return type
export const invalidDurationReturn = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return "not a number"; },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter with negative duration
export const negativeDuration = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return -1000; },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter with zero duration
export const zeroDuration = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 0; },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter that throws during getDurationMs
export const throwingGetDuration = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { 
        throw new Error('Duration calculation failed');
      },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter that throws during renderFrame
export const throwingRenderFrame = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      renderFrame(frameIndex, fps) {
        if (frameIndex > 5) {
          throw new Error('Render failed at frame ' + frameIndex);
        }
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter that uses time-dependent rendering (non-deterministic)
export const timeDependentAdapter = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 2000; },
      renderFrame(frameIndex, fps) {
        // BAD: Uses Date.now() making frames non-deterministic
        const timestamp = Date.now();
        const color = 'hsl(' + (timestamp % 360) + ', 70%, 50%)';
        document.body.style.background = color;
        document.body.innerHTML = '<div>Frame ' + frameIndex + ' at ' + timestamp + '</div>';
      }
    }
  };
})();
`;

// Adapter that uses random values (non-deterministic)
export const randomAdapter = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      renderFrame(frameIndex, fps) {
        // BAD: Uses Math.random() making frames non-deterministic
        const x = Math.random() * 300;
        const y = Math.random() * 200;
        document.body.innerHTML = '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;">Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter with slow renderFrame (for timeout testing)
export const slowRenderFrame = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      async renderFrame(frameIndex, fps) {
        // Simulate slow operation that will trigger timeout
        await new Promise(resolve => setTimeout(resolve, 5000));
        document.body.innerHTML = '<div>Slow frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter with slow ensureAssets (for timeout testing)
export const slowEnsureAssets = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      async ensureAssets() {
        // Simulate slow asset loading
        await new Promise(resolve => setTimeout(resolve, 10000));
      },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter with invalid ensureAssets return
export const invalidEnsureAssets = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      ensureAssets() {
        return "not a promise";
      },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      }
    }
  };
})();
`;

// Adapter with afterFrame that throws
export const throwingAfterFrame = `
(function(){
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      renderFrame(frameIndex, fps) {
        document.body.innerHTML = '<div>Frame ' + frameIndex + '</div>';
      },
      afterFrame() {
        throw new Error('afterFrame failed');
      }
    }
  };
})();
`;

// Adapter that modifies global state incorrectly
export const globalStateAdapter = `
(function(){
  // BAD: Uses global counter instead of frame-based calculation
  window.globalFrameCounter = 0;
  
  window.__RenderDOM__ = { 
    adapter: {
      getDurationMs() { return 1000; },
      renderFrame(frameIndex, fps) {
        // BAD: Increments global counter instead of using frameIndex
        window.globalFrameCounter++;
        document.body.innerHTML = '<div>Global counter: ' + window.globalFrameCounter + '</div>';
      }
    }
  };
})();
`;

// Empty adapter (missing __RenderDOM__)
export const emptyAdapter = `
// Empty file - no __RenderDOM__ defined
console.log('Empty adapter loaded');
`;

// Adapter with malformed __RenderDOM__
export const malformedRenderDOM = `
(function(){
  window.__RenderDOM__ = "not an object";
})();
`;

// Adapter with malformed adapter object
export const malformedAdapter = `
(function(){
  window.__RenderDOM__ = { 
    adapter: "not an object"
  };
})();
`;