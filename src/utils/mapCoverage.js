// Offline analysis only: never imported by the render loop. Areas are square metres.
export const COVERAGE = { cell:25, samples:3, groveRadius:25, groveTrees:3 };
export const COVERAGE_CLASSES = ['road','building','district','water','dense trees/park','EMPTY'];

export function insideBox(x,z,b) {
  const dx=x-b.x,dz=z-b.z,c=Math.cos(b.rot||0),s=Math.sin(b.rot||0);
  return Math.abs(dx*c-dz*s)<=b.hx && Math.abs(dx*s+dz*c)<=b.hz;
}
const insideRect=(x,z,b)=>x>=b.x0 && x<=b.x1 && z>=b.z0 && z<=b.z1;

function boxIndex(boxes,cell) {
  const bins=new Map();
  for(const b of boxes) {
    const r=Math.hypot(b.hx,b.hz);
    for(let iz=Math.floor((b.z-r)/cell);iz<=Math.floor((b.z+r)/cell);iz++)
      for(let ix=Math.floor((b.x-r)/cell);ix<=Math.floor((b.x+r)/cell);ix++) {
        const key=`${ix},${iz}`;if(!bins.has(key)) bins.set(key,[]);bins.get(key).push(b);
      }
  }
  return (x,z)=>(bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[]).some(b=>insideBox(x,z,b));
}

export function analyzeCoverage(data, options={}) {
  const cfg={...COVERAGE,...options},b=data.bounds;
  if(!(cfg.cell>0 && Number.isInteger(cfg.samples) && cfg.samples>0 && b.x1>b.x0 && b.z1>b.z0)) throw new Error('Invalid coverage grid');
  const building=boxIndex(data.solids||[],cfg.cell),yard=boxIndex(data.yards||[],cfg.cell);
  const counts=Object.fromEntries(COVERAGE_CLASSES.map(k=>[k,0])),cells=[];
  const cols=Math.ceil((b.x1-b.x0)/cfg.cell),rows=Math.ceil((b.z1-b.z0)/cfg.cell);
  function classify(x,z,h) {
    if((data.water||[]).some(w=>insideRect(x,z,w) && h<w.y)) return 'water';
    if(data.roadAt?.(x,z)) return 'road';
    if(building(x,z)) return 'building';
    if(yard(x,z) || (data.districts||[]).some(r=>insideRect(x,z,r))) return 'district';
    if((data.parks||[]).some(p=>p.r ? Math.hypot(x-p.x,z-p.z)<=p.r : insideRect(x,z,p))) return 'dense trees/park';
    let trees=0;
    for(const t of data.trees||[]) if(Math.hypot(x-t.x,z-t.z)<=cfg.groveRadius && ++trees>=cfg.groveTrees) return 'dense trees/park';
    return 'EMPTY';
  }
  for(let iz=0;iz<rows;iz++) for(let ix=0;ix<cols;ix++) {
    const x0=b.x0+ix*cfg.cell,z0=b.z0+iz*cfg.cell;
    const w=Math.min(cfg.cell,b.x1-x0),d=Math.min(cfg.cell,b.z1-z0),area=w*d;
    const shares=Object.fromEntries(COVERAGE_CLASSES.map(k=>[k,0]));
    let height=0,slope=0;
    for(let sz=0;sz<cfg.samples;sz++) for(let sx=0;sx<cfg.samples;sx++) {
      const x=x0+(sx+0.5)*w/cfg.samples,z=z0+(sz+0.5)*d/cfg.samples,h=data.height(x,z);
      const gx=(data.height(x+1,z)-data.height(x-1,z))/2,gz=(data.height(x,z+1)-data.height(x,z-1))/2;
      if(!Number.isFinite(h+gx+gz)) throw new Error(`Non-finite terrain at ${x},${z}`);
      const a=area/(cfg.samples*cfg.samples),kind=classify(x,z,h);
      shares[kind]+=a;counts[kind]+=a;height+=h/(cfg.samples*cfg.samples);
      slope=Math.max(slope,Math.atan(Math.hypot(gx,gz))*180/Math.PI);
    }
    const kind=COVERAGE_CLASSES.reduce((a,k)=>shares[k]>shares[a]?k:a,'EMPTY');
    cells.push({x:x0+w/2,z:z0+d/2,w,d,area,kind,emptyArea:shares.EMPTY,height,slope});
  }
  const seen=new Set(),regions=[];
  for(let i=0;i<cells.length;i++) {
    if(seen.has(i) || cells[i].emptyArea<cells[i].area/2) continue;
    const queue=[i];seen.add(i);let area=0,x=0,z=0,minHeight=Infinity,maxHeight=-Infinity,maxSlope=0;
    const bounds={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};
    for(let k=0;k<queue.length;k++) {
      const j=queue[k],c=cells[j],ix=j%cols,iz=Math.floor(j/cols);
      area+=c.emptyArea;x+=c.x*c.emptyArea;z+=c.z*c.emptyArea;
      minHeight=Math.min(minHeight,c.height);maxHeight=Math.max(maxHeight,c.height);maxSlope=Math.max(maxSlope,c.slope);
      bounds.x0=Math.min(bounds.x0,c.x-c.w/2);bounds.x1=Math.max(bounds.x1,c.x+c.w/2);
      bounds.z0=Math.min(bounds.z0,c.z-c.d/2);bounds.z1=Math.max(bounds.z1,c.z+c.d/2);
      for(const [nx,nz] of [[ix-1,iz],[ix+1,iz],[ix,iz-1],[ix,iz+1]]) {
        if(nx<0 || nx>=cols || nz<0 || nz>=rows) continue;
        const n=nz*cols+nx;
        if(!seen.has(n) && cells[n].emptyArea>=cells[n].area/2) {seen.add(n);queue.push(n);}
      }
    }
    regions.push({area,center:{x:x/area,z:z/area},bounds,cells:queue.length,minHeight,maxHeight,maxSlope});
  }
  regions.sort((a,b)=>b.area-a.area);
  // Connected empty land can wrap around occupied districts. Its bounding box does not
  // prove that a large campus fits: separately find a conservative flat empty rectangle.
  const heights=new Array(cols).fill(0);let flatEmptyRectangle=null;
  for(let iz=0;iz<rows;iz++) {
    for(let ix=0;ix<cols;ix++) {const c=cells[iz*cols+ix];heights[ix]=c.w===cfg.cell && c.d===cfg.cell && c.emptyArea/c.area>0.9 && c.slope<=8 ? heights[ix]+1 : 0;}
    const stack=[];
    for(let ix=0;ix<=cols;ix++) {
      const h=ix===cols?0:heights[ix];
      while(stack.length && heights[stack[stack.length-1]]>h) {
        const top=stack.pop(),left=stack.length?stack[stack.length-1]+1:0;
        const width=(ix-left)*cfg.cell,depth=heights[top]*cfg.cell,area=width*depth;
        if(!flatEmptyRectangle || area>flatEmptyRectangle.area) flatEmptyRectangle={area,width,depth,x0:b.x0+left*cfg.cell,x1:b.x0+ix*cfg.cell,z0:b.z0+(iz+1)*cfg.cell-depth,z1:b.z0+(iz+1)*cfg.cell};
      }
      stack.push(ix);
    }
  }
  const area=(b.x1-b.x0)*(b.z1-b.z0),landArea=area-counts.water;
  return {schema:1,bounds:b,config:cfg,cols,rows,area,landArea,counts,unusedPercent:landArea?100*counts.EMPTY/landArea:0,emptyMapPercent:100*counts.EMPTY/area,flatEmptyRectangle,regions,cells};
}
