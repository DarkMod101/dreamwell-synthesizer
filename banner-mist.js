/* Dream Binder: animated mist below the piano bridge.
   Small offscreen sprite, 15 FPS cap, no external assets or audio hooks. */
(() => {
  'use strict';
  const canvas = document.getElementById('dbBannerMist');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const W = 360, H = 100, FPS = 15;
  canvas.width = W; canvas.height = H;
  const sprite = document.createElement('canvas');
  sprite.width = 128; sprite.height = 56;
  const sc = sprite.getContext('2d');
  if (!sc) return;
  // Pre-render a diffuse, irregular wisp just once. No costly blur filter.
  const spots = [
    [27,34,31,18,.27], [49,25,35,17,.23], [73,35,39,18,.26],
    [95,27,30,15,.22], [58,43,45,13,.19], [17,43,24,12,.16]
  ];
  for (const [x,y,rx,ry,alpha] of spots) {
    sc.save();sc.translate(x,y);sc.scale(rx,ry);
    const g=sc.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,`rgba(250,247,255,${alpha})`);
    g.addColorStop(.45,`rgba(240,233,255,${alpha*.55})`);
    g.addColorStop(1,'rgba(240,233,255,0)');
    sc.fillStyle=g;sc.beginPath();sc.arc(0,0,1,0,Math.PI*2);sc.fill();sc.restore();
  }
  // Different speeds and heights create visible, gentle drifting.
  const wisps = Array.from({length:9}, (_,i)=>({
    x:(i*71+13)%470-110, y:22+(i*19)%58,
    speed:(i%3===0?-1:1)*(2.8+(i%4)*1.15),
    width:108+(i%3)*37, height:32+(i%4)*5,
    alpha:.38+(i%3)*.1
  }));
  let raf=0, last=0, previous=0;
  const render=(t)=>{
    raf=0;
    if(document.hidden || reduced.matches) return;
    if(t-last<1000/FPS){raf=requestAnimationFrame(render);return;}
    const dt=Math.min((t-(previous||t))/1000,.12);
    previous=t;last=t;
    ctx.clearRect(0,0,W,H);
    for(const w of wisps){
      w.x+=w.speed*dt;
      if(w.speed>0 && w.x>W+30) w.x=-w.width;
      if(w.speed<0 && w.x<-w.width-30) w.x=W+15;
      ctx.globalAlpha=w.alpha;
      ctx.drawImage(sprite,w.x,w.y-w.height/2,w.width,w.height);
    }
    ctx.globalAlpha=1;
    raf=requestAnimationFrame(render);
  };
  const start=()=>{if(!raf && !document.hidden && !reduced.matches){previous=0;raf=requestAnimationFrame(render);}};
  const stop=()=>{if(raf)cancelAnimationFrame(raf);raf=0;};
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  if(reduced.addEventListener)reduced.addEventListener('change',()=>reduced.matches?stop():start());
  else if(reduced.addListener)reduced.addListener(()=>reduced.matches?stop():start());
  start();
})();
