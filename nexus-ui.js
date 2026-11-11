/* Dream Binder · responsive UI and accessibility controller
 * UI-only. Does not alter oscillator, piano, choir, presets, or note lifecycle.
 */
(() => {
  'use strict';
  const overlay = document.getElementById('presetBrowserOverlay');
  if (!overlay) return;
  const dialog = overlay.querySelector('.preset-browser');
  const manager = document.getElementById('dbPresetManager');
  const toggle = document.getElementById('dbManagerToggle');
  const scroller = document.getElementById('dbLibraryScroll');
  const close = document.getElementById('closePresetBrowser');
  let returnFocus = null;
  const isOpen = () => !overlay.classList.contains('hidden');

  function setManagerVisible(open, focus = false) {
    if (!manager || !toggle) return;
    manager.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide tools' : 'Manage sounds';
    if (open && focus) {
      manager.scrollIntoView({block:'nearest',behavior:'instant'});
      document.getElementById('presetNameInput')?.focus({preventScroll:true});
    }
  }
  toggle?.addEventListener('click', () => setManagerVisible(manager.hidden, manager.hidden));
  document.getElementById('quickSavePreset')?.addEventListener('click', () => {
    setManagerVisible(true);
    requestAnimationFrame(() => {
      scroller?.scrollTo({top:0,behavior:'instant'});
      document.getElementById('presetNameInput')?.focus({preventScroll:true});
    });
  });
  // My Presets opens the management tools. Other banks keep the current state.
  document.querySelectorAll('.preset-browser-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.bank === 'user') setManagerVisible(true);
      requestAnimationFrame(() => { if (scroller) scroller.scrollTop = 0; });
      syncState();
    });
  });

  function syncState() {
    const open = isOpen();
    document.body.classList.toggle('db-library-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    dialog?.classList.toggle('db-atlas-active', Boolean(document.querySelector('.preset-browser-tab[data-bank="atlas"].active-bank')));
    if (open) {
      if (!returnFocus || !returnFocus.isConnected) returnFocus = document.activeElement;
      if (!overlay.contains(document.activeElement)) close?.focus({preventScroll:true});
    } else if (returnFocus) {
      const element = returnFocus;
      returnFocus = null;
      if (element.isConnected) element.focus({preventScroll:true});
    }
  }
  new MutationObserver(syncState).observe(overlay, {attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close?.click();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = [...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),label.preset-import-btn,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden');
    if (!elements.length) return;
    const first = elements[0];
    const last = elements[elements.length-1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });
  syncState();
})();

// Final DOM safeguard: keyboard must follow all instrument sections.
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main.app');
  const dock = document.getElementById('dbPerformanceDock');
  if (main && dock && main.lastElementChild !== dock) main.appendChild(dock);
});

/* DREAM BINDER · RESONANCE WORKSTATION V1
 * UI-only module navigation, recessed controls and low-budget visualizations.
 * Existing input elements are re-used (never cloned): all app.js DSP listeners,
 * 104 factory patches, note lifecycle and the original Web Audio graph are intact.
 */
(() => {
  'use strict';
  const shell = document.getElementById('dbInstrumentShell');
  if (!shell || shell.dataset.workstationReady) return;
  shell.dataset.workstationReady = 'true';

  const pageDescriptions = {
    source:    ['ORIGIN  /  OSCILLATORS', 'Frequency sources and tonal foundation', 'WAVEFORM GEOMETRY'],
    shape:     ['PHYSICS  /  SHAPING', 'Envelope, spectral filter and FM modulation', 'ENVELOPE / FILTER'],
    resonance: ['RESONANCE  /  FIELD', 'Polynomial harmonic structure and coherence', 'RESONANCE GEOMETRY'],
    motion:    ['MOTION  /  DREAM MORPH', 'Wave Fusion, modulation and arpeggiator', 'MORPH / ORBIT'],
    voicing:   ['VOICING  /  INSTRUMENTS', 'Existing Synth, Piano and Ah Choir sources', 'VOICE FIELDS'],
    master:    ['MASTER  /  OUTPUT', 'Final level, glide and performance output', 'OUTPUT STATE'],
    bindings:  ['BINDINGS  /  SOURCE FUSION', 'Two sound sources, one musical performance', 'HYBRID SOURCE'],
    midi:      ['MIDI  /  EXTERNAL CONTROL', 'Controller routing and note-input status', 'MIDI SIGNAL'],
    fx:        ['ATMOSPHERE  /  EFFECTS', 'Select a processor in the separate rack below', 'PROCESSOR ARRAY'],
    focus:     ['EFFECTS  /  FOCUSED RACK', 'Editing the original, live effect controls', 'PROCESSOR RESPONSE']
  };
  const title = document.getElementById('dbScreenTitle');
  const subtitle = document.getElementById('dbScreenSubtitle');
  const viztype = document.getElementById('dbVisualType');
  const tabButtons = Array.from(document.querySelectorAll('.db-edit-tab'));
  const panes = Array.from(document.querySelectorAll('.db-edit-pane'));
  const visualCanvas = document.getElementById('dbWorkstationCanvas');
  const focusedSlot = document.getElementById('dbRackFocusSlot');
  const engineDisplay = document.getElementById('dbEngineDisplay');
  const rackItems = Array.from(document.querySelectorAll('.db-rack-unit'));
  let currentPage = 'source';
  let priorPage = 'source';
  let focusedRack = null;
  let focusedPanel = null;
  let focusedHome = null;
  const quality = document.createElement('select');
  quality.id = 'dbVisualQuality';
  quality.setAttribute('aria-label', 'Visualization quality');
  quality.title = 'Visualization quality • all settings preserve audio priority';
  for (const [value,label] of [['eco','ECO VISUALS'],['balanced','BALANCED VISUALS'],['cinematic','CINEMATIC VISUALS']]) {
    const option = document.createElement('option');
    option.value=value;option.textContent=label;quality.append(option);
  }
  quality.value='balanced';
  const qualityHolder=document.createElement('label');
  qualityHolder.className='db-visual-quality';
  qualityHolder.append(quality);
  document.querySelector('.db-console-top')?.append(qualityHolder);

  function restoreRack() {
    if (focusedPanel && focusedHome) focusedHome.append(focusedPanel);
    document.querySelector('.db-rack-unit.db-focused')?.classList.remove('db-focused');
    focusedPanel=null;focusedHome=null;focusedRack=null;
  }
  function selectPane(page, opts={}) {
    if (page!=='focus' && focusedRack) restoreRack();
    if (!pageDescriptions[page]) page='source';
    currentPage=page;
    panes.forEach(p => {p.hidden=(p.dataset.pane!==page);});
    for (const tab of tabButtons) {
      const active=tab.dataset.page===page;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.setAttribute('aria-current',active?'page':'false');
    }
    const info=pageDescriptions[page];
    if (title) title.textContent=opts.title || info[0];
    if (subtitle) subtitle.textContent=opts.subtitle || info[1];
    if (viztype) viztype.textContent=info[2];
    document.querySelector('.db-pane-host')?.scrollTo({top:0});
    refreshVisualControls();
  }
  function focusRack(key) {
    const unit=rackItems.find(el=>el.dataset.rack===key);
    if (!unit || !focusedSlot) return;
    if (focusedRack) restoreRack();
    priorPage = currentPage==='focus' ? priorPage : currentPage;
    focusedHome=unit.querySelector('.db-rack-controls');
    focusedPanel=focusedHome?.querySelector('details');
    if (!focusedPanel) return;
    focusedRack=key;
    focusedSlot.append(focusedPanel);
    focusedPanel.open=true;
    unit.classList.add('db-focused');
    const label=unit.querySelector('.db-rack-left strong')?.textContent || key;
    selectPane('focus',{title:label.toUpperCase()+'  /  DETAILED PROCESSOR',subtitle:'Live controls • edit in the central instrument display'});
    document.querySelector('.db-edit-console')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  for (const b of tabButtons) b.addEventListener('click',()=>{
    selectPane(b.dataset.page);
  });
  document.querySelectorAll('button[data-focus]').forEach(button=>button.addEventListener('click',()=>focusRack(button.dataset.focus)));
  document.getElementById('dbRackBack')?.addEventListener('click',()=>selectPane(priorPage));
  document.querySelectorAll('button[data-voice]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelector(`[data-db-nav="${button.dataset.voice}"]`)?.click();
    selectPane('voicing');
  }));
  // app.js already changes actual sound sources; this only synchronizes the visible chassis.
  for (const button of document.querySelectorAll('[data-db-nav]')) button.addEventListener('click',()=>{
    const src=button.dataset.dbNav;
    if (src==='bindings') {selectPane('bindings'); document.getElementById('dbSoundArchitecture')?.scrollIntoView({behavior:'smooth',block:'start'});}
    else if (['synth','piano','choir'].includes(src)) {
      if (engineDisplay) engineDisplay.textContent=src.toUpperCase()+' / RESONANCE SOURCE';
      document.querySelectorAll('button[data-voice]').forEach(el=>el.classList.toggle('active',el.dataset.voice===src));
      if (currentPage==='bindings') selectPane(src==='synth'?'source':'voicing');
    }
  });
  document.getElementById('dbOpenMIDI')?.addEventListener('click',()=>selectPane('midi'));
  document.querySelector('button[data-voice="synth"]')?.classList.add('active');

  // Each original input remains in the DOM exactly once. Native range
  // keyboard arrows still operate the original input while pointer dragging
  // controls an inset circular dial or vertical light fader.
  const faders = new Set(['oscBLevel','subLevel','noiseAmount','reverbMix','reverbDecay',
    'delayMix','delayTime','delayFeedback','masterVolume','lfoAmount','lfoRate','arpGate',
    'arpTempo','fmAttack','fmDecay','fmSustain','fmRelease','attack','decay','sustain','release']);
  const violet = new Set(['waveFusion','fmAmount','fmRatio','dreamMorphMotion','voiceSpread','drift','lfoRate','lfoAmount','noiseAmount']);
  const gold = new Set(['presence','coherence','decoherence','polynomialRingAmount','polynomialRingDegree','krullDimension']);
  const controllers=[];
  function clamp(n,min,max) {return Math.min(max,Math.max(min,n));}
  function displayValue(input) {
    const strong=input.closest('label')?.querySelector('strong');
    if (strong) return strong.textContent.trim().slice(0,9);
    return Math.round(Number(input.value)*100)+'%';
  }
  function wrapRange(input) {
    const label=input.closest('label');
    if (!label || input.closest('.db-neon-control')) return;
    const isFader=faders.has(input.id);
    const wrapper=document.createElement('div');
    wrapper.className='db-neon-control '+(isFader?'db-fader':'db-knob')+' '+(violet.has(input.id)?'db-violet':gold.has(input.id)?'db-gold':'');
    wrapper.title='Drag up or down to adjust · keyboard arrows also work';
    input.before(wrapper);wrapper.append(input);
    const value=document.createElement('span');value.className='db-neon-value';
    let ring=null, pointer=null, fill=null, thumb=null;
    if (isFader) {
      const track=document.createElement('div');track.className='db-fader-line';
      fill=document.createElement('div');fill.className='db-fader-fill';track.append(fill);
      thumb=document.createElement('div');thumb.className='db-fader-thumb';
      wrapper.append(track,thumb,value);
    } else {
      const ns='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 80 80');svg.setAttribute('aria-hidden','true');
      const makeCircle=(cls,r)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('class',cls);c.setAttribute('cx','40');c.setAttribute('cy','40');c.setAttribute('r',String(r));svg.append(c);return c;};
      makeCircle('db-knob-well',33);makeCircle('db-knob-track',26);
      ring=makeCircle('db-knob-progress',26);ring.setAttribute('transform','rotate(135 40 40)');
      const dot=document.createElementNS(ns,'circle');dot.setAttribute('class','db-knob-pointer');dot.setAttribute('cx','40');dot.setAttribute('cy','14');dot.setAttribute('r','2.5');
      pointer=dot;svg.append(dot);
      wrapper.append(svg,value);
    }
    const entry={input,value,ring,pointer,fill,thumb};controllers.push(entry);
    let dragging=null;
    wrapper.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      event.preventDefault();
      input.focus({preventScroll:true});
      dragging={y:event.clientY,initial:Number(input.value)};
      try{wrapper.setPointerCapture(event.pointerId);}catch(e){}
    });
    wrapper.addEventListener('pointermove',event=>{
      if (!dragging) return;
      const min=Number(input.min)||0,max=Number(input.max)||100;
      const step=Number(input.step)||((max-min)/100);
      const raw=clamp(dragging.initial+(dragging.y-event.clientY)*((max-min)/150),min,max);
      const stepped=Math.round((raw-min)/step)*step+min;
      const next=Number(clamp(stepped,min,max).toFixed(5));
      if (next!==Number(input.value)) {
        input.value=String(next);input.dispatchEvent(new Event('input',{bubbles:true}));
        refreshVisualControls();
      }
    });
    wrapper.addEventListener('pointerup',()=>{dragging=null;});
    wrapper.addEventListener('pointercancel',()=>{dragging=null;});
    input.addEventListener('input',refreshVisualControls);
    label.classList.add(isFader?'db-control-fader':'db-control-knob');
  }
  for(const input of document.querySelectorAll('.db-chassis input[type="range"]')) wrapRange(input);
  document.querySelectorAll('.db-module label:has(select)').forEach(label=>label.classList.add('db-control-select'));
  function refreshVisualControls() {
    for(const item of controllers){
      const {input,value,ring,pointer,fill,thumb}=item;
      const min=Number(input.min)||0,max=Number(input.max)||100;
      const pct=clamp((Number(input.value)-min)/Math.max(.001,max-min),0,1);
      value.textContent=displayValue(input);
      if(ring) ring.setAttribute('stroke-dasharray',`${(pct*122.5).toFixed(2)} 163.37`);
      if(pointer) pointer.setAttribute('transform',`rotate(${(-135+pct*270).toFixed(1)} 40 40)`);
      if(fill) fill.style.height=`${(pct*100).toFixed(1)}%`;
      if(thumb) thumb.style.top=`${(73-(pct*67)).toFixed(1)}px`;
    }
  }
  refreshVisualControls();
  document.getElementById('openPresetBrowser')?.addEventListener('click',refreshVisualControls);
  document.querySelectorAll('.preset-browser-tab').forEach(button=>button.addEventListener('click',refreshVisualControls));
  document.getElementById('presetBrowserList')?.addEventListener('click',()=>setTimeout(refreshVisualControls,100));
  const refreshInterval=window.setInterval(()=>{if(!document.hidden) refreshVisualControls();},1700);

  // One animation loop. No particles, arrays, or canvases are created per frame.
  // These graphics illustrate the existing parameters, not quantum phenomena.
  const ctx=visualCanvas?.getContext('2d',{alpha:false});
  const rackCanvases=[...document.querySelectorAll('.db-rack-canvas')].map(el=>[el,el.getContext('2d',{alpha:false})]);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const particles=Array.from({length:20},(_,i)=>({x:(i*47%101)/101,y:(i*23%79)/79,v:.16+(i%6)*.06}));
  let rafId=null, lastAt=0, frameNum=0, live=true;
  const read=(id,fallback=0)=>Number(document.getElementById(id)?.value ?? fallback)||0;
  const checked=id=>Boolean(document.getElementById(id)?.checked);
  const choice=(id,fallback)=>document.getElementById(id)?.value || fallback;
  const TAU=Math.PI*2;
  function initCanvas(c,width,height){c.fillStyle='#070c16';c.fillRect(0,0,width,height);}
  function grid(c,w,h){
    c.strokeStyle='#4d6c7c24';c.lineWidth=1;
    for(let x=0;x<w;x+=w/8){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
    for(let y=0;y<h;y+=h/5){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  }
  function curve(c,w,h,func,color='#83cfe1',weight=2.1){
    c.beginPath();for(let i=0;i<=150;i++){
      const x=i*w/150,y=func(i/150)*h;
      if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.lineWidth=weight;c.strokeStyle=color;c.stroke();
  }
  function waveform(shape,t){
    const f=(t%1+1)%1;
    switch(shape){case 'triangle':return 1-4*Math.abs(f-.5);
    case 'sawtooth':return f*2-1;
    case 'square':return f<.5?1:-1;
    case 'trapezoid':return Math.max(-1,Math.min(1,4*(f-.5)));
    default:return Math.sin(t*TAU);}
  }
  function rings(c,w,h,time){
    const cx=w*.5,cy=h*.51;
    const degree=Math.max(2,Math.round(read('polynomialRingDegree',3)));
    const dim=Math.max(0,Math.round(read('krullDimension',1)));
    const intensity=read('polynomialRingAmount',35)/100;
    const coherence=read('coherence')/100,decoherence=read('decoherence')/100;
    const enabled=checked('polynomialRingEnabled');
    for(let band=0;band<Math.max(1,dim+1);band++){
      c.beginPath();
      for(let i=0;i<=240;i++){
        const theta=TAU*i/240;
        const phase=(reduced.matches?0:time*(.14+band*.04));
        const deform=enabled?intensity*(.10+band*.09):.015;
        const r=(Math.min(w,h)*(.18+band*.075))*(1+deform*Math.sin(theta*degree+(coherence-decoherence)*phase+band));
        const x=cx+r*Math.cos(theta),y=cy+r*Math.sin(theta);
        if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.closePath();c.strokeStyle=['#8bdddf','#b58fde','#e0bb90','#829bc8'][band%4];c.lineWidth=1.3;c.stroke();
    }
    for(let i=0;i<9;i++){
      const drift=decoherence*Math.sin(time*.4+i*7.5)*Math.min(w,h)*.17;
      const rad=TAU*i/9+(reduced.matches?0:time*.04*coherence);
      const radius=Math.min(w,h)*.35+drift;
      c.fillStyle='#c3ecf0';c.beginPath();c.arc(cx+Math.cos(rad)*radius,cy+Math.sin(rad)*radius,2.3,0,TAU);c.fill();
    }
  }
  function field(c,w,h,time){
    const page=currentPage;
    if(page==='source'||page==='voicing'){
      const fusion=read('waveFusion',50)/100;
      const a=choice('waveform','sine'),b=choice('waveformB','sawtooth');
      curve(c,w,h,t=>.5-(waveform(a,t*4)*Math.cos(fusion*Math.PI/2)+waveform(b,t*4)*Math.sin(fusion*Math.PI/2))*.22,'#8be3ee',2.1);
      curve(c,w,h,t=>.5-waveform(b,t*4)*.15,'#9575bb88',1.1);
    } else if(page==='shape'){
      const attack=read('attack',.05),decay=read('decay',.2),sustain=read('sustain',.7),release=read('release',.5);
      const total=Math.max(.1,attack+decay+1+release);
      const a=attack/total,d=(attack+decay)/total,s=(attack+decay+1)/total;
      curve(c,w,h,t=>{
        if(t<=a)return .85-.70*(t/Math.max(.001,a));
        if(t<=d)return .15+(1-sustain)*.7*(t-a)/Math.max(.001,d-a);
        if(t<=s)return .15+(1-sustain)*.7;
        return .15+(1-sustain)*.7+(.85-(.15+(1-sustain)*.7))*((t-s)/Math.max(.001,1-s));
      },'#adacee',2.5);
      const cutoff=read('cutoff',4000)/12000;
      curve(c,w,h,t=>.82-.62/(1+Math.pow(Math.max(.001,t)/(Math.max(.04,cutoff)),6)),'#7bd8bda8',1.4);
    } else if(page==='resonance'){
      rings(c,w,h,time);
    } else if(page==='motion'){
      const x=w*.5,y=h*.5,r=Math.min(w,h)*.27;
      for(let i=1;i<=3;i++){c.strokeStyle='#5e668f88';c.beginPath();c.arc(x,y,r*i/3,0,TAU);c.stroke();}
      const vel=checked('deepDreamOrbit')?time*.6:0;
      const px=x+Math.cos(vel)*r,py=y+Math.sin(vel)*r*.75;
      c.beginPath();c.arc(px,py,5,0,TAU);c.fillStyle='#83e7ee';c.fill();
      c.beginPath();c.arc(px,py,12,0,TAU);c.strokeStyle='#8fd9e766';c.stroke();
      const morph=read('waveFusion',50)/100;
      curve(c,w,h,t=>.79-.10*((1-morph)*Math.sin(TAU*t*7)+morph*waveform('triangle',t*7)),'#c9a3e0',1.2);
    } else if(page==='focus'){
      drawRack(c,w,h,focusedRack||'reverb',time,true);
    } else if(page==='master'){
      const amp=read('masterVolume',.25);
      curve(c,w,h,t=>.5-.15*amp*Math.sin(TAU*t*13),'#cebf91',2.4);
      for(let i=0;i<11;i++){
        const x=w*(i+.5)/11,bar=h*(.12+.27*amp*(.5+.5*Math.sin(time*.8+i)));
        c.fillStyle='#7898ad';c.fillRect(x,h*.84-bar,w*.025,bar);
      }
    } else if(page==='bindings'){
      curve(c,w,h,t=>.5-.16*Math.sin(TAU*t*5)*Math.sin(TAU*t*1.15),'#88cfe2',2);
      curve(c,w,h,t=>.5-.16*Math.sin(TAU*t*5+.65),'#cb9ccc',1.6);
    } else if(page==='midi'){
      for(let i=0;i<10;i++){
        const x=w*(i+.5)/10,height=h*(.15+(i*17%40)/100);
        c.fillStyle=i%3===0?'#8fcecf':'#6a6686';c.fillRect(x,h*.84-height,w*.035,height);
      }
    } else {
      for(const [i,key] of ['reverb','delay','noise','orbit','presence'].entries()){
        const x=w*(i+.5)/5,y=h*.5;
        c.beginPath();c.arc(x,y,15+read(['reverbMix','delayMix','noiseAmount','stereoWidth','presence'][i])*12,0,TAU);
        c.strokeStyle=['#a8b4e8','#7acddb','#ae86d9','#92cfd2','#d8c399'][i];c.stroke();
      }
    }
  }
  function drawRack(c,w,h,key,time,large=false){
    const track=h*.75;
    if(key==='reverb'){
      const mix=read('reverbMix'),decay=read('reverbDecay');
      curve(c,w,h,t=>track/h-(Math.max(.02,mix)*.36)*Math.exp(-t*5/(.3+decay))*(.5+.5*Math.sin(t*TAU*20)), '#b9a3e8',large?2.2:1.4);
    } else if(key==='delay'){
      const feedback=read('delayFeedback');
      for(let i=0;i<8;i++){
        const x=w*(i+.6)/9,bar=h*.48*Math.pow(.18+feedback,.5+i*.15);
        c.fillStyle='#78d5e0';c.fillRect(x,track-bar,w*.026,bar);
      }
    } else if(key==='noise'){
      const intensity=read('noiseAmount');
      const count=quality.value==='cinematic'?20:quality.value==='balanced'?11:0;
      for(let i=0;i<count;i++){
        const p=particles[i],x=(p.x+.01*time*p.v)%1*w,y=(p.y+Math.sin(time*p.v+i)*.02)*h;
        c.fillStyle=`rgba(175,147,232,${.13+.52*Math.min(1,intensity)})`;
        c.fillRect(x,y,large?2.5:1.6,large?2.5:1.6);
      }
      curve(c,w,h,t=>.5+(Math.sin(t*120+time*.2)*Math.sin(t*27-time*.1))*.18*Math.min(1,intensity), '#b49ce4',1);
    } else if(key==='orbit'){
      const x=w*.5,y=h*.5,r=h*.32;
      c.strokeStyle='#58798b88';c.beginPath();c.ellipse(x,y,r*1.8,r,0,0,TAU);c.stroke();
      const angle=checked('deepDreamOrbit')?(reduced.matches?0:time*.55):0;
      c.fillStyle='#8fd6e5';c.beginPath();c.arc(x+Math.cos(angle)*r*1.8,y+Math.sin(angle)*r,large?5:3,0,TAU);c.fill();
    } else if(key==='presence'){
      const presence=read('presence')/100;
      curve(c,w,h,t=>.57- Math.sin(t*TAU*4)*(.08+presence*.28),'#d6b98b',1.8);
    }
  }
  function draw(timeMs){
    if(!live) return;
    rafId=requestAnimationFrame(draw);
    if(document.hidden) return;
    const playing=Boolean(document.querySelector('.key:active'));
    const fps=reduced.matches?4:quality.value==='eco'?7:quality.value==='cinematic'?24:(playing?22:15);
    if(timeMs-lastAt<1000/fps) return;
    lastAt=timeMs;frameNum++;
    const t=reduced.matches?0:timeMs/1000;
    if(ctx && visualCanvas && visualCanvas.getClientRects().length){
      const w=visualCanvas.width,h=visualCanvas.height;
      initCanvas(ctx,w,h);grid(ctx,w,h);field(ctx,w,h,t);
      ctx.fillStyle='#aab8cf';ctx.font='12px sans-serif';ctx.fillText('PARAMETER MODEL  /  '+currentPage.toUpperCase(),17,h-16);
    }
    if(quality.value!=='eco'){
      for(const [canvas,c] of rackCanvases){
        if(!c || !canvas.getClientRects().length) continue;
        const w=canvas.width,h=canvas.height;
        initCanvas(c,w,h);grid(c,w,h);drawRack(c,w,h,canvas.dataset.rackCanvas,t);
      }
    }
  }
  rafId=requestAnimationFrame(draw);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) lastAt=0;});
  window.addEventListener('pagehide',()=>{
    live=false;if(rafId!==null) cancelAnimationFrame(rafId);
    clearInterval(refreshInterval);
  },{once:true});
  selectPane('source');
})();
