// Component test: replace the live music instance to isolate UI modes against the real HUD/input.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function testMusicUi(browser) {
  const page=await browser.newPage({viewport:{width:960,height:540}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let checks=0;
  const pass=label=>{checks++;console.log('PASS UI: '+label);};
  const click=action=>page.locator(`[data-music="card"] [data-action="${action}"]`).click();
  try {
    await page.goto(new URL('?cam=player',process.env.GTA_URL || 'http://127.0.0.1:5173/').href);
    await page.waitForFunction(()=>window.__gta?.ready,null,{timeout:90000});
    await page.evaluate(async()=>{
      __gta.musicUi?.dispose();__gta.music?.dispose();
      const {createMusicPlayer}=await import('/src/audio/musicPlayer.js');
      const {createMusicPlayerUi}=await import('/src/ui/musicPlayerUi.js');
      localStorage.removeItem('gta-music');
      window.testMusic=createMusicPlayer({master:{volume:0.8,muted:false}});
      window.testMusicUi=createMusicPlayerUi(testMusic);
      window.musicFlags={driving:false,cinematic:false,cutscene:false,menu:false};
      window.musicUiTick=setInterval(()=>{
        const f=musicFlags;
        testMusic.update(0.05,f.driving,f.cutscene);
        testMusicUi.update(0.05,f.driving,!!document.pointerLockElement,f.cinematic,f.cutscene,f.menu);
      },50);
      await testMusic.ready;testMusic.setVisible(true);testMusic.setCarOnly(false);
      __gta.weapons.arsenal.give('pistol');__gta.weapons.arsenal.select('pistol');
    });
    await page.waitForTimeout(400);
    const before=await page.evaluate(()=>__gta.weapons.st.fired);
    await click('play');await page.waitForFunction(()=>testMusic.state.playing);
    await click('next');await page.waitForFunction(()=>testMusic.state.index===1 && testMusic.duration>0);
    await click('play');await page.evaluate(()=>testMusic.seek(30));
    await click('back');assert.ok(Math.abs(await page.evaluate(()=>testMusic.currentTime)-20)<0.2);
    await click('forward');assert.ok(Math.abs(await page.evaluate(()=>testMusic.currentTime)-30)<0.2);
    await click('previous');assert.equal(await page.evaluate(()=>testMusic.state.index),1);assert.ok(await page.evaluate(()=>testMusic.currentTime)<0.2);
    await click('previous');assert.equal(await page.evaluate(()=>testMusic.state.index),0);
    pass('mouse play/pause, next, previous, rewind/forward use real player');
    await page.waitForFunction(()=>testMusic.duration>0 && Number(document.querySelector('[data-m="seek"]').max)===testMusic.duration);
    const seek=await page.locator('[data-m="seek"]').boundingBox();
    await page.mouse.click(seek.x+seek.width*0.6,seek.y+seek.height/2);
    const fraction=await page.evaluate(()=>testMusic.currentTime/testMusic.duration);assert.ok(fraction>0.5 && fraction<0.7);
    const vol=await page.locator('[data-m="volume"]').boundingBox();
    await page.mouse.click(vol.x+vol.width*0.3,vol.y+vol.height/2);
    assert.ok(await page.evaluate(()=>testMusic.state.volume)<0.5);
    await click('mute');assert.equal(await page.evaluate(()=>testMusic.state.muted),true);
    await click('shuffle');assert.equal(await page.evaluate(()=>testMusic.state.shuffle),true);
    await click('repeat');assert.equal(await page.evaluate(()=>testMusic.state.repeat),'one');
    await click('carOnly');assert.equal(await page.evaluate(()=>testMusic.state.carOnly),true);
    await click('expand');await page.locator('[data-track="2"]').click();
    assert.equal(await page.evaluate(()=>testMusic.state.index),2);
    pass('mouse seek, volume, mute, shuffle, repeat, car-only and track list');
    assert.equal(await page.evaluate(()=>__gta.weapons.st.fired),before);
    assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false);
    await page.locator('[data-m="volume"]').focus();
    await page.keyboard.down('w');assert.equal(await page.evaluate(()=>__gta.controls.input.rawDown('KeyW')),false);await page.keyboard.up('w');
    const zoom=await page.evaluate(()=>__gta.controls.player.state.dist);
    await page.mouse.move(vol.x+5,vol.y+5);await page.mouse.wheel(0,120);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>__gta.controls.player.state.dist),zoom);
    pass('armed UI clicks do not fire/capture pointer; focused keys and wheel do not reach game');
    await page.mouse.click(550,300);
    await page.waitForFunction(()=>!!document.pointerLockElement);
    assert.equal(await page.locator('[data-music="card"]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.waitForFunction(n=>__gta.weapons.st.fired>n,before);
    await page.evaluate(()=>document.exitPointerLock());
    await page.waitForFunction(()=>!document.pointerLockElement);
    assert.equal(await page.locator('[data-music="card"]').evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
    pass('pointer lock disables card hit testing; canvas positive control fires gun');
    await page.evaluate(()=>{__gta.wanted.clear(true);__gta.police.reset();testMusic.pause();testMusic.setMuted(false);testMusic.setVisible(true);});
    for(const [width,height] of [[960,540],[1280,720],[1920,1080]]) {
      await page.setViewportSize({width,height});await page.waitForTimeout(100);
      const bounds=await page.evaluate(()=>{
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
        const protectedRects=[];
        const add=(name,el,init)=>{
          if(!el) throw new Error('Missing protected element '+name);
          const c=el.cloneNode(true);document.body.append(c);c.style.display='block';init?.(c);
          protectedRects.push({name,...rect(c)});c.remove();
        };
        add('health',document.querySelector('[data-b="HP"]').closest('.gta-panel'),c=>c.querySelector('[data-k="car"]').style.display='block');
        add('cash/wanted',document.querySelector('[data-k="cash"]').closest('.gta-panel'));
        add('minimap',document.querySelector('canvas.gta-panel'));
        add('speed',document.querySelector('[data-k="speed"]').closest('.gta-panel'));
        add('weapon',document.querySelector('[data-k="mag"]').closest('.gta-panel'));
        add('limit/street',document.querySelector('[data-k="sign"]').parentElement,c=>{c.style.display='flex';const chip=c.querySelector('[data-k="chip"]');chip.style.display='block';chip.textContent='Terrace Motorway';});
        add('pull over',document.querySelector('[data-f]').parentElement.parentElement,c=>c.querySelector('[data-b]').style.display='block');
        const divs=[...document.body.children];
        add('prompt',divs.find(el=>el.style.bottom==='22%'),c=>{c.textContent='Press F to drive';c.style.transform='translate(-50%,0)';});
        add('status message',divs.find(el=>el.style.top==='38%'),c=>c.textContent='KNOCKED OUT -$200');
        for(const mode of ['walk','drive','fly']) {__gta.controls.panel.setPage(mode);protectedRects.push({name:'controls '+mode,...rect(__gta.controls.panel.el)});}
        __gta.controls.panel.setPage('walk');
        protectedRects.push({name:'central view',x:innerWidth*0.2,y:innerHeight*0.25,w:innerWidth*0.6,h:innerHeight*0.5});
        const card=document.querySelector('[data-music="card"]');
        const children=[...card.querySelectorAll('button,input,.gta-music-head')].filter(el=>el.getBoundingClientRect().width>0).map(rect);
        return {card:rect(card),protectedRects,children};
      });
      const r=bounds.card;
      for(const p of bounds.protectedRects) assert.ok(!(r.x<p.x+p.w && r.x+r.w>p.x && r.y<p.y+p.h && r.y+r.h>p.y),`${width}: card overlaps ${p.name}`);
      for(const c of bounds.children) assert.ok(c.x>=r.x && c.x+c.w<=r.x+r.w+0.1,`${width}: control overflows card`);
      assert.ok(r.y+r.h<height-170);console.log(`  ${width}x${height} expanded card: ${JSON.stringify(r)}`);
      pass(`${width}x${height}: expanded card clears every protected HUD and central view, no horizontal overflow`);
    }
    await page.setViewportSize({width:960,height:540});
    await page.evaluate(()=>{musicFlags.driving=true;testMusicUi.touch();});
    await page.waitForTimeout(4500);
    assert.equal(await page.locator('[data-music="card"]').evaluate(el=>getComputedStyle(el).opacity),'0.45');
    await click('expand');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-music="card"]')).opacity==='0.85');
    assert.equal(await page.locator('[data-music="card"]').evaluate(el=>getComputedStyle(el).opacity),'0.85');
    pass('driving idle dims after four seconds; interaction restores opacity');
    await page.evaluate(()=>{musicFlags.cinematic=true;testMusic.next();});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-music="card"]').isVisible(),false);assert.equal(await page.locator('[data-music="toast"]').isVisible(),true);
    await page.evaluate(()=>musicFlags.cutscene=true);await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-music="toast"]').isVisible(),false);
    await page.evaluate(()=>{musicFlags.cutscene=false;musicFlags.cinematic=false;musicFlags.menu=true;});await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-music="card"]').isVisible(),false);
    await page.evaluate(()=>{musicFlags.menu=false;testMusic.setVisible(false);testMusic.next();});await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-music="card"]').isVisible(),false);assert.equal(await page.locator('[data-music="toast"]').isVisible(),true);
    pass('cinematic/hidden card shows track toast, cutscene/menu hides overlays');
    await page.evaluate(()=>{testMusic.setVisible(true);testMusic.setCarOnly(false);testMusic.play();});await page.keyboard.press('Shift');
    await page.waitForFunction(()=>testMusic.state.playing);await page.waitForTimeout(3200);
    const updates=await page.evaluate(async()=>{
      let mutations=0;const observer=new MutationObserver(()=>mutations++);observer.observe(testMusicUi.card,{subtree:true,attributes:true,childList:true,characterData:true});
      const start=testMusicUi.state.renders;await new Promise(r=>setTimeout(r,1050));observer.disconnect();return {renders:testMusicUi.state.renders-start,mutations};
    });
    assert.ok(updates.renders>=3 && updates.renders<=5,JSON.stringify(updates));assert.ok(updates.mutations<=5,JSON.stringify(updates));
    pass('playing progress/DOM mutations stay at roughly four updates per second');
    await page.route('**/music/Kaali*',r=>r.fulfill({contentType:'audio/mpeg',body:'broken media fixture'}));
    await page.evaluate(()=>{testMusic.setShuffle(false);testMusic.select(0);testMusic.play();});
    await page.waitForFunction(()=>testMusic.state.index===1 && testMusic.state.playing);
    await page.waitForFunction(()=>document.querySelector('[data-m="note"]').textContent.includes('Could not play'),null,{timeout:3000});
    pass('failed track remains visible in notice after automatic next-track selection');
    assert.deepEqual(errors,[]);pass('no browser script errors');
    await page.evaluate(()=>{clearInterval(musicUiTick);testMusicUi.dispose();testMusic.dispose();});
    return checks;
  } finally {await page.close();}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  try {console.log(`${await testMusicUi(browser)} UI checks passed`);} finally {await browser.close();}
}
