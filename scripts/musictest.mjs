// Full music acceptance. One Edge browser; every page/suite runs serially and closes. No screenshots.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { testMusicIndex } from './musicIndextest.mjs';
import { testMusicEngine } from './musicEnginetest.mjs';
import { testMusicUi } from './musicUitest.mjs';
import { testMusicWiring } from './musicWiringtest.mjs';

const onlyIntegration=process.argv.includes('integration');
let count=0;
if(!onlyIntegration) {
  count+=await testMusicIndex();
  const response=await fetch('https://api.github.com/repos/realprabhvirk/grandterraceauto');
  assert.equal(response.status,404,'source audio requires verified private repository');
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  assert.equal(git('ls-files','Car Music').split('\n').length,3);
  assert.equal(git('ls-files','public/music','*.log','.tools','scripts/_probe.mjs'),'');
  assert.equal(git('check-ignore','public/music/playlist.json','codex-music-ui.log').split('\n').length,2);
  count++;console.log('PASS repository: 404 private, 3 source songs tracked, generated music/logs/scratch ignored');
}
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
try {
  if(!onlyIntegration) {count+=await testMusicEngine(browser);count+=await testMusicWiring(browser);count+=await testMusicUi(browser);}
  const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const key=code=>page.keyboard.press(code,{delay:70});
  const ev=fn=>page.evaluate(fn);
  const wait=ms=>page.waitForTimeout(ms);
  const playing=()=>page.waitForFunction(()=>__gta.music.state.playing && __gta.music.currentTime>0.1);
  const pass=label=>{count++;console.log('PASS integration: '+label);};
  const load=async()=>{await page.goto(new URL('?cam=player',process.env.GTA_URL || 'http://127.0.0.1:5173/').href);await page.waitForFunction(()=>__gta?.ready && __gta.music.state.ready,null,{timeout:90000});};
  try {
    await load();await ev(()=>__gta.debug.enter());await page.waitForFunction(()=>__gta.controls.mode==='drive');
    await page.mouse.click(550,300);await key('KeyT');await key('Slash');await playing();
    await key('Slash');await page.waitForFunction(()=>!__gta.music.state.playing);
    await ev(()=>__gta.music.seek(40));await key('BracketLeft');assert.ok(Math.abs(await ev(()=>__gta.music.currentTime)-30)<0.1);
    await key('BracketRight');assert.ok(Math.abs(await ev(()=>__gta.music.currentTime)-40)<0.1);
    const i=await ev(()=>__gta.music.state.index);await key('Comma');assert.equal(await ev(()=>__gta.music.state.index),i);assert.ok(await ev(()=>__gta.music.currentTime)<0.1);
    await key('Comma');assert.equal(await ev(()=>__gta.music.state.index),(i+2)%3);
    await key('Period');assert.equal(await ev(()=>__gta.music.state.index),i);
    await ev(()=>__gta.music.setVolume(0.5));await key('Minus');assert.ok(Math.abs(await ev(()=>__gta.music.state.volume)-0.45)<0.001);
    await key('Equal');assert.equal(await ev(()=>__gta.music.state.volume),0.5);
    await ev(()=>__gta.music.setVolume(0.99));await key('Equal');assert.equal(await ev(()=>__gta.music.state.volume),1);
    await ev(()=>__gta.music.setVolume(0.01));await key('Minus');assert.equal(await ev(()=>__gta.music.state.volume),0);
    await ev(()=>__gta.music.setVolume(0.5));await key('Backslash');assert.equal(await ev(()=>__gta.music.state.shuffle),true);
    await key('Semicolon');assert.equal(await ev(()=>__gta.music.state.repeat),'one');
    await key('Semicolon');assert.equal(await ev(()=>__gta.music.state.repeat),'off');await key('Semicolon');assert.equal(await ev(()=>__gta.music.state.repeat),'all');
    pass('all captured-pointer transport/seek/volume keys, clamps, shuffle and repeat');
    const help=await ev(()=>__gta.controls.panel.el.style.opacity);
    await page.keyboard.press('Shift+Slash',{delay:70});await wait(100);
    assert.equal(await ev(()=>__gta.music.state.requested),false);assert.notEqual(await ev(()=>__gta.controls.panel.el.style.opacity),help);
    await page.keyboard.press('Control+Equal',{delay:70});assert.equal(await ev(()=>__gta.music.state.volume),0.5);
    pass('Shift+/ still toggles help without music; Ctrl+= does not alter volume');
    const boostIndex=await ev(()=>__gta.music.state.index);
    await page.keyboard.down('Shift');await key('Period');await page.keyboard.up('Shift');
    assert.notEqual(await ev(()=>__gta.music.state.index),boostIndex,'next-track must work while Shift boost is held');
    pass('next-track remains usable while holding Shift boost');
    await key('Slash');await playing();await key('KeyM');await page.waitForFunction(()=>__gta.music.effectiveVolume===0);
    await key('KeyM');await page.waitForFunction(()=>__gta.music.effectiveVolume>0);
    await ev(()=>{const slider=document.querySelector('[data-k="vol"]');slider.value='40';slider.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>Math.abs(__gta.music.effectiveVolume-0.2)<0.001);
    pass('real M mute and Settings master volume affect music');
    await ev(()=>__gta.controls.settings.toggle());await wait(100);
    const beforeMenu=await ev(()=>__gta.music.state.index);await key('Period');assert.equal(await ev(()=>__gta.music.state.index),beforeMenu);
    assert.equal(await page.locator('[data-music="card"]').isVisible(),false);
    await ev(()=>__gta.controls.settings.close());
    await ev(()=>__gta.gunShop.openMenu());await key('Period');assert.equal(await ev(()=>__gta.music.state.index),beforeMenu);await ev(()=>__gta.gunShop.close());await wait(50);
    await ev(()=>__gta.shopMenu.openMenu({id:'test',name:'Test shop',menu:[{label:'Snack',price:20,hp:25}]}));await key('Period');assert.equal(await ev(()=>__gta.music.state.index),beforeMenu);await ev(()=>__gta.shopMenu.close());await wait(50);
    await page.locator('[data-m="volume"]').focus();await key('Period');assert.equal(await ev(()=>__gta.music.state.index),beforeMenu);await ev(()=>document.activeElement.blur());
    pass('settings, gun shop, shop menu and focused controls block music shortcuts');
    await ev(()=>__gta.mapUI.setMode(2));await wait(100);
    const mapStart=await ev(()=>({time:__gta.music.currentTime,pos:__gta.controls.car.body.body.translation()}));
    await key('Period');await wait(500);const mapEnd=await ev(()=>({time:__gta.music.currentTime,pos:__gta.controls.car.body.body.translation()}));
    assert.ok(mapEnd.time-mapStart.time>0.3);assert.deepEqual(mapEnd.pos,mapStart.pos);assert.equal(await ev(()=>__gta.music.state.index),beforeMenu);
    await ev(()=>__gta.mapUI.setMode(1));await wait(50);
    pass('full map freezes car physics while music advances; shortcut ignored');
    await page.mouse.click(550,300);await key('KeyF');await page.waitForFunction(()=>__gta.controls.mode==='walk');await page.waitForFunction(()=>!__gta.music.state.playing);
    assert.equal(await ev(()=>__gta.music.state.requested),true);const exitTime=await ev(()=>__gta.music.currentTime);await wait(200);assert.ok(Math.abs(await ev(()=>__gta.music.currentTime)-exitTime)<0.05);
    await ev(()=>__gta.debug.enter());await page.waitForFunction(()=>__gta.controls.mode==='drive');await playing();
    pass('actual F exit fades/pauses and re-entry resumes at the same timeline');
    for(const type of ['hatch','sedan','ute','suv']) {
      await page.evaluate(type=>{const g=__gta;g.controls.respawnAt(g.controls.car.position,0);g.debug.enter(g.vehicles.cars.findIndex(c=>c.type===type && !c.dead));},type);
      await page.waitForFunction(()=>__gta.controls.mode==='drive');await playing();
      for(const camera of ['chase','cabin','cinematic']) {
        for(let n=0;n<3 && await ev(()=>__gta.controls.cameraMode)!==camera;n++) await key('KeyC');
        await wait(100);assert.equal(await ev(()=>__gta.controls.cameraMode),camera);
        assert.equal(await ev(()=>__gta.musicUi.state.visible),camera!=='cinematic');assert.equal(await ev(()=>__gta.music.state.playing),true);
      }
    }
    pass('all four car types across chase/cabin/cinematic; card hidden only in cinematic');
    await ev(()=>{const g=__gta,c=g.controls.car;c.body.teleport(c.position.x+2,g.world.terrain.getHeight(c.position.x+2,c.position.z),c.position.z,c.body.yaw());});
    assert.equal(await ev(()=>__gta.music.state.requested),true);
    await ev(()=>__gta.combat.damageCar(__gta.controls.car,200));await page.waitForFunction(()=>!__gta.music.state.playing);
    assert.equal(await ev(()=>__gta.music.state.requested),true);
    await ev(()=>{const g=__gta;g.controls.respawnAt(g.controls.car.position,0);g.music.setCarOnly(false);});await playing();
    for(let n=0;n<2;n++) {await key('KeyC');await wait(100);assert.equal(await ev(()=>__gta.music.state.playing),true);}
    pass('teleport preserves intent; destroyed car fades music; car-only off plays in both foot cameras');
    await ev(()=>__gta.combat.damagePlayer(200,'music test'));await page.waitForFunction(()=>__gta.cutscene.active);
    await page.waitForFunction(()=>Math.abs(__gta.music.effectiveVolume-0.08)<0.001);
    assert.equal(await ev(()=>__gta.musicUi.state.visible),false);assert.equal(await page.locator('[data-music="toast"]').isVisible(),false);
    await page.waitForFunction(()=>!__gta.cutscene.active);await page.waitForFunction(()=>Math.abs(__gta.music.effectiveVolume-0.2)<0.001);
    pass('real KO ducks 60%, hides card/toast, and restores volume after respawn');
    await ev(()=>__gta.cutscene.play('busted',{dur:1,timeScale:1,title:'BUSTED',focus:()=>__gta.controls.player.position}));
    await page.waitForFunction(()=>Math.abs(__gta.music.effectiveVolume-0.08)<0.001);assert.equal(await ev(()=>__gta.musicUi.state.visible),false);
    await page.waitForFunction(()=>!__gta.cutscene.active);pass('busted cutscene uses the same duck/hide path');
    await ev(()=>{__gta.music.select(1);__gta.music.setVolume(0.37);__gta.music.setShuffle(true);__gta.music.setRepeat('one');});
    await page.reload();await page.waitForFunction(()=>__gta?.ready && __gta.music.state.ready,null,{timeout:90000});
    const restored=await ev(()=>({...__gta.music.state}));
    assert.equal(restored.index,1);assert.equal(restored.volume,0.37);assert.equal(restored.shuffle,true);assert.equal(restored.repeat,'one');assert.equal(restored.carOnly,false);assert.equal(restored.visible,true);assert.equal(restored.playing,false);assert.equal(restored.unlocked,false);
    pass('real page reload restores state and never autoplays');
    // Same stationary scene, all overlays settled. Music adds no Three.js nodes or draw calls.
    await ev(()=>{__gta.music.setVisible(false);__gta.music.pause();});await wait(2000);
    const sample=()=>ev(async()=>{const samples=[];for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,50));samples.push(__gta.stats());}let nodes=0;__gta.scene.traverse(()=>nodes++);return {fps:samples.reduce((s,x)=>s+x.fps,0)/samples.length,calls:samples.reduce((s,x)=>s+x.calls,0)/samples.length,nodes};});
    const off=await sample();await page.mouse.click(550,300);await key('KeyT');await key('Slash');await playing();await wait(1500);const on=await sample();
    assert.equal(on.nodes,off.nodes);assert.ok(Math.abs(on.calls-off.calls)<=2,JSON.stringify({off,on}));assert.ok(on.fps>=45 && on.fps>=off.fps-5,JSON.stringify({off,on}));
    console.log('  performance',JSON.stringify({off,on}));pass('music introduces no scene nodes, draw calls unchanged within scene variation, fps >=45');
    assert.deepEqual(errors,[]);pass('no browser script errors across all live transitions');
  } finally {await page.close();}
  console.log(`All ${count} music checks passed`);
} finally {await browser.close();}
