// +Z forward, with a visible and native loaded fork assembly driven by the same dimensions.
import * as THREE from 'three';
import {PALETTE as P} from '../art/palette.js';
import {MAT} from '../art/materials.js';
import {CAR_MAT} from '../vehicles/carMaterials.js';
import {box,painted,merge} from '../utils/geom.js';
import {createCharacter} from '../player/character.js';
import {roleOutfit} from '../npc/outfits.js';

export function buildForkliftModel(kind,c,colour,rng){
  const root=new THREE.Group();root.name='yard-forklift';const parts=[box(c.w,.35,c.l,0,c.clearance+.175,0,P.cars.trim),box(c.w,.9,.9,0,.95,-.9,colour),box(.55,.15,.5,0,c.seatY+.9,c.seatZ,P.cars.trim),box(.55,.55,.12,0,c.seatY+1.12,c.seatZ-.25,P.cars.trim)];
  for(const side of [-1,1]){
    for(const z of [-.85,.85])parts.push(box(.075,1.5,.075,side*.68,1.65,z,P.industry.steel));
    parts.push(box(.14,2.1,.18,side*.58,1.2,1.25,P.industry.steel));
  }
  parts.push(box(1.5,.12,2.05,0,2.49,0,colour),box(1.3,.15,.15,0,1.55,1.25,P.industry.steel),painted(new THREE.TorusGeometry(.17,.025,4,12).rotateX(-.8),P.cars.trim,0,c.seatY+1.15,c.seatZ+.48));
  const add=(geo,mat,shadow=true)=>{const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);return mesh;};add(merge(parts),MAT.solid);
  const load=add(merge(c.load.map((b,i)=>box(b.w,b.h,b.d,b.x,b.y,b.z,i<2?P.industry.steel:P.town.wood))),MAT.solid);load.name='carried-pallet-crate';
  const lamps=add(merge([-1,1].map(side=>box(.2,.14,.06,side*.55,2.35,1.06,P.cars.head))),CAR_MAT.headOff,false);
  const driver=createCharacter(roleOutfit('worker',rng),{name:'yard operator',idlePhase:rng.range(0,10)});driver.root.position.set(0,c.seatY,c.seatZ);driver.animate({dt:1,speed:0,grounded:true,action:'seated',steer:0});root.add(driver.root);
  const wheels=[];for(const side of [-1,1])for(const front of [false,true])wheels.push({x:side*c.track/2,y:front?c.frontRadius:c.rearRadius,z:(front?1:-1)*c.axle/2,r:front?c.frontRadius:c.rearRadius,front,side});
  return {root,lamps,load,header:null,driver,wheels,solids:c.load};
}
