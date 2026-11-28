/* Dream Binder Spectral Synthesis I — additive partial synthesis, independent voice state. */
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
  function sanitize(s={}) {
    const out={};
    for(const id of ids){const d=specs[id], v=s[id];
      if(typeof d==='boolean')out[id]=v===true;
      else if(typeof d==='string')out[id]=Object.hasOwn(levels,v)?v:d;
      else {const n=Number(v);out[id]=clamp(v!=null&&Number.isFinite(n)?n:d, id==='spectralTilt'?-100:id==='spectralShift'?-120:0,id==='spectralShift'?120:100);}
    }return out;
  }
  function read(){return sanitize(Object.fromEntries(ids.map(id=>{const e=get(id);return [id,e?(e.type==='checkbox'?e.checked:e.value):specs[id]];})));}
  function display(){for(const id of ids){const el=get(id),out=get(id+'Value');if(out&&el)out.textContent=el.value+(id==='spectralShift'?' Hz':'%');}}
  function load(s){const state=sanitize(s);for(const id of ids){const el=get(id);if(!el)continue;if(el.type==='checkbox')el.checked=state[id];else el.value=state[id];}display();}
  function status(){const e=get('spectralBudget');if(e)e.textContent=`${used} / ${budget} allocated partials • release tails included`;}
  const smooth=(p,v,t,tau=.045)=>{p.setTargetAtTime(v,t,tau);};
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
  function refreshTimer(){const needs=[...voices].some(v=>!v.releasing&&!v.state.spectralFreeze&&v.state.spectralMotion>0&&v.state.spectralLevel>0);
    if(needs&&!timer)timer=setInterval(()=>{for(const v of voices){if(v.releasing||v.state.spectralFreeze||v.state.spectralMotion<=0||v.state.spectralLevel<=0||v.ctx.state!=='running')continue;const now=v.ctx.currentTime;v.phase+=Math.min(.16,Math.max(0,now-v.last))*(.25+v.state.spectralMotion/100*2.5);v.last=now;v.render(false);}},100);
    if(!needs&&timer){clearInterval(timer);timer=null;}
  }
  function create(ctx,f,destination){const s=read();if(!s.spectralEnabled||s.spectralLevel<=0)return null;
    const count=Math.min(levels[s.spectralQuality],budget-used,Math.max(1,Math.floor((ctx.sampleRate*.45)/f)));
    if(count<4)return null; // preserve base voice if spectral budget is exhausted
    const left=ctx.createStereoPanner(),right=ctx.createStereoPanner(),out=ctx.createGain();
    left.connect(out);right.connect(out);out.connect(destination);out.gain.value=0;
    const parts=[];const seed=Math.random()*6.283;
    const v={ctx,state:s,phase:0,last:ctx.currentTime,releasing:false,
      render(retune=true){const t=ctx.currentTime,st=v.state;let sum=0;
        for(const p of parts){const f2=pitch(f,p.n,st,seed);p.weight=f2>0&&f2<ctx.sampleRate*.45?weights(p.n,count,st,v.phase,seed):0;sum+=p.weight;if(retune)smooth(p.osc.frequency,clamp(f2,8,ctx.sampleRate*.45),t);}
        for(const p of parts)smooth(p.gain.gain,.72*p.weight/Math.max(.001,sum),t,.055);
        if(retune){smooth(left.pan,-st.spectralStereo/100,t);smooth(right.pan,st.spectralStereo/100,t);smooth(out.gain,st.spectralLevel/100*.65,t);}
      },
      update(id,value){if(v.releasing||!ids.includes(id)||id==='spectralEnabled'||id==='spectralQuality')return;v.state=sanitize({...v.state,[id]:value});v.last=ctx.currentTime;v.render();refreshTimer();},
      stop(delay=0){if(v.releasing)return;v.releasing=true;refreshTimer();const t=ctx.currentTime+Math.max(0,delay);for(const p of parts){try{p.osc.stop(t);}catch(_){}}}
    };
    let ended=0;function cleanup(){if(++ended!==parts.length)return;for(const p of parts){p.osc.disconnect();p.gain.disconnect();}left.disconnect();right.disconnect();out.disconnect();voices.delete(v);used-=count;status();refreshTimer();}
    for(let n=1;n<=count;n++){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=clamp(pitch(f,n,s,seed),8,ctx.sampleRate*.45);gain.gain.value=0;osc.connect(gain);gain.connect(n%2?left:right);osc.onended=cleanup;parts.push({n,osc,gain,weight:0});}
    used+=count;voices.add(v);v.render();for(const p of parts)p.osc.start();status();refreshTimer();return v;
  }
  return {ids,defaults:{...specs},read,load,display,create,stats:()=>({used,voices:voices.size,budget})};
})();
