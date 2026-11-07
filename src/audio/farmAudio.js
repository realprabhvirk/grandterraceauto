// One lazy, bounded synth graph on the existing master. Sources stay pooled at zero gain while idle.
import { makeRng } from '../utils/rng.js';
import { FARM_AUDIO as C } from './farmAudioConfig.js';

export function createFarmAudio(audio,{machines,animals}){
  let nodes=null,disposed=false;
  const st={nodesCreated:0,endedSources:0,elapsed:0,output:0,calls:{cow:0,sheep:0,dog:0}},rng=makeRng(C.seed);
  function init(){
    if(!audio.ready||!audio.master)return false;const ctx=audio.ctx;
    const mk=method=>{st.nodesCreated++;return ctx[method]();},out=mk('createGain');out.gain.value=0;out.connect(audio.master);
    const noise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*C.noiseSeconds),ctx.sampleRate),data=noise.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+C.brownMix*(rng.next()*2-1))/C.brownDivisor;data[i]=brown*C.brownGain;}
    const voices=C.voices.map((cfg,i)=>{
      const tone=mk('createOscillator'),source=mk('createBufferSource'),noiseGain=mk('createGain'),filter=mk('createBiquadFilter'),amp=mk('createGain'),env=mk('createGain'),level=mk('createGain'),lfo=mk('createOscillator'),lfoGain=mk('createGain');
      tone.type=cfg.loop?'sawtooth':'triangle';tone.frequency.value=cfg.freq;source.buffer=noise;source.loop=true;noiseGain.gain.value=cfg.noise;
      filter.type='lowpass';filter.frequency.value=cfg.filter;amp.gain.value=C.ampBase;lfo.frequency.value=cfg.rate;lfoGain.gain.value=C.ampDepth;env.gain.value=cfg.loop?1:0;level.gain.value=0;
      tone.connect(filter);source.connect(noiseGain);noiseGain.connect(filter);filter.connect(amp);lfo.connect(lfoGain);lfoGain.connect(amp.gain);amp.connect(env);env.connect(level);level.connect(out);
      const ended=()=>{st.endedSources++;};tone.onended=source.onended=lfo.onended=ended;tone.start();source.start();lfo.start();
      return {cfg,tone,source,filter,env,level,lfo,amp,noiseGain,lfoGain,rng:rng.fork(i+1),nextCall:cfg.initial||0,calls:0,distance:Infinity,sourceId:null,target:0,lastLevel:NaN,lastFreq:cfg.freq,lastRate:cfg.rate};
    });nodes={ctx,master:audio.master,out,voices,lastOutput:NaN};return true;
  }
  function set(param,value,last,now,fade=C.fade){if(!Number.isFinite(last)||Math.abs(last-value)>C.epsilon){param.setTargetAtTime(value,now,fade);return value;}return last;}
  function call(v,now){
    const c=v.cfg,f=c.freq*v.rng.range(C.callPitchMin,C.callPitchMax);v.tone.frequency.cancelScheduledValues(now);v.tone.frequency.setValueAtTime(f,now);v.tone.frequency.linearRampToValueAtTime(f*C.callPeakPitch,now+c.attack);v.tone.frequency.exponentialRampToValueAtTime(f*C.callEndPitch,now+c.duration);
    const p=v.env.gain;p.cancelScheduledValues(now);p.setValueAtTime(0,now);p.linearRampToValueAtTime(1,now+c.attack);p.exponentialRampToValueAtTime(C.envelopeFloor,now+c.duration);p.setValueAtTime(0,now+c.duration+C.envelopeTail);v.calls++;st.calls[c.kind]++;v.nextCall=v.rng.range(c.intervalMin,c.intervalMax);
  }
  function dispose(){if(disposed)return;disposed=true;window.removeEventListener('pagehide',onPageHide);if(!nodes)return;nodes.out.gain.cancelScheduledValues(nodes.ctx.currentTime);nodes.out.gain.value=0;nodes.out.disconnect();for(const v of nodes.voices){v.tone.stop();v.source.stop();v.lfo.stop();for(const n of [v.tone,v.source,v.filter,v.env,v.level,v.lfo,v.amp,v.noiseGain,v.lfoGain])n.disconnect();}st.output=0;}
  const onPageHide=e=>{if(!e.persisted)dispose();};
  window.addEventListener('pagehide',onPageHide);
  return {state:st,get ready(){return !!nodes&&!disposed;},get nodes(){return nodes;},dispose,
    update(dt,listener,cutscene){
      if(disposed||(!nodes&&!init()))return;const now=nodes.ctx.currentTime;st.elapsed+=dt;st.output=dt>0?(cutscene?C.duck:1):0;
      nodes.lastOutput=set(nodes.out.gain,st.output,nodes.lastOutput,now); // AudioContext time fades even while game dt is zero.
      for(const v of nodes.voices){const c=v.cfg;let distance=Infinity,speed=0,id=null;
        if(c.loop){for(const m of machines)if(m.kind===c.kind&&!m.sleeping){const d=Math.hypot(m.pose.x-listener.x,m.pose.z-listener.z);if(d<distance){distance=d;speed=m.v;id=m.id;}}}
        else{for(const a of animals)if(a.kind===c.kind&&!a.asleep&&a.down<=0){const d=Math.hypot(a.pos.x-listener.x,a.pos.z-listener.z);if(d<distance){distance=d;id=a.id;}}}
        v.distance=distance;v.sourceId=id;const falloff=Math.max(0,1-distance/c.range);v.target=c.gain*falloff*falloff;v.lastLevel=set(v.level.gain,v.target,v.lastLevel,now);
        if(c.loop){v.lastFreq=set(v.tone.frequency,c.freq+speed*c.freqSpeed,v.lastFreq,now,C.frequencyFade);v.lastRate=set(v.lfo.frequency,c.rate+speed*c.rateSpeed,v.lastRate,now,C.frequencyFade);}
        else if(dt>0){v.nextCall-=dt;if(v.target>C.epsilon&&v.nextCall<=0)call(v,now);}
      }
    },
  };
}
