// Real media playback in a small harness; one Edge instance, no game/screenshot overhead.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function testMusicEngine(browser) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const base = process.env.GTA_URL || 'http://127.0.0.1:5173/';
  let checks = 0;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const pass = label => { checks++; console.log('PASS engine: ' + label); };
  await page.route('**/__music_engine_test__', r => r.fulfill({ contentType:'text/html', body:'<button id="gesture">Gesture</button>' }));
  await page.route('**/music/test-broken.mp3', r => r.fulfill({ contentType:'audio/mpeg', body:'not audio' }));
  await page.route('**/test-playlist.json', r => r.fulfill({ contentType:'application/json', body: JSON.stringify([
    {file:'test-broken.mp3',title:'Broken fixture',artist:''},
    {file:'GTA%20Mohali%20-%20Sultaan.mp3',title:'GTA Mohali',artist:'Sultaan'},
  ]) }));
  await page.route('**/empty-playlist.json', r => r.fulfill({ contentType:'application/json', body:'[]' }));
  await page.route('**/bad-playlist.json', r => r.fulfill({ contentType:'application/json', body:JSON.stringify([{file:'test-broken.mp3',title:'Only broken fixture',artist:''}]) }));
  await page.route('**/missing-playlist.json', r => r.fulfill({status:404,body:'missing'}));
  const boot = async (clear = true, url = '/music/playlist.json') => page.evaluate(async ({clear,url}) => {
    window.music?.dispose(); clearInterval(window.musicTick);
    if (clear) localStorage.removeItem('gta-music');
    const {createMusicPlayer} = await import('/src/audio/musicPlayer.js');
    window.master = {volume:0.8,muted:false}; window.inCar = false; window.inCutscene = false;
    window.notices = [];
    window.music = createMusicPlayer({master,playlistUrl:url});
    music.subscribe((kind,message) => { if (kind === 'notice') notices.push(message); });
    window.musicTick = setInterval(() => music.update(0.05,inCar,inCutscene),50);
    await music.ready;
  }, {clear,url});
  const get = () => page.evaluate(() => ({...music.state,track:music.track,time:music.currentTime,duration:music.duration,gain:music.effectiveVolume}));
  const waitPlaying = () => page.waitForFunction(() => music.state.playing && music.currentTime > 0.1, null, {timeout:10000});
  try {
    await page.goto(new URL('/__music_engine_test__',base).href);
    await page.evaluate(() => {
      const NativeAudio = window.Audio; window.createdAudio = [];
      window.Audio = function() { const a = new NativeAudio(); createdAudio.push(a); return a; };
    });
    await boot();
    assert.equal(await page.evaluate(() => createdAudio.length),1);
    assert.equal((await get()).tracks.length,3);
    assert.equal((await get()).requested,false);
    await page.evaluate(() => { music.play(); window.inCar = true; });
    await page.waitForTimeout(200);
    assert.equal((await get()).playing,false);
    assert.equal((await get()).unlocked,false);
    pass('one Audio element and explicit gesture gate even with browser autoplay allowed');
    await page.click('#gesture'); await waitPlaying();
    assert.equal((await get()).track.title,'Kaali Hoodie');
    pass('trusted gesture starts requested playback');
    for (let i=0;i<3;i++) {
      await page.evaluate(i => music.select(i),i); await waitPlaying();
      const s = await get(); assert.ok(s.duration > 160); assert.ok(s.time > 0);
      console.log(`  decoded ${s.track.title}: ${s.duration.toFixed(3)} s`);
    }
    assert.equal(await page.evaluate(() => createdAudio.length),1);
    pass('all three real MP3s decode, advance, and reuse one element');
    await page.evaluate(() => {music.pause();music.seek(40);});
    await page.waitForFunction(() => Math.abs(music.currentTime - 40) < 0.1);
    await page.evaluate(() => music.skip(-10)); assert.ok(Math.abs((await get()).time-30)<0.1);
    await page.evaluate(() => music.skip(10)); assert.ok(Math.abs((await get()).time-40)<0.1);
    await page.evaluate(() => music.seek(-99)); assert.equal((await get()).time,0);
    await page.evaluate(() => music.seek(1e6)); assert.ok(Math.abs((await get()).time-(await get()).duration)<0.1);
    pass('seek, +/-10 seconds, and start/end clamps');
    await page.evaluate(() => {music.seek(4);music.previous();}); assert.equal((await get()).index,2); assert.ok((await get()).time<0.1);
    await page.evaluate(() => music.previous()); assert.equal((await get()).index,1);
    pass('previous restarts after three seconds, otherwise previous track');
    await page.evaluate(() => {music.setVolume(2);}); assert.equal((await get()).volume,1);
    await page.evaluate(() => music.setVolume(-2)); assert.equal((await get()).volume,0);
    await page.evaluate(() => {music.setVolume(0.5);music.update(1,true,false);}); assert.ok(Math.abs((await get()).gain-0.4)<0.001);
    await page.evaluate(() => {master.muted=true;music.update(0,true,false);}); assert.equal((await get()).gain,0);
    await page.evaluate(() => {master.muted=false;master.volume=0.3;music.update(0,true,false);}); assert.ok(Math.abs((await get()).gain-0.15)<0.001);
    await page.evaluate(() => music.setMuted(true)); assert.equal((await get()).gain,0);
    await page.evaluate(() => {music.setMuted(false);master.volume=0.8;});
    pass('volume clamps, master multiplication, master/local mute');
    await page.evaluate(() => {music.setShuffle(true);music.setRepeat('all');music.select(0);});
    const order = [0];
    for (let i=0;i<2;i++) {await page.evaluate(() => music.next());order.push((await get()).index);}
    assert.equal(new Set(order).size,3);
    await page.evaluate(() => music.previous()); assert.equal((await get()).index,order[1]);
    pass('shuffle visits each track once and previous follows actual history');
    await page.evaluate(() => {music.setShuffle(false);music.select(0);music.setRepeat('one');music.play();}); await waitPlaying();
    await page.evaluate(() => music.seek(music.duration-0.15));
    await page.waitForFunction(() => music.currentTime < 2 && music.state.playing, null, {timeout:5000});
    assert.equal((await get()).index,0);
    pass('natural media ended repeats current track in repeat-one');
    await page.evaluate(() => {music.setRepeat('all');music.select(2);}); await waitPlaying();
    await page.evaluate(() => music.seek(music.duration-0.15));
    await page.waitForFunction(() => music.state.index === 0 && music.state.playing, null, {timeout:5000});
    pass('natural media ended wraps last track in repeat-all');
    await page.evaluate(() => {music.setRepeat('off');music.select(2);}); await waitPlaying();
    await page.evaluate(() => music.seek(music.duration-0.15));
    await page.waitForFunction(() => !music.state.requested && !music.state.playing, null, {timeout:5000});
    assert.equal((await get()).index,2);
    pass('repeat-off stops at playlist end');
    await page.evaluate(() => {music.select(0);music.play();}); await waitPlaying();
    await page.evaluate(() => window.inCar=false);
    await page.waitForTimeout(200); const fading=await get(); assert.ok(fading.gain>0 && fading.gain<0.4); assert.equal(fading.requested,true);
    await page.waitForFunction(() => !music.state.playing && music.effectiveVolume === 0);
    assert.equal((await get()).requested,true);
    const stoppedAt=(await get()).time;
    await page.waitForTimeout(150); assert.ok(Math.abs((await get()).time-stoppedAt)<0.05);
    await page.evaluate(() => window.inCar=true); await waitPlaying();
    await page.waitForFunction(() => music.effectiveVolume > 0.399);
    assert.ok((await get()).time>=stoppedAt);
    pass('exit fades over 0.5 seconds, pauses timeline, re-entry resumes intent');
    await page.evaluate(() => {music.pause();window.inCar=false;}); await page.waitForTimeout(550);
    await page.evaluate(() => window.inCar=true); await page.waitForTimeout(550);
    assert.equal((await get()).playing,false);
    pass('explicit pause survives exit/re-entry');
    await page.evaluate(() => {music.setCarOnly(false);window.inCar=false;music.play();}); await waitPlaying();
    await page.evaluate(() => window.inCutscene=true);
    await page.waitForFunction(() => Math.abs(music.effectiveVolume-0.16)<0.001);
    await page.evaluate(() => window.inCutscene=false);
    await page.waitForFunction(() => Math.abs(music.effectiveVolume-0.4)<0.001);
    pass('car-only off plays on foot; cutscene ducks 60% and recovers');
    await page.evaluate(() => {music.select(1);music.setVolume(0.37);music.setShuffle(true);music.setRepeat('one');music.setVisible(true);});
    await page.reload(); await boot(false);
    const restored=await get();
    assert.equal(restored.index,1);assert.equal(restored.volume,0.37);assert.equal(restored.shuffle,true);assert.equal(restored.repeat,'one');assert.equal(restored.carOnly,false);assert.equal(restored.visible,true);
    assert.equal(restored.playing,false);assert.equal(restored.unlocked,false);assert.equal(restored.requested,false);
    pass('reload restores settings/track but not playback or gesture authorization');
    await page.evaluate(() => localStorage.setItem('gta-music','{"volume":99,"repeat":"bad","track":"missing","carOnly":"bad"}'));
    await boot(false);const validated=await get();assert.equal(validated.volume,1);assert.equal(validated.repeat,'all');assert.equal(validated.index,0);assert.equal(validated.carOnly,true);
    await page.evaluate(() => localStorage.setItem('gta-music','not json'));await boot(false);assert.equal((await get()).volume,0.65);
    pass('invalid storage values and corrupt JSON have safe defaults');
    await boot(true,'/empty-playlist.json');await page.evaluate(() => {music.play();music.next();music.previous();music.seek(10);});assert.equal((await get()).index,-1);assert.equal((await get()).playing,false);
    pass('empty playlist remains usable and silent');
    await boot(true,'/missing-playlist.json');assert.equal((await get()).ready,true);assert.match((await get()).error,/unavailable/);
    pass('missing playlist is reported without uncaught rejection');
    await boot(true,'/test-playlist.json');
    await page.evaluate(() => {window.inCar=true;music.play();});await page.click('#gesture');await waitPlaying();
    assert.equal((await get()).track.title,'GTA Mohali');assert.ok(await page.evaluate(() => notices.some(n => n.includes('Broken fixture'))));
    pass('decode failure emits notice and skips to playable track');
    await boot(true,'/bad-playlist.json');await page.click('#gesture');await page.evaluate(() => {window.inCar=true;music.play();});
    await page.waitForFunction(() => music.state.error === 'No playable music tracks');
    assert.equal((await get()).requested,false);const noticeCount=await page.evaluate(() => notices.length);
    await page.waitForTimeout(300);assert.equal(await page.evaluate(() => notices.length),noticeCount);
    pass('all-broken playlist stops recovery without an infinite retry loop');
    // Replace the corrupt response, then retry the same selected file without recreating the player.
    await page.unroute('**/music/test-broken.mp3');
    await page.route('**/music/test-broken.mp3', async r => {
      const response = await page.request.get(new URL('/music/GTA%20Mohali%20-%20Sultaan.mp3',base).href);
      await r.fulfill({contentType:'audio/mpeg',body:await response.body()});
    });
    await page.evaluate(() => music.play());await waitPlaying();
    assert.equal((await get()).track.title,'Only broken fixture');
    pass('explicit retry reloads a previously failed resource after recovery');
    await boot();
    await page.evaluate(() => {
      const descriptor=Object.getOwnPropertyDescriptor(window,'localStorage');
      Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('storage denied');}});
      window.restoreStorage=()=>Object.defineProperty(window,'localStorage',descriptor);
    });
    await boot(false);await page.evaluate(() => {music.setVolume(0.42);music.setVisible(true);restoreStorage();});
    assert.equal((await get()).volume,0.42);pass('unavailable storage does not prevent playback controls');
    await page.evaluate(() => {music.setCarOnly(false);music.play();});await page.click('#gesture');await waitPlaying();
    await page.evaluate(() => {for(let i=0;i<30;i++) music.select(i%3);music.pause();});
    await page.waitForTimeout(250);assert.equal((await get()).requested,false);assert.equal((await get()).playing,false);assert.equal((await get()).index,2);
    pass('rapid track switches followed by pause do not restart from stale play promises');
    await boot();await page.evaluate(() => {music.setCarOnly(false);music.play();});await page.click('#gesture');await waitPlaying();
    await page.evaluate(() => {music.dispose();clearInterval(musicTick);});assert.equal((await get()).playing,false);
    assert.deepEqual(errors,[]);pass('dispose stops playback; no browser script errors');
    return checks;
  } finally {await page.close();}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  try {console.log(`${await testMusicEngine(browser)} engine checks passed`);} finally {await browser.close();}
}
