(()=>{'use strict';
const $=id=>document.getElementById(id),modal=$('dm-modal'),pad=$('dm-pad');
if(!modal||!pad||!$('dm-launch'))return;
const ids=[['cutoff','Filter Cutoff'],['resonance','Filter Resonance'],['waveFusion','Wave Fusion'],['coherence','Coherence'],['decoherence','Decoherence'],['presence','Presence'],['deepDreamOrbit','Deep Dream Orbit'],['stereoWidth','Stereo Width'],['reverbMix','Reverb Mix'],['delayMix','Delay Mix'],['noiseAmount','Noise Amount'],['polynomialRingAmount','Polynomial Ring Amount'],['fmAmount','FM Amount']];
// Only expose controls backed by real range inputs. Checkboxes cannot accept continuous XY values.
const controls=ids.filter(([id])=>{const el=$(id);return el&&el.type==='range'&&Number.isFinite(Number(el.min))&&Number.isFinite(Number(el.max))&&Number(el.max)>Number(el.min)});
if(!controls.length){$('dm-launch').disabled=true;$('dm-launch').title='No compatible sound parameters found';return}
const selects=[$('dm-x'),$('dm-y')];for(const select of selects){for(const [id,label] of controls){const opt=document.createElement('option');opt.value=id;opt.textContent=label;select.append(opt)}}
selects[0].value=controls.some(([id])=>id==='cutoff')?'cutoff':controls[0][0];selects[1].value=controls.some(([id])=>id==='resonance')?'resonance':controls[Math.min(1,controls.length-1)][0];
let x=.5,y=.5,dragging=false,activePointer=null,previousFocus=null,raf=0,last=0,phase=0,orbitRadius=.3;
const clamp=v=>Math.max(0,Math.min(1,v));
function apply(id,p){const el=$(id);if(!el||el.type!=='range')return;const min=Number(el.min),max=Number(el.max),step=Number(el.step);let val=min+(max-min)*clamp(p);if(Number.isFinite(step)&&step>0)val=min+Math.round((val-min)/step)*step;val=Math.max(min,Math.min(max,val));if(Number(el.value)===val)return;el.value=String(val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function set(nx,ny){x=clamp(nx);y=clamp(ny);$('dm-orb').style.left=$('dm-trace').style.left=(x*100)+'%';$('dm-orb').style.top=$('dm-trace').style.top=((1-y)*100)+'%';pad.setAttribute('aria-valuenow',String(Math.round(x*100)));$('dm-values').textContent='X '+Math.round(x*100)+'% · Y '+Math.round(y*100)+'%';apply(selects[0].value,x);if(selects[1].value!==selects[0].value)apply(selects[1].value,y)}
function move(e){const r=pad.getBoundingClientRect();if(!r.width||!r.height)return;set((e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height)}
function stopOrbit(){if(raf)cancelAnimationFrame(raf);raf=0;last=0}
function tick(now){if(modal.hidden||!$('dm-orbit').checked||document.hidden){stopOrbit();return}if(!last)last=now;const dt=Math.min(.08,(now-last)/1000);last=now;const speed=Number($('dm-orbit-speed').value)||.3;phase+=dt*speed*Math.PI*2;if(!dragging)set(.5+orbitRadius*Math.cos(phase),.5+orbitRadius*Math.sin(phase));raf=requestAnimationFrame(tick)}
function startOrbit(){if(raf||modal.hidden||!$('dm-orbit').checked||document.hidden)return;phase=Math.atan2(y-.5,x-.5);orbitRadius=Math.min(.49,Math.max(.08,Math.hypot(x-.5,y-.5)));raf=requestAnimationFrame(tick)}
function open(){previousFocus=document.activeElement;modal.hidden=false;modal.setAttribute('aria-hidden','false');$('dm-close').focus();startOrbit()}
function close(){stopOrbit();modal.hidden=true;modal.setAttribute('aria-hidden','true');if(previousFocus?.focus)previousFocus.focus()}
$('dm-launch').addEventListener('click',open);$('dm-close').addEventListener('click',close);modal.addEventListener('pointerdown',e=>{if(e.target===modal)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close()});
pad.addEventListener('pointerdown',e=>{if(activePointer!==null)return;activePointer=e.pointerId;dragging=true;pad.setPointerCapture(e.pointerId);move(e)});
pad.addEventListener('pointermove',e=>{if(dragging&&e.pointerId===activePointer)move(e)});
function release(e){if(e.pointerId!==activePointer)return;dragging=false;activePointer=null;if($('dm-orbit').checked){stopOrbit();startOrbit()}else if(!$('dm-hold').checked)set(.5,.5)}
pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
pad.addEventListener('keydown',e=>{const d=e.shiftKey?.1:.025;if(e.key==='ArrowRight')set(x+d,y);else if(e.key==='ArrowLeft')set(x-d,y);else if(e.key==='ArrowUp')set(x,y+d);else if(e.key==='ArrowDown')set(x,y-d);else return;e.preventDefault()});
$('dm-center').addEventListener('click',()=>{set(.5,.5);if($('dm-orbit').checked){stopOrbit();startOrbit()}});
$('dm-orbit').addEventListener('change',()=>{stopOrbit();if($('dm-orbit').checked)startOrbit();else if(!$('dm-hold').checked)set(.5,.5)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopOrbit();else startOrbit()});
for(const select of selects)select.addEventListener('change',()=>set(x,y));
})();
