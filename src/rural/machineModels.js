// Shared flat-shaded agricultural kit, +Z forward. Wheel geometry comes from the car pool.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { CAR_MAT } from '../vehicles/carMaterials.js';
import { box,cylinder,painted,merge } from '../utils/geom.js';
import { createCharacter } from '../player/character.js';
import { roleOutfit } from '../npc/outfits.js';

const cache=new Map();
function geometry(kind,c,colour){
  const key=`${kind}:${colour}`;if(cache.has(key))return cache.get(key);
  const p=[],glass=[],lamps=[],header=[];
  p.push(box(c.w*.68,.3,c.l,0,c.clearance+.15,0,P.cars.trim));
  if(kind==='tractor'){
    p.push(box(1.25,.85,2.25,0,1.12,.65,colour),box(1.2,.65,.08,0,1.05,1.8,P.cars.trim));
    for(const side of [-1,1]){p.push(box(.68,.12,1.8,side*.95,1.63,-1.2,colour),box(.5,.15,.9,side*.8,.7,-.55,P.cars.chrome));
      for(const z of [-1.45,-.05])p.push(box(.07,1.55,.07,side*.65,2.03,z,P.cars.chrome));
      lamps.push(box(.27,.23,.08,side*.4,1.4,1.86,P.cars.head));}
    p.push(box(1.65,.12,1.9,0,2.82,-.75,colour),cylinder(.055,.055,1.3,8,-.48,1.4,.55,P.cars.trim));
    glass.push(box(1.25,1.1,.025,0,2.12,-.03,P.cars.glassLight),box(1.25,1.1,.025,0,2.12,-1.43,P.cars.glassLight));
  }else{
    p.push(box(c.w,1.65,3.8,0,2.2,-.8,colour),box(2.45,.3,2.1,0,2.05,1.55,colour),box(2.5,.14,2.4,0,3.65,1.35,colour));
    for(const side of [-1,1]){p.push(box(.09,1.5,.09,side*1.12,2.9,.45,P.cars.chrome),box(.09,1.5,.09,side*1.12,2.9,2.2,P.cars.chrome));
      lamps.push(box(.35,.2,.1,side*.85,3.5,2.53,P.cars.head));}
    glass.push(box(2.2,1.3,.025,0,2.9,2.21,P.cars.glassLight));
    p.push(box(1.9,.2,1.3,0,3.2,-1.1,P.cars.trim),cylinder(.12,.12,1,8,-1.1,2.8,-2.2,P.cars.trim));
    const h=c.header;p.push(box(h.w,.14,h.d,0,.5,h.z,colour),box(h.w,.5,.12,0,.75,h.z-h.d/2,colour));
    header.push(painted(new THREE.CylinderGeometry(.09,.09,h.w,10).rotateZ(Math.PI/2),P.cars.chrome));
    for(const side of [-1,1])for(let k=0;k<6;k++)header.push(box(.06,.62,.06,side*(h.w/2-.15),0,0,colour,{rotY:0}).rotateX(k*Math.PI/3));
    for(let k=0;k<6;k++){const a=k*Math.PI/3;header.push(box(h.w,.045,.07,0,Math.sin(a)*.3,Math.cos(a)*.3,P.cars.trim));}
  }
  p.push(box(.5,.15,.48,0,c.seatY+.9,c.seatZ,P.cars.trim),box(.5,.55,.12,0,c.seatY+1.12,c.seatZ-.23,P.cars.trim));
  const wheelY=c.seatY+1.15,wheelZ=c.seatZ+.48;
  p.push(painted(new THREE.TorusGeometry(.18,.025,4,12).rotateX(-.8),P.cars.trim,0,wheelY,wheelZ));
  const result={body:merge(p),glass:merge(glass),lamps:merge(lamps),header:header.length?merge(header):null};cache.set(key,result);return result;
}

export function buildMachineModel(kind,c,colour,rng){
  const g=geometry(kind,c,colour),root=new THREE.Group();root.name=`field-${kind}`;
  const mesh=(geo,mat,shadow=true)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=shadow;m.receiveShadow=true;root.add(m);return m;};
  mesh(g.body,MAT.solid);mesh(g.glass,CAR_MAT.glass,false);const lamps=mesh(g.lamps,CAR_MAT.headOff,false);
  const header=g.header?mesh(g.header,MAT.solid):null;if(header)header.position.set(0,c.header.y,c.header.z+.15);
  const driver=createCharacter(roleOutfit('farmer',rng),{name:'field operator',idlePhase:rng.range(0,10)});
  driver.root.position.set(0,c.seatY,c.seatZ);driver.animate({dt:1,speed:0,grounded:true,action:'seated',steer:0});root.add(driver.root);
  const wheels=[];for(const side of [-1,1])for(const front of [false,true])wheels.push({x:side*c.track/2,y:front?c.frontRadius:c.rearRadius,z:(front?1:-1)*c.axle/2,r:front?c.frontRadius:c.rearRadius,front,side});
  return {root,lamps,header,driver,wheels};
}
