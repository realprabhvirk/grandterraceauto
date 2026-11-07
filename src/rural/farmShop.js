// Farm produce store: the same shell, door and menu contract as the town, with registered staff.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { shell } from '../town/townInteriors.js';
import { frame,makeChunk,createSignAtlas } from '../town/townKit.js';
import { buildSwingDoor } from '../world/house62Doors.js';
import { makeRng } from '../utils/rng.js';
import { icosa } from '../utils/geom.js';
import { FARM_SHOP as C } from './farmShopConfig.js';

export function buildFarmShop({parent,terrain,site,farmId,hooks}){
  const y=terrain.getHeight(site.x,site.z)+C.floorLift,F=frame(site.x,site.z,0,1,y),rng=makeRng(C.seed);
  const ch=makeChunk(C.id),inside=makeChunk(`${C.id}-inside`),atlas=createSignAtlas(),cz=-C.d+C.counterFromBack;
  shell(ch,F,{w:C.w,d:C.d,h:C.h,wall:P.walls[2],doorW:C.doorW,doorH:C.doorH,inner:P.interior.wall,floor:P.interior.timber});
  ch.block(F,C.w+.3,.3,C.d+.3,0,C.h,-C.d/2,P.roofs[3]);
  for(const s of [-1,1])ch.box(F,3.6,1.8,.08,s*3.7,.8,.06,P.house.glass,{glassy:true});
  ch.box(F,C.w+.4,.2,2.3,0,3,1.1,P.town.awnings[1]);
  ch.box(F,C.w-.6,.8,.12,0,3.35,.08,P.road.signBlade);
  atlas.sign(F,atlas.row(C.name,P.road.signBlade,P.road.signText),C.w-1,.65,0,3.75,.16);
  inside.collide(F,C.w-.62,.04,C.d-.62,0,.02,-C.d/2);
  inside.block(F,5.4,1,.9,C.counterX,.05,cz,P.town.wood);
  inside.box(F,5.4,.06,1,C.counterX,1.05,cz,P.interior.timber);
  inside.box(F,.45,.3,.4,C.counterX-1,1.11,cz,P.cars.trim);
  let produceCount=0;
  for(const side of [-1,1]){
    const x=side*(C.w/2-.9);inside.block(F,1,1.6,5,x,.05,-5.3,P.town.wood);
    for(let row=0;row<3;row++)for(let k=0;k<6;k++){
      const p=F.toW(x+rng.range(-.27,.27),-7.3+k*.75),h=y+.35+row*.5;
      inside.solid.push(icosa(.16,0,p.x,h,p.z,[P.town.fuelRed,P.town.yellow,P.tree.leaves[1]][row]));produceCount++;
    }
  }
  for(const x of [-3,3])inside.box(F,1.8,.06,.5,x,C.h-.15,-C.d/2,P.house.lamp);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.4,.15,.2),MAT.lamp);lamp.position.set(site.x-2,y+2.8,site.z+.06);parent.add(lamp);
  ch.collide(F,.4,.15,.2,-2,2.725,.06);
  ch.finish(parent);const interior=inside.finish(parent);parent.add(atlas.mesh());
  const doorId=`${C.id}-door`,door=buildSwingDoor({id:doorId,x:site.x,y,z:site.z-.15,w:C.doorW-.1,h:C.doorH,rot:0,color:P.road.signBlade,glass:P.house.glass});parent.add(door.group);
  const shop={id:C.id,name:C.name,label:C.label,kind:'food',farmId,menu:C.menu,front:{x:site.x,y,z:site.z},doorId,door,inside:interior.group,lamp,produceCount,
    counter:{x:site.x+C.counterX,y,z:site.z+cz+C.customerGap},centre:{x:site.x,z:site.z-C.d/2},light:{x:site.x,y,z:site.z-C.d/2,h:C.lightHeight,r:C.lightRange}};
  const staff={role:'shopkeeper',area:'farm',farmId,shopId:C.id,x:site.x+C.counterX,y:y+C.floorTop,z:site.z+cz-C.keeperGap,yaw:0,action:'look'};
  const colliders=[...ch.colliders,...inside.colliders];colliders.forEach((c,i)=>{c.tag='farm shop';c.owner=`${C.id}:${i}`;});
  return {shop,staff,colliders,toggles:door.toggles,targets:[door.target,{id:`${C.id}-counter`,key:'E',range:C.counterRange,position:()=>shop.counter,label:`Press E to shop (${C.label})`,action:()=>hooks.openShop?.(shop)}],
    place:{kind:'food',x:site.x,z:site.z+1.5,label:C.label},
    update(dt,{focus,dusk}){door.update(dt);interior.group.visible=Math.hypot(focus.x-shop.centre.x,focus.z-shop.centre.z)<C.show+C.d/2;atlas.mat.emissiveIntensity=.15+dusk*1.3;},
  };
}
