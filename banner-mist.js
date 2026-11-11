/* Dream Binder: visible, gentle mist in the banner, isolated from audio. */
(() => {
  'use strict';
  const canvas = document.getElementById('dbBannerMist');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const W = 480, H = 120, FPS = 18;
  canvas.width = W; canvas.height = H;
  const sprite = document.createElement('canvas');
  sprite.width = 160; sprite.height = 64;
  const sc = sprite.getContext('2d', {alpha:true});
  if (!sc) return;
  // Build a soft wisp once; only the sprite moves during playback.
  [[26,38,29,17,.55],[53,28,38,21,.48],[88,35,45,19,.50],
   [121,29,35,18,.45],[76,48,51,14,.34]].forEach(([x,y,rx,ry,a]) => {
    sc.save(); sc.translate(x,y); sc.scale(rx,ry);
    const g=sc.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,`rgba(248,246,255,${a})`);
    g.addColorStop(.5,`rgba(237,229,255,${a*.55})`);
    g.addColorStop(1,'rgba(237,229,255,0)');
    sc.fillStyle=g; sc.beginPath(); sc.arc(0,0,1,0,Math.PI*2); sc.fill(); sc.restore();
  });
  const wisps = Array.from({length:8},(_,i)=>({
    x: (i*83)%590-130,
    y: 34+(i*17)%61,
    speed: (i%3===0?-1:1)*(13+(i%4)*2.5),
    width: 138+(i%3)*29,
    height: 35+(i%3)*7,
    alpha: .52+(i%3)*.09
  }));
  let raf=0, last=0, previous=0;
  function frame(t) {
    raf=0;
    if(document.hidden || reduced.matches) return;
    raf=requestAnimationFrame(frame);
    if(t-last<1000/FPS) return;
    const dt=Math.min((t-(previous||t))/1000,.12);
    last=t; previous=t;
    ctx.clearRect(0,0,W,H);
    for(const w of wisps){
      w.x+=w.speed*dt;
      if(w.speed>0 && w.x>W+25) w.x=-w.width;
      if(w.speed<0 && w.x< -w.width-25) w.x=W+15;
      ctx.globalAlpha=w.alpha;
      ctx.drawImage(sprite,w.x,w.y-w.height/2,w.width,w.height);
    }
    ctx.globalAlpha=1;
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function start(){if(!raf && !document.hidden && !reduced.matches){previous=0;last=0;raf=requestAnimationFrame(frame);}}
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  if(reduced.addEventListener) reduced.addEventListener('change',()=>reduced.matches?stop():start());
  else reduced.addListener(()=>reduced.matches?stop():start());
  start();
})();
