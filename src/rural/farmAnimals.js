// Safe livestock AI: bounded seeded wandering, soft car knockdowns, no health/death/injury state.
import * as THREE from 'three';
import { PALETTE as P } from '../art/palette.js';
import { groups,GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';
import { ANIMALS as C } from './animalConfig.js';
import { animalInstances } from './animalModels.js';

const PLAYER_ONLY=groups(GROUP.NPC,GROUP.PLAYER);

// Ray vs yawed standing box, using scalar slab intervals and no temporary vectors/arrays.
function rayAnimal(a,o,d,max){
  const c=Math.cos(a.yaw),s=Math.sin(a.yaw),dx=o.x-a.pos.x,dz=o.z-a.pos.z;
  const ox=dx*c-dz*s,oz=dx*s+dz*c,ux=d.x*c-d.z*s,uz=d.x*s+d.z*c;let lo=0,hi=max;
  for(let axis=0;axis<3;axis++){
    const p=axis===0?ox:axis===1?o.y-a.pos.y-a.cfg.hitY*a.scale:oz,v=axis===0?ux:axis===1?d.y:uz,h=(axis===0?a.cfg.w:axis===1?a.cfg.h:a.cfg.l)*a.scale/2;
    if(Math.abs(v)<1e-9){if(Math.abs(p)>h)return Infinity;continue;}const t0=(-h-p)/v,t1=(h-p)/v;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return Infinity;
  }return lo;
}

export function createFarmAnimals({physics,world}){
  const list=[],batches=[],rng=makeRng(C.seed),{world:pw,RAPIER:R}=physics;
  const root=new THREE.Matrix4(),local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),roll=new THREE.Quaternion(),legQ=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),one=new THREE.Vector3(1,1,1),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),X=new THREE.Vector3(1,0,0),colour=new THREE.Color(),zero=new THREE.Matrix4().makeScale(0,0,0),rayHit={dist:Infinity,ref:null};
  function clear(a,x,z){
    const b=a.bounds,r=a.radius;if(x<b.x0+C.paddockInset+r||x>b.x1-C.paddockInset-r||z<b.z0+C.paddockInset+r||z>b.z1-C.paddockInset-r)return false;
    const d=a.farm.config.dam;if(((x-d.x)/(d.r+r))**2+((z-d.z)/(d.r*.72+r))**2<1)return false;
    for(const ob of a.obstacles){const dx=x-ob.x,dz=z-ob.z;if(Math.abs(dx*ob.c-dz*ob.s)<ob.hx+r&&Math.abs(dx*ob.s+dz*ob.c)<ob.hz+r)return false;}
    return true;
  }
  function segment(a,x,z){const dx=x-a.pos.x,dz=z-a.pos.z,n=Math.ceil(Math.hypot(dx,dz)/C.pathStep);for(let k=1;k<=n;k++)if(!clear(a,a.pos.x+dx*k/n,a.pos.z+dz*k/n))return false;return true;}
  function separated(a,x,z){for(const other of list)if(other!==a&&other.farmId===a.farmId&&Math.hypot(x-other.pos.x,z-other.pos.z)<a.radius+other.radius+C.separation)return false;return true;}
  function target(a,fromX=0,fromZ=0,flee=false){
    const b=a.bounds,r=a.radius+C.paddockInset;
    for(let n=0;n<C.targetTries;n++){let x,z;
      if(flee){const yaw=Math.atan2(a.pos.x-fromX,a.pos.z-fromZ)+a.rng.range(-C.scatterAngle,C.scatterAngle),d=a.rng.range(C.scatterMin,C.scatterMax);x=Math.max(b.x0+r,Math.min(b.x1-r,a.pos.x+Math.sin(yaw)*d));z=Math.max(b.z0+r,Math.min(b.z1-r,a.pos.z+Math.cos(yaw)*d));if(Math.hypot(x-fromX,z-fromZ)<Math.hypot(a.pos.x-fromX,a.pos.z-fromZ)+C.scatterGain)continue;}
      else{x=a.rng.range(b.x0+r,b.x1-r);z=a.rng.range(b.z0+r,b.z1-r);}
      if(clear(a,x,z)&&separated(a,x,z)&&segment(a,x,z)){a.tx=x;a.tz=z;return true;}
    }a.tx=a.pos.x;a.tz=a.pos.z;return false;
  }
  for(const [fi,farm] of world.rural.farms.entries()){
    const obstacles=world.colliders.filter(o=>o.x>farm.config.x-farm.config.hw-C.obstacleMargin&&o.x<farm.config.x+farm.config.hw+C.obstacleMargin&&o.z>farm.config.z-farm.config.hd-C.obstacleMargin&&o.z<farm.config.z+farm.config.hd+C.obstacleMargin&&!o.owner?.includes(':fence:')).map(o=>({...o,c:Math.cos(o.rot||0),s:Math.sin(o.rot||0)}));
    for(const t of world.trunks)if(Math.abs(t.x-farm.config.x)<farm.config.hw+C.obstacleMargin&&Math.abs(t.z-farm.config.z)<farm.config.hd+C.obstacleMargin)obstacles.push({x:t.x,z:t.z,hx:t.r,hz:t.r,c:1,s:0});
    for(const spec of C.farms[farm.id]){
      const cfg=C.types[spec.kind],batch=animalInstances(farm.group,spec.kind,cfg,spec.count);batches.push(batch);
      for(let i=0;i<spec.count;i++){
        const r=rng.fork(fi*100+list.length+1),s=r.range(C.scaleMin,C.scaleMax),b=farm.paddocks[spec.paddock],a={id:`${farm.id}-${spec.kind}-${i}`,kind:spec.kind,farmId:farm.id,farm,bounds:b,cfg,scale:s,radius:Math.hypot(cfg.w,cfg.l)*s/2,rng:r,obstacles,pos:new THREE.Vector3(),yaw:r.range(0,Math.PI*2),phase:r.range(0,Math.PI*2),state:'graze',timer:r.range(C.grazeMin,C.grazeMax),flee:0,down:0,cooldown:0,speed:0,asleep:true,tx:0,tz:0,body:null,collider:null};
        let placed=false;for(let k=0;k<C.spawnTries;k++){const x=r.range(b.x0+C.spawnMarginX,b.x1-C.spawnMarginX),z=r.range(b.z0+C.spawnMarginZ,b.z1-C.spawnMarginZ);if(clear(a,x,z)&&separated(a,x,z)){a.pos.set(x,world.terrain.getHeight(x,z),z);placed=true;break;}}
        if(!placed)throw Error(`No safe animal spawn for ${a.id}`);
        a.spawn={x:a.pos.x,y:a.pos.y,z:a.pos.z,yaw:a.yaw,scale:s};a.tx=a.pos.x;a.tz=a.pos.z;
        a.body=pw.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(a.pos.x,a.pos.y,a.pos.z));
        a.collider=pw.createCollider(R.ColliderDesc.cuboid(cfg.w*s/2,cfg.h*s/2,cfg.l*s/2).setTranslation(0,cfg.hitY*s,0).setCollisionGroups(PLAYER_ONLY),a.body);physics.tag(a.collider,'animal',a.id);a.body.setEnabled(false);
        a.next={x:a.pos.x,y:a.pos.y,z:a.pos.z};a.rotation={x:0,y:Math.sin(a.yaw/2),z:0,w:Math.cos(a.yaw/2)};
        const coats=spec.kind==='dog'?P.npc.hairs:spec.kind==='sheep'?[P.house.frameLight,P.walls[0]]:[P.house.frameLight,P.walls[2],P.ground.grassDry];colour.set(r.pick(coats));batch.body.setColorAt(i,colour);for(let k=0;k<4;k++)batch.legs.setColorAt(i*4+k,colour);list.push(a);batch.list.push(a);
      }
    }
  }
  function scatter(a,x,z){a.flee=C.scatterTime;a.timer=0;a.state='scatter';target(a,x,z,true);}
  function hit(a,knock=false){if(a.asleep)return;if(knock&&a.cooldown<=0){a.down=C.downTime;a.cooldown=C.hitCooldown;a.state='down';a.speed=0;a.collider.setEnabled(false);}else if(a.down<=0)scatter(a,a.pos.x-Math.sin(a.yaw),a.pos.z-Math.cos(a.yaw));}
  return {list,batches,clear,hit,
    alarm(p,radius=C.gunfireRadius){for(const a of list)if(!a.asleep&&a.down<=0&&Math.hypot(a.pos.x-p.x,a.pos.z-p.z)<radius)scatter(a,p.x,p.z);},
    raycast(o,d,max){rayHit.dist=max;rayHit.ref=null;for(const a of list)if(!a.asleep&&a.down<=0){const t=rayAnimal(a,o,d,rayHit.dist);if(t<rayHit.dist){rayHit.dist=t;rayHit.ref=a;}}return rayHit.ref?rayHit:null;},
    update(dt,{focus,player,cars}){
      for(const a of list){const asleep=Math.hypot(a.pos.x-focus.x,a.pos.z-focus.z)>C.sleepDistance;if(asleep!==a.asleep){a.asleep=asleep;a.body.setEnabled(!asleep);}if(asleep)continue;
        if(dt>0){a.cooldown=Math.max(0,a.cooldown-dt);a.flee=Math.max(0,a.flee-dt);
          if(a.down>0){a.down=Math.max(0,a.down-dt);if(a.down===0){a.collider.setEnabled(true);scatter(a,a.pos.x-1,a.pos.z-1);}}
          else{
            if(player&&Math.hypot(a.pos.x-player.x,a.pos.z-player.z)<C.scatterDistance&&a.flee<C.scatterRefresh)scatter(a,player.x,player.z);
            for(const car of cars){const dx=a.pos.x-car.x,dz=a.pos.z-car.z,near=Math.hypot(dx,dz);if(Math.abs(car.speed)<C.carMovingMin||near>C.carAwareness)continue;
              const along=Math.abs(dx*car.fx+dz*car.fz),lat=Math.abs(dx*car.fz-dz*car.fx);
              if(Math.abs(car.speed)>=C.carHitSpeed&&along<car.len/2+a.radius+Math.abs(car.speed)*C.carLookAhead&&lat<car.w/2+a.cfg.w*a.scale/2){hit(a,true);break;}
              if(near<C.carScatterDistance&&a.flee<C.scatterRefresh)scatter(a,car.x,car.z);
            }
            if(a.down<=0){const dx=a.tx-a.pos.x,dz=a.tz-a.pos.z,d=Math.hypot(dx,dz);
              if(d<C.targetReach){a.speed=0;if(a.flee<=0){a.state='graze';a.timer-=dt;if(a.timer<=0){target(a);a.timer=a.rng.range(C.grazeMin,C.grazeMax);a.state='wander';}}else a.state='scatter';}
              else{a.speed=a.flee>0?a.cfg.run:a.cfg.walk;a.state=a.flee>0?'scatter':'wander';const step=Math.min(d,a.speed*dt),x=a.pos.x+dx/d*step,z=a.pos.z+dz/d*step;
                if(clear(a,x,z)&&separated(a,x,z)){a.pos.set(x,world.terrain.getHeight(x,z),z);const yaw=Math.atan2(dx,dz);a.yaw+=Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw))*Math.min(1,dt*C.turnRate);}else{a.tx=a.pos.x;a.tz=a.pos.z;a.timer=C.targetRetry;a.speed=0;}
              }
            }
          }a.phase+=dt*(a.speed>0?a.speed*C.trotRate:C.idleRate);a.next.x=a.pos.x;a.next.y=a.pos.y;a.next.z=a.pos.z;a.rotation.y=Math.sin(a.yaw/2);a.rotation.w=Math.cos(a.yaw/2);a.body.setNextKinematicTranslation(a.next);a.body.setNextKinematicRotation(a.rotation);
        }
        // A teleport must not enable a body inside the player; moving cars never receive animal impulses.
        a.collider.setEnabled(a.down<=0&&(!player||Math.hypot(a.pos.x-player.x,a.pos.z-player.z)>a.cfg.w*a.scale/2+C.playerClearance));
      }
      for(const batch of batches){let awake=0;for(let i=0;i<batch.list.length;i++){const a=batch.list[i];if(a.asleep){batch.body.setMatrixAt(i,zero);for(let k=0;k<4;k++)batch.legs.setMatrixAt(i*4+k,zero);continue;}awake++;
        const down=a.down>0?Math.min(1,(C.downTime-a.down)/C.fallTime,a.down/C.riseTime):0,pivot=a.cfg.hitY,centre=pivot*(1-down)+a.cfg.w/2*down,bob=a.speed>0?Math.abs(Math.sin(a.phase))*C.bob:0;
        pos.set(a.pos.x,a.pos.y+(centre+bob)*a.scale,a.pos.z);q.setFromAxisAngle(Y,a.yaw);roll.setFromAxisAngle(Z,down*C.downAngle);q.multiply(roll);scale.setScalar(a.scale);root.compose(pos,q,scale);local.makeTranslation(0,-pivot,0);root.multiply(local);batch.body.setMatrixAt(i,root);
        for(let k=0;k<4;k++){pos.set((k%2?1:-1)*a.cfg.legX,a.cfg.leg,(k<2?1:-1)*a.cfg.legZ);legQ.setFromAxisAngle(X,Math.sin(a.phase+(k===0||k===3?0:Math.PI))*C.legSwing*Math.min(1,a.speed)*(1-down));local.compose(pos,legQ,one);matrix.multiplyMatrices(root,local);batch.legs.setMatrixAt(i*4+k,matrix);}
      }batch.body.visible=batch.legs.visible=awake>0;batch.body.instanceMatrix.needsUpdate=batch.legs.instanceMatrix.needsUpdate=true;}
    },
  };
}
