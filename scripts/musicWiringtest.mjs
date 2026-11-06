// Minimal playable milestone: use real main.js, real key presses and real media. No injection/screenshots.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function testMusicWiring(browser) {
  const page=await browser.newPage({viewport:{width:960,height:540}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const key=code=>page.keyboard.press(code,{delay:80});
  try {
    await page.goto(new URL('?cam=player',process.env.GTA_URL || 'http://127.0.0.1:5173/').href);
    await page.waitForFunction(()=>window.__gta?.ready,null,{timeout:90000});
    assert.equal(await page.evaluate(()=>!!__gta.music),true,'main must create the music player');
    await page.waitForFunction(()=>__gta.music.state.ready);
    assert.equal(await page.evaluate(()=>__gta.music.state.tracks.length),3);
    await page.evaluate(()=>__gta.debug.enter());
    await page.waitForFunction(()=>__gta.controls.mode==='drive');
    await page.mouse.click(550,300);
    await page.waitForFunction(()=>!!document.pointerLockElement);
    await key('KeyT');
    await page.waitForFunction(()=>__gta.musicUi.state.visible);
    assert.equal(await page.locator('[data-music="card"]').isVisible(),true);
    console.log('PASS wiring: T shows card with mouse captured in a car');
    await key('Slash');
    await page.waitForFunction(()=>__gta.music.state.playing && __gta.music.currentTime>0.1,null,{timeout:15000});
    const first=await page.evaluate(()=>__gta.music.state.index);
    console.log('PASS wiring: / starts actual audio playback');
    await key('Period');
    await page.waitForFunction(i=>__gta.music.state.index!==i && __gta.music.state.playing && __gta.music.currentTime>0.1,first);
    console.log('PASS wiring: . advances to another playing track');
    await key('KeyT');
    await page.waitForFunction(()=>!__gta.musicUi.state.visible);
    assert.equal(await page.evaluate(()=>__gta.music.state.playing),true);
    console.log('PASS wiring: T hides card without stopping music');
    await page.evaluate(()=>{
      const g=__gta,p=g.world.town.propCars.find(p=>p.kind==='police' && !p.hidden);
      // Normal entry begins on foot. Detach from the hero car before entering another.
      g.controls.respawnAt(g.controls.car.position,0);
      const car=g.controls.hooks.onPropSteal(p);g.controls.enterCar(car);
    });
    await page.waitForFunction(()=>__gta.controls.mode==='drive' && !!__gta.controls.car?.emergency);
    assert.equal(await page.evaluate(()=>__gta.controls.car.emergency.on),false);
    await key('KeyT');await page.waitForFunction(()=>__gta.musicUi.state.visible);
    assert.equal(await page.evaluate(()=>__gta.controls.car.emergency.on),false);
    await key('KeyY');await page.waitForFunction(()=>__gta.controls.car.emergency.on && __gta.world.playerSiren);
    await key('KeyT');await page.waitForFunction(()=>!__gta.musicUi.state.visible);
    assert.equal(await page.evaluate(()=>__gta.controls.car.emergency.on && __gta.world.playerSiren),true);
    await key('KeyY');await page.waitForFunction(()=>!__gta.controls.car.emergency.on && !__gta.world.playerSiren);
    console.log('PASS wiring: Y toggles real emergency siren, T never changes it');
    assert.deepEqual(errors,[]);console.log('PASS wiring: no browser script errors');
    return 6;
  } catch(e) {
    console.error('Wiring diagnostic',await page.evaluate(()=>({mode:__gta.controls.mode,car:__gta.controls.car?.type,emergency:__gta.controls.car?.emergency?.kind})),errors);
    throw e;
  } finally {await page.close();}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  try {await testMusicWiring(browser);} finally {await browser.close();}
}
