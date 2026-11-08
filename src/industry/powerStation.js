// Stoneleaf's energy works: merged static kit, exact hollow tower solids and a real cooling basin.
import * as THREE from 'three';
import {PALETTE as P} from '../art/palette.js';
import {MAT} from '../art/materials.js';
import {paint,painted,cylinder,merge} from '../utils/geom.js';
import {frame,makeChunk,createSignAtlas} from '../town/townKit.js';
import {MAP} from '../world/terrain.js';
import {POWER as C} from './powerConfig.js';
import {FARM_NIGHT as NIGHT} from '../audio/farmAudioConfig.js';
import {createSteamPool} from './steamPool.js';

function tower(cfg,index,y,colliders){
  const parts=[],tri=[0,1,2,1,3,2,4,6,5,5,6,7,0,2,4,4,2,6,1,5,3,5,7,3,0,4,1,1,4,5,2,3,6,3,7,6];
  for(let band=1;band<cfg.profile.length;band++)for(let k=0;k<C.towerSegments;k++){
    const [ya,ra]=cfg.profile[band-1],[yb,rb]=cfg.profile[band],a=k*Math.PI*2/C.towerSegments,b=(k+1)*Math.PI*2/C.towerSegments;
    const v=[];for(const inner of [false,true])for(const [h,r]of [[ya,ra],[yb,rb]])for(const t of [a,b])v.push([cfg.x+Math.sin(t)*(r-(inner?C.towerWall:0)),y+h,cfg.z+Math.cos(t)*(r-(inner?C.towerWall:0))]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v.flat(),3));geo.setIndex(tri);geo.computeVertexNormals();parts.push(paint(geo,P.industry.concrete,.045,C.seed+index*101+band*17+k));
    const centre=[0,0,0];for(const p of v)for(let j=0;j<3;j++)centre[j]+=p[j]/8;
    const local=new Float32Array(v.flatMap(p=>p.map((n,j)=>n-centre[j]))),extent=[0,0,0];for(const p of v)for(let j=0;j<3;j++)extent[j]=Math.max(extent[j],Math.abs(p[j]-centre[j]));
    colliders.push({x:centre[0],y:centre[1],z:centre[2],hx:extent[0],hy:extent[1],hz:extent[2],rot:0,shape:'convex',vertices:local,tag:'power station',owner:`${C.id}:tower:${index}:${band-1}:${k}`});
  }
  const mesh=new THREE.Mesh(merge(parts),MAT.solid);mesh.castShadow=mesh.receiveShadow=true;mesh.name=`cooling-tower-${index}`;
  return {...cfg,y,mesh};
}

function paving(terrain,rects=C.paving,color=P.town.carpark){
  const positions=[];
  for(const b of rects){
    for(const n of [b.x0,b.x1])if(Math.abs((n-MAP.x0)/MAP.cell-Math.round((n-MAP.x0)/MAP.cell))>.00001)throw Error('Power paving must align to terrain grid');
    for(const n of [b.z0,b.z1])if(Math.abs((n-MAP.z0)/MAP.cell-Math.round((n-MAP.z0)/MAP.cell))>.00001)throw Error('Power paving must align to terrain grid');
    const put=(x,z)=>positions.push(x,terrain.getHeight(x,z)+.005,z);
    for(let z=b.z0;z<b.z1;z+=MAP.cell)for(let x=b.x0;x<b.x1;x+=MAP.cell){const nx=x+MAP.cell,nz=z+MAP.cell;put(x,z);put(x,nz);put(nx,z);put(nx,z);put(x,nz);put(nx,nz);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(paint(geo,color,.025,C.seed),MAT.decal);mesh.name='energy-yard-paving';mesh.receiveShadow=true;return mesh;
}

export function buildPowerStation({parent,terrain}){
  const group=new THREE.Group();group.name=C.id;parent.add(group);
  const ch=makeChunk(C.id),features=[],atlas=createSignAtlas(),y=terrain.getHeight(C.x,C.z),F=(x,z,rot=0)=>frame(x,z,Math.sin(rot),Math.cos(rot),y);
  const tag=(start,kind)=>{for(let i=start;i<ch.colliders.length;i++){ch.colliders[i].tag='power station';ch.colliders[i].owner=`${C.id}:${kind}:${i}`;}};
  const block=(kind,x,z,w,h,d,ly=0,color=P.industry.concrete)=>{const start=ch.colliders.length;ch.block(F(x,z),w,h,d,0,ly,0,color);tag(start,kind);features.push({kind,x,z});};
  for(const [kind,b]of [['hall',C.hall],['store',C.store],['office',C.office]]){
    block(kind,b.x,b.z,b.w,b.h,b.d,0,kind==='hall'?P.industry.wall:P.walls[2]);
    block(kind+'-roof',b.x,b.z,b.w+.5,.25,b.d+.5,b.h,P.roofs[2]);
    const f=F(b.x,b.z);ch.box(f,b.w-.8,.15,.12,0,b.h-.8,b.d/2+.04,P.industry.steel);
    for(let x=-b.w/2+2;x<b.w/2;x+=4)ch.box(f,2.2,1.1,.08,x,b.h-2.2,b.d/2+.06,P.house.glass,{glassy:true});
    const bays=kind==='hall'?3:1;for(let i=0;i<bays;i++){const x=(i-(bays-1)/2)*(b.w/(bays+1));ch.box(f,kind==='hall'?6:3.5,kind==='hall'?4:2.7,.1,x,0,b.d/2+.08,P.cars.trim);for(let h=.4;h<(kind==='hall'?4:2.7);h+=.45)ch.box(f,kind==='hall'?5.9:3.4,.035,.13,x,h,b.d/2+.11,P.industry.steel);}
  }
  for(let i=0;i<4;i++)block('roof-plant',C.hall.x-22+i*14,C.hall.z,4,1.8,5,C.hall.h+.25,P.industry.steel);
  for(const b of C.workPanels){block('work-panel',b.x,b.z,.65,.5,.12,1.05,P.industry.steel);ch.box(F(b.x,b.z),.3,.18,.025,0,1.25,.075,P.house.glass);ch.solid.push(painted(new THREE.TorusGeometry(.13,.025,4,10),P.industry.copper,b.x+.16,y+1.22,b.z+.09));}
  const towers=C.towers.map((b,i)=>tower(b,i,y,ch.colliders));for(const t of towers){group.add(t.mesh);features.push({kind:'tower',x:t.x,z:t.z});}
  for(const b of C.transformers){
    block('transformer',b.x,b.z,6,3.4,7,0,P.industry.steel);
    block('transformer-top',b.x,b.z,5.4,.25,6.4,3.4,P.industry.copper);
    for(const side of [-1,1])for(let k=0;k<4;k++){
      ch.solid.push(cylinder(.22,.28,.8,8,b.x+side*2,y+3.65,b.z-2.2+k*1.45,P.house.glass));
      const start=ch.colliders.length;ch.colliders.push({x:b.x+side*2,y:y+4.05,z:b.z-2.2+k*1.45,hx:.28,hy:.4,hz:.28,shape:'cylinder',radius:.28,rot:0});tag(start,'insulator');
    }
  }
  const b=C.basin;
  for(const side of [-1,1]){
    block('basin',b.x+side*b.wallHalfW,b.z,.45,b.depth+.65,b.wallHalfD*2+.45,-b.depth-.2);
    block('basin',b.x,b.z+side*b.wallHalfD,b.wallHalfW*2,.65+b.depth,.45,-b.depth-.2);
  }
  const waterY=y-b.waterDrop,waterMesh=new THREE.Mesh(new THREE.PlaneGeometry(b.hw*2,b.hd*2).rotateX(-Math.PI/2).translate(b.x,waterY,b.z),MAT.coolingWater);waterMesh.name='energy-cooling-basin';group.add(waterMesh);
  const water={x:b.x,z:b.z,y:waterY,mesh:waterMesh};
  function pipe(ax,az,bx,bz,height,r=.3){
    const length=Math.hypot(bx-ax,bz-az),rot=Math.atan2(bx-ax,bz-az),x=(ax+bx)/2,z=(az+bz)/2;
    ch.solid.push(painted(new THREE.CylinderGeometry(r,r,length,8).rotateX(Math.PI/2).rotateY(rot),P.industry.copper,x,y+height,z));
    ch.colliders.push({x,y:y+height,z,hx:r,hy:length/2,hz:r,shape:'cylinder',radius:r,rot,rotX:Math.PI/2,tag:'power station',owner:`${C.id}:pipe:${ch.colliders.length}`});features.push({kind:'pipe',x,z});
    for(const s of [-1,1])block('pipe-support',x+s*(bx-ax)*.3,z+s*(bz-az)*.3,.2,height,.2,0,P.industry.steel);
  }
  pipe(-408,-568,-370,-568,3.6);pipe(-370,-568,-370,-560,3.6);pipe(-381,-569,-381,-560,2.7);
  pipe(-339,-560,-309,-560,4.5);pipe(-309,-560,-309,-578,4.5);pipe(-309,-578,-296,-578,4.5);
  function fence(ax,az,bx,bz){
    const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),f=frame((ax+bx)/2,(az+bz)/2,-dz/len,dx/len,y),start=ch.colliders.length;
    ch.collide(f,len,2.45,.2,0,0,0);tag(start,'fence');features.push({kind:'fence',x:(ax+bx)/2,z:(az+bz)/2});
    for(const h of [.65,1.35,2.2])ch.box(f,len,.07,.07,0,h,0,P.industry.steel);
    const n=Math.ceil(len/C.fenceStep);for(let i=0;i<=n;i++)ch.box(f,.16,2.45,.16,-len/2+len*i/n,0,0,P.industry.steel);
  }
  const q=C.bounds,g=C.gate;fence(q.x0,q.z0,q.x1,q.z0);fence(q.x0,q.z0,q.x0,q.z1);fence(q.x1,q.z0,q.x1,q.z1);fence(q.x0,q.z1,g.x-g.w/2,q.z1);fence(g.x+g.w/2,q.z1,q.x1,q.z1);
  for(const s of [-1,1])block('gate',g.x+s*(g.w/2+.3),g.z,.35,3,.35,0,P.industry.steel);
  const s=C.sign,sf=F(s.x,s.z,s.rot),start=ch.colliders.length;
  ch.block(sf,s.w,s.h,.12,0,s.y,0,P.road.signBlade);for(const x of [-s.w*.42,s.w*.42])ch.block(sf,.12,s.y+s.h/2,.12,x,0,0,P.industry.steel);tag(start,'sign');
  atlas.sign(sf,atlas.row(C.label,P.road.signBlade,P.road.signText),s.w-.3,s.h-.12,0,s.y+s.h/2,.07);const signMesh=atlas.mesh();group.add(signMesh);features.push({kind:'sign',x:s.x,z:s.z});
  const heads=[],pools=[];
  for(const p of C.lamps){block('lamp',p.x,p.z,NIGHT.housingW,NIGHT.housingH,NIGHT.housingD,p.h-NIGHT.housingH/2,P.cars.trim);const col=ch.colliders.at(-1);col.hz+=NIGHT.headD/4;col.z+=NIGHT.headD/4;heads.push(new THREE.BoxGeometry(NIGHT.headW,NIGHT.headH,NIGHT.headD).translate(p.x,y+p.h,p.z+NIGHT.housingD/2));pools.push(new THREE.CircleGeometry(NIGHT.poolRadius,20).rotateX(-Math.PI/2).translate(p.x,terrain.getHeight(p.x,p.z+1)+NIGHT.poolLift,p.z+1));}
  const lampHeads=new THREE.Mesh(merge(heads),MAT.lamp),lampPools=new THREE.Mesh(merge(pools),MAT.pool);lampPools.renderOrder=4;group.add(lampHeads,lampPools);
  ch.finish(group);const floor=paving(terrain);group.add(floor);features.push({kind:'paving',x:C.x,z:C.z});
  const apron=paving(terrain,[C.apron],P.town.gravel);apron.name='energy-gate-apron';group.add(apron);
  const steam=createSteamPool(group,towers,C.steam,C.seed+1),site={id:C.id,label:C.label,config:C,group,features,towers,water,paving:floor,apron,gate:C.gate,sign:{mesh:signMesh},steam,nightFixtures:{count:C.lamps.length,heads:lampHeads,pools:lampPools,spots:C.lamps}};
  const npcSpots=C.workers.map((b,i)=>{const route=b.route.map(([x,z])=>({x,z,y:terrain.getHeight(x,z)+.005}));return {role:'worker',area:'power',industryId:C.id,job:i,...route[0],yaw:b.workYaw,workYaw:b.workYaw,route,speed:C.workerSpeed,workTime:C.workTime,workAction:'maintenance'};});
  return {site,chunks:[{group,x:C.x,z:C.z,r:Math.hypot(q.x1-q.x0,q.z1-q.z0)/2}],colliders:ch.colliders,npcSpots,places:[{kind:'power',x:g.x,z:g.z+4,label:C.label}],surfaces:[...C.paving,C.apron].map(p=>({...p})),water:[{x0:b.x-b.hw,x1:b.x+b.hw,z0:b.z-b.hd,z1:b.z+b.hd,y:waterY}],updaters:[(dt,{dusk})=>{atlas.mat.emissiveIntensity=.15+dusk*1.1;steam.update(dt);}]};
}
