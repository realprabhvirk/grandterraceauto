// B1/B2: preserve original terrain outside explicitly planned grading; continuous expanded ground.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(await readFile(new URL('../docs/terrain-baseline.json',import.meta.url),'utf8'));
const originalColliderCount=JSON.parse(await readFile(new URL('../docs/coverage-baseline.json',import.meta.url),'utf8')).baseline.colliders;
const originalBytes=gunzipSync(await readFile(new URL('../docs/terrain-baseline.f32.gz',import.meta.url)));
assert.equal(createHash('sha256').update(originalBytes).digest('hex'),baseline.sha256);
const original=Array.from(new Float32Array(originalBytes.buffer,originalBytes.byteOffset,originalBytes.byteLength/4));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('?cam=player',process.env.GTA_URL||'http://127.0.0.1:5173/').href);
 await page.waitForFunction(()=>__gta?.ready,null,{timeout:90000});
 const r=await page.evaluate(async ({baseline,original,originalColliderCount})=>{
  const g=__gta,t=g.world.terrain,{MAP}=await import('/src/world/terrain.js');
  const b=baseline.bounds,old=new Float32Array(baseline.heightCount),offset=Math.round((b.x0-MAP.x0)/MAP.cell);
  for(let iz=0;iz<=b.nz;iz++) for(let ix=0;ix<=b.nx;ix++) old[iz*(b.nx+1)+ix]=t.heights[iz*(MAP.nx+1)+offset+ix];
  const digest=await crypto.subtle.digest('SHA-256',old);
  const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const {CORRIDOR}=await import('/src/world/terrain.js'),rural=g.world.rural;
  const protectedSolids=[...(g.world.originalColliders || g.world.colliders)];
  if(protectedSolids.length<originalColliderCount)throw Error('Original developed collider footprints were lost');
  g.physics.world.forEachCollider(c=>{if(g.physics.tagOf(c.handle).type==='landmark'&&c.shape.halfExtents){const p=c.translation(),q=c.rotation(),e=c.shape.halfExtents;protectedSolids.push({x:p.x,z:p.z,hx:e.x,hz:e.z,rot:2*Math.atan2(q.y,q.w)});}});
  let changed=0,unplanned=0,protectedChanged=0;const examples=[];
  for(let iz=0;iz<=b.nz;iz++)for(let ix=0;ix<=b.nx;ix++){
   const k=iz*(b.nx+1)+ix;if(old[k]===original[k])continue;changed++;
   const x=b.x0+ix*b.cell,z=b.z0+iz*b.cell;
   const planned=rural?.roads.some(r=>{const a=r.samples[0],end=r.samples[r.samples.length-1],radius=CORRIDOR.flat+CORRIDOR.blend+MAP.cell;return x>=Math.min(a.x,end.x)-radius&&x<=Math.max(a.x,end.x)+radius&&z>=Math.min(a.z,end.z)-radius&&z<=Math.max(a.z,end.z)+radius;})||rural?.sites.some(s=>Math.hypot(Math.max(0,Math.abs(x-s.x)-s.hw),Math.max(0,Math.abs(z-s.z)-s.hd))<=s.fall+MAP.cell);
   if(!planned){unplanned++;if(examples.length<8)examples.push({x,z,was:original[k],now:old[k]});}
   const developed=g.world.network.index.nearest(x,z,6,r=>!r.rural)||protectedSolids.some(c=>{const dx=x-c.x,dz=z-c.z,co=Math.cos(c.rot||0),si=Math.sin(c.rot||0);return Math.abs(dx*co-dz*si)<=c.hx&&Math.abs(dx*si+dz*co)<=c.hz;});
   if(developed&&Math.abs(old[k]-original[k])>.001){protectedChanged++;if(examples.length<8)examples.push({protected:true,x,z,was:original[k],now:old[k]});}
  }
  // Preserve the query investigation as reproducible evidence, separate from pass/fail.
  const referenceWorld=new g.RAPIER.World({x:0,y:-9.81,z:0}),referenceHeights=new Float32Array(old.length);
  for(let ix=0;ix<=b.nx;ix++)for(let iz=0;iz<=b.nz;iz++)referenceHeights[ix*(b.nz+1)+iz]=original[iz*(b.nx+1)+ix];
  referenceWorld.createCollider(g.RAPIER.ColliderDesc.heightfield(b.nz,b.nx,referenceHeights,{x:b.x1-b.x0,y:1,z:b.z1-b.z0}).setTranslation(b.cx,0,b.cz));referenceWorld.step();
  const boundaryReference=[];
  for(const z of [-195,-195.001,-194.999]){const x=-199.999,h=t.getHeight(x,z),ray=new g.RAPIER.Ray({x,y:h+10,z},{x:0,y:-1,z:0});boundaryReference.push({x,z,old:referenceWorld.castRay(ray,30,true)?.timeOfImpact??null,current:g.physics.world.castRay(ray,30,true,undefined,undefined,undefined,undefined,c=>g.physics.tagOf(c.handle).type==='terrain')?.timeOfImpact??null});}
  referenceWorld.free();
  let triangles=0,vertices=0,vertexErrors=0,shadowLights=0;
  t.mesh.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;triangles+=p.count/3;vertices+=p.count;
   for(let k=0;k<p.count;k++){const ix=Math.round((p.getX(k)-MAP.x0)/MAP.cell),iz=Math.round((p.getZ(k)-MAP.z0)/MAP.cell);if(p.getY(k)!==t.heights[iz*(MAP.nx+1)+ix])vertexErrors++;}
  });
  g.scene.traverse(o=>{if(o.isLight && o.castShadow)shadowLights++;});
  const boundary=[];g.physics.world.forEachCollider(c=>{if(g.physics.tagOf(c.handle).type==='boundary')boundary.push(c.translation());});
  let rays=0,missing=0,maxError=0,exactBoundaryMisses=0;const misses=[];
  const cast=(x,z)=>{const h=t.getHeight(x,z),hit=g.physics.world.castRay(new g.RAPIER.Ray({x,y:h+10,z},{x:0,y:-1,z:0}),30,true,undefined,undefined,undefined,undefined,c=>g.physics.tagOf(c.handle).type==='terrain');rays++;if(hit)maxError=Math.max(maxError,Math.abs(h-(h+10-hit.timeOfImpact)));return !!hit;};
  const probe=(x,z)=>{
   if(cast(x,z))return;
   // Rapier's exact-grid-boundary ray miss also occurs on the reconstructed old
   // heightfield. Require ALL four 1mm interior neighbours, not a skipped sample.
   exactBoundaryMisses++;
   for(const dx of [-0.001,0.001])for(const dz of [-0.001,0.001])if(!cast(x+dx,z+dz)){missing++;if(misses.length<12)misses.push({x:x+dx,z:z+dz});}
  };
  for(let z=MAP.z0+5;z<MAP.z1-5;z+=25)for(let x=MAP.x0+5;x<MAP.x1-5;x+=25)probe(x,z);
  for(let x=MAP.x0+320;x<MAP.x1;x+=320)for(let z=MAP.z0+5;z<MAP.z1-5;z+=25){probe(x-0.01,z);probe(x+0.01,z);}
  for(let z=MAP.z0+320;z<MAP.z1;z+=320)for(let x=MAP.x0+5;x<MAP.x1-5;x+=25){probe(x,z-0.01);probe(x,z+0.01);}
  t.updateVisibility({x:-1100,z:-300},300);const visible=t.chunks.filter(c=>c.mesh.visible).length;
  return {MAP,hash,changed,unplanned,protectedChanged,examples,triangles,vertices,vertexErrors,shadowLights,boundary,rays,missing,misses,exactBoundaryMisses,boundaryReference,maxError,chunks:t.chunks.length,visible,
   mapBounds:g.minimap.bounds,bgWidth:g.minimap.bg.width,bgHeight:g.minimap.bg.height};
 },{baseline,original,originalColliderCount});
 assert.equal(r.MAP.x0,-1500);assert.equal(r.MAP.x1,1060);assert.equal(r.MAP.nz,440);console.log('PASS terrain: expanded west only');
 assert.equal(r.unplanned,0,JSON.stringify(r.examples));assert.equal(r.protectedChanged,0,JSON.stringify(r.examples));console.log(`PASS terrain: ${r.changed} intentional grading samples; every other original height bit-for-bit unchanged, developed ground preserved`);
 assert.equal(r.triangles,901120);assert.equal(r.chunks,32);assert.equal(r.vertexErrors,0);console.log('PASS terrain: all chunk vertices match heightfield; exact triangle total');
 assert.ok(r.visible>0 && r.visible<r.chunks);console.log('PASS terrain: conservative distance culling hides distant chunks');
 assert.equal(r.missing,0,JSON.stringify(r));assert.ok(r.maxError<=0.01,JSON.stringify(r));console.log(`PASS terrain: ${r.rays} physics rays incl. chunk seams, ${r.exactBoundaryMisses} exact-boundary misses checked with four neighbours, max disagreement ${r.maxError}m`);
 console.log('Rapier boundary reference (original/rebuilt heightfield):',JSON.stringify(r.boundaryReference));
 assert.equal(r.boundary.length,4);assert.ok(r.boundary.some(p=>p.x===-1460));assert.equal(r.shadowLights,1);console.log('PASS terrain: moved boundary and exactly one shadow light');
 assert.equal(r.mapBounds.x0,-1500);assert.equal(r.mapBounds.x1,1060);assert.ok(r.bgWidth<=2048 && r.bgHeight<=2048);console.log('PASS terrain: map covers extension with bounded raster memory');
 await page.evaluate(()=>__gta.debug.teleport(-1100,-300,0));await page.waitForTimeout(1500);
 const position=await page.evaluate(()=>{const p=__gta.controls.player.position;return {x:p.x,z:p.z,gap:p.y-__gta.world.terrain.getHeight(p.x,p.z)};});
 assert.ok(Math.abs(position.x+1100)<1 && Math.abs(position.z+300)<1 && position.gap>-0.1 && position.gap<0.3,JSON.stringify(position));
 assert.deepEqual(errors,[]);console.log('PASS terrain: walker stands on new ground without errors');console.log('All 8 terrain expansion checks passed');
}finally{await browser.close();}
