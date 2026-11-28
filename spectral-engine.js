/* Dream Binder Spectral Synthesis IV.1 — adaptive linear frequency display. */
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
  function load(s){const state=sanitize(s);for(const id of ids){const el=get(id);if(!el)continue;if(el.type==='checkbox')el.checked=state[id];else el.value=state[id];}display();}
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

  // Read-only display snapshot; live values are the targets already calculated by the audio engine.
  function snapshot(phase=0){
    let live=null; for(const v of voices) if(!v.releasing) live=v;
    if(live)return {active:true,state:live.state,base:live.baseFreq,parts:live.parts,count:live.parts.length,used,voices:voices.size};
    const s=read(),base=110,count=levels[s.spectralQuality],seed=1.731,parts=[];
    let sum=0; for(let n=1;n<=count;n++){const f=pitch(base,n,s,seed),w=f>0&&f<21600?weights(n,count,s,phase,seed):0;sum+=w;parts.push({n,freq:clamp(f,8,21600),weight:w});}
    for(const p of parts)p.amp=.72*p.weight/Math.max(.001,sum)*s.spectralLevel/100*.65;
    return {active:false,state:s,base,parts,count,used,voices:voices.size};
  }
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
    const v={ctx,state:s,phase:0,last:ctx.currentTime,releasing:false,baseFreq:f,seed,parts,
      render(retune=true){
        const t=ctx.currentTime,st=v.state; let sum=0;
        for(const p of parts){
          const f2=pitch(f,p.n,st,seed);
          p.weight=f2>0&&f2<ctx.sampleRate*.45?weights(p.n,count,st,v.phase,seed):0;
          p.freq=clamp(f2,8,ctx.sampleRate*.45);
          sum+=p.weight;
          if(retune) smooth(p.osc.frequency,clamp(f2,8,ctx.sampleRate*.45),t);
        }
        for(const p of parts){const a=.72*p.weight/Math.max(.001,sum); p.amp=a*st.spectralLevel/100*.65; smooth(p.gain.gain,a,t,.055);}
        if(retune){
          smooth(left.pan,-st.spectralStereo/100,t);
          smooth(right.pan,st.spectralStereo/100,t);
          smooth(out.gain,st.spectralLevel/100*.65,t);
        }
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
        }
    };
    let ended=0;
    function cleanup(){
      if(++ended!==parts.length) return;
      for(const p of parts){p.osc.disconnect(); p.gain.disconnect();}
      left.disconnect(); right.disconnect(); out.disconnect();
      voices.delete(v); used-=count; status(); refreshTimer();
    }
    for(let n=1;n<=count;n++){
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='sine'; osc.frequency.value=clamp(pitch(f,n,s,seed),8,ctx.sampleRate*.45); gain.gain.value=0;
      osc.connect(gain); gain.connect(n%2?left:right); osc.onended=cleanup;
      parts.push({n,osc,gain,weight:0});
    }
    used+=count; voices.add(v); v.render(); for(const p of parts) p.osc.start(); status(); refreshTimer(); return v;
  }


  function attachVisualizer(){
    const canvas=get('dbSpectralCanvas'); if(!canvas||canvas.dataset.bound)return;
    const c=canvas.getContext('2d',{alpha:false}); if(!c)return; canvas.dataset.bound='1';
    const shell=canvas.closest('.db-spectral-shell'), module=canvas.closest('details');
    const axis=get('dbSpectralAxis'),mode=get('dbSpectralMode'),readout=get('dbSpectralReadout'),chip=get('dbSpectralFreezeChip'),view=get('dbSpectralView');
    let frequency=false,visible=false,raf=0,last=0,phase=0,prev=0,key='',W=0,H=0;
    const set=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
    function draw(snap){
      const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
      if(r.width<100||r.height<70)return;
      W=r.width;H=r.height;const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
      if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
      c.setTransform(pw/W,0,0,ph/H,0,0);
      const s=snap.state,L=34,T=13,R=W-13,B=H-25,w=R-L,h=B-T;
      // Hz view: show actual frequency spacing, zoomed to the allocated spectrum.
      // Include silent allocated partials so density changes do not rescale the axis.
      const highest=Math.max(100,...snap.parts.map(p=>p.freq));
      const target=highest*1.06/Math.max(2,Math.min(8,Math.floor(w/48)));
      const power=10**Math.floor(Math.log10(target));
      const step=([1,2,2.5,5,10].find(n=>n*power>=target)||10)*power;
      const end=Math.ceil(highest*1.06/step)*step;
      const x=f=>L+f/end*w;
      const xp=n=>L+(n-.5)/snap.count*w;
      const y=db=>B-(clamp(db,-60,0)+60)/60*h;
      const db=a=>20*Math.log10(Math.max(a,1e-8));
      c.fillStyle='#080c14';c.fillRect(0,0,W,H);
      const bg=c.createLinearGradient(0,T,0,B);bg.addColorStop(0,'#10192a');bg.addColorStop(1,'#060a12');c.fillStyle=bg;c.fillRect(L,T,w,h);
      c.font='9px system-ui';c.textBaseline='middle';c.lineWidth=1;
      for(let d=0;d>=-60;d-=12){const yy=y(d);c.strokeStyle=d===0?'#415268':'#243345';c.beginPath();c.moveTo(L,yy+.5);c.lineTo(R,yy+.5);c.stroke();c.fillStyle='#9caec2';c.textAlign='right';c.fillText(String(d),L-5,yy);}
      const ticks=frequency?Array.from({length:Math.round(end/step)+1},(_,i)=>i*step):Array.from(new Set([1,Math.ceil(snap.count/4),Math.ceil(snap.count/2),Math.ceil(snap.count*3/4),snap.count]));
      c.textAlign='center';c.textBaseline='top';
      for(const t of ticks){const xx=frequency?x(t):xp(t);c.strokeStyle='#203043';c.beginPath();c.moveTo(xx,T);c.lineTo(xx,B);c.stroke();c.fillStyle='#9caec2';const label=frequency?(t>=1000?Number((t/1000).toFixed(3))+'k':String(t)):'H'+t;const tw=c.measureText(label).width;c.fillText(label,clamp(xx,tw/2+2,W-tw/2-2),B+6);}
      // Focus is the actual harmonic index used by the synthesis equation.
      const focus=1+(snap.count-1)*s.spectralFocus/100,spread=Math.max(1,snap.count*(.055+s.spectralBlur/100*.22));
      const focusFreq=n=>{const a=snap.parts[Math.max(0,Math.min(snap.count-1,Math.round(n)-1))];return a?.freq||snap.base;};
      const fa=frequency?x(focusFreq(focus-spread)):xp(focus-spread),fb=frequency?x(focusFreq(focus+spread)):xp(focus+spread);
      c.save();c.beginPath();c.rect(L,T,w,h);c.clip();
      c.fillStyle='#b9945018';c.fillRect(Math.min(fa,fb),T,Math.abs(fb-fa),h);
      const fcenter=frequency?x(focusFreq(focus)):xp(focus);c.strokeStyle='#ceaf6277';c.setLineDash([3,4]);c.beginPath();c.moveTo(fcenter,T);c.lineTo(fcenter,B);c.stroke();c.setLineDash([]);
      const points=[];let peak=null;
      for(const p of snap.parts){if(p.amp<=0||db(p.amp)<-60)continue;const xx=frequency?x(p.freq):xp(p.n),yy=y(db(p.amp));points.push({x:xx,y:yy,n:p.n});if(!peak||p.amp>peak.amp)peak=p;}
      points.sort((a,b)=>a.x-b.x);
      if(points.length>1){c.beginPath();c.moveTo(points[0].x,B);for(const p of points)c.lineTo(p.x,p.y);c.lineTo(points[points.length-1].x,B);c.closePath();const fill=c.createLinearGradient(0,T,0,B);fill.addColorStop(0,'#9977ec44');fill.addColorStop(1,'#497ec50d');c.fillStyle=fill;c.fill();}
      const bw=Math.max(1,Math.min(5,w/snap.count*.32));const bars=c.createLinearGradient(0,T,0,B);bars.addColorStop(0,'#e5d5ff');bars.addColorStop(.45,'#aa83f1');bars.addColorStop(1,'#377caa');
      c.fillStyle=bars;for(let i=0;i<points.length;i++){const p=points[i];const gap=Math.min(i?p.x-points[i-1].x:Infinity,i+1<points.length?points[i+1].x-p.x:Infinity);const width=frequency?Math.max(.75,Math.min(bw,gap*.62)):bw;c.fillRect(p.x-width/2,p.y,width,B-p.y);}
      if(points.length>1){c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.strokeStyle='#81d9eb';c.lineWidth=1.1;c.stroke();}
      c.fillStyle='#d6eeff';for(const p of points){const tip=frequency?Math.min(2,bw):4;c.fillRect(p.x-tip/2,p.y-1,tip,2);}
      c.restore();c.strokeStyle='#46536b';c.lineWidth=1;c.strokeRect(L+.5,T+.5,w-1,h-1);
      set(mode,`${snap.active?'LIVE':'MODEL'} · ${s.spectralQuality.toUpperCase()} / ${snap.count}`);
      set(axis,frequency?'AUTO RANGE / Hz (LINEAR)':'PARTIAL INDEX / HARMONICS');
      set(chip,snap.active?(s.spectralFreeze?'FROZEN':s.spectralMotion?'LIVE':'STATIC'):(s.spectralEnabled?(s.spectralFreeze?'FROZEN':'PREVIEW'):'BYPASSED'));
      set(readout,`${snap.active?'Voice':'A2 model'} ${snap.base.toFixed(1)} Hz · ${peak?'Peak H'+peak.n+' / '+peak.freq.toFixed(0)+' Hz':'No partials above −60 dB'} · ${snap.used}/144 allocated`);
    }
    function shown(){return visible&&!document.hidden&&module.open&&canvas.getClientRects().length>0&&get('dm-modal')?.hidden!==false;}
    function tick(ts){raf=0;if(!shown())return; if(ts-last>=1000/30){const state=read();const dt=prev?Math.min(.1,(ts-prev)/1000):0;prev=ts;last=ts;if(state.spectralEnabled&&!state.spectralFreeze&&state.spectralMotion>0)phase+=dt*(.25+state.spectralMotion/100*2.5);const snap=snapshot(phase);const next=JSON.stringify([frequency,snap.active,snap.state,snap.base,snap.used,snap.parts.map(p=>[p.freq,p.amp]),canvas.clientWidth,canvas.clientHeight]);if(next!==key){key=next;draw(snap);}}
      raf=requestAnimationFrame(tick);
    }
    function wake(){if(shown()){if(!raf){prev=0;key='';raf=requestAnimationFrame(tick);}}else if(raf){cancelAnimationFrame(raf);raf=0;}}
    view.addEventListener('click',()=>{frequency=!frequency;view.textContent=frequency?'Hz':'PARTIALS';view.setAttribute('aria-pressed',String(frequency));key='';wake();});
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;wake();});observer.observe(canvas);
    new ResizeObserver(()=>{key='';wake();}).observe(canvas);
    module.addEventListener('toggle',wake);document.addEventListener('visibilitychange',wake);
    // Wake when tabs or the Matrix overlay change visibility.
    const mo=new MutationObserver(wake);for(const e of [get('dbPaneSource'),get('dm-modal')])if(e)mo.observe(e,{attributes:true,attributeFilter:['hidden','class','style']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', attachVisualizer, {once:true});
  else setTimeout(attachVisualizer,0);

  return {ids,defaults:{...specs},read,load,display,create,stats:()=>({used,voices:voices.size,budget}),snapshot};
})();
