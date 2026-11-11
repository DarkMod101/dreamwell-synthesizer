/* Dream Binder — lightweight, self-contained Dream Atlas analog snow. */
(() => {
  'use strict';
  const canvas = document.getElementById('dbAtlasStatic');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const frame = ctx.createImageData(w, h);
  const pixels = frame.data;
  const targetInterval = 1000 / 12;
  let rafId = 0, last = -Infinity, inView = true;
  function draw() {
    // Only a few tiny white snow grains per frame, transparent everywhere else.
    for (let i = 0; i < pixels.length; i += 4) {
      const grain = Math.random();
      pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
      pixels[i + 3] = grain > 0.72 ? Math.floor(130 + Math.random() * 125) : 0;
    }
    ctx.putImageData(frame, 0, 0);
  }
  function tick(now) {
    if (document.hidden || !inView) { rafId = 0; return; }
    if (now - last >= targetInterval) { draw(); last = now; }
    rafId = requestAnimationFrame(tick);
  }
  function start() {
    if (!rafId && !document.hidden && inView) { last = -Infinity; rafId = requestAnimationFrame(tick); }
  }
  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false;
      if (inView) start(); else stop();
    }, { threshold: 0 });
    observer.observe(canvas);
  } else start();
})();
