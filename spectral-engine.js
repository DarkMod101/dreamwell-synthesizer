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
    const peaks=[];

    function resize(){
      const rect=canvas.getBoundingClientRect();
      dpr=Math.min(window.devicePixelRatio||1,2);
      const nw=Math.max(260,Math.round(rect.width*dpr));
      const nh=Math.max(160,Math.round(rect.height*dpr));
      if(canvas.width!==nw||canvas.height!==nh){ canvas.width=nw; canvas.height=nh; }
      ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr,dpr);
      width=canvas.width/dpr; height=canvas.height/dpr;
    }
    function isVisible(){
      const pane=get('dbPaneSource');
      if(!pane || pane.hidden) return false;
      const module=canvas.closest('details');
      return !module || module.open;
    }
    function lerp(a,b,t){ return a+(b-a)*t; }
    function drawGrid(chartX, chartY, chartW, chartH){
      ctx.save();
      const bg=ctx.createLinearGradient(0,chartY,0,chartY+chartH);
      bg.addColorStop(0,'rgba(4,8,24,.94)'); bg.addColorStop(.55,'rgba(4,8,22,.86)'); bg.addColorStop(1,'rgba(3,6,18,.96)');
      ctx.fillStyle=bg; ctx.fillRect(chartX, chartY, chartW, chartH);
      const haze=ctx.createRadialGradient(chartX+chartW*.76, chartY+chartH*.14, 8, chartX+chartW*.76, chartY+chartH*.14, chartW*.5);
      haze.addColorStop(0,'rgba(158,110,255,.18)'); haze.addColorStop(0.5,'rgba(90,60,170,.09)'); haze.addColorStop(1,'rgba(90,60,170,0)');
      ctx.fillStyle=haze; ctx.fillRect(chartX, chartY, chartW, chartH);
      ctx.strokeStyle='rgba(166,153,228,.08)'; ctx.lineWidth=1;
      for(let i=0;i<=8;i++){ const x=chartX + chartW*i/8; ctx.beginPath(); ctx.moveTo(x,chartY); ctx.lineTo(x,chartY+chartH); ctx.stroke(); }
      for(let i=0;i<=5;i++){ const y=chartY + chartH*i/5; ctx.beginPath(); ctx.moveTo(chartX,y); ctx.lineTo(chartX+chartW,y); ctx.stroke(); }
      ctx.strokeStyle='rgba(123,211,247,.12)';
      ctx.beginPath(); ctx.moveTo(chartX, chartY+chartH*.72); ctx.lineTo(chartX+chartW, chartY+chartH*.72); ctx.stroke();
      ctx.restore();
    }
    function drawLabels(chartX, chartY, chartW, chartH){
      ctx.save();
      ctx.fillStyle='rgba(180,187,220,.55)';
      ctx.font='10px system-ui';
      ctx.textBaseline='top';
      const marks=[['60 Hz',0.05],['250 Hz',0.22],['1 kHz',0.46],['4 kHz',0.71],['12 kHz',0.90]];
      for(const [txt,pos] of marks){ ctx.fillText(txt, chartX+chartW*pos-10, chartY+chartH+7); }
      ctx.restore();
    }
    function draw(snapshot){
      resize();
      const s=snapshot.state;
      ctx.clearRect(0,0,width,height);
      const pad=12;
      const chartX=pad, chartY=14, chartW=width-pad*2, chartH=height-42;
      drawGrid(chartX,chartY,chartW,chartH);

      const partials=snapshot.partials || [];
      const maxFreq=Math.max(2200, ...(partials.map(p=>p.freq)), 14000);
      const minFreq=Math.max(25, Math.min(70, partials[0]?.freq || 55));
      const logMin=Math.log(minFreq), logMax=Math.log(maxFreq);
      const focusCenter=(0.12 + s.spectralFocus/100*0.78);
      const focusWidth=(0.05 + s.spectralBlur/100*0.12);
      const focusX=chartX + chartW*focusCenter;
      const fxw=chartW*focusWidth;
      const focus=ctx.createLinearGradient(focusX-fxw,0,focusX+fxw,0);
      focus.addColorStop(0,'rgba(255,214,128,0)'); focus.addColorStop(0.25,'rgba(255,214,128,0.05)'); focus.addColorStop(0.5,'rgba(255,214,128,0.16)'); focus.addColorStop(0.75,'rgba(255,214,128,0.05)'); focus.addColorStop(1,'rgba(255,214,128,0)');
      ctx.fillStyle=focus; ctx.fillRect(focusX-fxw, chartY, fxw*2, chartH);

      const bars=[];
      for(let i=0;i<partials.length;i++){
        const p=partials[i];
        const freq=Math.max(minFreq,p.freq);
        const x=chartX + ((Math.log(freq)-logMin)/(logMax-logMin||1))*chartW;
        const amp=Math.max(0.005,p.amp||0);
        const y=chartY + chartH - amp*chartH*0.95;
        const barW=Math.max(3, Math.min(14, chartW/(partials.length*1.2)));
        bars.push({x,y,amp,barW,p});
        peaks[i]=peaks[i]==null?y:Math.min(y, peaks[i] + (y-peaks[i])*0.28);
        if(y > peaks[i]) peaks[i]=lerp(peaks[i], y, 0.13);
      }
      peaks.length = bars.length;
      if(bars.length>1){
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chartX, chartY+chartH);
        ctx.lineTo(bars[0].x, bars[0].y);
        for(let i=1;i<bars.length;i++){
          const prev=bars[i-1], b=bars[i];
          const cx=(prev.x+b.x)/2;
          ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y+b.y)/2);
        }
        const last=bars[bars.length-1];
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(chartX+chartW, chartY+chartH);
        ctx.closePath();
        const fill=ctx.createLinearGradient(0,chartY,0,chartY+chartH);
        fill.addColorStop(0,'rgba(194,155,255,.28)'); fill.addColorStop(.45,'rgba(112,204,255,.14)'); fill.addColorStop(1,'rgba(90,160,255,.02)');
        ctx.fillStyle=fill; ctx.fill();
        ctx.restore();
      }
      // glow line
      if(bars.length>1){
        ctx.save();
        ctx.beginPath(); ctx.moveTo(bars[0].x, bars[0].y);
        for(let i=1;i<bars.length;i++) ctx.lineTo(bars[i].x,bars[i].y);
        ctx.strokeStyle='rgba(120,238,255,.95)'; ctx.lineWidth=2.1; ctx.shadowBlur=12; ctx.shadowColor='rgba(120,238,255,.48)'; ctx.stroke();
        ctx.restore();
      }
      // bars + peaks
      for(let i=0;i<bars.length;i++){
        const b=bars[i];
        const grad=ctx.createLinearGradient(0,b.y,0,chartY+chartH);
        grad.addColorStop(0,'rgba(233,214,255,.98)'); grad.addColorStop(.22,'rgba(166,123,255,.82)'); grad.addColorStop(.56,'rgba(96,220,255,.26)'); grad.addColorStop(1,'rgba(96,220,255,.02)');
        ctx.fillStyle=grad; ctx.shadowBlur=10; ctx.shadowColor='rgba(140,112,255,.24)';
        ctx.fillRect(b.x-b.barW/2,b.y,b.barW,chartY+chartH-b.y);
        ctx.fillStyle='rgba(255,247,255,.95)'; ctx.beginPath(); ctx.arc(b.x,b.y,Math.max(1.8, b.barW*0.28+1.2),0,Math.PI*2); ctx.fill();
        const py=peaks[i];
        ctx.fillStyle='rgba(255,227,170,.72)'; ctx.fillRect(b.x-b.barW/2, py, b.barW, 2);
      }
      // motion / orbit accent
      const ox=chartX + chartW*(0.15 + s.spectralMotion/100*0.70);
      const oy=chartY + chartH*(0.18 + (1-(s.spectralTilt+100)/200)*0.42) + Math.sin(snapshot.phase*1.8)*chartH*0.05;
      ctx.save();
      ctx.strokeStyle='rgba(197,176,255,.17)'; ctx.lineWidth=1.1;
      ctx.beginPath(); ctx.arc(ox,oy,12+14*s.spectralStereo/100,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox,oy,26+12*s.spectralMorph/100,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(129,244,255,.95)'; ctx.shadowBlur=10; ctx.shadowColor='rgba(129,244,255,.6)';
      ctx.beginPath(); ctx.arc(ox + Math.cos(snapshot.phase*1.4)*18, oy + Math.sin(snapshot.phase*1.4)*10, 4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // border
      ctx.save(); ctx.strokeStyle='rgba(207,198,255,.12)'; ctx.strokeRect(chartX+.5, chartY+.5, chartW-1, chartH-1); ctx.restore();
      drawLabels(chartX,chartY,chartW,chartH);

      if(modeLabel){ modeLabel.textContent = `${snapshot.active?'LIVE':'PREVIEW'} ${snapshot.quality.toUpperCase()} · ${snapshot.partialCount} PARTIALS`; }
      if(readout){
        const lead=!snapshot.enabled?'Spectral field bypassed':snapshot.active?'Spectral field active':'Preview ready';
        readout.textContent=`${lead} • Morph ${s.spectralMorph}% • Stretch ${s.spectralStretch}% • Focus ${s.spectralFocus}% • Motion ${s.spectralMotion}%`;
      }
      if(chip){
        chip.textContent=!snapshot.enabled?'FIELD OFF':(s.spectralFreeze?'MOTION FROZEN':(snapshot.active?'LIVE TRACKING':'PREVIEW MODE'));
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
      const phase = latest.active ? latest.phase : ((performance.now?.()||Date.now())*0.0013*(.25+(state.spectralMotion||0)/100*2.5));
      const fresh=buildPreview(state,{baseFreq: latest.active && latest.partials?.[0]?.freq ? Math.max(55, latest.partials[0].freq) : 110, phase});
      fresh.active=latest.active; fresh.voices=latest.voices; draw(fresh);
    }
    subscribe(snapshot=>{ latest=snapshot; draw(latest); });
    new ResizeObserver(()=>resize()).observe(canvas);
    resize(); raf=requestAnimationFrame(loop);
  }


  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', attachVisualizer, {once:true});
  else setTimeout(attachVisualizer,0);

  return {ids,defaults:{...specs},read,load,display,create,stats:()=>({used,voices:voices.size,budget}),preview:buildPreview,subscribe,emit};
})();
