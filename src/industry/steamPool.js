// A single bounded tower plume; all slots, transforms and random state are allocated once.
import * as THREE from 'three';
import {MAT} from '../art/materials.js';
import {makeRng} from '../utils/rng.js';
export function createSteamPool(parent,mouths,c,seed){
  const rng=makeRng(seed),slots=Array.from({length:c.capacity},()=>({x:0,y:0,z:0,vx:0,vz:0,t:0,source:0}));
  const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),MAT.steam,c.capacity);mesh.name='cooling-tower-steam';mesh.frustumCulled=false;mesh.visible=false;parent.add(mesh);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();matrix.makeScale(0,0,0);for(let i=0;i<c.capacity;i++)mesh.setMatrixAt(i,matrix);
  let next=0,emitted=0,active=0,elapsed=0,timer=0;
  return {mesh,slots,capacity:c.capacity,get emitted(){return emitted;},get active(){return active;},get elapsed(){return elapsed;},
    update(dt){
      if(dt<=0||!parent.visible)return;elapsed+=dt;timer+=dt;
      while(timer>=c.interval){timer-=c.interval;for(let source=0;source<mouths.length;source++){const m=mouths[source],s=slots[next];next=(next+1)%c.capacity;s.x=m.x+rng.range(-c.mouthSpread,c.mouthSpread);s.y=m.y+m.h;s.z=m.z+rng.range(-c.mouthSpread,c.mouthSpread);s.vx=rng.range(-c.drift,c.drift);s.vz=rng.range(-c.drift,c.drift);s.t=c.life;s.source=source;emitted++;}}
      active=0;for(let i=0;i<c.capacity;i++){const s=slots[i];s.t=Math.max(0,s.t-dt);if(s.t>0){active++;s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=c.rise*dt;position.set(s.x,s.y,s.z);scale.setScalar((c.radius+(c.life-s.t)*c.growth)*Math.min(1,s.t/c.fade));}else{position.set(0,-1000,0);scale.setScalar(0);}matrix.compose(position,q,scale);mesh.setMatrixAt(i,matrix);}mesh.visible=active>0;mesh.instanceMatrix.needsUpdate=true;
    },
  };
}
