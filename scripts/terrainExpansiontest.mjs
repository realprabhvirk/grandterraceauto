// B1 acceptance only: exact old-height preservation and continuous expanded visual/physics terrain.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const baseline=JSON.parse(await readFile(new URL('../docs/terrain-baseline.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('?cam=player',process.env.GTA_URL||'http://127.0.0.1:5173/').href);
 await page.waitForFunction(()=>__gta?.ready,null,{timeout:90000});
 const r=await page.evaluate(async baseline=>{
  const g=__gta,t=g.world.terrain,{MAP}=await import('/src/world/terrain.js');
  const b=baseline.bounds,old=new Float32Array(baseline.heightCount),offset=Math.round((b.x0-MAP.x0)/MAP.cell);
  for(let iz=0;iz<=b.nz;iz++) for(let ix=0;ix<=b.nx;ix++) old[iz*(b.nx+1)+ix]=t.heights[iz*(MAP.nx+1)+offset+ix];
  const digest=await crypto.subtle.digest('SHA-256',old);
  const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  // Preserve the query investigation as reproducible evidence, separate from pass/fail.
  const referenceWorld=new g.RAPIER.World({x:0,y:-9.81,z:0}),referenceHeights=new Float32Array(old.length);
  for(let ix=0;ix<=b.nx;ix++)for(let iz=0;iz<=b.nz;iz++)referenceHeights[ix*(b.nz+1)+iz]=old[iz*(b.nx+1)+ix];
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
  return {MAP,hash,triangles,vertices,vertexErrors,shadowLights,boundary,rays,missing,misses,exactBoundaryMisses,boundaryReference,maxError,chunks:t.chunks.length,visible,
   mapBounds:g.minimap.bounds,bgWidth:g.minimap.bg.width,bgHeight:g.minimap.bg.height};
 },baseline);
 assert.equal(r.MAP.x0,-1500);assert.equal(r.MAP.x1,1060);assert.equal(r.MAP.nz,440);console.log('PASS terrain: expanded west only');
 assert.equal(r.hash,baseline.sha256);console.log('PASS terrain: every original height sample bit-for-bit unchanged');
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
