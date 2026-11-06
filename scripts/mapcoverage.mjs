// Analytical SVG/JSON artifacts, no screenshots. One Edge browser, always closed.
import { chromium } from 'playwright';
import { writeFile,mkdir,access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PALETTE } from '../src/art/palette.js';
const baseline=process.argv.includes('--baseline'),stem=baseline?'coverage-baseline':'coverage-current';
if(baseline && !process.argv.includes('--replace-baseline')) {
  let exists=false;try {await access('docs/coverage-baseline.json');exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(exists) throw new Error('Baseline already exists; use --replace-baseline only before world changes');
}
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
let report;
try {
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('?cam=player',process.env.GTA_URL||'http://127.0.0.1:5173/').href);
  await page.waitForFunction(()=>window.__gta?.ready,null,{timeout:90000});
  report=await page.evaluate(async()=>{
    const g=__gta,w=g.world;
    const {MAP,WATER_Y}=await import('/src/world/terrain.js');
    const {AP}=await import('/src/airport/airportPlan.js');
    const {lotPads}=await import('/src/world/layout.js');
    const {analyzeCoverage}=await import('/src/utils/mapCoverage.js');
    const water=w.town.beach.water.mesh;water.geometry.computeBoundingBox();water.updateMatrixWorld(true);
    const box=water.geometry.boundingBox.clone().applyMatrix4(water.matrixWorld);
    const park=w.town.wattle.mesh;park.geometry.computeBoundingBox();park.updateMatrixWorld(true);
    const parkBox=park.geometry.boundingBox.clone().applyMatrix4(park.matrixWorld);
    const r=analyzeCoverage({bounds:{x0:MAP.x0,x1:MAP.x1,z0:MAP.z0,z1:MAP.z1},height:(x,z)=>w.terrain.getHeight(x,z),
      roadAt:(x,z)=>{const hit=w.network.index.nearest(x,z,20);return hit && hit.d<=(hit.road.halfW||3.6)+(hit.road.town?4.8:3.7);},
      solids:w.colliders.filter(c=>c.hy>=1 && c.hx>=1 && c.hz>=1),
      yards:lotPads(w.layout).map(l=>({x:l.x,z:l.z,hx:l.hw,hz:l.hd,rot:l.rot})),
      districts:[{x0:AP.fence.x0,x1:AP.fence.x1,z0:AP.fence.north,z1:AP.fence.z}],
      parks:[w.town.gardens.bounds,{x0:parkBox.min.x,x1:parkBox.max.x,z0:parkBox.min.z,z1:parkBox.max.z}],
      trees:w.trunks,water:[{x0:box.min.x,x1:box.max.x,z0:box.min.z,z1:box.max.z,y:WATER_Y}]
    });
    await new Promise(resolve=>setTimeout(resolve,1200));
    r.baseline={terrainTriangles:w.terrain.mesh.geometry.attributes.position.count/3,heightSamples:w.terrain.heights.length,
      roads:w.network.allRoads.length,colliders:w.colliders.length,trees:w.trunks.length,pedestrians:g.peds.peds.length,traffic:g.traffic.cars.length,stats:g.stats()};
    return r;
  });
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
assert.ok(Math.abs(Object.values(report.counts).reduce((a,b)=>a+b,0)-report.area)<0.01,'area conservation');
const colors={road:PALETTE.road.asphalt,building:PALETTE.town.office[0],district:PALETTE.town.gravel,water:PALETTE.town.water,'dense trees/park':PALETTE.tree.leaves[0],EMPTY:PALETTE.town.fuelRed};
const b=report.bounds,scale=0.7,rects=report.cells.map(c=>`<rect x="${(c.x-c.w/2-b.x0)*scale}" y="${(c.z-c.d/2-b.z0)*scale}" width="${c.w*scale}" height="${c.d*scale}" fill="${colors[c.kind]}"/>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${(b.x1-b.x0)*scale}" height="${(b.z1-b.z0)*scale+65}" viewBox="0 0 ${(b.x1-b.x0)*scale} ${(b.z1-b.z0)*scale+65}">${rects}<text x="8" y="${(b.z1-b.z0)*scale+20}" font-family="sans-serif" font-size="13">Unused land ${report.unusedPercent.toFixed(2)}% · 25m cells, 9 samples/cell · north at top</text>${Object.entries(colors).map(([label,color],i)=>`<rect x="${8+i*145}" y="${(b.z1-b.z0)*scale+35}" width="12" height="12" fill="${color}"/><text x="${24+i*145}" y="${(b.z1-b.z0)*scale+46}" font-size="11" font-family="sans-serif">${label}</text>`).join('')}</svg>`;
await mkdir('docs',{recursive:true});
await writeFile(`docs/${stem}.json`,JSON.stringify(report,null,2)+'\n');await writeFile(`docs/${stem}.svg`,svg);
console.log(JSON.stringify({unusedPercent:report.unusedPercent,area:report.area,landArea:report.landArea,counts:report.counts,flatEmptyRectangle:report.flatEmptyRectangle,largestEmptyRegions:report.regions.slice(0,8),baseline:report.baseline},null,2));
