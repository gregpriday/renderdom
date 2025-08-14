(function(){
  const DURATION_MS = 2000;
  const box = () => document.getElementById('box');

  const adapter = {
    getDurationMs(){ return DURATION_MS; },
    async ensureAssets(){},
    async renderFrame(frameIndex, fps){
      const t = frameIndex / fps; // seconds
      // move 0 -> 1720px over DURATION
      const px = Math.min(1720, (frameIndex / (fps * (DURATION_MS/1000))) * 1720);
      box().style.left = px + 'px';
    }
  };

  window.__RenderDOM__ = { adapter };
})();