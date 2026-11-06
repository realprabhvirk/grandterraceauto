// Triangles follow the very same heightfield split as terrain; gravel has no kerbs/lips.
import * as THREE from 'three';
import { MAP } from '../world/terrain.js';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { T } from '../town/townPlan.js';

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
  }
  const shoulder=(ax,az,bx,bz,side,width)=>{
    const length=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/length,dz=(bz-az)/length,n=Math.ceil(length/2.5),line=[];
    for(let i=0;i<=n;i++){const x=ax+(bx-ax)*i/n-dz*width*side,z=az+(bz-az)*i/n+dx*width*side;line.push({x,z,y:terrain.getHeight(x,z)+.005,ox:-dz*side,oz:dx*side,detour:null});}
    line.rural=true;rural.pedLines.push(line);
  };
  // Pedestrians choose links only at line ends: split at the actual road junctions.
  for(const {a,b,road} of rural.edges)for(const side of [-1,1])shoulder(a.x,a.z,b.x,b.z,side,road.halfW+.6);
  // The existing west ramp connects the new gravel verge to the civilian footpaths.
  const zs=[-215,-252,-290],width=T.hw+T.kerb+T.path/2;
  for(let i=1;i<zs.length;i++)for(const side of [-1,1])shoulder(330,zs[i-1],330,zs[i],side,width);
}
