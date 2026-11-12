/* Dream Binder living patch cables — visual-only; no audio engine changes. */
(()=>{
 'use strict';
 const shell=document.querySelector('.db-chassis');
 const atlas=document.querySelector('.db-hero-art');
 const display=document.querySelector('.db-hero-studio');
 const monitor=document.querySelector('.db-monitor-row');
 const mesh=document.querySelector('.db-console-top.db-workstation-mesh');
 if(!shell||!atlas||!display||!monitor||!mesh)return;
 const NS='http://www.w3.org/2000/svg';
 const make=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.appendChild(e);return e;};
 const wires=[0,1].map((_,i)=>{
  const svg=make('svg',{class:'db-living-cable','aria-hidden':'true',focusable:'false'},shell);
  const paths=['cable-shadow','cable-jacket','cable-glass','cable-core','cable-pulse'].map(cls=>make('path',{class:cls},svg));
  return {svg,paths,i,box:null};
 });
 let spring=0,velocity=0,lastScroll=window.scrollY,lastTime=performance.now(),raf=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function rect(el){const a=el.getBoundingClientRect(),b=shell.getBoundingClientRect();return {l:a.left-b.left,r:a.right-b.left,t:a.top-b.top,b:a.bottom-b.top,w:a.width,h:a.height};}
 function layout(){
  const a=rect(atlas),d=rect(display),m=rect(monitor),p=rect(mesh),w=shell.clientWidth;
  // First wire: between Atlas and display. Works for both side-by-side and stacked layouts.
  let box1;
  if(d.l>=a.r-6 && Math.abs(d.t-a.t)<Math.max(a.h,d.h)*.65){
   const left=a.r-6,right=d.l+6,top=Math.max(a.t,d.t)+Math.min(a.h,d.h)*.52;
   box1={x:left,y:top-22,w:Math.max(12,right-left),h:44,vertical:false};
  }else{
   const top=a.b-5,bottom=d.t+5;
   box1={x:Math.max(15,w*.22),y:top,w:Math.max(22,w*.23),h:Math.max(12,bottom-top),vertical:true};
  }
  // Second wire: narrow visible connection between monitor and workstation mesh.
  const y=m.b-5, bottom=p.t+5;
  const box2={x:Math.max(12,w*.69),y,w:Math.max(24,w*.14),h:Math.max(12,bottom-y),vertical:true};
  [box1,box2].forEach((b,i)=>{const v=wires[i];v.box=b;Object.assign(v.svg.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'});v.svg.setAttribute('viewBox',`0 0 ${b.w} ${b.h}`);});
  draw();
 }
 function draw(){for(const v of wires){const b=v.box;if(!b)continue;let path;
  const sway=reduced.matches?0:spring*(v.i?-.65:1);
  if(b.vertical){const x=b.w*.49;path=`M ${x} 0 C ${x+7+sway} ${b.h*.24}, ${x-10+sway} ${b.h*.72}, ${x+3} ${b.h}`;}
  else {const y=b.h*.5;path=`M 0 ${y-3} C ${b.w*.32} ${y-9+sway}, ${b.w*.65} ${y+9+sway}, ${b.w} ${y+2}`;}
  for(const p of v.paths)p.setAttribute('d',path);
 }}
 function tick(){raf=0;velocity*=.82;spring+=(velocity-spring)*.18;spring*=.82;draw();if(Math.abs(spring)>.035||Math.abs(velocity)>.035)raf=requestAnimationFrame(tick);}
 function onScroll(){const now=performance.now(),delta=window.scrollY-lastScroll;lastScroll=window.scrollY;lastTime=now;if(!reduced.matches){velocity=Math.max(-8,Math.min(8,velocity+delta*.055));if(!raf)raf=requestAnimationFrame(tick);}}
 window.addEventListener('scroll',onScroll,{passive:true});
 window.addEventListener('resize',layout,{passive:true});
 window.addEventListener('orientationchange',()=>setTimeout(layout,220),{passive:true});
 if('ResizeObserver'in window){const ro=new ResizeObserver(layout);[shell,atlas,display,monitor,mesh].forEach(el=>ro.observe(el));}
 layout();
})();
