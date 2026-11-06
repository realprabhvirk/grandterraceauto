// One seeded, bounded instanced pool. Numeric slots and transforms are reused each frame.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { paint } from '../utils/geom.js';
import { makeRng } from '../utils/rng.js';

export function createDustPool(scene,{capacity,life,seed}){
  const rng=makeRng(seed),slots=Array.from({length:capacity},()=>({x:0,y:0,z:0,vx:0,vz:0,t:0}));
  const material=new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:.22,depthWrite:false,flatShading:true});
  const mesh=new THREE.InstancedMesh(paint(new THREE.IcosahedronGeometry(1,0),P.ground.soil),material,capacity);mesh.name='field-dust';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();let next=0,emitted=0,active=0;
  return {mesh,capacity,get active(){return active;},get emitted(){return emitted;},
    emit(x,y,z){const s=slots[next];next=(next+1)%capacity;s.x=x+rng.range(-.4,.4);s.y=y;s.z=z+rng.range(-.4,.4);s.vx=rng.range(-.4,.4);s.vz=rng.range(-.4,.4);s.t=life;emitted++;},
    update(dt){active=0;for(let i=0;i<capacity;i++){const s=slots[i];s.t=Math.max(0,s.t-dt);if(s.t>0){active++;s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=dt*.45;position.set(s.x,s.y,s.z);scale.setScalar((1-s.t/life)*.7+.12);scale.multiplyScalar(Math.min(1,s.t/.3));}else{position.set(0,-1000,0);scale.setScalar(0);}matrix.compose(position,q,scale);mesh.setMatrixAt(i,matrix);}mesh.visible=active>0;mesh.instanceMatrix.needsUpdate=true;},
  };
}
