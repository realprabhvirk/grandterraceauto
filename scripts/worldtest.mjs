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
 if(run('walking')){
  const r=await page.evaluate(()=>{const g=__gta,rural=g.world.rural,{lines,links,suburbLines}=g.peds.graph,ids=rural.pedLines.map(l=>lines.indexOf(l)),ruralIds=new Set(ids),unreachable=[];
   for(const start of ids){const seen=new Set([start]),q=[start];for(let i=0;i<q.length;i++)for(const e of [...links[q[i]].start,...links[q[i]].end])if(!seen.has(e.line)){seen.add(e.line);q.push(e.line);}
    if(ids.some(id=>!seen.has(id))||!q.some(id=>id>=suburbLines&&!ruralIds.has(id)))unreachable.push(start);
   }
   const badPoints=[];for(const id of ids)for(const p of lines[id])if(!Number.isFinite(p.x+p.y+p.z)||Math.abs(p.y-g.world.terrain.getHeight(p.x,p.z))>.01){if(badPoints.length<8)badPoints.push({id,x:p.x,z:p.z,y:p.y});}
   const north=g.peds.peds.filter(p=>p.area==='north'),civilian=g.peds.peds.filter(p=>['north','town','downtown','beach'].includes(p.area));
   return {lines:ids.length,edges:rural.edges.length,marked:ids.every(id=>lines[id].rural),unreachable,badPoints,north:north.length,misplaced:civilian.filter(p=>ruralIds.has(p.li)).map(p=>p.id)};
  });console.log('Walking evidence',JSON.stringify(r));assert.ok(r.lines>=r.edges*2);assert.ok(r.marked);assert.deepEqual(r.unreachable,[]);assert.deepEqual(r.badPoints,[]);assert.equal(r.north,4);assert.deepEqual(r.misplaced,[]);console.log('PASS walking: rural junctions/civilian verge links and legacy resident routes');
 }
 if(run('farmstatic')){
  const r=await page.evaluate(async()=>{
   const g=__gta,{ICON}=await import('/src/ui/mapIcons.js'),farms=g.world.rural.farms;
   if(!farms)throw Error('Farm clusters not built');
   const required=['farmhouse','barn','shed','silo','tank','windmill','paddock','crop','orchard','hay','scarecrow','dam','track'],failures=[],summaries=[];
   let lights=0,totalCrops=0;g.scene.traverse(o=>{if(o.isLight&&o.castShadow)lights++;});
   for(const f of farms){
    for(const kind of required)if(!f.features.some(p=>p.kind===kind))failures.push(`${f.id}: missing ${kind}`);
    let triangles=0;f.group.traverse(m=>{if(m.isMesh&&m.geometry.attributes.position)triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});
    const crops=f.fields.reduce((s,p)=>s+p.mesh.count,0);totalCrops+=crops;
    const solids=[];g.physics.world.forEachCollider(c=>{const tag=g.physics.tagOf(c.handle);if(tag.type==='farm'&&tag.owner.startsWith(`${f.id}:`))solids.push(c);});
    if(solids.length<10||triangles<500||crops<20||f.orchard.trunks.length<4||!f.paddocks.length)failures.push(`${f.id}: missing physical/instanced content`);
    for(const kind of ['farmhouse','barn','shed','silo','tank'])if(!solids.some(c=>g.physics.tagOf(c.handle).owner.startsWith(`${f.id}:${kind}`)))failures.push(`${f.id}: missing solid ${kind}`);
    if(!solids.some(c=>c.shape.type===g.RAPIER.ShapeType.Cylinder))failures.push(`${f.id}: native round collider missing`);
    const barn=f.config.barn,bh=g.world.terrain.getHeight(barn.x,barn.z);
    const roof=g.physics.world.castRay(new g.RAPIER.Ray({x:barn.x,y:bh+30,z:barn.z+barn.d/4},{x:0,y:-1,z:0}),40,true,undefined,undefined,undefined,undefined,c=>g.physics.tagOf(c.handle).owner===`${f.id}:barn-roof`);
    if(!roof)failures.push(`${f.id}: visible pitched roof not solid`);
    const dam=f.config.dam,water=g.world.rural.water.find(b=>dam.x>=b.x0&&dam.x<=b.x1&&dam.z>=b.z0&&dam.z<=b.z1);
    if(!water||water.y-g.world.terrain.getHeight(dam.x,dam.z)<.5)failures.push(`${f.id}: dam has no real depth`);
    const sign=f.sign,n=sign.mesh.geometry.attributes.normal,near=g.world.network.index.nearest(sign.x,sign.z,20),dx=near.sample.x-sign.x,dz=near.sample.z-sign.z;
    if((n.getX(0)*dx+n.getZ(0)*dz)/Math.hypot(dx,dz)<.9)failures.push(`${f.id}: sign faces away from approach road`);
    for(let i=1;i<f.config.track.length;i++){const [ax,az]=f.config.track[i-1],[bx,bz]=f.config.track[i],length=Math.hypot(bx-ax,bz-az),tx=(bx-ax)/length,tz=(bz-az)/length;
      for(let s=0;s<=length;s+=.5)for(const lat of [-2.25,0,2.25]){const x=ax+tx*s-tz*lat,z=az+tz*s+tx*lat;if(Math.abs(g.world.terrain.getHeight(x,z)+4.4)>.004)failures.push(`${f.id}: private yard track not flush`);}
    }
    if(!g.world.places.some(p=>p.kind==='farm'&&p.label===f.label))failures.push(`${f.id}: marker missing`);
    summaries.push({id:f.id,triangles,crops,solids:solids.length,trees:f.orchard.trunks.length,rotor:f.windmill.rotor.rotation.z});
   }
   return {farms:farms.length,failures,summaries,totalCrops,lights,icon:ICON.farm?.label};
  });console.log('Farm construction',JSON.stringify(r));assert.equal(r.farms,3);assert.deepEqual(r.failures,[]);assert.ok(r.totalCrops>=1000);assert.equal(r.lights,1);assert.equal(r.icon,'Farm');
  for(const dusk of [0,1]){await page.evaluate(dusk=>__gta.lighting.setDusk(dusk),dusk);for(let i=0;i<r.farms;i++){
   await page.evaluate(i=>{const f=__gta.world.rural.farms[i];__gta.debug.teleport(f.access.x,f.access.z,0);},i);await page.waitForTimeout(2700);
   const a=await page.evaluate(i=>{const g=__gta,f=g.world.rural.farms[i];return {visible:f.group.visible,rotor:f.windmill.rotor.rotation.z,stats:g.stats(),calls:g.renderer.info.render.calls};},i);
   await page.waitForTimeout(300);const angle=await page.evaluate(i=>__gta.world.rural.farms[i].windmill.rotor.rotation.z,i);
   console.log('Farm view',i,'dusk',dusk,JSON.stringify(a));assert.ok(a.visible);assert.notEqual(a.rotor,angle);assert.ok(a.stats.fps>=45);assert.ok(a.calls<600);
  }}
  await page.evaluate(()=>__gta.mapUI.setMode(2));await page.waitForTimeout(100);
  const pausedRotor=await page.evaluate(()=>__gta.world.rural.farms[2].windmill.rotor.rotation.z);await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>__gta.world.rural.farms[2].windmill.rotor.rotation.z),pausedRotor);
  await page.evaluate(()=>{__gta.mapUI.setMode(1);__gta.lighting.setDusk(0);});await page.waitForTimeout(200);
  assert.notEqual(await page.evaluate(()=>__gta.world.rural.farms[2].windmill.rotor.rotation.z),pausedRotor);
  await page.evaluate(()=>__gta.debug.teleport(900,-400,0));await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>__gta.world.rural.farms.every(f=>!f.group.visible)));console.log('PASS farms: real structures/crops/solids/maps, windmill pumps, pause/resume, culling and day/night farm-view budget');
 }
 if(run('farmers')){
  const r=await page.evaluate(()=>{const g=__gta,ps=g.peds.peds.filter(p=>p.role==='farmer'),counts={},blocked=[];let tools=0;
   for(const p of ps){counts[p.home.farmId]=(counts[p.home.farmId]||0)+1;if(p.workTool?.isMesh)tools++;
    const route=p.home.route,shape=new g.RAPIER.Capsule(.55,.28);
    for(let i=0;i<route.length;i++){const a=route[i],b=route[(i+1)%route.length],len=Math.hypot(b.x-a.x,b.z-a.z);
     for(let s=0;s<=len;s+=1){const x=a.x+(b.x-a.x)*s/len,z=a.z+(b.z-a.z)*s/len,y=g.world.terrain.getHeight(x,z)+.88;
      g.physics.world.intersectionsWithShape({x,y,z},{x:0,y:0,z:0,w:1},shape,c=>{const tag=g.physics.tagOf(c.handle);if(c.isEnabled()&&['farm','building','landmark','door'].includes(tag.type)&&blocked.length<12)blocked.push({ped:p.id,x,z,tag});return true;});
     }
    }
   }return {count:ps.length,counts,tools,blocked,total:g.peds.peds.length,ids:ps.filter(p=>p.home.route?.length>=4).map(p=>p.id)};
  });console.log('Farmer registry/paths',JSON.stringify(r));assert.equal(r.count,6);assert.equal(r.tools,6);assert.equal(r.ids.length,6);assert.deepEqual(Object.values(r.counts),[2,2,2]);assert.deepEqual(r.blocked,[]);
  for(const id of [r.ids[0],r.ids[2],r.ids[4]]){
   await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);__gta.debug.teleport(p.pos.x+5,p.pos.z+5,-3*Math.PI/4);},id);await page.waitForTimeout(350);
   const a=await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);return {x:p.pos.x,z:p.pos.z,work:p.workT,action:p.jobAction,arm:p.ch.bones.rShoulder.rotation.x};},id);
   assert.ok(a.work>0&&a.action==='farmWork'&&Math.abs(a.arm)>.1,JSON.stringify(a));await page.waitForTimeout(2700);
   const b=await page.evaluate(id=>{const g=__gta,p=g.peds.peds.find(p=>p.id===id),screen=p.pos.clone();screen.y+=1;screen.project(g.camera);return {x:p.pos.x,z:p.pos.z,visible:p.ch.root.visible,screen:{x:screen.x,y:screen.y,z:screen.z},fps:g.stats().fps,calls:g.renderer.info.render.calls};},id);console.log('Working farmer view',id,JSON.stringify(b));assert.ok(b.visible&&Math.hypot(b.x-a.x,b.z-a.z)>.5,JSON.stringify({a,b}));assert.ok(Math.abs(b.screen.x)<=1&&Math.abs(b.screen.y)<=1&&b.screen.z>=-1&&b.screen.z<=1);assert.ok(b.fps>=45&&b.calls<600);
  }
  const id=r.ids[4];await page.evaluate(()=>__gta.mapUI.setMode(2));await page.waitForTimeout(100);
  const paused=await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);return [p.pos.x,p.pos.z,p.workT];},id);await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);return [p.pos.x,p.pos.z,p.workT];},id),paused);
  await page.evaluate(()=>{__gta.mapUI.setMode(1);__gta.debug.teleport(900,-400,0);});await page.waitForTimeout(200);
  const sleeping=await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);return [p.pos.x,p.pos.z,p.ch.root.visible];},id);await page.waitForTimeout(350);
  assert.equal(sleeping[2],false);assert.deepEqual(await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);return [p.pos.x,p.pos.z,p.ch.root.visible];},id),sleeping);
  await page.evaluate(id=>{const g=__gta,p=g.peds.peds.find(p=>p.id===id);g.debug.teleport(p.pos.x+5,p.pos.z+5,0);g.peds.alarm(p.pos,10);},id);await page.waitForTimeout(150);
  assert.ok(await page.evaluate(id=>{const p=__gta.peds.peds.find(p=>p.id===id);return (p.flee>0||p.cower>0)&&!p.workTool.visible;},id));
  await page.evaluate(id=>{const g=__gta,p=g.peds.peds.find(p=>p.id===id);g.peds.revive(p);p.flee=0;p.cower=0;p.startled=0;},id);await page.waitForTimeout(250);
  const shot=await page.evaluate(id=>{const g=__gta,p=g.peds.peds.find(p=>p.id===id),wasWorking=p.workT>0;g.peds.shoot(p,10,g.controls.player.position);return {hp:p.hp,flee:p.flee,work:p.workT,wasWorking};},id);assert.equal(shot.hp,90);assert.ok(shot.flee>0&&shot.wasWorking);assert.equal(shot.work,0,'interrupted work must wait until the farmer returns to a waypoint');
  await page.evaluate(async id=>{const g=__gta,p=g.peds.peds.find(p=>p.id===id),{CAR_TYPES}=await import('/src/vehicles/carTypes.js'),{PALETTE}=await import('/src/art/palette.js');g.peds.revive(p);p.flee=0;p.cower=0;p.startled=0;const c=g.vehicles.spawn({type:'hatch',cfg:CAR_TYPES.hatch,paint:PALETTE.cars.paints[0],x:p.pos.x,z:p.pos.z-3,yaw:0});window.__farmTestCar=c;c.body.body.setLinvel({x:0,y:0,z:8},true);},id);
  await page.waitForFunction(id=>__gta.peds.peds.find(p=>p.id===id).state==='down',id,{timeout:4000});
  await page.evaluate(()=>{const c=window.__farmTestCar;c.body.teleport(-1400,__gta.world.terrain.getHeight(-1400,-100),-100,0);});
  await page.waitForTimeout(5100);
  const recovered=await page.evaluate(id=>{const g=__gta,p=g.peds.peds.find(p=>p.id===id);return {state:p.state,hp:p.hp,solid:p.collider.isEnabled(),witness:g.crimes.getWitnesses({x:p.pos.x+1,y:p.pos.y,z:p.pos.z}).some(w=>w.ref===p&&!w.cop)};},id);
  console.log('Farmer reactions/recovery',JSON.stringify({shot,recovered}));assert.equal(recovered.state,'home');assert.equal(recovered.hp,100);assert.ok(recovered.solid&&recovered.witness);console.log('PASS farmers: working/moving adults, pause/sleep, alarm/shot/real car knockdown/get-up/witness behavior');
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
