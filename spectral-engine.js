/* Dream Binder Spectral Synthesis II — additive partial synthesis with live visualizer. */
const dbSpectral = (() => {
  'use strict';
  const specs = {
    spectralEnabled: false, spectralQuality: 'eco', spectralLevel: 65,
    spectralMorph: 35, spectralDensity: 65, spectralTilt: -15,
    spectralStretch: 12, spectralBlur: 12, spectralFreeze: false,
    spectralShift: 0, spectralDispersion: 10, spectralMotion: 25,
    spectralChaos: 0, spectralFocus: 45, spectralStereo: 55
  };
  const ids=Object.keys(specs), levels={eco:12,high:24,ultra:48};
  const budget=144; // includes releasing voices, including Binding leaves
  const voices=new Set(); let used=0, timer=null;
  const listeners=new Set();
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const get=id=>document.getElementById(id);
  const smooth=(p,v,t,tau=.045)=>{p.setTargetAtTime(v,t,tau);};

  function sanitize(s={}) {
    const out={};
    for(const id of ids){
      const d=specs[id], v=s[id];
      if(typeof d==='boolean') out[id]=v===true;
      else if(typeof d==='string') out[id]=Object.hasOwn(levels,v)?v:d;
      else {
        const n=Number(v);
        out[id]=clamp(v!=null&&Number.isFinite(n)?n:d, id==='spectralTilt'?-100:id==='spectralShift'?-120:0, id==='spectralShift'?120:100);
      }
    }
    return out;
  }
  function read(){return sanitize(Object.fromEntries(ids.map(id=>{const e=get(id);return [id,e?(e.type==='checkbox'?e.checked:e.value):specs[id]];})));}
  function formatValue(id, value){
    if(id==='spectralShift') return `${value} Hz`;
    return `${value}%`;
  }
  function display(){for(const id of ids){const el=get(id),out=get(id+'Value');if(out&&el)out.textContent=formatValue(id,el.type==='checkbox'?Number(el.checked):el.value);}}
  function load(s){const state=sanitize(s);for(const id of ids){const el=get(id);if(!el)continue;if(el.type==='checkbox')el.checked=state[id];else el.value=state[id];}display();emit();}
  function status(){const e=get('spectralBudget');if(e)e.textContent=`${used} / ${budget} allocated partials • release tails included`;}

  function weights(n,count,s,phase,seed){
    const morph=s.spectralMorph/100, tilt=s.spectralTilt/100, density=s.spectralDensity/100;
    const blur=s.spectralBlur/100, focus=1+(count-1)*s.spectralFocus/100;
    const harmonic=Math.pow(n,-(1.35-tilt*1.1));
    const bell=(.08+Math.exp(-Math.pow((n-focus)/Math.max(1,count*(.055+blur*.22)),2)/2)) / Math.pow(n,.35);
    const blend=harmonic*(1-morph)+bell*morph;
    const mask=clamp(1+(1+density*(count-1)-n)/2,0,1);
    const moving=1+s.spectralMotion/100*.62*Math.sin(phase*(1+n%3*.17)+n*.83);
    const chaos=1+s.spectralChaos/100*.75*Math.sin(seed+n*17.137+phase*.31);
    const focusGain=1+.9*Math.exp(-Math.pow((n-focus)/Math.max(1,count*.12),2)/2);
    return Math.max(0,blend*mask*moving*chaos*focusGain);
  }
  function pitch(f,n,s,seed){return f*(n + s.spectralStretch/100*.055*(n-1)**1.65) + s.spectralShift + f*(n-1)*s.spectralDispersion/100*.018*Math.sin(n*2.39+seed);}

  function buildPreview(state=read(), opts={}){
    const s=sanitize(state), quality=levels[s.spectralQuality]||levels.eco;
    const baseFreq = Math.max(40, Math.min(440, Number(opts.baseFreq)||110));
    const count = Math.max(4, Math.min(quality, Math.floor((48000*.45)/baseFreq)));
    const phase = Number.isFinite(opts.phase) ? opts.phase : (performance.now?.()||Date.now())*0.0013*(.25+s.spectralMotion/100*2.5);
    const seed = Number.isFinite(opts.seed) ? opts.seed : 1.731;
    const partials = [];
    let total = 0;
    for(let n=1;n<=count;n++){
      const freq = pitch(baseFreq,n,s,seed);
      if(!(freq>0)) continue;
      const weight = weights(n,count,s,phase,seed);
      total += weight;
      partials.push({n, freq, weight});
    }
    const norm = Math.max(0.0001,total);
    for(const p of partials){
      p.amp = Math.max(0, Math.min(1, 0.72*p.weight/norm * (s.spectralLevel/100*1.1)));
    }
    return {
      enabled: s.spectralEnabled,
      quality: s.spectralQuality,
      partialCount: partials.length,
      qualityCount: quality,
      phase,
      state: s,
      partials,
      used,
      budget,
      voices: voices.size,
      active: voices.size>0
    };
  }

  function emit(){
    const live=[...voices].find(v=>!v.releasing);
    const snapshot = live
      ? buildPreview(live.state,{baseFreq:live.baseFreq, phase:live.phase, seed:live.seed})
      : buildPreview(read());
    snapshot.active = !!live;
    snapshot.voices = voices.size;
    for(const fn of listeners){ try{ fn(snapshot); } catch(_){} }
  }
  function subscribe(fn){ if(typeof fn!=='function') return ()=>{}; listeners.add(fn); fn(buildPreview(read())); return ()=>listeners.delete(fn); }

  function refreshTimer(){
    const needs=[...voices].some(v=>!v.releasing&&!v.state.spectralFreeze&&v.state.spectralMotion>0&&v.state.spectralLevel>0);
    if(needs&&!timer) timer=setInterval(()=>{
      for(const v of voices){
        if(v.releasing||v.state.spectralFreeze||v.state.spectralMotion<=0||v.state.spectralLevel<=0||v.ctx.state!=='running') continue;
        const now=v.ctx.currentTime;
        v.phase+=Math.min(.16,Math.max(0,now-v.last))*(.25+v.state.spectralMotion/100*2.5);
        v.last=now;
        v.render(false);
      }
      emit();
    },100);
    if(!needs&&timer){clearInterval(timer);timer=null;}
  }

  function create(ctx,f,destination){
    const s=read();
    if(!s.spectralEnabled||s.spectralLevel<=0) return null;
    const count=Math.min(levels[s.spectralQuality],budget-used,Math.max(1,Math.floor((ctx.sampleRate*.45)/f)));
    if(count<4) return null; // preserve base voice if spectral budget is exhausted
    const left=ctx.createStereoPanner(),right=ctx.createStereoPanner(),out=ctx.createGain();
    left.connect(out); right.connect(out); out.connect(destination); out.gain.value=0;
    const parts=[]; const seed=Math.random()*6.283;
    const v={ctx,state:s,phase:0,last:ctx.currentTime,releasing:false,baseFreq:f,seed,
      render(retune=true){
        const t=ctx.currentTime,st=v.state; let sum=0;
        for(const p of parts){
          const f2=pitch(f,p.n,st,seed);
          p.weight=f2>0&&f2<ctx.sampleRate*.45?weights(p.n,count,st,v.phase,seed):0;
          sum+=p.weight;
          if(retune) smooth(p.osc.frequency,clamp(f2,8,ctx.sampleRate*.45),t);
        }
        for(const p of parts) smooth(p.gain.gain,.72*p.weight/Math.max(.001,sum),t,.055);
        if(retune){
          smooth(left.pan,-st.spectralStereo/100,t);
          smooth(right.pan,st.spectralStereo/100,t);
          smooth(out.gain,st.spectralLevel/100*.65,t);
        }
        emit();
      },
      update(id,value){
        if(v.releasing||!ids.includes(id)||id==='spectralEnabled'||id==='spectralQuality') return;
        v.state=sanitize({...v.state,[id]:value});
        v.last=ctx.currentTime;
        v.render();
        refreshTimer();
      },
      stop(delay=0){
        if(v.releasing) return;
        v.releasing=true;
        refreshTimer();
        const t=ctx.currentTime+Math.max(0,delay);
        for(const p of parts){ try{p.osc.stop(t);}catch(_){}}
        emit();
      }
    };
    let ended=0;
    function cleanup(){
      if(++ended!==parts.length) return;
      for(const p of parts){p.osc.disconnect(); p.gain.disconnect();}
      left.disconnect(); right.disconnect(); out.disconnect();
      voices.delete(v); used-=count; status(); refreshTimer(); emit();
    }
    for(let n=1;n<=count;n++){
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='sine'; osc.frequency.value=clamp(pitch(f,n,s,seed),8,ctx.sampleRate*.45); gain.gain.value=0;
      osc.connect(gain); gain.connect(n%2?left:right); osc.onended=cleanup;
      parts.push({n,osc,gain,weight:0});
    }
    used+=count; voices.add(v); v.render(); for(const p of parts) p.osc.start(); status(); refreshTimer(); emit(); return v;
  }

  function attachVisualizer(){
    const canvas=get('dbSpectralCanvas');
    if(!canvas || canvas.dataset.bound==='1') return;
    canvas.dataset.bound='1';
    const ctx=canvas.getContext('2d');
    const readout=get('dbSpectralReadout');
    const chip=get('dbSpectralFreezeChip');
    const modeLabel=get('dbSpectralMode');
    let latest=buildPreview(read());
    let width=0,height=0,dpr=1;
    let raf=0,lastFrame=0;

    function resize(){
      const rect=canvas.getBoundingClientRect();
      dpr=Math.min(window.devicePixelRatio||1,2);
      width=Math.max(160,Math.round(rect.width*dpr));
      height=Math.max(120,Math.round(rect.height*dpr));
      if(canvas.width!==width||canvas.height!==height){ canvas.width=width; canvas.height=height; }
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr,dpr);
      width=canvas.width/dpr; height=canvas.height/dpr;
    }
    function isVisible(){
      const pane=get('dbPaneSource');
      if(!pane || pane.hidden) return false;
      const module=canvas.closest('details');
      return !module || module.open;
    }
    function drawGrid(){
      ctx.save();
      ctx.strokeStyle='rgba(182,150,255,0.08)';
      ctx.lineWidth=1;
      for(let i=1;i<8;i++){ const x=(width-24)*i/8+12; ctx.beginPath(); ctx.moveTo(x,10); ctx.lineTo(x,height-22); ctx.stroke(); }
      for(let i=1;i<5;i++){ const y=(height-34)*i/5+10; ctx.beginPath(); ctx.moveTo(12,y); ctx.lineTo(width-12,y); ctx.stroke(); }
      ctx.restore();
    }
    function draw(snapshot){
      resize();
      const s=snapshot.state;
      ctx.clearRect(0,0,width,height);
      const bg=ctx.createLinearGradient(0,0,0,height);
      bg.addColorStop(0,'rgba(6,8,19,0.98)');
      bg.addColorStop(1,'rgba(10,7,26,0.84)');
      ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);

      const glow=ctx.createRadialGradient(width*0.78,height*0.16,8,width*0.78,height*0.16,width*0.46);
      glow.addColorStop(0,'rgba(170,112,255,0.18)'); glow.addColorStop(1,'rgba(170,112,255,0)');
      ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
      drawGrid();

      const chartX=16, chartY=12, chartW=width-32, chartH=height-42;
      const partials=snapshot.partials || [];
      const maxFreq=Math.max(1200, ...(partials.map(p=>p.freq)), 6000);
      const minFreq=Math.max(20, partials[0]?.freq || 55);
      const logMin=Math.log(minFreq), logMax=Math.log(maxFreq);
      const morphHue=210 + s.spectralMorph*0.7;
      const bars=[];
      for(const p of partials){
        const x=chartX + ((Math.log(Math.max(minFreq,p.freq))-logMin)/(logMax-logMin||1))*chartW;
        const amp=Math.max(0.003,p.amp||0);
        const y=chartY + chartH - amp*chartH*0.96;
        bars.push({x,y,amp,p});
      }
      // spectral haze ribbon
      if(bars.length>1){
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chartX, chartY+chartH);
        for(const b of bars) ctx.lineTo(b.x,b.y);
        ctx.lineTo(chartX+chartW, chartY+chartH);
        ctx.closePath();
        const haze=ctx.createLinearGradient(0,chartY,0,chartY+chartH);
        haze.addColorStop(0,'rgba(195,152,255,0.24)');
        haze.addColorStop(0.55,'rgba(106,196,255,0.14)');
        haze.addColorStop(1,'rgba(106,196,255,0.02)');
        ctx.fillStyle=haze; ctx.fill();
        ctx.restore();
      }
      // focus region highlight
      const focusX=chartX + chartW*(0.12 + s.spectralFocus/100*0.78);
      const focusW=chartW*(0.08 + s.spectralBlur/100*0.16);
      const focusGrad=ctx.createLinearGradient(focusX-focusW,0,focusX+focusW,0);
      focusGrad.addColorStop(0,'rgba(255,207,120,0)'); focusGrad.addColorStop(0.5,'rgba(255,207,120,0.15)'); focusGrad.addColorStop(1,'rgba(255,207,120,0)');
      ctx.fillStyle=focusGrad; ctx.fillRect(focusX-focusW, chartY, focusW*2, chartH);

      // partial bars and tips
      ctx.save();
      for(const b of bars){
        const barW=Math.max(2, Math.min(10, chartW/(bars.length*1.6)));
        const grad=ctx.createLinearGradient(0,b.y,0,chartY+chartH);
        grad.addColorStop(0,`hsla(${morphHue}, 90%, 74%, 0.95)`);
        grad.addColorStop(0.55,'rgba(159,121,255,0.42)');
        grad.addColorStop(1,'rgba(82,197,240,0.08)');
        ctx.fillStyle=grad;
        ctx.shadowBlur=10;
        ctx.shadowColor='rgba(180,146,255,0.34)';
        ctx.fillRect(b.x-barW/2,b.y,barW,chartY+chartH-b.y);
        ctx.beginPath(); ctx.arc(b.x,b.y,Math.max(1.8,barW*0.5),0,Math.PI*2);
        ctx.fillStyle='rgba(239,223,255,0.95)'; ctx.fill();
      }
      ctx.restore();

      // envelope line overlay
      if(bars.length>1){
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bars[0].x,bars[0].y);
        for(let i=1;i<bars.length;i++) ctx.lineTo(bars[i].x,bars[i].y);
        ctx.strokeStyle='rgba(121,240,255,0.9)';
        ctx.lineWidth=1.7;
        ctx.shadowBlur=8; ctx.shadowColor='rgba(121,240,255,0.45)';
        ctx.stroke();
        ctx.restore();
      }

      // motion orbit accent
      const orbX=chartX + chartW*(0.14 + s.spectralMotion/100*0.72);
      const orbY=chartY + chartH*(0.2 + (1-s.spectralTilt/100)*0.18) + Math.sin(snapshot.phase*2.1)*chartH*0.06;
      ctx.save();
      ctx.strokeStyle='rgba(208,179,255,0.16)';
      ctx.beginPath(); ctx.arc(orbX,orbY,20+18*s.spectralStereo/100,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(orbX,orbY,8+10*s.spectralMorph/100,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(136,238,255,0.9)'; ctx.shadowBlur=12; ctx.shadowColor='rgba(136,238,255,0.5)';
      ctx.beginPath(); ctx.arc(orbX + Math.cos(snapshot.phase*1.25)*18, orbY + Math.sin(snapshot.phase*1.25)*10, 3.2, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      if(modeLabel){
        modeLabel.textContent = snapshot.active ? `LIVE ${snapshot.quality.toUpperCase()} · ${snapshot.partialCount} PARTIALS` : `PREVIEW ${snapshot.quality.toUpperCase()} · ${snapshot.partialCount} PARTIALS`;
      }
      if(readout){
        const lead = snapshot.enabled ? (snapshot.active ? 'Active spectral voice' : 'Preview ready') : 'Spectral field bypassed';
        readout.textContent = `${lead} • Morph ${s.spectralMorph}% • Stretch ${s.spectralStretch}% • Focus ${s.spectralFocus}%`;
      }
      if(chip){
        chip.textContent = !snapshot.enabled ? 'FIELD OFF' : (s.spectralFreeze ? 'MOTION FROZEN' : (snapshot.active ? 'MOTION LIVE' : 'PREVIEW MODE'));
        chip.classList.toggle('is-frozen', !!s.spectralFreeze && snapshot.enabled);
        chip.classList.toggle('is-disabled', !snapshot.enabled);
      }
    }

    function loop(ts){
      raf=requestAnimationFrame(loop);
      if(!isVisible()) return;
      if(ts-lastFrame<33) return;
      lastFrame=ts;
      const state=latest.state || read();
      const phase = latest.active ? latest.phase : (((performance.now?.()||Date.now())*0.0013*(.25+(state.spectralMotion||0)/100*2.5)));
      const fresh=buildPreview(state,{baseFreq: latest.active && latest.partials?.[0]?.freq ? Math.max(55, latest.partials[0].freq) : 110, phase});
      fresh.active = latest.active;
      fresh.voices = latest.voices;
      draw(fresh);
    }

    subscribe(snapshot=>{latest=snapshot; draw(latest);});
    new ResizeObserver(()=>resize()).observe(canvas);
    resize();
    raf=requestAnimationFrame(loop);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', attachVisualizer, {once:true});
  else setTimeout(attachVisualizer,0);

  return {ids,defaults:{...specs},read,load,display,create,stats:()=>({used,voices:voices.size,budget}),preview:buildPreview,subscribe,emit};
})();
