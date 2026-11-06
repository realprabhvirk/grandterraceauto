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
 if(run('machinery')){
  const r=await page.evaluate(()=>{const g=__gta,ops=g.farmMachinery;if(!ops)throw Error('Farm machinery is not wired into the game');
   return {count:ops.machines.length,kinds:ops.machines.map(m=>m.kind),farms:ops.machines.map(m=>m.farmId),dustCapacity:ops.dust.capacity};
  });console.log('Machinery registry',JSON.stringify(r));assert.equal(r.count,3);assert.equal(r.kinds.filter(k=>k==='tractor').length,2);assert.equal(r.kinds.filter(k=>k==='harvester').length,1);assert.equal(r.dustCapacity,60);
  const shapeScan=await page.evaluate(()=>{const g=__gta,R=g.RAPIER,blocked=[],summaries=[];let samples=0;
   for(const m of g.farmMachinery.machines){const c=m.cfg,parts=[{x:0,y:(c.h+c.clearance)/2,z:0,shape:new R.Cuboid(c.w/2,(c.h-c.clearance)/2,c.l/2)}];
    for(const w of m.model.wheels)parts.push({...w,shape:new R.Cylinder(c.wheelWidth/2,w.r),wheel:true});
    if(c.header){const h=c.header;parts.push({x:0,y:h.y,z:h.z,shape:new R.Cuboid(h.w/2,h.h/2,h.d/2)});}
    for(const p of m.route.samples){if(!Number.isFinite(p.x+p.y+p.z+p.yaw))throw Error('non-finite machine route');const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),s=Math.sin(p.yaw/2),co=Math.cos(p.yaw/2);
     for(const part of parts){samples++;const position={x:p.x+part.x*cy+part.z*sy,y:p.y+part.y,z:p.z-part.x*sy+part.z*cy},q=part.wheel?{x:s*Math.SQRT1_2,y:s*Math.SQRT1_2,z:co*Math.SQRT1_2,w:co*Math.SQRT1_2}:{x:0,y:s,z:0,w:co};
      g.physics.world.intersectionsWithShape(position,q,part.shape,col=>{const tag=g.physics.tagOf(col.handle);if(col.isEnabled()&&!['terrain','farm machinery','car','traffic','ped','player','police sensor'].includes(tag.type)&&blocked.length<20)blocked.push({id:m.id,x:p.x,z:p.z,tag});return true;});
     }
    }
    const start=m.route.at(0,{}),wrapped=m.route.at(m.route.length,{});if(Math.hypot(start.x-wrapped.x,start.z-wrapped.z)>1e-6)throw Error('route seam');
    summaries.push({id:m.id,length:m.route.length,parts:m.colliders.length,operator:m.model.driver.mesh.isSkinnedMesh,solidTags:m.colliders.every(c=>g.physics.tagOf(c.handle).owner===m.id),wheelColliders:m.colliders.filter(c=>c.shape.type===R.ShapeType.Cylinder).length});
   }return {samples,blocked,summaries};
  });console.log('Whole-route native shape scan',JSON.stringify(shapeScan));assert.deepEqual(shapeScan.blocked,[]);assert.ok(shapeScan.samples>10000);for(const m of shapeScan.summaries){assert.ok(m.operator&&m.solidTags&&m.parts>=5);assert.equal(m.wheelColliders,4);}
  for(let i=0;i<3;i++){
   await page.evaluate(i=>{const g=__gta,m=g.farmMachinery.machines[i],p=m.pose;g.debug.teleport(p.x+8,p.z+8,-3*Math.PI/4);},i);await page.waitForTimeout(600);
   const a=await page.evaluate(i=>{const m=__gta.farmMachinery.machines[i],matrix=__gta.farmMachinery.wheels.instanceMatrix.array;return {s:m.s,spin:m.spin,header:m.model.header?.rotation.x||0,dust:__gta.farmMachinery.dust.emitted,wheel:Array.from(matrix.slice(i*64,i*64+12))};},i);await page.waitForTimeout(3000);
   for(const dusk of [0,1]){await page.evaluate(({dusk,i})=>{const g=__gta,m=g.farmMachinery.machines[i];g.lighting.setDusk(dusk);g.debug.teleport(m.pose.x+18,m.pose.z+18,-3*Math.PI/4);},{dusk,i});await page.waitForTimeout(2500);
    const b=await page.evaluate(i=>{const g=__gta,m=g.farmMachinery.machines[i],screen=m.model.root.position.clone();screen.y+=1.7;screen.project(g.camera);const body=m.body.translation();return {id:m.id,s:m.s,spin:m.spin,header:m.headerAngle,dust:g.farmMachinery.dust.emitted,activeDust:g.farmMachinery.dust.active,v:m.v,sleeping:m.sleeping,bodyError:Math.hypot(body.x-m.pose.x,body.y-m.pose.y,body.z-m.pose.z),renderError:Math.hypot(m.render.x-m.pose.x,m.render.z-m.pose.z),screen:{x:screen.x,y:screen.y,z:screen.z},arm:m.model.driver.bones.rShoulder.rotation.x,lamps:m.model.lamps.material.emissiveIntensity,fps:g.stats().fps,calls:g.renderer.info.render.calls,shadowLights:g.scene.children.filter(o=>o.isLight&&o.castShadow).length};},i);
    const rotation=await page.evaluate(i=>Array.from(__gta.farmMachinery.wheels.instanceMatrix.array.slice(i*64,i*64+12)),i);assert.ok(rotation.some((v,k)=>Math.abs(v-a.wheel[k])>.01),'uploaded wheel rotation must change');
    console.log('Moving field-machine view',dusk,JSON.stringify(b));assert.ok(!b.sleeping&&b.s>a.s+1&&b.spin>a.spin&&b.dust>a.dust&&b.activeDust>0&&b.activeDust<=60);assert.ok(b.bodyError<.002&&b.renderError<.1);assert.ok(Math.abs(b.screen.x)<1&&Math.abs(b.screen.y)<1&&Math.abs(b.arm)>.2);assert.ok(b.screen.z>=-1&&b.screen.z<=1);assert.equal(b.lamps>1,dusk===1);assert.equal(b.shadowLights,1);assert.ok(b.fps>=45&&b.calls<600);if(i===2){assert.ok(b.header>a.header);assert.ok(await page.evaluate(()=>__gta.farmMachinery.machines[2].model.header.rotation.x>0));}
   }
  }
  const stopped=await page.evaluate(async()=>{const g=__gta,m=g.farmMachinery.machines[2],wait=ms=>new Promise(r=>setTimeout(r,ms)),p=m.pose,fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);g.debug.teleport(p.x+fx*10,p.z+fz*10,0);await wait(1800);const hp=g.combat.hp,s=m.s,v=m.v,blocked=m.blocked;await wait(600);return {v,blocked,advance:m.s-s,hpBefore:hp,hpAfter:g.combat.hp};});console.log('Player obstacle stop',JSON.stringify(stopped));assert.ok(stopped.blocked&&stopped.v<.01&&stopped.advance<.01);assert.equal(stopped.hpBefore,stopped.hpAfter);
  // Move an existing reactive farmer into the clear stopping zone, without disabling its collider or machine avoidance.
  const farmerStop=await page.evaluate(async()=>{const g=__gta,m=g.farmMachinery.machines[2],p=g.peds.peds.find(p=>p.role==='farmer'&&p.home.farmId==='redbank'),wait=ms=>new Promise(r=>setTimeout(r,ms));g.debug.teleport(m.pose.x+12,m.pose.z+12,0);const old={home:p.home,state:p.state,x:p.pos.x,y:p.pos.y,z:p.pos.z};
   p.home={...p.home,route:null,x:m.pose.x+Math.sin(m.pose.yaw)*7,y:m.pose.y+.05,z:m.pose.z+Math.cos(m.pose.yaw)*7,action:'phone'};p.pos.set(p.home.x,p.home.y,p.home.z);p.state='home';await wait(1800);const result={blocked:m.blocked,v:m.v,ped:p.state,hp:p.hp};p.home=old.home;p.pos.set(old.x,old.y,old.z);p.state=old.state;return result;
  });console.log('Farmer obstacle stop',JSON.stringify(farmerStop));assert.ok(farmerStop.blocked&&farmerStop.v<.01);assert.notEqual(farmerStop.ped,'down');assert.equal(farmerStop.hp,100);
  const carStop=await page.evaluate(async()=>{const g=__gta,m=g.farmMachinery.machines[2],c=g.vehicles.cars.find(c=>c.type==='ute'),wait=ms=>new Promise(r=>setTimeout(r,ms)),old={...c.position},yaw=c.body.yaw();g.debug.teleport(m.pose.x+14,m.pose.z+14,0);c.body.teleport(m.pose.x+Math.sin(m.pose.yaw)*10,m.pose.y,m.pose.z+Math.cos(m.pose.yaw)*10,m.pose.yaw);await wait(1800);const result={blocked:m.blocked,v:m.v,health:c.health};c.body.teleport(old.x,old.y,old.z,yaw);return result;});console.log('Car obstacle stop',JSON.stringify(carStop));assert.ok(carStop.blocked&&carStop.v<.01);assert.equal(carStop.health,100);
  await page.evaluate(()=>{const g=__gta,m=g.farmMachinery.machines[2];g.debug.teleport(m.pose.x+12,m.pose.z+12,0);g.mapUI.setMode(2);});await page.waitForTimeout(100);
  const paused=await page.evaluate(()=>__gta.farmMachinery.machines.map(m=>[m.s,m.spin,m.headerAngle]));await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>__gta.farmMachinery.machines.map(m=>[m.s,m.spin,m.headerAngle])),paused);
  await page.evaluate(()=>{__gta.mapUI.setMode(1);__gta.debug.teleport(900,-400,0);});await page.waitForTimeout(200);const sleeping=await page.evaluate(()=>__gta.farmMachinery.machines.map(m=>({s:m.s,enabled:m.body.isEnabled(),sleeping:m.sleeping})));await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>__gta.farmMachinery.machines.map(m=>({s:m.s,enabled:m.body.isEnabled(),sleeping:m.sleeping}))),sleeping);assert.ok(sleeping.every(m=>m.sleeping&&!m.enabled));
  await page.evaluate(()=>{const g=__gta,m=g.farmMachinery.machines[2],p=m.pose,c=Math.cos(p.yaw),s=Math.sin(p.yaw);g.debug.teleport(p.x+2.5*c+m.cfg.header.z*s,p.z-2.5*s+m.cfg.header.z*c,0);});await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>{const m=__gta.farmMachinery.machines[2];return m.sleeping&&!m.body.isEnabled()&&__gta.combat.hp===100;}),'waking must not materialize the wide header on the player');
  await page.evaluate(()=>{const g=__gta,m=g.farmMachinery.machines[2];g.debug.teleport(m.pose.x+10,m.pose.z+10,0);});await page.waitForTimeout(2500);assert.ok(await page.evaluate(()=>{const m=__gta.farmMachinery.machines[2];return !m.sleeping&&m.v>.5&&m.body.isEnabled();}));
  // Observe real simulation-time circuits. No s/speed edits or accelerated stepping.
  for(const ids of [[0],[1,2]]){
   await page.keyboard.press('F2');
   const cycle=await page.evaluate(async ids=>{const g=__gta,ms=ids.map(i=>g.farmMachinery.machines[i]),start=ms.map(m=>({s:m.s,laps:m.laps})),t0=performance.now(),timeout=Math.max(...ms.map(m=>m.route.length/m.cfg.speed))*1000+22000;
    while(performance.now()-t0<timeout){const centre=ms[0].farm.config;g.camera.position.set(centre.id==='gumleaf'?-120:-1120,20,centre.id==='gumleaf'?-370:170);g.camera.lookAt(ms[0].pose.x,ms[0].pose.y,ms[0].pose.z);g.controls.syncFly();if(ms.every((m,i)=>m.laps>start[i].laps&&m.s>=start[i].s))break;await new Promise(r=>setTimeout(r,200));}
    return {elapsed:(performance.now()-t0)/1000,machines:ms.map((m,i)=>({id:m.id,travel:(m.laps-start[i].laps)*m.route.length+m.s-start[i].s,length:m.route.length,laps:m.laps,blocked:m.blocked}))};
   },ids);console.log('Observed real field circuits',JSON.stringify(cycle));for(const m of cycle.machines)assert.ok(m.travel>=m.length,JSON.stringify(m));await page.keyboard.press('F2');
  }
  console.log('PASS machinery: native solid route clearance, movement/circuits/wheels/header/dust, operators, obstacle stops, pause/sleep/wake and day/night budgets');
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
