// Adult farm animals, built once per species. Body/head/tail and four trotting legs are instanced.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box,icosa,merge } from '../utils/geom.js';

const cache=new Map();
function kit(kind,c){
  if(cache.has(kind))return cache.get(kind);const parts=[],cream=P.house.frameLight,dark=P.cars.trim,coat=P.ground.soil;
  if(kind==='cow'){
    parts.push(box(.85,.75,1.85,0,1.05,-.08,cream),box(.46,.5,.55,0,1.32,1.02,cream),box(.47,.22,.28,0,1.12,1.35,P.npc.skins[1]));
    for(const side of [-1,1])parts.push(box(.025,.4,.6,side*.433,1.1,.2,coat),box(.3,.12,.18,side*.32,1.47,.98,coat),box(.07,.18,.07,side*.18,1.65,1.0,cream),box(.04,.65,.04,side*.05,.9,-1.03,coat),icosa(.035,0,side*.13,1.38,1.3,dark));
    parts.push(box(.5,.25,.45,0,.58,-.35,P.npc.skins[1]));
  }else if(kind==='sheep'){
    parts.push(icosa(.65,1,0,.65,0,cream,{sx:.65,sy:.68,sz:1}),icosa(.22,0,0,.8,.61,coat,{sy:1.1,sz:1.4}),box(.16,.08,.16,0,.7,.86,dark));
    for(const side of [-1,1])parts.push(box(.2,.07,.1,side*.23,.85,.6,coat),icosa(.025,0,side*.12,.84,.77,dark));
    for(const z of [-.35,0,.35])for(const side of [-1,1])parts.push(icosa(.26,0,side*.22,.84,z,cream,{sy:.8}));
    parts.push(icosa(.1,0,0,.7,-.66,cream));
  }else{
    parts.push(box(.26,.24,.62,0,.42,0,coat),box(.2,.2,.22,0,.62,.34,coat),box(.12,.1,.14,0,.58,.5,cream),box(.05,.1,.06,-.08,.76,.3,dark),box(.05,.1,.06,.08,.76,.3,dark),box(.27,.06,.1,0,.53,.2,P.town.fuelRed),box(.05,.06,.29,0,.55,-.43,coat));
    for(const side of [-1,1])parts.push(icosa(.018,0,side*.065,.65,.46,dark));
  }
  const leg=merge([box(c.legW,c.leg,c.legW,0,-c.leg/2,0,kind==='sheep'?coat:cream),box(c.legW*1.1,.08,c.legW*1.2,0,-c.leg+.04,.01,dark)]),out={body:merge(parts),leg};cache.set(kind,out);return out;
}

export function animalInstances(parent,kind,c,count){
  const g=kit(kind,c),body=new THREE.InstancedMesh(g.body,MAT.solid,count),legs=new THREE.InstancedMesh(g.leg,MAT.solid,count*4);
  for(const m of [body,legs]){m.castShadow=m.receiveShadow=true;m.frustumCulled=false;m.visible=false;parent.add(m);}body.name=`farm-${kind}-bodies`;legs.name=`farm-${kind}-legs`;
  return {kind,body,legs,list:[]};
}
