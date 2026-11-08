// Fixed-step field routes with interpolated visuals; no drivable-car physics changes.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { CAR_MAT } from '../vehicles/carMaterials.js';
import { createWheelInstances } from '../vehicles/wheels.js';
import { G_CAR } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';
import { MACHINERY } from './machineryConfig.js';
import { buildMachineModel } from './machineModels.js';
import { createDustPool } from './dustPool.js';

// Arc-length samples are allocated once; sampling the live state only writes into an existing object.
function fieldRoute(points,terrain,sampleStep){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');curve.arcLengthDivisions=2048;curve.updateArcLengths();
  const length=curve.getLength(),n=Math.ceil(length/sampleStep),samples=[];
  for(let i=0;i<n;i++){const p=curve.getPointAt(i/n),t=curve.getTangentAt(i/n);samples.push({x:p.x,y:terrain.getHeight(p.x,p.z),z:p.z,yaw:Math.atan2(t.x,t.z)});}
  return {samples,length,at(s,out){const u=((s%length+length)%length)/length*n,i=Math.floor(u),t=u-i,a=samples[i],b=samples[(i+1)%n];out.x=a.x+(b.x-a.x)*t;out.y=a.y+(b.y-a.y)*t;out.z=a.z+(b.z-a.z)*t;out.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*t;return out;}};
}

function aheadOf(m,x,z,r,fx,fz,reach,width){
  const dx=x-m.pose.x,dz=z-m.pose.z,ahead=dx*fx+dz*fz,lat=dx*fz-dz*fx;
  return ahead>-.5&&ahead<reach+r&&Math.abs(lat)<width/2+r+.3;
}

function occupies(m,p,margin){
  const dx=p.x-m.pose.x,dz=p.z-m.pose.z,c=Math.cos(m.pose.yaw),s=Math.sin(m.pose.yaw),z=dx*s+dz*c;
  const width=Math.max(m.cfg.w,m.cfg.header?.w||0);
  return Math.abs(dx*c-dz*s)<width/2+margin&&z>-m.cfg.l/2-margin&&z<Math.max(m.cfg.l/2,m.cfg.header?m.cfg.header.z+m.cfg.header.d/2:0)+margin;
}

export function createFarmMachinery({scene,physics,world,controls,peds,vehicles,traffic,config:C=MACHINERY,modelFactory=buildMachineModel,sites=world.rural.farms}){
  const {world:pw,RAPIER:R}=physics,terrain=world.terrain,rng=makeRng(C.seed),wheels=createWheelInstances(C.machines.length*4).mesh;wheels.name='field-machine-wheels';scene.add(wheels);
  const dust=C.dustCapacity?createDustPool(scene,{capacity:C.dustCapacity,life:C.dustLife,seed:C.seed}):null,zero=new THREE.Matrix4().makeScale(0,0,0);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),wq=new THREE.Quaternion(),turn=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(),Y=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0);
  const nextPosition={x:0,y:0,z:0},nextRotation={x:0,y:0,z:0,w:1},driverPose={dt:0,speed:0,grounded:true,action:'seated',steer:0};
  const machines=C.machines.map((spec,i)=>{
    const cfg=C.types[spec.kind],route=fieldRoute(spec.points,terrain,C.sampleStep),farm=sites.find(f=>f.id===(spec.siteId||spec.farmId)),model=modelFactory(spec.kind,cfg,P.cars.paints[spec.paint],rng.fork(i+1)),pose=route.at(0,{});
    farm.group.add(model.root);const body=pw.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.x,pose.y,pose.z).setRotation({x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)})),colliders=[];
    const add=d=>{const col=pw.createCollider(d.setCollisionGroups(G_CAR),body);physics.tag(col,C.colliderTag||'farm machinery',spec.id);colliders.push(col);};
    add(R.ColliderDesc.cuboid(cfg.w/2,(cfg.h-cfg.clearance)/2,cfg.l/2).setTranslation(0,(cfg.h+cfg.clearance)/2,0));
    for(const w of model.wheels)add(R.ColliderDesc.cylinder(cfg.wheelWidth/2,w.r).setRotation({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}).setTranslation(w.x,w.y,w.z));
    if(model.solids){for(const b of model.solids)add(R.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.y,b.z));}
    else if(cfg.header){const h=cfg.header;add(R.ColliderDesc.cuboid(h.w/2,h.h/2,h.d/2).setTranslation(0,h.y,h.z));}
    body.setEnabled(false);
    return {...spec,cfg,route,model,farm,body,colliders,pose,prev:{...pose},render:{...pose},s:0,v:0,spin:0,prevSpin:0,headerAngle:0,prevHeader:0,steer:0,dustT:0,sleeping:true,blocked:false,laps:0,mover:{x:pose.x,z:pose.z,fx:Math.sin(pose.yaw),fz:Math.cos(pose.yaw),speed:0,len:cfg.l,w:cfg.w}};
  });
  function obstructed(m){
    const fx=Math.sin(m.pose.yaw),fz=Math.cos(m.pose.yaw),front=m.cfg.header?m.cfg.header.z+m.cfg.header.d/2:m.cfg.l/2,width=m.cfg.header?m.cfg.header.w:m.cfg.w;
    // Retain a stop as speed falls: the shrinking stopping distance must not cause creep/chatter.
    const reach=front+C.stopGap+m.v*m.v/(2*C.braking)+(m.blocked?C.stopReleaseMargin:0);
    if(controls.mode==='walk'&&aheadOf(m,controls.player.position.x,controls.player.position.z,.4,fx,fz,reach,width))return true;
    for(const p of peds.peds)if(!p.gone&&aheadOf(m,p.pos.x,p.pos.z,.4,fx,fz,reach,width))return true;
    for(const c of vehicles.cars)if(!c.impounded&&aheadOf(m,c.position.x,c.position.z,c.cfg.L/2,fx,fz,reach,width))return true;
    for(const c of traffic.cars)if(aheadOf(m,c.pos.x,c.pos.z,c.cfg.L/2,fx,fz,reach,width))return true;
    return false;
  }
  physics.onStep(dt=>{const focus=controls.focus();for(const m of machines){
    const sleep=Math.hypot(m.pose.x-focus.x,m.pose.z-focus.z)>C.awakeDistance;
    if(sleep){if(!m.sleeping){m.body.setEnabled(false);m.sleeping=true;m.v=0;Object.assign(m.prev,m.pose);m.prevSpin=m.spin;m.prevHeader=m.headerAngle;}continue;}
    if(m.sleeping){const car=controls.car&&controls.mode!=='walk'&&controls.mode!=='fly'?controls.car:null,margin=car?Math.hypot(car.cfg.W,car.cfg.L)/2+C.wakeCarPadding:C.wakeMargin;if(occupies(m,focus,margin)){m.blocked=true;continue;}m.body.setEnabled(true);m.sleeping=false;}
    Object.assign(m.prev,m.pose);m.prevSpin=m.spin;m.prevHeader=m.headerAngle;m.blocked=obstructed(m);
    const target=m.blocked?0:m.cfg.speed;m.v+=Math.max(-C.braking*dt,Math.min(C.acceleration*dt,target-m.v));
    const step=m.v*dt;m.s+=step;if(m.s>=m.route.length){m.s-=m.route.length;m.laps++;}m.route.at(m.s,m.pose);
    const dyaw=Math.atan2(Math.sin(m.pose.yaw-m.prev.yaw),Math.cos(m.pose.yaw-m.prev.yaw));m.steer=step>.0001?Math.max(-.55,Math.min(.55,Math.atan(m.cfg.axle*dyaw/step))):0;
    m.spin+=step;m.headerAngle+=m.v>.1?dt*C.headerSpeed:0;
    nextPosition.x=m.pose.x;nextPosition.y=m.pose.y;nextPosition.z=m.pose.z;nextRotation.y=Math.sin(m.pose.yaw/2);nextRotation.w=Math.cos(m.pose.yaw/2);m.body.setNextKinematicTranslation(nextPosition);m.body.setNextKinematicRotation(nextRotation);
    if(dust&&m.v>.25&&Math.hypot(m.pose.x-focus.x,m.pose.z-focus.z)<C.dustDistance){m.dustT+=dt;if(m.dustT>=C.dustInterval){m.dustT-=C.dustInterval;dust.emit(m.pose.x-Math.sin(m.pose.yaw)*m.cfg.l/2,m.pose.y+.2,m.pose.z-Math.cos(m.pose.yaw)*m.cfg.l/2);}}
    else m.dustT=0;
  }});
  return {machines,dust,wheels,movers:machines.map(m=>m.mover),
    update(dt,alpha,dusk){for(let i=0;i<machines.length;i++){const m=machines[i],a=m.sleeping?1:alpha,p=m.render;p.x=m.prev.x+(m.pose.x-m.prev.x)*a;p.y=m.prev.y+(m.pose.y-m.prev.y)*a;p.z=m.prev.z+(m.pose.z-m.prev.z)*a;p.yaw=m.prev.yaw+Math.atan2(Math.sin(m.pose.yaw-m.prev.yaw),Math.cos(m.pose.yaw-m.prev.yaw))*a;
      m.model.root.position.set(p.x,p.y,p.z);m.model.root.rotation.y=p.yaw;m.model.lamps.material=dusk>.5?CAR_MAT.headOn:CAR_MAT.headOff;
      if(m.model.header)m.model.header.rotation.x=m.prevHeader+(m.headerAngle-m.prevHeader)*a;
      m.mover.x=p.x;m.mover.z=p.z;m.mover.fx=Math.sin(p.yaw);m.mover.fz=Math.cos(p.yaw);m.mover.speed=m.v;
      if(m.farm.group.visible){driverPose.dt=dt;driverPose.steer=m.steer;m.model.driver.animate(driverPose);}
      const spin=m.prevSpin+(m.spin-m.prevSpin)*a;
      for(let k=0;k<4;k++){const w=m.model.wheels[k];if(!m.farm.group.visible){wheels.setMatrixAt(i*4+k,zero);continue;}
        const c=Math.cos(p.yaw),s=Math.sin(p.yaw);position.set(p.x+w.x*c+w.z*s,p.y+w.y,p.z-w.x*s+w.z*c);q.setFromAxisAngle(Y,p.yaw+(w.front?m.steer:0));turn.setFromAxisAngle(X,spin/w.r);q.multiply(turn);if(w.side<0){wq.setFromAxisAngle(Y,Math.PI);q.multiply(wq);}scale.set(m.cfg.wheelWidth,w.r,w.r);matrix.compose(position,q,scale);wheels.setMatrixAt(i*4+k,matrix);
      }
    }wheels.instanceMatrix.needsUpdate=true;dust?.update(dt);},
  };
}
