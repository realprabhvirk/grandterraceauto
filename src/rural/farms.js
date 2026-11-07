// Built farms: shared low-poly kit, real planted fields, fenced paddocks and shallow dams.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box,boxB,cylinder,icosa,paint,painted,merge } from '../utils/geom.js';
import { makeRng } from '../utils/rng.js';
import { makeChunk,frame,createSignAtlas } from '../town/townKit.js';
import { buildHouses } from '../world/houses.js';
import { gableRoof } from '../world/houseParts.js';
import { FARM } from './farmConfig.js';
import { FARM_NIGHT as NIGHT } from '../audio/farmAudioConfig.js';

const cropGeometry=new Map();
function cropGeo(kind){
  if(cropGeometry.has(kind))return cropGeometry.get(kind);
  const colour=kind==='wheat'?P.town.yellow:kind==='maize'?P.ground.grassDark:P.tree.leaves[1];
  const parts=[boxB(.09,1,.09,0,0,0,colour)];
  if(kind==='vegetables')parts.push(icosa(.35,0,0,.3,0,colour,{sy:.6}));
  else if(kind==='wheat')parts.push(icosa(.14,0,0,1.05,0,colour,{sy:1.8}));
  else for(const side of [-1,1])parts.push(box(.7,.1,.2,side*.24,.65,0,colour,{rotY:side*.5}));
  const geo=merge(parts);cropGeometry.set(kind,geo);return geo;
}

export function buildFarms({parent,terrain}){
  const out={farms:[],chunks:[],colliders:[],trunks:[],places:[],updaters:[],cultivated:[],water:[],npcSpots:[]};
  const rng=makeRng(FARM.seed),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),Y=new THREE.Vector3(0,1,0),position=new THREE.Vector3();
  for(const [fi,cfg] of FARM.farms.entries()){
    const r=rng.fork(fi+1),group=new THREE.Group();group.name=`farm-${cfg.id}`;parent.add(group);
    const ch=makeChunk(`farm-${cfg.id}`),features=[],fields=[],paddocks=cfg.paddocks.map(b=>({...b})),atlas=createSignAtlas();
    const feature=(kind,p)=>features.push({kind,x:p.x,z:p.z});
    const tagSince=(start,kind)=>{for(let i=start;i<ch.colliders.length;i++){ch.colliders[i].tag='farm';ch.colliders[i].owner=`${cfg.id}:${kind}:${i}`;}};
    const F=(x,z,rot=0)=>frame(x,z,Math.sin(rot),Math.cos(rot),terrain.getHeight(x,z));
    const block=(kind,f,w,h,d,lx=0,ly=0,lz=0,colour=P.town.wood)=>{const start=ch.colliders.length;ch.block(f,w,h,d,lx,ly,lz,colour);tagSince(start,kind);};
    const h=cfg.house,house=buildHouses([{...h,h:terrain.getHeight(h.x,h.z),flip:false,wallColor:fi*2,roofColor:fi+2}]);
    group.add(house.group);for(const c of house.colliders){c.tag='farm';c.owner=`${cfg.id}:farmhouse`;ch.colliders.push(c);}feature('farmhouse',h);

    // Pitched working barn, braced timber doors, corrugated cladding and ventilated gables.
    {const b=cfg.barn,f=F(b.x,b.z),wall=P.walls[(fi+3)%P.walls.length],roof=P.roofs[(fi+1)%P.roofs.length],height=fi===2?4.6:6;
      block('barn',f,b.w,height,b.d,0,0,0,wall);
      const parts={walls:[],roof:[],detail:[]};gableRoof(parts,{y:height,W:b.w,D:b.d,pitch:25,color:roof,fascia:P.house.frameLight,soffit:P.house.frameLight});
      const transform=new THREE.Matrix4().makeTranslation(b.x,f.y,b.z);
      for(const g of parts.walls)paint(g,wall,.03);for(const list of Object.values(parts))for(const g of list){g.applyMatrix4(transform);ch.solid.push(g);}
      const pitch=25*Math.PI/180,halfD=b.d/2+.5,rise=halfD*Math.tan(pitch);
      for(const side of [-1,1])ch.colliders.push({x:b.x,y:f.y+height+rise/2,z:b.z+side*halfD/2,hx:(b.w+1)/2,hy:.04,hz:halfD/Math.cos(pitch)/2,rot:0,rotX:side*pitch,tag:'farm',owner:`${cfg.id}:barn-roof`});
      const doorW=Math.min(6,b.w*.4),doorH=height*.76;
      ch.box(f,doorW,doorH,.08,0,0,b.d/2+.05,P.ground.mulch);
      for(const side of [-1,1]){ch.box(f,.14,doorH,.12,side*doorW/2,0,b.d/2+.12,P.house.frameLight);
        const brace=painted(new THREE.BoxGeometry(doorW/2,.12,.1).rotateZ(side*.65),P.house.frameLight,side*doorW/4,doorH/2,b.d/2+.14);brace.translate(b.x,f.y,b.z);ch.solid.push(brace);}
      ch.box(f,doorW+.2,.16,.12,0,doorH,b.d/2+.12,P.house.frameLight);
      for(let x=-b.w/2+.7;x<b.w/2;x+=1.3)ch.box(f,.04,height,.05,x,0,-b.d/2-.04,P.house.frameLight);
      feature('barn',b);
    }
    // Open machinery shed: separate side/back walls and roof keep its front enterable.
    {const b=cfg.shed,f=F(b.x,b.z),height=4.2;
      for(const side of [-1,1])block('shed',f,.16,height,b.d,side*b.w/2,0,0,P.town.concrete);
      block('shed',f,b.w,height,.16,0,0,-b.d/2,P.town.concrete);
      block('shed',f,b.w+.7,.2,b.d+.8,0,height,0,P.roofs[2]);
      for(const side of [-1,1])block('shed',f,.18,height,.18,side*b.w/2,0,b.d/2,P.cars.chrome);
      feature('shed',b);
    }
    const round=(kind,b)=>{
      const y=terrain.getHeight(b.x,b.z);ch.solid.push(cylinder(b.r,b.r,b.h,20,b.x,y,b.z,kind==='silo'?P.cars.chrome:P.tree.leaves[3]));
      ch.colliders.push({x:b.x,y:y+b.h/2,z:b.z,hx:b.r,hy:b.h/2,hz:b.r,rot:0,shape:'cylinder',radius:b.r,tag:'farm',owner:`${cfg.id}:${kind}`});
      ch.solid.push(painted(new THREE.ConeGeometry(b.r+.1,b.r*.45,16),P.roofs[2],b.x,y+b.h+b.r*.225,b.z));
      ch.colliders.push({x:b.x,y:y+b.h+b.r*.225,z:b.z,hx:b.r+.1,hy:b.r*.225,hz:b.r+.1,rot:0,shape:'cone',radius:b.r+.1,tag:'farm',owner:`${cfg.id}:${kind}-roof`});
      for(let yy=.6;yy<b.h;yy+=1.2)ch.solid.push(painted(new THREE.TorusGeometry(b.r+.025,.025,3,20).rotateX(Math.PI/2),P.house.frame,b.x,y+yy,b.z));
      feature(kind,b);
    };
    round('silo',cfg.silo);round('tank',cfg.tank);

    const pump=cfg.pump,pf=F(pump.x,pump.z),s=pump.s;
    for(const x of [-1,1])for(const z of [-1,1])block('windmill',pf,.12*s,8*s,.12*s,x*s,0,z*s,P.cars.chrome);
    for(let y=1;y<8;y+=2)ch.box(pf,2.1*s,.1*s,2.1*s,0,y*s,0,P.cars.chrome);
    const rotorParts=[painted(new THREE.CylinderGeometry(.25,.25,.22,10).rotateX(Math.PI/2),P.cars.chrome)];
    for(let k=0;k<10;k++)rotorParts.push(painted(new THREE.BoxGeometry(.32,1.4,.06).translate(0,1.1,0).rotateZ(k*Math.PI/5),P.house.frameLight));
    const rotor=new THREE.Mesh(merge(rotorParts),MAT.solid);rotor.position.set(pump.x,pf.y+8*s,pump.z+1.1*s);rotor.scale.setScalar(s);rotor.rotation.z=r.range(0,6.28);group.add(rotor);feature('windmill',pump);
    out.updaters.push(dt=>{if(group.visible)rotor.rotation.z+=dt*FARM.pumpSpeed;});

    function fence(ax,az,bx,bz){
      const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),f=frame((ax+bx)/2,(az+bz)/2,-dz/len,dx/len,terrain.getHeight((ax+bx)/2,(az+bz)/2));
      const start=ch.colliders.length;ch.collide(f,len,1.35,.16,0,0,0);tagSince(start,'fence');
      for(const y of [.5,1.05])ch.box(f,len,.12,.1,0,y,0,P.hero.fence);
      const n=Math.ceil(len/FARM.fenceStep);for(let i=0;i<=n;i++)ch.box(f,.16,1.45,.16,-len/2+len*i/n,0,0,P.hero.fencePost);
    }
    for(const b of paddocks){const mid=(b.x0+b.x1)/2,gap=Math.min(5,(b.x1-b.x0)/4);
      fence(b.x0,b.z0,b.x1,b.z0);fence(b.x0,b.z0,b.x0,b.z1);fence(b.x1,b.z0,b.x1,b.z1);
      fence(b.x0,b.z1,mid-gap,b.z1);fence(mid+gap,b.z1,b.x1,b.z1);feature('paddock',{x:mid,z:(b.z0+b.z1)/2});
    }
    for(const b of cfg.fields){
      const countX=Math.floor((b.x1-b.x0)/FARM.plantStep),countZ=Math.floor((b.z1-b.z0)/FARM.plantStep),count=countX*countZ;
      const mesh=new THREE.InstancedMesh(cropGeo(b.kind),MAT.solid,count);mesh.name=`crop-${cfg.id}-${b.kind}`;mesh.receiveShadow=true;
      for(let iz=0;iz<countZ;iz++)for(let ix=0;ix<countX;ix++){
        const x=b.x0+(ix+.5)*(b.x1-b.x0)/countX,z=b.z0+(iz+.5)*(b.z1-b.z0)/countZ;
        position.set(x,terrain.getHeight(x,z),z);q.setFromAxisAngle(Y,r.range(-.3,.3));scale.set(r.range(.7,1.05),r.range(.55,b.kind==='maize'?1.9:1.2),r.range(.7,1.05));matrix.compose(position,q,scale);mesh.setMatrixAt(iz*countX+ix,matrix);
      }mesh.computeBoundingSphere();group.add(mesh);fields.push({mesh,bounds:{...b},kind:b.kind});
      const f=F((b.x0+b.x1)/2,(b.z0+b.z1)/2);ch.box(f,b.x1-b.x0,.004,b.z1-b.z0,0,.002,0,P.ground.soil);feature('crop',{x:f.cx,z:f.cz});out.cultivated.push({...b});
    }
    const treeGeo=merge([cylinder(.15,.22,1.8,6,0,0,0,P.tree.trunk),icosa(1.5,0,0,2.25,0,P.tree.leaves[2],{sy:.8}),icosa(1.15,0,.55,2.65,.2,P.tree.leaves[1],{sy:.8}),icosa(.12,0,.9,1.9,.8,P.town.fuelRed),icosa(.12,0,-.8,2.5,-.5,P.town.yellow)]);
    const orchardSpots=[],o=cfg.orchard;
    for(let z=o.z0+2;z<=o.z1-2;z+=o.step)for(let x=o.x0+2;x<=o.x1-2;x+=o.step)orchardSpots.push({x,z});
    const orchardMesh=new THREE.InstancedMesh(treeGeo,MAT.solid,orchardSpots.length),trunks=[];orchardMesh.name=`orchard-${cfg.id}`;orchardMesh.castShadow=orchardMesh.receiveShadow=true;
    orchardSpots.forEach((p,i)=>{const y=terrain.getHeight(p.x,p.z),s=r.range(.88,1.12);position.set(p.x,y,p.z);q.setFromAxisAngle(Y,r.range(0,6.28));scale.setScalar(s);matrix.compose(position,q,scale);orchardMesh.setMatrixAt(i,matrix);trunks.push({x:p.x,y,z:p.z,r:.22*s,h:1.8*s});});orchardMesh.computeBoundingSphere();group.add(orchardMesh);out.trunks.push(...trunks);feature('orchard',{x:(o.x0+o.x1)/2,z:(o.z0+o.z1)/2});

    for(let k=0;k<6;k++){const x=cfg.hay.x+(k%3)*1.6,z=cfg.hay.z+Math.floor(k/3)*1.5,f=F(x,z);block('hay',f,1.2,.9,1.1,0,0,0,P.ground.grassDry);ch.box(f,.07,.94,1.13,-.3,0,0,P.town.wood);ch.box(f,.07,.94,1.13,.3,0,0,P.town.wood);}feature('hay',cfg.hay);
    {const p=cfg.scarecrow,f=F(p.x,p.z);block('scarecrow',f,.1,2.5,.1,0,0,0,P.tree.trunk);ch.box(f,1.5,.12,.12,0,1.7,0,P.tree.trunk);ch.box(f,.55,.7,.3,0,1.3,0,P.npc.shirts[2]);ch.solid.push(icosa(.2,0,p.x,f.y+2.25,p.z,P.npc.skins[1]));ch.solid.push(cylinder(.35,.35,.06,8,p.x,f.y+2.45,p.z,P.ground.grassDry));feature('scarecrow',p);}
    const dam=cfg.dam,waterY=terrain.getHeight(cfg.x,cfg.z)-.08,waterGeo=new THREE.CircleGeometry(dam.r,24).rotateX(-Math.PI/2).scale(1,1,.72).translate(dam.x,waterY,dam.z);
    const water=new THREE.Mesh(paint(waterGeo,P.town.water,.025),MAT.solid);water.name=`dam-${cfg.id}`;group.add(water);feature('dam',dam);
    out.water.push({x0:dam.x-dam.r,x1:dam.x+dam.r,z0:dam.z-dam.r*.72,z1:dam.z+dam.r*.72,x:dam.x,z:dam.z,rx:dam.r,rz:dam.r*.72,y:waterY});
    for(let i=1;i<cfg.track.length;i++){const [ax,az]=cfg.track[i-1],[bx,bz]=cfg.track[i],len=Math.hypot(bx-ax,bz-az),f=F((ax+bx)/2,(az+bz)/2,-Math.atan2(bz-az,bx-ax));ch.box(f,len,.004,4.5,0,.002,0,P.town.gravel);}feature('track',cfg.access);
    const sf=F(cfg.access.x-7,cfg.access.z+9,fi===0?Math.PI/2:Math.PI);block('sign',sf,.12,2.4,.12,0,0,0,P.road.signPole);ch.box(sf,5,.8,.1,0,1.6,0,P.road.signBlade);atlas.sign(sf,atlas.row(cfg.label,P.road.signBlade,P.road.signText),4.8,.65,0,2,.06);const sign=atlas.mesh();group.add(sign);
    const heads=[],pools=[],lampSpots=[{x:cfg.barn.x-cfg.barn.w*NIGHT.barnInset,z:cfg.barn.z+cfg.barn.d/2+NIGHT.wallOffset,h:NIGHT.barnHeight},{x:cfg.shed.x+cfg.shed.w/2,z:cfg.shed.z+cfg.shed.d/2+NIGHT.wallOffset,h:NIGHT.shedHeight}];
    for(const p of lampSpots){const f=F(p.x,p.z);block('lamp',f,NIGHT.housingW,NIGHT.housingH,NIGHT.housingD,0,p.h-NIGHT.housingH/2,0,P.cars.trim);const c=ch.colliders[ch.colliders.length-1];c.hz+=NIGHT.headD/4;c.z+=NIGHT.headD/4;heads.push(new THREE.BoxGeometry(NIGHT.headW,NIGHT.headH,NIGHT.headD).translate(p.x,f.y+p.h,p.z+NIGHT.housingD/2));pools.push(new THREE.CircleGeometry(NIGHT.poolRadius,20).rotateX(-Math.PI/2).translate(p.x,terrain.getHeight(p.x,p.z+1)+NIGHT.poolLift,p.z+1));}
    const lampHeads=new THREE.Mesh(merge(heads),MAT.lamp),lampPools=new THREE.Mesh(merge(pools),MAT.pool);lampHeads.name=`farm-${cfg.id}-lamps`;lampPools.name=`farm-${cfg.id}-light-pools`;lampPools.renderOrder=4;group.add(lampHeads,lampPools);
    ch.finish(group);out.colliders.push(...ch.colliders);
    const farm={id:cfg.id,label:cfg.label,group,features,fields,paddocks,orchard:{mesh:orchardMesh,trunks},windmill:{rotor},sign:{mesh:sign,x:sf.cx,z:sf.cz},nightFixtures:{count:lampSpots.length,heads:lampHeads,pools:lampPools,spots:lampSpots},access:cfg.access,config:cfg};out.farms.push(farm);
    for(const points of cfg.workers){const route=points.map(([x,z])=>({x,z,y:terrain.getHeight(x,z)+.05}));out.npcSpots.push({role:'farmer',area:'farm',farmId:cfg.id,...route[0],yaw:0,route,speed:FARM.workerSpeed,workTime:FARM.workTime,workAction:'farmWork',idlePhase:r.range(0,10)});}
    out.chunks.push({group,x:cfg.x,z:cfg.z,r:Math.hypot(cfg.hw,cfg.hd)+10});out.places.push({kind:'farm',x:cfg.access.x,z:cfg.access.z,label:cfg.label});
  }
  return out;
}
