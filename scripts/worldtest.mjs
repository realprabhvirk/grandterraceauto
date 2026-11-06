// Incremental Task004 acceptance. Additional content sections are added with their phases.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const want=new Set(process.argv.slice(2)),run=n=>!want.size||want.has(n);
const roadFilter=process.argv.find(a=>a.startsWith('--road='))?.slice(7);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('?cam=player',process.env.GTA_URL||'http://127.0.0.1:5173/').href);
 await page.waitForFunction(()=>window.__gta?.ready,null,{timeout:90000});
 if(run('roads')){
  const r=await page.evaluate(async()=>{
   const g=__gta,w=g.world,rural=w.rural,lanes=g.traffic.graph.lanes;
   if(!rural)throw Error('Rural world not built');
   const bfs=start=>{const seen=new Set([start]),q=[start];for(let i=0;i<q.length;i++)for(const e of [...lanes[q[i]].exits,...lanes[q[i]].branches])if(!seen.has(e.lane)){seen.add(e.lane);q.push(e.lane);}return seen;};
   const forward=bfs(g.traffic.graph.fwd.id),ruralLanes=lanes.filter(l=>l.road?.rural);
   const unreachable=ruralLanes.filter(l=>!forward.has(l.id)||!bfs(l.id).has(g.traffic.graph.fwd.id)).map(l=>l.name);
   const missingSigns=rural.roads.filter(r=>!w.citySigns.registry.limits.some(s=>s.road===r.name&&s.limit===r.speedLimit)).map(r=>r.name);
   const missingBlades=rural.nodes.filter(n=>n.links.length>=2&&!w.citySigns.registry.blades.some(s=>s.x===n.x&&s.z===n.z)).map(n=>n.id);
   const names=rural.roads.map(r=>r.name),badLimits=rural.roads.filter(r=>r.speedLimit!==(r.track||r.base?40:80)).map(r=>r.name);
   const badLanes=ruralLanes.filter(l=>{const p=l.pts[0],dx=Math.sign(l.to.x-l.from.x),dz=Math.sign(l.to.z-l.from.z),left=(p.x-l.from.x)*dz-(p.z-l.from.z)*dx;return !l.exits.length||!Number.isFinite(l.len)||l.len<1||Math.abs(left-1.8)>.001||l.pts.some(p=>!Number.isFinite(p.x+p.z));}).map(l=>l.name);
   const {CORRIDOR}=await import('/src/world/terrain.js');let samples=0,maxError=0,maxStep=0,missing=0;const ghosts=[];
   const P=g.physics,R=g.RAPIER,shape=new R.Cuboid(.85,.7,2),ignore=new Set(['terrain','car','traffic','police sensor','ped','player']);
   for(const r of rural.roads){const S=r.samples;for(let i=0;i<S.length;i++){
    const s=S[i];for(let lat=-r.halfW-1;lat<=r.halfW+1;lat+=.5){const x=s.x+s.nx*lat+.001,z=s.z+s.nz*lat+.001,h=w.terrain.getHeight(x,z);samples++;
     const hit=P.world.castRay(new R.Ray({x,y:h+10,z},{x:0,y:-1,z:0}),20,true,undefined,undefined,undefined,undefined,c=>P.tagOf(c.handle).type==='terrain');
     if(!hit)missing++;else maxError=Math.max(maxError,Math.abs(h+10-hit.timeOfImpact-h));
     if(i>0){const prev=S[i-1],ph=w.terrain.getHeight(prev.x+prev.nx*lat+.001,prev.z+prev.nz*lat+.001);maxStep=Math.max(maxStep,Math.abs(h-ph));}
    }
    if(i%2===0)for(const lat of [-2,0,2]){const x=s.x+s.nx*lat,z=s.z+s.nz*lat,y=w.terrain.getHeight(x,z)+1.05,yaw=Math.atan2(s.tx,s.tz);P.world.intersectionsWithShape({x,y,z},{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},shape,c=>{const tag=P.tagOf(c.handle);if(c.isEnabled()&&!ignore.has(tag.type)&&ghosts.length<20)ghosts.push({road:r.name,tag,x,z});return true;});}
   }}
   return {roads:rural.roads.length,lanes:ruralLanes.length,unreachable,missingSigns,missingBlades,badLimits,badLanes,unique:new Set(names).size===names.length,samples,maxError,maxStep,missing,ghosts,paths:rural.pedLines.length,sites:rural.sites.map(s=>({id:s.id,x:s.x,z:s.z})),CORRIDOR};
  });
  console.log('Road evidence',JSON.stringify(r));assert.ok(r.roads>=12&&r.lanes>=r.roads*2);for(const k of ['unreachable','missingSigns','missingBlades','badLimits','badLanes','ghosts'])assert.deepEqual(r[k],[],k);assert.ok(r.unique);assert.ok(r.paths>0);assert.equal(r.missing,0);assert.ok(r.maxError<=.01);assert.ok(r.maxStep<=.02);console.log('PASS roads: directed connectivity, signs, limits, full-width terrain and ghost scan');
 }
 if(run('drive')){
  await page.evaluate(async()=>{const g=__gta;g.debug.enter(g.vehicles.cars.findIndex(c=>c.type==='sedan'&&!c.dead));await new Promise(r=>setTimeout(r,1400));g.wanted.clear(true);g.police.reset();});
  const roads=(await page.evaluate(()=>__gta.world.rural.roads.map(r=>r.name))).filter(n=>!roadFilter||n===roadFilter);
  assert.ok(roads.length,'requested road must exist');
  for(const name of roads)for(const dir of [1,-1]){
   const r=await page.evaluate(async({name,dir})=>{const g=__gta,c=g.controls.car,road=g.world.rural.roads.find(r=>r.name===name),S=dir===1?road.samples:[...road.samples].reverse(),points=[];
    for(let i=1;i<S.length-1;i+=3){const s=S[i];points.push({x:s.x-s.nx*1.8*dir,z:s.z-s.nz*1.8*dir});}
    const end=S[S.length-2];points.push({x:end.x-end.nx*1.8*dir,z:end.z-end.nz*1.8*dir});
    c.health=100;c.dead=false;c.body.dead=false;g.wanted.clear(true);g.police.reset();const d0=g.combat.damageLog.length;g.controls.input.setVirtual('ShiftLeft',true);
    const obstacles=[...g.vehicles.cars.filter(v=>v!==c&&!v.impounded),...g.traffic.cars.map(t=>({position:t.pos}))];
    const res=await g.debug.drivePoints(points,{speed:80,timeout:120,obstacles});g.controls.input.setVirtual('ShiftLeft',false);
    return {name,dir,...res,length:road.length,health:c.health,damage:g.combat.damageLog.slice(d0),traffic:g.traffic.cars.length,parked:g.vehicles.cars.length};
   },{name,dir});console.log('Driving',JSON.stringify(r));assert.ok(r.ok,`${name} direction${dir}: ${r.reason}`);assert.ok(r.dist>=r.length-10,'drive must traverse the road');assert.deepEqual(r.damage,[]);assert.equal(r.health,100);assert.ok(r.maxTilt<30);assert.ok(r.traffic>0&&r.parked>0);
  }console.log(`PASS drive: ${roads.length} selected rural roads, both directions, full throttle, no damage/flips`);
 }
 assert.deepEqual(errors,[]);console.log('PASS world: no page errors');
}finally{await browser.close();}
