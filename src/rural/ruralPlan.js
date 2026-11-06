// Explicit countryside roads/pads; graph links and visual/physics surfaces share this plan.
import { TOWN } from '../world/terrain.js';
import { ROAD } from '../world/roadNetwork.js';

export const RURAL_SITES = [
  { id: 'garrison', x: -950, z: -300, hw: 480, hd: 365 },
  { id: 'airfield', x: -950, z: -710, hw: 500, hd: 48 },
  { id: 'orchard', x: -50, z: -390, hw: 130, hd: 95 },
  { id: 'creek-farm', x: 535, z: 225, hw: 40, hd: 35, fall: 12 },
  { id: 'west-farm', x: -980, z: 170, hw: 300, hd: 85 },
  { id: 'works', x: -335, z: -450, hw: 100, hd: 150 },
];

export function buildRuralPlan() {
  const roads = [];
  const road = (name, ax, az, bx, bz, kind = 'rural') => {
    const length = Math.hypot(bx-ax,bz-az), n = Math.ceil(length/ROAD.step), tx=(bx-ax)/length,tz=(bz-az)/length;
    const samples=[];
    for(let i=0;i<=n;i++) samples.push({x:ax+(bx-ax)*i/n,z:az+(bz-az)*i/n,h:TOWN.h,tx,tz,nx:-tz,nz:tx,s:length*i/n});
    roads.push({name,street:name,rural:true,track:kind==='track',base:kind==='base',halfW:kind==='rural'?4.5:3.6,samples,length});
  };
  road('Stoneleaf Rd',330,-252,-500,-252);
  road('Ridge Access Rd',-450,-620,-450,180);
  road('Creek Valley Rd',-1360,180,560,180);
  road('Meadow Link',330,45,330,180);
  road('Riverside Lane',330,160,560,160,'track');
  road('Spring Lane',560,160,560,180,'track');
  road('Orchard Lane',100,-252,100,-430,'track');
  road('Windmill Track',100,-430,-200,-430,'track');
  road('Harvest Lane',-200,-480,-200,-252,'track');
  road('Works Rd',-450,-480,-200,-480,'track');
  road('Parade Way',-500,-252,-1360,-252,'base');
  road('West Patrol Rd',-1360,-655,-1360,180,'base');
  road('Range Rd',-1360,-620,-500,-620,'base');
  road('Gatehouse Rd',-500,-655,-500,50,'base');
  road('Barracks Way',-1360,50,-500,50,'base');
  road('Aviation Dr',-1360,-655,-450,-655,'base');
  road('Airfield Link',-450,-655,-450,-620,'base');
  const sites=RURAL_SITES.map(s=>({...s,rot:0,h:TOWN.h,fall:s.fall??40}));
  return {roads,sites,nodes:[],edges:[],pedLines:[],chunks:[]};
}

// Split axis-aligned roads at every crossing. Reuse existing attachment nodes by identity.
export function attachRuralGraph(rural,plan) {
  const nodeAt=(x,z)=>{
    let n=plan.nodes.find(n=>n.x===x&&n.z===z);
    if(!n){n={id:plan.nodes.length,x,z,links:[],rural:true,north:true,i:-3,j:-3};plan.nodes.push(n);}
    if(!rural.nodes.includes(n))rural.nodes.push(n);
    return n;
  };
  for(const r of rural.roads){
    const a=r.samples[0],b=r.samples[r.samples.length-1],vertical=a.x===b.x;
    const on=(x,z)=>Math.abs(vertical?x-a.x:z-a.z)<.01&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x)&&z>=Math.min(a.z,b.z)&&z<=Math.max(a.z,b.z);
    const points=[nodeAt(a.x,a.z),nodeAt(b.x,b.z)];
    for(const other of rural.roads){const c=other.samples[0],d=other.samples[other.samples.length-1];
      if((c.x===d.x)===vertical)continue;
      const x=vertical?a.x:c.x,z=vertical?c.z:a.z;
      if(on(x,z)&&x>=Math.min(c.x,d.x)&&x<=Math.max(c.x,d.x)&&z>=Math.min(c.z,d.z)&&z<=Math.max(c.z,d.z))points.push(nodeAt(x,z));
    }
    const nodes=[...new Set(points)].sort((p,q)=>vertical?p.z-q.z:p.x-q.x);
    for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],edge={a,b,road:r,rural:true};a.links.push(b);b.links.push(a);plan.edges.push(edge);rural.edges.push(edge);}
  }
  plan.roads.push(...rural.roads);
}
