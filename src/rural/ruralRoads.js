// Triangles follow the very same heightfield split as terrain; gravel has no kerbs/lips.
import * as THREE from 'three';
import { MAP } from '../world/terrain.js';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';

export function buildRuralRoads(rural,terrain,parent) {
  for(const road of rural.roads){
    const a=road.samples[0],b=road.samples[road.samples.length-1],w=road.halfW+1;
    const x0=Math.min(a.x,b.x)-w,x1=Math.max(a.x,b.x)+w,z0=Math.min(a.z,b.z)-w,z1=Math.max(a.z,b.z)+w;
    const positions=[],colours=[],core=new THREE.Color(PALETTE.town.gravel),edge=new THREE.Color(PALETTE.ground.soil);
    const put=(x,z)=>{positions.push(x,terrain.getHeight(x,z)+.005,z);const d=a.x===b.x?Math.abs(x-a.x):Math.abs(z-a.z),c=d>road.halfW?edge:core;colours.push(c.r,c.g,c.b);};
    // Clip to each real terrain grid cell, preserving its anti-diagonal by sampling its vertices.
    // Flat road corridors guarantee these boundary vertices are coplanar with physical ground.
    for(let z=z0;z<z1;){const nz=Math.min(z1,MAP.z0+(Math.floor((z-MAP.z0)/MAP.cell)+1)*MAP.cell);
      for(let x=x0;x<x1;){const nx=Math.min(x1,MAP.x0+(Math.floor((x-MAP.x0)/MAP.cell)+1)*MAP.cell);
        put(x,z);put(x,nz);put(nx,z);put(nx,z);put(x,nz);put(nx,nz);x=nx;
      }z=nz;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geo.computeVertexNormals();geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,MAT.decal);mesh.name=`gravel-${road.name}`;mesh.receiveShadow=true;parent.add(mesh);
    rural.chunks.push({group:mesh,x:(a.x+b.x)/2,z:(a.z+b.z)/2,r:road.length/2+w});
    // Walking shoulders meet at rural intersections; no raised pavement or solid kerbs.
    for(const side of [-1,1]){const line=[];for(let i=0;i<road.samples.length;i+=2){const s=road.samples[i],x=s.x+s.nx*(road.halfW+.6)*side,z=s.z+s.nz*(road.halfW+.6)*side;line.push({x,z,y:terrain.getHeight(x,z)+.005,ox:s.nx*side,oz:s.nz*side,detour:null});}rural.pedLines.push(line);}
  }
}
