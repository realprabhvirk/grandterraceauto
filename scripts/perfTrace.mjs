// Opt-in test-page diagnostics. No hooks or allocations are added to the shipped game.
export async function installPerfTrace(page){
 await page.evaluate(()=>{
  const g=__gta,gl=g.renderer.getContext(),N=180,data=Array.from({length:N},()=>new Float64Array(7));
  let active=false,start=0,index=0,count=0,last=0,renderMs=0,heap=0,frames=0;
  const shader=[],longTasks=[],bounded=(a,v)=>{if(a.length===64)a.shift();a.push(v);};
  const render=g.renderer.render;g.renderer.render=function(...args){const t=performance.now();try{return render.apply(this,args);}finally{if(active)renderMs+=performance.now()-t;}};
  for(const name of ['getProgramInfoLog','getProgramParameter','compileShader','linkProgram']){
   const original=gl[name];gl[name]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-t;if(active&&ms>1)bounded(shader,{at:t-start,name,ms});}};
  }
  if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>{if(active)for(const e of list.getEntries())if(e.startTime>=start)bounded(longTasks,{at:e.startTime-start,ms:e.duration});}).observe({type:'longtask'});
  function frame(t){if(active){if(++frames%15===0)heap=performance.memory?.usedJSHeapSize||0;const a=data[index];a[0]=performance.now()-start;a[1]=last?t-last:0;a[2]=renderMs;a[3]=performance.now()-t;a[4]=g.stats().fps;a[5]=g.renderer.info.render.calls;a[6]=heap;index=(index+1)%N;count=Math.min(N,count+1);}last=t;renderMs=0;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  window.__perfTrace={
   begin(){active=true;start=performance.now();index=count=frames=0;last=renderMs=0;shader.length=longTasks.length=0;},
   end(){active=false;const rows=[];for(let i=0;i<count;i++)rows.push(Array.from(data[(index-count+i+N)%N]));return {columns:['atMs','frameMs','renderMs','callbackLagMs','overlayFps','calls','heapBytes'],rows,shader:shader.slice(),longTasks:longTasks.slice(),state:{camera:g.controls.cameraMode,mode:g.controls.mode,paused:g.mapUI.open,cutscene:g.cutscene.active,wanted:g.wanted.stars,carHealth:g.controls.car?.health,awake:g.peds.stats().awake,police:g.police.cars.length,light:g.shopLight.intensity,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures}};},
  };
 });
}
