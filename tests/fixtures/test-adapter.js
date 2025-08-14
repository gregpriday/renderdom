(function(){
  // Deterministic test adapter following RenderDOM contract:
  // - renderFrame(fi, fps) sets exact state at t = fi/fps
  // - No reliance on Date.now() or ambient timelines  
  // - Pure mathematical computation for bouncing ball animation
  
  const DURATION_MS = 1000; // 1 second for faster tests
  
  const adapter = {
    getDurationMs() { 
      return DURATION_MS; 
    },
    
    async ensureAssets() {
      // No assets needed for test
    },
    
    async renderFrame(frameIndex, fps) {
      // Create deterministic bouncing ball animation
      const timeMs = (frameIndex / fps) * 1000;
      const progress = Math.min(1, timeMs / DURATION_MS);
      
      // Clear any existing content
      document.body.innerHTML = '';
      
      // Create container with gradient background
      const container = document.createElement('div');
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(45deg, #2196F3, #21CBF3);
      `;
      
      // Create bouncing ball
      const ball = document.createElement('div');
      
      // Ball moves horizontally across screen
      const x = Math.floor(progress * 250); // Move 0 to 250px
      
      // Ball bounces vertically using sine wave
      const bounceHeight = 100;
      const bounceSpeed = progress * Math.PI * 4; // 4 bounces over duration
      const y = 50 + Math.abs(Math.sin(bounceSpeed)) * bounceHeight;
      
      ball.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${Math.floor(y)}px;
        width: 30px;
        height: 30px;
        background: radial-gradient(circle at 30% 30%, #ffff00, #ff6600);
        border-radius: 50%;
        box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      `;
      
      container.appendChild(ball);
      
      // Add trail effect (previous ball positions)
      for (let i = 1; i <= 3; i++) {
        if (frameIndex >= i) {
          const prevProgress = Math.min(1, ((frameIndex - i) / fps) * 1000 / DURATION_MS);
          const prevX = Math.floor(prevProgress * 250);
          const prevBounceSpeed = prevProgress * Math.PI * 4;
          const prevY = 50 + Math.abs(Math.sin(prevBounceSpeed)) * bounceHeight;
          
          const trail = document.createElement('div');
          trail.style.cssText = `
            position: absolute;
            left: ${prevX}px;
            top: ${Math.floor(prevY)}px;
            width: 30px;
            height: 30px;
            background: rgba(255, 255, 0, ${0.3 / i});
            border-radius: 50%;
          `;
          container.appendChild(trail);
        }
      }
      
      // Add frame number text for debugging
      const text = document.createElement('div');
      text.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 10px;
        color: white;
        font-family: monospace;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 1px 1px 1px black;
        background: rgba(0,0,0,0.5);
        padding: 4px 8px;
        border-radius: 4px;
      `;
      text.textContent = `Frame: ${frameIndex}`;
      container.appendChild(text);
      
      document.body.appendChild(container);
    }
  };

  window.__RenderDOM__ = { adapter };
})();