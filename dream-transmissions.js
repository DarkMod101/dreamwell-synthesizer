/* Dream Binder Dream Transmissions 08 — true WebP flipbook, no parallax or scanlines. */
(()=>{'use strict';
const $=id=>document.getElementById('dt-'+id);
const canvas=$('scene'),g=canvas.getContext('2d',{alpha:false});
const noise=$('crt'),nctx=noise.getContext('2d',{alpha:true});
const W=960,H=540,FPS=12,COUNT=120;
const names=['HOUSE OF MEMORIES','INFINITE CAR RIDE','CELESTIAL DOORWAY','NEVER ENDING FIELDS'];
const memories=['childhood-bedroom'];
let channel=0,memory=0,playing=false,raf=0,last=0,elapsed=0,noiseEnd=0,noiseStart=0,noiseDuration=520;
const frames=memories.map(folder=>Array.from({length:COUNT},(_,i)=>{
 const img=new Image();img.decoding='async';img.src=`assets/transmissions/house-of-memories/${folder}/${String(i).padStart(3,'0')}.webp`;return img;
}));
function ready(img){return img&&img.complete&&img.naturalWidth>0}
function label(){ $('channelTag').textContent=`CH ${String(channel+1).padStart(2,'0')} · ${names[channel]}`;}
function startNoise(duration=520){noiseStart=performance.now();noiseDuration=duration;noiseEnd=noiseStart+duration;$('tuning').classList.add('on');setTimeout(()=>$('tuning').classList.remove('on'),Math.min(duration,350));}
function drawNoise(now){const fuzz=Number($('fuzz').value)/100,active=now<noiseEnd;
 nctx.clearRect(0,0,480,270);if(!active&&fuzz===0)return;
 const strength=active?1:Math.min(.25,fuzz*.24);
 const block=active?3:6, cols=Math.ceil(480/block),rows=Math.ceil(270/block);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  if(!active&&Math.random()>fuzz*.15)continue;
  const gray=(Math.random()*255)|0;
  nctx.fillStyle=`rgba(${gray},${gray},${gray},${active?.94:strength})`;
  nctx.fillRect(x*block,y*block,block,block);
 }
}
function draw(now){g.fillStyle='#11101b';g.fillRect(0,0,W,H);
 if(channel===0){
  const index=Math.floor(elapsed*FPS)%COUNT,img=frames[memory][index];
  if(ready(img))g.drawImage(img,0,0,W,H);
  else {g.fillStyle='#ded0bf';g.font='24px sans-serif';g.textAlign='center';g.fillText('Loading childhood bedroom memory…',W/2,H/2);}
 }else{
  g.fillStyle='#b6a3c9';g.font='28px sans-serif';g.textAlign='center';g.fillText('DREAM TRANSMISSION NOT YET RECORDED',W/2,H/2);
  g.font='17px sans-serif';g.fillText('This channel is awaiting its flipbook images.',W/2,H/2+36);
 }
 drawNoise(now);
}
function frame(now){if(!playing||document.hidden)return;
 if(!last)last=now;const delta=Math.min(.12,(now-last)/1000);last=now;
 const speed=Number($('motion').value)/100;
 if(channel===0){elapsed+=delta*(.5+speed*1.5);if(elapsed>=10){elapsed%=10;}}
 draw(now);raf=requestAnimationFrame(frame);
}
function play(){if(playing)return;playing=true;last=0;$('play').textContent='❚❚ Pause';raf=requestAnimationFrame(frame)}
function pause(){playing=false;cancelAnimationFrame(raf);last=0;$('play').textContent='▶ Play'}
function setChannel(n){channel=(n+names.length)%names.length;$('channel').value=channel;memory=0;elapsed=0;label();startNoise();draw(performance.now())}
function open(){ $('modal').hidden=false;$('modal').setAttribute('aria-hidden','false');document.body.classList.add('dt-open');$('close').focus();play()}
function close(){pause();$('modal').hidden=true;$('modal').setAttribute('aria-hidden','true');document.body.classList.remove('dt-open');$('launch').focus()}
$('launch').addEventListener('click',open);$('close').addEventListener('click',close);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').hidden)close()});
$('prev').addEventListener('click',()=>setChannel(channel-1));$('next').addEventListener('click',()=>setChannel(channel+1));
$('channel').addEventListener('change',e=>setChannel(Number(e.target.value)));
$('play').addEventListener('click',()=>playing?pause():play());
$('mode').addEventListener('click',()=>{if(channel!==0)return;memory=0;elapsed=0;startNoise(350)});
$('fuzz').addEventListener('input',()=>{if(!playing)draw(performance.now())});
$('motion').addEventListener('input',()=>{if(!playing)draw(performance.now())});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);last=0}else if(playing)raf=requestAnimationFrame(frame)});
window.addEventListener('pagehide',pause);
window.DreamTransmissions={open,close,setChannel,setAudioLevel(){/* animation deliberately independent of audio */}};
label();draw(performance.now());
})();
