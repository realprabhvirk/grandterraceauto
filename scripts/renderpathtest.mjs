// Actual rendering: scene-specific material cache, sleeping skeleton traversal and first visible poses.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('?cam=player',process.env.GTA_URL||'http://127.0.0.1:5173/').href);
  await page.waitForFunction(()=>window.__gta?.ready,null,{timeout:90000});
  await page.keyboard.press('Shift');
  const registry=await page.evaluate(()=>{
    const M=__gta.debug.materials();window.__renderMaterials=M;
    if(!M.viewSolid)return {exists:false};
    return {exists:true,separate:M.viewSolid!==M.solid,same:['type','vertexColors','flatShading','side','transparent','opacity','depthWrite','emissiveIntensity','fog'].every(k=>M.viewSolid[k]===M.solid[k])&&M.viewSolid.color.equals(M.solid.color)&&M.viewSolid.emissive.equals(M.solid.emissive)};
  });
  assert.ok(registry.exists,'viewmodel must have a bounded shared scene material');
  assert.ok(registry.separate&&registry.same,'viewmodel material must retain the original appearance');
  await page.evaluate(async()=>{
    const g=__gta;g.debug.teleport(470,-92,Math.PI);await g.debug.tap('KeyC');
    window.__fogCounter={switches:0,draws:0};
    const draw=g.renderer.renderBufferDirect;
    g.renderer.renderBufferDirect=function(camera,scene,geometry,material,...rest){
      if(material===__renderMaterials.solid||material===__renderMaterials.viewSolid){
        const p=this.properties.get(material);__fogCounter.draws++;
        if(p.__version!==undefined&&p.fog!==scene.fog)__fogCounter.switches++;
      }
      return draw.call(this,camera,scene,geometry,material,...rest);
    };
  });
  const sample=async()=>{
    await page.evaluate(()=>{__fogCounter.switches=__fogCounter.draws=0;});
    await page.waitForTimeout(650);
    return page.evaluate(()=>({...__fogCounter,programs:__gta.renderer.info.programs.length}));
  };
  for(const id of ['pistol','smg','shotgun','rifle']){
    await page.evaluate(id=>{__gta.weapons.arsenal.give(id,100);__gta.weapons.arsenal.select(id);},id);
    await page.waitForTimeout(800);
    const assignment=await page.evaluate(id=>{
      const g=__gta,M=__renderMaterials;let view=0,world=0,bad=0;
      g.viewmodel.scene.traverse(o=>{if(o.isMesh){view++;if(o.material!==M.viewSolid)bad++;}});
      g.weapons.hand[id].group.traverse(o=>{if(o.isMesh){world++;if(o.material!==M.solid)bad++;}});
      return {view,world,bad,visible:g.viewmodel.visible,camera:g.controls.cameraMode};
    },id);
    assert.ok(assignment.view>=7&&assignment.world>0&&assignment.visible&&assignment.camera==='first',JSON.stringify(assignment));
    assert.equal(assignment.bad,0);
    const cache=await sample();console.log('Viewmodel material',id,JSON.stringify(cache));
    assert.ok(cache.draws>100);assert.equal(cache.switches,0);
  }
  const production=await sample();
  await page.evaluate(()=>{
    window.__viewRestore=[];
    __gta.viewmodel.scene.traverse(o=>{if(o.material===__renderMaterials.viewSolid){__viewRestore.push(o);o.material=__renderMaterials.solid;}});
  });
  await page.waitForTimeout(500);const old=await sample();
  console.log('Old scene-sharing positive control',JSON.stringify(old));
  assert.ok(old.switches>20);assert.equal(old.programs,production.programs);
  await page.evaluate(()=>{for(const o of __viewRestore)o.material=__renderMaterials.viewSolid;});
  await page.waitForTimeout(400);assert.equal((await sample()).switches,0);

  await page.evaluate(()=>{
    const g=__gta,p=g.peds.peds.find(p=>p.area==='suburb'&&p.role==='walker');
    window.__matrixPed=p;window.__matrixCalls=0;window.__wakeRows=[];window.__watchWake=false;
    const child=p.ch.bones.torso,fn=child.updateMatrixWorld;
    child.updateMatrixWorld=function(...a){__matrixCalls++;return fn.apply(this,a);};
    window.__productionRootUpdate=p.ch.root.updateMatrixWorld;
    p.ch.root.updateMatrixWorld=function(force){
      __productionRootUpdate.call(this,force);
      if(this.visible&&__watchWake){
        __watchWake=false;const e=this.matrixWorld.elements,t=p.body.translation();let boneError=0;
        for(const b of Object.values(p.ch.bones)){
          const expected=b.parent.matrixWorld.clone().multiply(b.matrix).elements;
          for(let i=0;i<16;i++)boneError=Math.max(boneError,Math.abs(expected[i]-b.matrixWorld.elements[i]));
        }
        __wakeRows.push({rootError:Math.hypot(e[12]-p.pos.x,e[13]-p.pos.y,e[14]-p.pos.z),boneError,nativeError:Math.hypot(t.x-p.pos.x,t.z-p.pos.z),solid:p.collider.isEnabled(),calls:__matrixCalls});
      }
    };
    window.__watchedRootUpdate=p.ch.root.updateMatrixWorld;
    g.debug.teleport(900,-600,0);
  });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>__matrixPed.ch.root.visible),false);
  await page.evaluate(()=>{__matrixCalls=0;});await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>__matrixCalls),0,'sleeping NPC descendants must not be traversed by real renders');
  await page.evaluate(()=>{__matrixPed.ch.root.updateMatrixWorld=Object.getPrototypeOf(__matrixPed.ch.root).updateMatrixWorld;__matrixCalls=0;});
  await page.waitForTimeout(350);
  const waste=await page.evaluate(()=>__matrixCalls);console.log('Old sleeping traversal positive control',waste);assert.ok(waste>5);
  await page.evaluate(()=>{__matrixPed.ch.root.updateMatrixWorld=__watchedRootUpdate;});
  for(let i=0;i<3;i++){
    await page.evaluate(()=>{const g=__gta,p=__matrixPed;__matrixCalls=0;__watchWake=true;g.debug.teleport(p.pos.x+5,p.pos.z+5,0);});
    await page.waitForFunction(n=>__wakeRows.length===n,i+1,{timeout:4000});
    const row=await page.evaluate(()=>__wakeRows.at(-1));console.log('First visible NPC frame',i,JSON.stringify(row));
    assert.ok(row.rootError<.00001&&row.boneError<.00001&&row.nativeError<.1&&row.solid&&row.calls>0);
    await page.evaluate(()=>__gta.debug.teleport(900,-600,0));await page.waitForTimeout(250);
    await page.evaluate(()=>{__matrixCalls=0;});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__matrixCalls),0);
    const query=await page.evaluate(()=>{const p=__matrixPed,q=p.ch.root.getWorldPosition(p.pos.clone());return q.distanceTo(p.pos);});assert.ok(query<.00001,'explicit hidden world-space queries remain valid');
  }
  await page.evaluate(()=>{const g=__gta,p=__matrixPed;g.debug.teleport(p.pos.x+5,p.pos.z+5,0);});await page.waitForTimeout(250);
  await page.evaluate(()=>{__gta.peds.shoot(__matrixPed,10,__gta.controls.player.position);__matrixCalls=0;});await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>__matrixPed.flee>0&&__matrixCalls>0&&__matrixPed.ch.root.visible));
  await page.evaluate(()=>__gta.peds.shoot(__matrixPed,1000,__gta.controls.player.position));
  await page.waitForFunction(()=>__matrixPed.gone,null,{timeout:9000});await page.waitForTimeout(100);
  await page.evaluate(()=>{__matrixCalls=0;});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__matrixCalls),0);
  await page.evaluate(()=>{const g=__gta,p=__matrixPed;__watchWake=true;g.peds.revive(p);g.debug.teleport(p.pos.x+5,p.pos.z+5,0);});
  await page.waitForFunction(()=>__wakeRows.length===4,null,{timeout:4000});
  const revived=await page.evaluate(()=>({row:__wakeRows.at(-1),material:__matrixPed.ch.mesh.material===__renderMaterials.skinned,fade:!!__matrixPed.fadeMat}));
  assert.ok(revived.material&&!revived.fade&&revived.row.rootError<.00001&&revived.row.boneError<.00001&&revived.row.solid&&revived.row.calls>0);
  assert.deepEqual(errors,[]);
  console.log('PASS render paths: four real viewmodel weapons, unchanged shaders, cache/traversal positive controls, immediate repeated wake, native pose, explicit queries, flee/fade/revive');
} finally { await browser.close(); }
