// Phase 5 test suite (numeric/state asserts only - no screenshots).
// Usage (dev server running): .\dev.cmd node scripts/phase5test.mjs [section ...]
//   sections: pov cabin zoom carhp burn stars push arrest ko steal parked guns copguns shop downtown beach northgate industrial vibe airport vibe6 life city shops enforce highway signs mapnav speeding copstars pois map witness damage
import { chromium } from 'playwright';

const want = new Set(process.argv.slice(2));
const run = (name) => want.size === 0 || want.has(name);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
let loaded = false;
const load = async (force = false) => {
  if (loaded && !force) return;
  await page.goto('http://127.0.0.1:5173/?cam=player', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  await wait(600);
  loaded = true;
};
const state = () => ev(() => window.__gta.debug.state());
/** Back on foot at the spawn, no wanted level, full health. */
const fresh = () => ev(async () => {
  const g = window.__gta;
  if (g.controls.mode === 'drive') { g.controls.respawnAt(g.controls.car.position, 0); }
  g.wanted.clear(true); g.police.reset(); g.combat.setHp(100);
  const v = g.controls.input; v.clearVirtual();
  await new Promise((r) => setTimeout(r, 200));
});

try {
  // ------------------------------------------------------------ 1a: POV body + viewmodel
  if (run('pov')) {
    await load();
    await ev(() => window.__gta.debug.tap('KeyC'));
    await wait(500);
    let r = await ev(() => ({ cam: window.__gta.controls.cameraMode, body: window.__gta.controls.player.character.mesh.visible, vm: window.__gta.viewmodel.visible }));
    check('POV: world body mesh not rendered', r.cam === 'first' && r.body === false, r);
    check('POV: viewmodel visible', r.vm === true, r);
    // Arms sway with walking: hand positions change while walking.
    r = await ev(async () => {
      const g = window.__gta, I = g.controls.input, h0 = g.viewmodel.hands().r.clone();
      I.setVirtual('KeyW', true); const s = [];
      for (let i = 0; i < 20; i++) { await new Promise((q) => setTimeout(q, 50)); s.push(g.viewmodel.hands().r.z); }
      I.setVirtual('KeyW', false);
      return { range: +(Math.max(...s) - Math.min(...s)).toFixed(3), h0: h0.toArray().map((v) => +v.toFixed(2)) };
    });
    check('POV: unarmed arms sway while walking', r.range > 0.02, r);
    await ev(() => window.__gta.debug.tap('KeyC'));
    await wait(300);
    r = await ev(() => ({ body: window.__gta.controls.player.character.mesh.visible, vm: window.__gta.viewmodel.visible }));
    check('third person: body back, viewmodel off', r.body && !r.vm, r);
  }

  // ------------------------------------------------------------ 1b: cabin view
  if (run('cabin')) {
    await load();
    await fresh();
    const out = await ev(async () => {
      const g = window.__gta, d = g.debug, res = [];
      const types = ['hatch', 'sedan', 'ute', 'suv'];
      for (const t of types) {
        const i = g.vehicles.cars.findIndex((c) => c.type === t && !c.impounded);
        if (i < 0) { res.push({ type: t, missing: true }); continue; }
        if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
        d.enter(i); await new Promise((r) => setTimeout(r, 1300));
        // Flat straight in town (Terrace Pde), facing east.
        const x = 380 + types.indexOf(t) * 30; for (const tc of [...g.traffic.cars]) if (Math.abs(tc.pos.z + 85) < 10) g.traffic.removeCar(tc); g.controls.car.body.teleport(x, g.world.terrain.getHeight(x, -87.2), -87.2, Math.PI / 2);
        while (g.controls.cameraMode !== 'cabin') await d.tap('KeyC');
        await new Promise((r) => setTimeout(r, 600));
        res.push(d.cabinCheck());
        while (g.controls.cameraMode !== 'chase') await d.tap('KeyC');
      }
      return res;
    });
    for (const r of out) {
      check(`cabin ${r.type}: road visible (9 rays, none blocked)`, r && !r.missing && r.blocked.length === 0, r);
      check(`cabin ${r.type}: dash top below 70% of the screen`, r && r.dashTopY > 0.7, { dashTopY: r?.dashTopY, fov: r?.fov, eyeY: r?.eyeY });
    }
  }

  // ------------------------------------------------------------ 1c: zoom / page zoom blocked
  if (run('zoom')) {
    await load();
    await fresh();
    const wheel = (ctrl, dy) => ev(({ ctrl, dy }) => {
      const e = new WheelEvent('wheel', { deltaY: dy, ctrlKey: ctrl, cancelable: true, bubbles: true });
      document.querySelector('canvas').dispatchEvent(e);
      return e.defaultPrevented;
    }, { ctrl, dy });
    let d0 = await ev(() => window.__gta.controls.player.state.dist);
    const prevented = await wheel(true, 60);
    await wait(200);
    let d1 = await ev(() => window.__gta.controls.player.state.dist);
    const scale = await ev(() => window.visualViewport ? window.visualViewport.scale : 1);
    check('pinch (ctrl+wheel) is preventDefault-ed', prevented === true);
    check('pinch zooms the third-person camera', Math.abs(d1 - d0) > 0.3 && d1 >= 1.8 && d1 <= 8, { d0, d1 });
    check('page zoom unchanged (visualViewport.scale = 1)', scale === 1, { scale });
    for (let i = 0; i < 30; i++) await wheel(false, 300);
    await wait(150);
    d1 = await ev(() => window.__gta.controls.player.state.dist);
    check('third-person distance clamps at 8 m', Math.abs(d1 - 8) < 0.01, { d1 });
    // POV FOV
    await ev(() => window.__gta.debug.tap('KeyC'));
    await wait(300);
    const f0 = await ev(() => window.__gta.controls.player.state.fpFov);
    for (let i = 0; i < 4; i++) await wheel(true, -50);
    await wait(500);
    const f1 = await ev(() => ({ fov: window.__gta.controls.player.state.fpFov, cam: window.__gta.camera.fov }));
    check('POV wheel changes the FOV (60-100)', f1.fov !== f0 && f1.fov >= 60 && f1.fov <= 100 && Math.abs(f1.cam - f1.fov) < 2, { f0, f1 });
    await ev(() => window.__gta.debug.tap('KeyC'));
    // Ctrl + '=' blocked
    const keyPrevented = await ev(() => { const e = new KeyboardEvent('keydown', { code: 'Equal', key: '=', ctrlKey: true, cancelable: true, bubbles: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    check('Ctrl + = page zoom blocked', keyPrevented === true);
    // Cabin FOV 65-85 + chase distance
    const c = await ev(async () => {
      const g = window.__gta, d = g.debug;
      d.enter(); await new Promise((r) => setTimeout(r, 1400));
      const ch0 = g.controls.chase.state.dist;
      for (let i = 0; i < 3; i++) document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 200, cancelable: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const ch1 = g.controls.chase.state.dist;
      while (g.controls.cameraMode !== 'cabin') await d.tap('KeyC');
      for (let i = 0; i < 20; i++) document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 300, cancelable: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      const cab = g.controls.cabin.state.fov, fov = g.camera.fov;
      while (g.controls.cameraMode !== 'cinematic') await d.tap('KeyC');
      const w = g.controls.input.peekWheel();
      document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 300, cancelable: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const cin = g.controls.input.peekWheel();
      while (g.controls.cameraMode !== 'chase') await d.tap('KeyC');
      return { ch0, ch1, cab, fov, w, cin };
    });
    check('chase distance zooms', c.ch1 > c.ch0, c);
    check('cabin FOV clamps to 65-85', c.cab === 85 && Math.abs(c.fov - 85) < 0.5, c);
    check('cinematic ignores zoom (wheel consumed)', c.cin === 0, c);
  }

  // ------------------------------------------------------------ 1d: no player damage in a car
  if (run('carhp')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug;
      g.combat.setHp(80);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await new Promise((q) => setTimeout(q, 1400));
      const ch0 = g.controls.car.health;
      g.combat.damagePlayer(30, 'crash'); g.combat.damagePlayer(30, 'bullet'); g.combat.damagePlayer(30, 'fall');
      // A real crash: drive into a wall at speed.
      const car = g.controls.car;
      car.body.teleport(553, g.world.terrain.getHeight(553, -80), -80, Math.PI); // toward Terrace Central's facade
      await new Promise((q) => setTimeout(q, 300));
      car.body.body.setLinvel({ x: 0, y: 0, z: -14 }, true);
      await new Promise((q) => setTimeout(q, 1500));
      return { hp: g.combat.hp, carHealth: g.controls.car.health, ch0, blocked: g.combat.state.blocked };
    });
    check('in a car the player takes no damage (calls + crash)', r.hp >= 80, r);
    check('the car took the crash damage', r.carHealth < r.ch0, r);
  }

  // ------------------------------------------------------------ 1e: car destroyed -> burn -> eject
  if (run('burn')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug;
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await new Promise((q) => setTimeout(q, 1400));
      const car = g.controls.car;
      for (const tc of [...g.traffic.cars]) if (Math.abs(tc.pos.z + 85) < 12) g.traffic.removeCar(tc); // nobody runs the ejected driver over
      car.body.teleport(470, g.world.terrain.getHeight(470, -87.2), -87.2, Math.PI / 2);
      g.combat.setHp(90);
      await new Promise((q) => setTimeout(q, 300));
      g.combat.damageCar(car, 500);
      await new Promise((q) => setTimeout(q, 800));
      const mid = { mode: g.controls.mode, burning: !!g.combat.burning, flames: car.dmg?.flames.visible, msg: document.body.innerText.includes('Car on fire') };
      const t0 = performance.now();
      while (g.controls.mode === 'drive' && performance.now() - t0 < 8000) await new Promise((q) => setTimeout(q, 100));
      const tEject = (performance.now() - t0) / 1000 + 0.8;
      await new Promise((q) => setTimeout(q, 1000));
      return { mid, tEject: +tEject.toFixed(1), mode: g.controls.mode, hp: g.combat.hp, action: g.controls.player.state.action, wreck: car.dead && car.group.visible, engine: car.body.dead };
    });
    check('destroyed car: burning + prompt + flames', r.mid.burning && r.mid.msg && r.mid.flames, r.mid);
    check('ejected after ~5 s', r.mode === 'walk' && r.tEject > 4 && r.tEject < 7.5, r);
    check('ejection does no damage', r.hp >= 90, r);
    check('wreck stays, engine dead', r.wreck && r.engine, r);
    // F gets out any time (even moving).
    const f = await ev(async () => {
      const g = window.__gta, d = g.debug;
      const i = g.vehicles.cars.findIndex((c) => !c.hero && !c.dead && !c.impounded && c.type === 'hatch');
      d.enter(i); await new Promise((q) => setTimeout(q, 1400));
      const car = g.controls.car;
      car.body.teleport(440, g.world.terrain.getHeight(440, -87.2), -87.2, Math.PI / 2);
      await new Promise((q) => setTimeout(q, 300));
      g.combat.damageCar(car, 500);
      car.body.body.setLinvel({ x: 14, y: 0, z: 0 }, true);
      await new Promise((q) => setTimeout(q, 150));
      const sp = Math.abs(car.body.state.speed);
      await d.tap('KeyF');
      await new Promise((q) => setTimeout(q, 1200));
      return { speedAtF: +sp.toFixed(1), mode: g.controls.mode };
    });
    check('F leaves a burning car any time', f.mode === 'walk', f);
  }

  // ------------------------------------------------------------ 1f: stars flash + reset
  if (run('stars')) {
    await load();
    await fresh();
    // Sim-time fast-forward of the wanted state machine (Phase 5.1 rules, wantedConfig.js).
    const r = await ev(async () => {
      const g = window.__gta, W = g.wanted, d = g.debug;
      const sim = (sec, inp, every = 0.1) => { const out = []; for (let t = 0; t < sec - 1e-6; t += every) { W.update(every, inp); out.push(W.phase); } return out; };
      const far = { seen: false, nearest: 300 };
      // (a) 1 star, 300 m away at once: solid for the full 15 s grace, then flashing.
      W.clear(true); W.add('test', 25);
      const a1 = sim(14.9, far), a2 = sim(0.3, far);
      const a = { solidThroughGrace: a1.every((p) => p === 'solid'), flipped: a2.includes('flashing'), grace: d.wanted().graceRemaining };
      // (b) 10 s of flashing, then wanted 0.
      const b1 = sim(9.7, far), starsMid = W.stars; sim(0.5, far);
      const b = { stillFlashing: b1.every((p) => p === 'flashing') && starsMid > 0, stars: W.stars, phase: W.phase };
      // (c) a cop 60 m away with no LOS: never flashes.
      W.clear(true); W.add('test', 25);
      const c = { phases: [...new Set(sim(40, { seen: false, nearest: 60 }))] };
      // (d) cop gets LOS mid-flash: solid again, flash timer reset.
      W.clear(true); W.add('test', 25); sim(15.2, far); const dBefore = W.phase; sim(4, far); const flashLeft = d.wanted().flashRemaining;
      sim(0.1, { seen: true, nearest: 100 }); const dAfter = d.wanted();
      sim(0.2, far); const dRe = d.wanted(); // nearest >= 150 m: may flash again at once, with a full 10 s timer
      const dd = { dBefore, flashLeft, after: dAfter, re: dRe };
      // (e) new crime during the grace restarts it at 15 s.
      W.clear(true); W.add('test', 25); sim(10, far); const g1 = d.wanted().graceRemaining; W.add('test', 5); const g2 = d.wanted().graceRemaining;
      W.clear(true);
      return { a, b, c, dd, e: { g1, g2 } };
    });
    check('(a) stars stay solid for the 15 s grace even 300 m away, then flash', r.a.solidThroughGrace && r.a.flipped, r.a);
    check('(b) 10 s of flashing clears the wanted level', r.b.stillFlashing && r.b.stars === 0 && r.b.phase === 'none', r.b);
    check('(c) cop 60 m away without LOS: never flashes', r.c.phases.length === 1 && r.c.phases[0] === 'solid', r.c);
    check('(d) cop LOS mid-flash: back to solid, flash timer reset', r.dd.dBefore === 'flashing' && r.dd.flashLeft < 7 && r.dd.after.wantedPhase === 'solid' && r.dd.after.hiddenTimer === 0 && r.dd.re.wantedPhase === 'flashing' && r.dd.re.flashRemaining > 9.5, r.dd);
    check('(e) new crime during the grace restarts it at 15 s', r.e.g1 < 5.5 && r.e.g2 === 15, r.e);
    // (f) live: a witnessed crime dispatches police at once; they close in within the grace.
    const f = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(470, -92, 0); g.police.reset(); g.wanted.clear(true);
      await wait(300);
      g.wanted.add('test', 25);
      await wait(1500);
      const n1 = g.police.cars.length, P = g.controls.player.position, dist = () => Math.min(...g.police.cars.map((c) => Math.hypot(c.pos.x - P.x, c.pos.z - P.z)));
      const d1 = dist();
      await wait(5000);
      const d2 = dist(), w = d.wanted();
      g.police.reset(); g.wanted.clear(true);
      return { n1, d1: +d1.toFixed(1), d2: +d2.toFixed(1), phase: w.wantedPhase, grace: w.graceRemaining };
    });
    check('(f) police dispatched straight away and closing in during the grace', f.n1 >= 1 && f.d2 < f.d1 - 10 && f.phase === 'solid', f);
    check('HUD blink rate ~2 Hz while flashing', await ev(async () => (await import('/src/police/wantedConfig.js')).WANTED_CFG.flashHz === 2));
  }

  // ------------------------------------------------------------ 1g: soft contact chase
  if (run('push')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug;
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await new Promise((q) => setTimeout(q, 1400));
      return d.chaseTest({ stars: 3, seconds: 12 });
    });
    check('3-star chase: nearest cop ends >20 m away', r.nearest > 20, r);
    check('3-star chase: total contact time <3 s', r.contactTime < 3, r);
    // Rigid contact disabled: police collider ignores the CAR group.
    const grp = await ev(() => { const c = window.__gta.police.cars[0]; return c ? c.body.collider(0).collisionGroups() & 0xffff : null; });
    check('police collider does not collide with cars (sensor-style)', grp !== null && (grp & 0x2) === 0, { filter: grp });
  }

  // ------------------------------------------------------------ 1h + 1i: arrests + BUSTED cutscene
  if (run('arrest')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug;
      const i = g.vehicles.cars.findIndex((c) => !c.hero && !c.dead && !c.impounded);
      d.enter(i); await new Promise((q) => setTimeout(q, 1400));
      const car = g.controls.car; car.stolen = true;
      car.body.teleport(470, g.world.terrain.getHeight(470, -83), -83, Math.PI / 2);
      await new Promise((q) => setTimeout(q, 500));
      const cash0 = g.wallet.cash, busts0 = g.police.st.busts;
      g.wanted.add('test', 70);
      d.placeCop(465, -83, Math.PI / 2);
      const t0 = performance.now(); let officer = null, pullAt = null, csStart = null, csMax = 0, locked = false;
      while (performance.now() - t0 < 20000) {
        if (!officer && g.police.foot.alive.length) officer = (performance.now() - t0) / 1000;
        if (g.police.st.pull && pullAt === null) pullAt = (performance.now() - t0) / 1000;
        if (g.cutscene.active) { if (csStart === null) csStart = performance.now(); csMax = Math.max(csMax, g.cutscene.state.t); locked = locked || g.controls.input.locked; }
        if (csStart !== null && !g.cutscene.active) break;
        await new Promise((q) => setTimeout(q, 50));
      }
      await new Promise((q) => setTimeout(q, 300));
      const p = g.controls.player.position, sp = g.spawns.police().position;
      return { officer, pullAt, csMax: +csMax.toFixed(2), locked, busts: g.police.st.busts - busts0, cash: g.wallet.cash - cash0, stars: g.wanted.stars, atStation: +Math.hypot(p.x - sp.x, p.z - sp.z).toFixed(1), impounded: !!car.impounded, cops: g.police.cars.length, mode: g.controls.mode };
    });
    check('in car: officer gets out after ~1.5 s stopped', r.officer !== null && r.officer > 1.2 && r.officer < 3, r);
    check('officer pulls the player out', r.pullAt !== null, r);
    check('BUSTED cutscene >= 4 s, input locked', r.csMax >= 4 && r.locked, r);
    check('after bust: -$500, 0 stars, police station, car impounded, police reset', r.busts === 1 && r.cash === -500 && r.stars === 0 && r.atStation < 3 && r.impounded && r.cops === 0 && r.mode === 'walk', r);
    // Moving fast: no officer gets out.
    const m = await ev(async () => {
      const g = window.__gta, d = g.debug;
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await new Promise((q) => setTimeout(q, 1400));
      g.wanted.add('test', 70);
      const car = g.controls.car;
      car.body.teleport(340, g.world.terrain.getHeight(340, -87.2), -87.2, Math.PI / 2);
      await new Promise((q) => setTimeout(q, 300));
      d.placeCop(333, -87.2, Math.PI / 2);
      const I = g.controls.input; I.setVirtual('KeyW', true);
      let out = 0; const t0 = performance.now();
      while (performance.now() - t0 < 3000) { out = Math.max(out, g.police.foot.alive.length); await new Promise((q) => setTimeout(q, 50)); }
      I.setVirtual('KeyW', false);
      return { out, speed: g.controls.car ? +(g.controls.car.body.state.speed * 3.6).toFixed(0) : null };
    });
    check('cops stay in their cars while the player drives', m.out === 0, m);
    await fresh();
    // On foot: officers walk up, within 3 m for 1.5 s -> BUSTED.
    const f = await ev(async () => {
      const g = window.__gta, d = g.debug;
      d.teleport(470, -92, Math.PI);
      g.wanted.add('test', 30);
      const busts0 = g.police.st.busts;
      d.placeCop(500, -82.8, -Math.PI / 2); // on Terrace Pde (the old spot is behind the Phase 6 enterable chemist)
      const t0 = performance.now(); let officer = null, cs = null;
      while (performance.now() - t0 < 20000) {
        if (!officer && g.police.foot.alive.length) officer = (performance.now() - t0) / 1000;
        if (g.cutscene.active && cs === null) cs = (performance.now() - t0) / 1000;
        if (cs !== null && !g.cutscene.active) break;
        await new Promise((q) => setTimeout(q, 50));
      }
      return { officer, cs, busts: g.police.st.busts - busts0, stars: g.wanted.stars };
    });
    check('on foot: officer walks up and arrests', f.officer !== null && f.cs !== null && f.busts === 1 && f.stars === 0, f);
  }

  // ------------------------------------------------------------ 1i: KO cutscene + reset
  if (run('ko')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug;
      d.teleport(470, -92, 0);
      g.wanted.add('test', 130);
      await new Promise((q) => setTimeout(q, 2500));
      const cash0 = g.wallet.cash, cops0 = g.police.cars.length;
      const p0 = g.controls.player.position.clone();
      g.combat.damagePlayer(500, 'test');
      let csMax = 0, locked = false, moved = 0, ts = 1;
      const I = g.controls.input; I.setVirtual('KeyW', true);
      const t0 = performance.now();
      while (performance.now() - t0 < 9000) {
        if (g.cutscene.active) { csMax = Math.max(csMax, g.cutscene.state.t); locked = locked || I.locked; ts = Math.min(ts, g.cutscene.timeScale); moved = Math.max(moved, Math.hypot(g.controls.player.position.x - p0.x, g.controls.player.position.z - p0.z)); }
        else if (csMax > 0) break;
        await new Promise((q) => setTimeout(q, 50));
      }
      I.setVirtual('KeyW', false);
      await new Promise((q) => setTimeout(q, 300));
      const p = g.controls.player.position, hs = g.spawns.hospital().position;
      return { csMax: +csMax.toFixed(2), locked, ts, moved: +moved.toFixed(2), cops0, hp: g.combat.hp, stars: g.wanted.stars, cops: g.police.cars.length, cash: g.wallet.cash - cash0, atHospital: +Math.hypot(p.x - hs.x, p.z - hs.z).toFixed(1), ko: g.combat.ko };
    });
    check('KO cutscene >= 4 s, slow-mo 0.3x, input locked', r.csMax >= 4 && r.ts <= 0.31 && r.locked && r.moved < 0.3, r);
    check('after KO: full health, hospital, -$200', r.hp === 100 && r.atHospital < 3 && r.cash === -200 && !r.ko, r);
    check('KO resets wanted + all police', r.stars === 0 && r.cops === 0, r);
  }

  // ------------------------------------------------------------ 1j: stealing parked props
  if (run('steal')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, props = g.world.town.propCars;
      const kinds = {}; for (const p of props) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
      const out = { kinds, total: props.length, steals: [] };
      for (const kind of ['police', 'ambulance', 'civ']) {
        const p = props.find((q) => q.kind === kind && !q.hidden);
        if (g.controls.mode === 'drive') { g.controls.respawnAt(g.controls.car.position, 0); await new Promise((q) => setTimeout(q, 200)); }
        g.wanted.clear(true);
        const c = Math.cos(p.yaw), s = Math.sin(p.yaw), lx = -(p.cfg.W / 2 + 0.7), lz = p.cfg.seat[2];
        d.teleport(p.x + c * lx + s * lz, p.z - s * lx + c * lz, p.yaw + Math.PI / 2);
        await new Promise((q) => setTimeout(q, 400));
        const prompt = d.state().prompt, witnessed = g.theft.witnessed({ x: p.x, y: g.world.terrain.getHeight(p.x, p.z), z: p.z });
        const h0 = g.wanted.heat;
        g.controls.input.setVirtual('KeyF', true);
        await new Promise((q) => setTimeout(q, 1500));
        g.controls.input.setVirtual('KeyF', false);
        await new Promise((q) => setTimeout(q, 1300));
        const car = g.controls.car;
        const row = { kind, prompt, mode: g.controls.mode, emergency: car?.emergency?.kind || null, hidden: !!p.hidden, collider: g.physics.toggles[p.id]?.isEnabled(), heat: g.wanted.heat - h0, witnessed };
        if (car?.emergency) { await d.tap('KeyT'); row.siren = car.emergency.on && g.world.playerSiren; await d.tap('KeyT'); }
        out.steals.push(row);
      }
      return out;
    });
    check('town props: police bay, ambulance, car park + petrol cars', (r.kinds.police || 0) >= 3 && r.kinds.ambulance === 1 && (r.kinds.civ || 0) >= 10, r.kinds);
    const H = { police: 60, ambulance: 30, civ: 25 };
    for (const s of r.steals) {
      check(`steal ${s.kind}: hold F -> driving it, prop hidden, collider off`, /break in/i.test(s.prompt || '') && s.mode === 'drive' && s.hidden && s.collider === false, s);
      check(`steal ${s.kind}: witnessed heat`, s.heat === (s.witnessed ? H[s.kind] : 0), s);
      if (s.kind !== 'civ') check(`steal ${s.kind}: emergency kit, T = lights + siren`, s.emergency === s.kind && s.siren === true, s);
    }
    const cj = await ev(() => { const g = window.__gta; return g.police.cars.every((c) => c.isPolice); });
    check('cop cars are never carjackable (isPolice)', cj);
  }

  // ------------------------------------------------------------ 1k: more parked cars
  if (run('parked')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, W = g.world, extra = g.vehicles.cars.filter((c) => c.spawn.extra);
      const all = g.vehicles.cars.filter((c) => c.spawn && !c.hero);
      let minGap = Infinity, minCut = Infinity, inPad = 0;
      for (const c of extra) {
        for (const o of all) if (o !== c) minGap = Math.min(minGap, Math.hypot(o.spawn.x - c.spawn.x, o.spawn.z - c.spawn.z));
        for (const k of W.layout.cuts) minCut = Math.min(minCut, Math.hypot(k.x - c.spawn.x, k.z - c.spawn.z));
        if (W.network.pads.some((p) => Math.hypot(p.x - c.spawn.x, p.z - c.spawn.z) < p.r + 1)) inPad++;
      }
      g.debug.teleport(470, -92, 0);
      await new Promise((q) => setTimeout(q, 800));
      return { extra: extra.length, roads: W.network.roads.length, minGap: +minGap.toFixed(1), minCut: +minCut.toFixed(1), inPad, sleeping: g.vehicles.sleepingCount, calls: g.renderer.info.render.calls, fps: g.stats().fps };
    });
    check('extra parked cars on every 2nd street', r.extra >= Math.floor(r.roads / 2), r);
    check('parked cars >=8 m apart, >=12 m from driveways, none in pads', r.minGap >= 8 && r.minCut >= 12 && r.inPad === 0, r);
    check('far parked cars sleep', r.sleeping > 0, r);
    check('no page errors', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 2: guns
  if (run('guns')) {
    await load();
    await fresh();
    // Hold pose (IK) for every gun, ready + aiming.
    const hold = await ev(async () => {
      const g = window.__gta, d = g.debug, W = g.weapons, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(470, -92, Math.PI); await wait(300);
      const out = {};
      for (const id of ['pistol', 'smg', 'shotgun', 'rifle']) {
        W.arsenal.give(id, 30); W.arsenal.select(id); await wait(700);
        const ready = W.holdCheck();
        g.controls.input.setVirtual('Mouse2', true); await wait(700);
        const aim = { ...W.holdCheck(), aiming: W.aiming, fov: +g.camera.fov.toFixed(1), dist: +g.camera.position.distanceTo(g.controls.player.position).toFixed(2) };
        g.controls.input.setVirtual('Mouse2', false); await wait(300);
        out[id] = { ready, aim };
      }
      return out;
    });
    for (const [id, h] of Object.entries(hold)) {
      const worst = Math.max(h.ready.gripToHand, h.aim.gripToHand, h.ready.foreToHand ?? 0, h.aim.foreToHand ?? 0);
      check(`${id}: right hand on the grip, left hand on the foregrip (<3 cm)`, worst < 0.03, h);
      check(`${id}: muzzle in front of the body`, h.ready.muzzleAhead > 0.25 && h.aim.muzzleAhead > 0.25, { ready: h.ready.muzzleAhead, aim: h.aim.muzzleAhead });
    }
    check('RMB: over-the-shoulder aim (zoomed, camera closer)', hold.pistol.aim.aiming && hold.pistol.aim.fov < 56 && hold.pistol.aim.dist < 3.2, hold.pistol.aim);
    // Holster / draw (Q) + guns on the body.
    const hq = await ev(async () => {
      const g = window.__gta, d = g.debug, W = g.weapons;
      await d.tap('Digit1'); await new Promise((q) => setTimeout(q, 300));
      const drawn = { armed: W.arsenal.armed, id: W.arsenal.weapon.id, inHand: W.hand.pistol.group.visible, onHip: W.holster.pistol.group.visible, onBack: W.holster.rifle.group.visible };
      await d.tap('KeyQ'); await new Promise((q) => setTimeout(q, 300));
      const hol = { armed: W.arsenal.armed, inHand: W.hand.pistol.group.visible, onHip: W.holster.pistol.group.visible, onBack: W.holster.rifle.group.visible, hud: W.hud.state.visible, cross: W.hud.state.crosshair };
      await d.tap('KeyQ');
      return { drawn, hol };
    });
    check('1 draws the pistol (in hand, long guns on the back)', hq.drawn.armed && hq.drawn.id === 'pistol' && hq.drawn.inHand && !hq.drawn.onHip && hq.drawn.onBack, hq.drawn);
    check('Q holsters: pistol on the hip, HUD + crosshair off', !hq.hol.armed && !hq.hol.inHand && hq.hol.onHip && !hq.hol.hud && !hq.hol.cross, hq.hol);
    // Real trigger pull through the crosshair at a wall: ammo, decal, flash, casing, HUD.
    const shot = await ev(async () => {
      const g = window.__gta, d = g.debug, W = g.weapons, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(553, -80, Math.PI); g.controls.player.state.yaw = Math.PI; g.controls.player.state.pitch = 0.05;
      W.arsenal.select('pistol'); await wait(600);
      W.arsenal.state.ammo.pistol.mag = 12;
      const mag0 = W.arsenal.ammo.mag, fx0 = { ...W.fx.stats };
      g.controls.input.setVirtual('Mouse0', true); await wait(60); g.controls.input.setVirtual('Mouse0', false); await wait(400);
      return { mag0, mag: W.arsenal.ammo.mag, last: W.st.lastShot, fx: Object.fromEntries(Object.entries(W.fx.stats).map(([k, v]) => [k, v - fx0[k]])), hud: W.hud.state.text, light: W.fx.light.intensity };
    });
    check('LMB fires one round through the crosshair', shot.mag === shot.mag0 - 1 && shot.last && shot.last.kind !== 'none', shot);
    check('effects: muzzle flash, casing, impact, bullet hole', shot.fx.flashes === 1 && shot.fx.casings === 1 && shot.fx.impacts >= 1 && shot.fx.decals === 1, shot.fx);
    check('HUD shows weapon + ammo, flash light back off', /Pistol 11\//.test(shot.hud) && shot.light === 0, { hud: shot.hud, light: shot.light });
    // Hits: head/body zones, kill + fade timing, heat events.
    const hits = await ev(async () => {
      const g = window.__gta, W = g.weapons, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      g.wanted.clear(true); g.police.reset();
      g.debug.teleport(470, -92, 0); await wait(300);
      const P = g.controls.player.position;
      const p = g.peds.peds.filter((q) => q.ch.root.visible && q.state !== 'dead' && q.state !== 'down').sort((a, b) => a.pos.distanceTo(P) - b.pos.distanceTo(P))[0];
      if (!p) return { error: 'no ped' };
      p.state = 'pause'; p.timer = 60; p.flee = 0; p.cower = 0;
      await wait(200);
      const at = (ped, z) => { const h = ped.ch.bones[z === 'head' ? 'head' : 'torso']; h.updateWorldMatrix(true, false); const e = h.matrixWorld.elements; return { x: e[12], y: e[13] + (z === 'head' ? 0.14 : 0.2), z: e[14] }; };
      const from = (t) => ({ x: t.x - 6, y: t.y, z: t.z });
      g.crimes.st.forceWitness = true; // heat rules are tested in 'witness'; here every shot is seen
      g.crimes.clear(); g.wanted.clear(true);
      const h0 = g.wanted.heat;
      const b = W.debugShot(from(at(p, 'body')), { x: 1, y: 0, z: 0 }, 'pistol');
      const hpAfterBody = p.hp; await wait(1700); const heatShoot = g.wanted.heat - h0;
      p.state = 'pause'; p.flee = 0; p.cower = 0; await wait(50);
      const hd = W.debugShot(from(at(p, 'head')), { x: 1, y: 0, z: 0 }, 'pistol');
      const hpAfterHead = p.hp;
      const h1 = g.wanted.heat;
      p.state = 'pause'; p.flee = 0; p.cower = 0; await wait(50);
      if (p.state !== 'dead') W.debugShot(from(at(p, 'body')), { x: 1, y: 0, z: 0 }, 'rifle');
      const killT = performance.now();
      const killed = p.state === 'dead'; await wait(1700); const heatKill = g.wanted.heat - h1;
      const t0 = killT; let fadeStart = null, goneAt = null;
      while (performance.now() - t0 < 8000) { if (p.fadeMat && fadeStart === null) fadeStart = (performance.now() - t0) / 1000; if (p.gone) { goneAt = (performance.now() - t0) / 1000; break; } await wait(50); }
      // Officer: shoot +100, kill +150.
      g.wanted.clear(true);
      // Shot in the same tick it appears (an officer with no car and no wanted level would walk off).
      const o = g.police.foot.spawn(null, { x: P.x + 6, z: P.z }); o.state = 'hold';
      const ot = { x: o.pos.x, y: o.pos.y + 1.2, z: o.pos.z };
      const c0 = g.wanted.heat;
      W.debugShot({ x: ot.x - 5, y: ot.y, z: ot.z }, { x: 1, y: 0, z: 0 }, 'pistol');
      const copHp = o.hp;
      for (let i = 0; i < 8 && o.state !== 'dead'; i++) W.debugShot({ x: ot.x - 5, y: ot.y, z: ot.z }, { x: 1, y: 0, z: 0 }, 'pistol');
      await wait(1700); const copTotal = g.wanted.heat - c0, copShot = 100, copKill = copTotal - 100; g.crimes.st.forceWitness = false;
      return { b, hd, hpAfterBody, hpAfterHead, heatShoot, killed, heatKill, fadeStart, goneAt, copShot, copHp, copDead: o.state === 'dead', copKill, hitMarkers: W.hud.state.hitMarkers };
    });
    check('body shot: body zone, 25 damage', hits.b?.zone === 'body' && hits.hpAfterBody === 75, hits);
    check('headshot: head zone, x2 damage', hits.hd?.zone === 'head' && hits.hd.dmg === 50 && hits.hpAfterHead === 25, hits);
    check('heat: shooting a civilian +50, killing +80', hits.heatShoot === 50 && hits.killed && hits.heatKill === 80, hits);
    check('shot ped goes down, fades after ~5 s, gone by ~6.5 s', hits.fadeStart > 4.3 && hits.fadeStart < 5.8 && hits.goneAt > 5.5 && hits.goneAt < 7.2, { fadeStart: hits.fadeStart, goneAt: hits.goneAt });
    check('cops: 150 hp; hitting one = 5 stars (heat >= 300), killing adds +150', hits.copHp === 125 && hits.copDead && hits.copKill + 100 >= 450, hits);
    check('hit markers shown', hits.hitMarkers >= 3, hits.hitMarkers);
    // Cars + breakables + civilians reacting.
    const misc = await ev(async () => {
      const g = window.__gta, W = g.weapons, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      g.wanted.clear(true); g.police.reset();
      const car = g.vehicles.cars.find((c) => !c.hero && !c.dead && !c.impounded && !c.sleeping) || g.vehicles.cars.find((c) => !c.hero && !c.dead && !c.impounded);
      const h0 = car.health ?? 100, cp = car.position;
      const r = W.debugShot({ x: cp.x - 6, y: cp.y + 0.8, z: cp.z }, { x: 1, y: 0, z: 0 }, 'rifle');
      const carDmg = h0 - car.health;
      // A street light (breakable): shoot until it breaks.
      const set = g.breakables.sets.find((s) => s.name === 'streetLight'), it = set.items.find((i) => !i.broken);
      let n = 0;
      while (!it.broken && n < 20) { W.debugShot({ x: it.x - 4, y: it.y + 2, z: it.z + 0.001 }, { x: 1, y: 0, z: 0 }, 'pistol'); n++; }
      // Civilians within 40 m react to gunfire.
      g.debug.teleport(470, -92, 0); await wait(400);
      W.arsenal.select('pistol'); await wait(500);
      g.controls.input.setVirtual('Mouse0', true); await wait(60); g.controls.input.setVirtual('Mouse0', false); await wait(300);
      const P = g.controls.player.position;
      const near = g.peds.peds.filter((p) => p.ch.root.visible && p.state !== 'dead' && p.state !== 'down' && Math.hypot(p.pos.x - P.x, p.pos.z - P.z) < 40);
      return { r, carDmg, poleBroken: it.broken, shotsToBreak: n, near: near.length, reacting: near.filter((p) => p.flee > 0 || p.cower > 0).length };
    });
    check('bullets damage cars a little', misc.r.kind === 'car' && misc.carDmg > 5 && misc.carDmg < 15, misc);
    check('street light breaks from gunfire', misc.poleBroken && misc.shotsToBreak >= 2, misc);
    check('civilians within 40 m flee or cower', misc.near === 0 || misc.reacting >= Math.ceil(misc.near * 0.7), misc);
    // First person: viewmodel holds the gun, ADS centres the sights.
    const fp = await ev(async () => {
      const g = window.__gta, d = g.debug, W = g.weapons, V = g.viewmodel, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      while (g.controls.cameraMode !== 'first') await d.tap('KeyC');
      W.arsenal.select('rifle'); await wait(600);
      const holder = V.root.children[2];
      const hip = { visible: V.visible, item: !!W.st.viewItem, x: +holder.position.x.toFixed(3) };
      g.controls.input.setVirtual('Mouse2', true); await wait(700);
      const ads = { ads: +V.state.ads.toFixed(2), x: +holder.position.x.toFixed(3), fov: +g.camera.fov.toFixed(1) };
      g.controls.input.setVirtual('Mouse2', false);
      while (g.controls.cameraMode !== 'third') await d.tap('KeyC');
      return { hip, ads };
    });
    check('POV: viewmodel shows the gun at the hip', fp.hip.visible && fp.hip.item && fp.hip.x > 0.08, fp);
    check('POV: ADS centres the sights + zooms', fp.ads.ads > 0.9 && Math.abs(fp.ads.x) < 0.02 && fp.ads.fov < 70, fp);
    const saved = await ev(() => JSON.parse(localStorage.getItem('gta-weapons') || 'null'));
    check('owned weapons + ammo saved to localStorage', saved && saved.owned.includes('rifle') && !!saved.ammo.pistol, saved?.owned);
    const nan = await ev(() => { const s = window.__gta.debug.state(); return !s.player.every(Number.isFinite); });
    check('no NaN after gunfire', !nan);
    check('no page errors (guns)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 3: cops with guns
  if (run('copguns')) {
    await load();
    await fresh();
    const rule = await ev(async () => {
      const m = await import('/src/police/copGuns.js');
      return { s2: m.copWeapon(2, 0), s3: m.copWeapon(3, 0), s3b: m.copWeapon(3, 1), s4: m.copWeapon(4, 0), s4b: m.copWeapon(4, 1), s5b: m.copWeapon(5, 2), acc20: +m.copAccuracy(20, 0).toFixed(2), acc40: +m.copAccuracy(40, 0).toFixed(2), accFast: +m.copAccuracy(20, 15).toFixed(2) };
    });
    check('arming rule: none <3 stars, pistols at 3, rifle + SMGs at 4-5', rule.s2 === null && rule.s3 === 'pistol' && rule.s3b === 'pistol' && rule.s4 === 'rifle' && rule.s4b === 'smg' && rule.s5b === 'smg', rule);
    check('accuracy ~35% at 20 m, less far away and vs a fast target', Math.abs(rule.acc20 - 0.35) < 0.01 && rule.acc40 < rule.acc20 && rule.accFast < rule.acc20, rule);
    // Live arming at 2 vs 3 stars.
    const live = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(470, -92, 0); await wait(200);
      g.wanted.add('test', 61); // 2 stars
      const P = g.controls.player.position;
      const o = g.police.foot.spawn(null, { x: P.x + 25, z: P.z }); o.state = 'hold';
      await wait(300);
      const at2 = o.gun || null;
      g.wanted.add('test', 60); // 3 stars
      await wait(300);
      const at3 = o.gun || null, gunVisible = !!o.gunObj?.group.visible;
      g.police.reset(); g.wanted.clear(true);
      return { at2, at3, gunVisible };
    });
    check('officers unarmed at 2 stars, pistol at 3 (held, visible)', live.at2 === null && live.at3 === 'pistol' && live.gunVisible, live);
    // Cop fire at an on-foot player: health drops.
    const foot = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(470, -92, 0); await wait(200);
      g.combat.setHp(100);
      g.wanted.add('test', 201); // 4 stars: armed officers keep their distance and shoot
      const P = g.controls.player.position;
      const o = g.police.foot.spawn(null, { x: P.x + 16, z: P.z }); o.state = 'hold';
      const s0 = g.copGuns.st.shots;
      const t0 = performance.now();
      while (performance.now() - t0 < 9000 && g.combat.hp >= 100 && !g.combat.ko) await wait(100);
      const r = { hp: +g.combat.hp.toFixed(1), shots: g.copGuns.st.shots - s0, gun: o.gun, aimHold: !!o.gunObj, busted: g.police.st.busted, sees: o.sees, t: +((performance.now() - t0) / 1000).toFixed(1) };
      g.police.reset(); g.wanted.clear(true); g.combat.setHp(100);
      return r;
    });
    check('cops shoot an on-foot player: health drops', foot.shots > 0 && foot.hp < 100, foot);
    // Cop fire at the player's car: car health drops, player health constant.
    const car = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await wait(1400);
      const c = g.controls.car; c.health = 100; c.dead = false; c.body.dead = false;
      c.body.teleport(440, g.world.terrain.getHeight(440, -83), -83, Math.PI / 2);
      await wait(400);
      g.combat.setHp(90);
      g.wanted.add('test', 201);
      d.placeCop(418, -83, Math.PI / 2);
      const s0 = g.copGuns.st.carHits, shots0 = g.copGuns.st.shots;
      const t0 = performance.now();
      while (performance.now() - t0 < 6000 && g.copGuns.st.carHits === s0) await wait(100);
      await wait(300);
      const r = { carHealth: +c.health.toFixed(1), carHits: g.copGuns.st.carHits - s0, shots: g.copGuns.st.shots - shots0, hp: +g.combat.hp.toFixed(1), mode: g.controls.mode };
      g.police.reset(); g.wanted.clear(true);
      return r;
    });
    check('cops shoot the car: car health drops', car.carHits > 0 && car.carHealth < 100, car);
    check('in a car the player never takes bullet damage', car.hp >= 90, car);
    check('no page errors (copguns)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 4: Barrel & Bolt
  if (run('shop')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, A = g.weapons.arsenal, S = g.gunShop, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const T = g.world.town, c = T.interiors.counters.gunShop;
      A.state.owned.delete('shotgun'); A.state.owned.delete('rifle'); A.holster();
      A.state.ammo.pistol.reserve = 0;
      g.wallet.set(2000);
      d.teleport(c.x, c.z + 1.1, Math.PI); await wait(500);
      const prompt = d.state().prompt;
      await d.tap('KeyE'); await wait(200);
      const opened = { open: S.open, locked: g.controls.input.locked, visible: !!document.querySelector('.gta-panel button[data-k]') };
      const c0 = g.wallet.cash;
      const b1 = S.buy('ammo:pistol');
      const afterAmmo = { cash: g.wallet.cash - c0, reserve: A.state.ammo.pistol.reserve };
      A.state.ammo.pistol.reserve = 96;
      const c1 = g.wallet.cash;
      const b2 = S.buy('ammo:pistol');
      const capBlocked = { bought: b2, cash: g.wallet.cash - c1, reserve: A.state.ammo.pistol.reserve };
      const b3 = S.buy('ammo:rifle'); // no rifle yet
      const c2 = g.wallet.cash;
      const b4 = S.buy('gun:shotgun');
      const shotgun = { bought: b4, cash: g.wallet.cash - c2, owns: A.owns('shotgun') };
      g.wallet.set(1000);
      const b5 = S.buy('gun:rifle'); // $1,000 is not enough
      const cashLeft = g.wallet.cash;
      g.wallet.add(1000);
      const b6 = S.buy('gun:rifle');
      const b7 = S.buy('gun:rifle'); // already owned
      await wait(100);
      const ev = new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      await wait(200);
      const closed = { open: S.open, locked: g.controls.input.locked };
      const sel3 = A.select(3), sel4 = A.select(4);
      const keeper = T.interiors.people.find((p) => p.role === 'gunshop');
      const shootable = g.weapons.hitscan.targets().some((t) => t.ch === keeper?.ch);
      return { prompt, opened, b1, afterAmmo, capBlocked, b3, shotgun, b5, cashLeft, b6, b7, closed, sel3, sel4, keeper: !!keeper, shootable, place: g.world.places.some((p) => /Barrel/.test(p.label)) };
    });
    check('counter prompt: E to shop', /Barrel & Bolt/.test(r.prompt || ''), r.prompt);
    check('E opens the buy menu, game input paused', r.opened.open && r.opened.locked && r.opened.visible, r.opened);
    check('ammo pack: -$30, +24 pistol rounds', r.b1 && r.afterAmmo.cash === -30 && r.afterAmmo.reserve === 24, r.afterAmmo);
    check('cannot buy past the ammo cap', !r.capBlocked.bought && r.capBlocked.cash === 0 && r.capBlocked.reserve === 96, r.capBlocked);
    check('no ammo for a gun you do not own', r.b3 === false);
    check('shotgun $600 -> owned', r.shotgun.bought && r.shotgun.cash === -600 && r.shotgun.owns, r.shotgun);
    check('rifle needs $1,200 (refused when short, bought after)', r.b5 === false && r.cashLeft < 1200 && r.b6 && r.b7 === false, { b5: r.b5, cashLeft: r.cashLeft, b6: r.b6, b7: r.b7 });
    check('Esc closes the menu, input back', !r.closed.open && !r.closed.locked, r.closed);
    check('bought guns unlock slots 3 and 4', r.sel3 && r.sel4);
    check('shopkeeper is there and never in the fight (not a target)', r.keeper && !r.shootable);
    check('minimap / places list the gun shop', r.place);
    check('no page errors (shop)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 5.1: Downtown
  if (run('downtown')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, T = g.world.town, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(745, -92, 0); await wait(2500);
      const P = g.controls.player.position, info = g.renderer.info.render;
      const inDT = (x, z) => x > 612 && x < 975 && z > -220 && z < 50;
      return {
        towers: T.downtown.towers, landmarks: T.downtown.landmarks.length, flat: Math.abs(g.world.terrain.getHeight(900, -150) - T.plan.nodes[0].x * 0 - (-4.4)) < 0.05,
        y: +P.y.toFixed(2), calls: info.calls, fps: g.stats().fps,
        lanes: g.traffic.graph.lanes.filter((l) => l.town && l.pts.some((p) => p.x > 700)).length,
        pedLines: g.peds.graph.lines.filter((L) => L[0].x > 612 && L[0].x < 1000).length,
        office: g.peds.peds.filter((p) => p.role === 'office').length,
        places: g.world.places.filter((p) => inDT(p.x, p.z)).map((p) => p.kind),
        stops: T.stops.filter((s) => inDT(s.x, s.z)).length,
        props: T.propCars.filter((p) => inDT(p.x, p.z)).length,
        neon: !!T.downtown.neon,
        traffic: g.traffic.cars.filter((t) => inDT(t.pos.x, t.pos.z)).length,
        peds: g.peds.peds.filter((p) => inDT(p.pos.x, p.pos.z) && p.ch.root.visible).length,
      };
    });
    check('downtown: 12-16 towers + 2 landmarks', r.towers >= 12 && r.towers <= 16 && r.landmarks >= 2, r);
    check('downtown: teleport lands on flat ground', r.flat && Math.abs(r.y + 4.4) < 0.3, r);
    check('downtown: lanes + footpaths generated for the new streets', r.lanes >= 20 && r.pedLines >= 7, r);
    check('downtown: minimap markers, bus stops, stealable cars, neon', r.places.includes('landmark') && r.places.includes('park') && r.stops >= 3 && r.props >= 4 && r.neon, r);
    check('downtown: draw calls < 500, fps >= 45', r.calls < 500 && r.fps >= 45, { calls: r.calls, fps: r.fps });
    // Drive it end to end (Terrace Pde east, then down the east ring road): physics only.
    const drv = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await wait(1400);
      const c = g.controls.car; c.health = 100; c.dead = false; c.body.dead = false;
      for (const t of [...g.traffic.cars]) if (Math.abs(t.pos.z + 85) < 8 && t.pos.x > 600) g.traffic.removeCar(t);
      const pts = [...d.lanePoints(615, -85, 958, -85), ...d.lanePoints(970, -73, 970, 33)];
      const res = await d.drivePoints(pts, { speed: 16, timeout: 70 });
      await wait(3000);
      const inDT = (x, z) => x > 612 && x < 975 && z > -220 && z < 50;
      return { res, traffic: g.traffic.cars.filter((t) => inDT(t.pos.x, t.pos.z)).length, peds: g.peds.peds.filter((p) => inDT(p.pos.x, p.pos.z) && p.ch.root.visible).length };
    });
    check('downtown drive: end to end, no NaN, no flips, stays on the road', !drv.res.nan && drv.res.maxTilt < 20 && drv.res.minAbove > -0.4 && drv.res.dist > 300, drv.res);
    check('downtown: traffic and NPCs present', r.traffic >= 2 && r.peds >= 4, { traffic: r.traffic, peds: r.peds });
    check('no page errors (downtown)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 5.2: Beach / waterfront
  if (run('beach')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, B = g.world.town.beach, T = g.world.terrain, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(800, 60, Math.PI); await wait(2500);
      const info = g.renderer.info.render, P = g.controls.player.position;
      const hs = [60, 70, 90, 116, 150].map((z) => T.getHeight(800, z));
      const near = (p) => p.pos.x > 600 && p.pos.z > 50;
      const deck = g.physics.world.castRay(new g.physics.RAPIER.Ray({ x: B.pier.x, y: 5, z: 170 }, { x: 0, y: -1, z: 0 }), 30, true);
      return {
        y: +P.y.toFixed(2), slope: hs.every((h, i) => i === 0 || h < hs[i - 1] + 0.01), shore: +B.water.zShore.toFixed(1), waterY: B.water.y,
        underwater: T.getHeight(800, 150) < B.water.y, deckY: deck ? +(5 - deck.timeOfImpact).toFixed(2) : null,
        landmarks: B.landmarks.map((l) => l.name), gulls: B.gulls.birds.length, gullsMoving: B.gulls.mesh.visible,
        spots: g.peds.peds.filter((p) => p.home && near(p)).map((p) => p.home.action), walkers: g.peds.peds.filter((p) => !p.home && near(p)).length,
        places: g.world.places.filter((p) => p.x > 600 && p.z > 50).map((p) => p.kind), props: g.world.town.propCars.filter((p) => p.z > 55).length,
        calls: info.calls, fps: g.stats().fps,
      };
    });
    check('beach: sand slopes from the promenade into the water', r.slope && r.underwater && r.shore > 100 && r.shore < 130 && Math.abs(r.y + 4.4) < 0.3, r);
    check('beach: pier deck has collision at promenade level', r.deckY !== null && Math.abs(r.deckY + 4.4) < 0.1, { deckY: r.deckY });
    check('beach: landmarks (pier, lifeguard tower) + seagulls', r.landmarks.length >= 2 && r.gulls >= 8 && r.gullsMoving, { landmarks: r.landmarks, gulls: r.gulls });
    check('beach: sunbathers, volleyball, lifeguard, kiosk vendor', r.spots.filter((a) => a === 'sunbathe').length >= 2 && r.spots.filter((a) => a === 'volley').length >= 2 && r.spots.includes('look'), r.spots);
    check('beach: minimap marker, stealable cars', r.places.includes('beach') && r.places.includes('landmark') && r.props >= 3, { places: r.places, props: r.props });
    check('beach: draw calls < 500, fps >= 45', r.calls < 500 && r.fps >= 45, { calls: r.calls, fps: r.fps });
    // Drive the beach road (south ring road) end to end, then out along the pier.
    const drv = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await wait(1400);
      const c = g.controls.car; c.health = 100; c.dead = false; c.body.dead = false;
      for (const t of [...g.traffic.cars]) if (Math.abs(t.pos.z - 45) < 8 && t.pos.x > 600) g.traffic.removeCar(t);
      const road = await d.drivePoints(d.lanePoints(615, 45, 958, 45), { speed: 16, timeout: 50 });
      const pier = await d.drivePoints(d.lanePoints(800, 57, 800, 196, 0), { speed: 8, timeout: 40 });
      const p = c.position;
      const tr = g.traffic.cars.filter((t) => t.pos.x > 600 && t.pos.z > -90).length;
      const npc = g.peds.peds.filter((q) => q.pos.x > 600 && q.pos.z > 50 && q.ch.root.visible).length;
      const lanes = g.traffic.graph.lanes.filter((l) => l.pts.some((q) => q.x > 620 && Math.abs(q.z - 45) < 4)).length;
      return { road, pier, end: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), tr, npc, lanes };
    });
    check('beach road: end to end, no NaN, no flips', !drv.road.nan && drv.road.maxTilt < 20 && drv.road.minAbove > -0.4 && drv.road.dist > 300, drv.road);
    check('pier: drivable to the end, stays on the deck', !drv.pier.nan && drv.pier.maxTilt < 15 && drv.end[2] > 180 && drv.end[1] > -4.9, { pier: drv.pier, end: drv.end });
    check('beach: traffic lanes on the beach road + beach NPCs present', drv.lanes >= 4 && drv.npc >= 6, { traffic: drv.tr, lanes: drv.lanes, npc: drv.npc });
    check('no page errors (beach)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 5.3: Northgate (suburb 2 + school + shopping centre)
  if (run('northgate')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, N = g.world.town.northgate, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(470, -300, 0); await wait(2500);
      const info = g.renderer.info.render, P = g.controls.player.position, inN = (x, z) => z < -250 && z > -485 && x > 325 && x < 640;
      const roles = g.peds.peds.filter((p) => inN(p.pos.x, p.pos.z)).map((p) => p.role);
      return {
        y: +P.y.toFixed(2), lots: N.lots.length, carpark: N.carparkCars, landmarks: N.landmarks.map((l) => l.name),
        lanes: g.traffic.graph.lanes.filter((l) => l.pts.some((p) => inN(p.x, p.z))).length,
        pedLines: g.peds.graph.lines.filter((L) => inN(L[0].x, L[0].z)).length, roles,
        places: g.world.places.filter((p) => inN(p.x, p.z)).map((p) => p.kind),
        props: g.world.town.propCars.filter((p) => inN(p.x, p.z)).length,
        calls: info.calls, fps: g.stats().fps,
        houseOverlap: N.lots.some((a, i) => N.lots.some((b, k) => k > i && Math.hypot(a.x - b.x, a.z - b.z) < 9)),
      };
    });
    check('northgate: houses (reused variants), school, shopping centre, water tower', r.lots >= 24 && !r.houseOverlap && r.landmarks.length >= 3, { lots: r.lots, landmarks: r.landmarks });
    check('northgate: school has staff only (adults, no child NPCs)', r.roles.includes('teacher') && !r.roles.some((x) => /child|kid|student/.test(x)), r.roles);
    check('northgate: lanes + footpaths + minimap markers', r.lanes >= 20 && r.pedLines >= 4 && r.places.includes('school') && r.places.includes('shop'), r);
    check('northgate: big car park of stealable cars', r.carpark >= 10 && r.props >= 10, { carpark: r.carpark, props: r.props });
    check('northgate: flat ground, draw calls < 500, fps >= 45', Math.abs(r.y + 4.4) < 0.3 && r.calls < 500 && r.fps >= 45, { y: r.y, calls: r.calls, fps: r.fps });
    const drv = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await wait(1400);
      const c = g.controls.car; c.health = 100; c.dead = false; c.body.dead = false;
      for (const t of [...g.traffic.cars]) if (Math.abs(t.pos.x - 420) < 8 && t.pos.z < -200) g.traffic.removeCar(t);
      // From the ring road up Northgate Rd to the top of the estate.
      const res = await d.drivePoints(d.lanePoints(420, -222, 420, -462), { speed: 16, timeout: 45 });
      await wait(1500);
      const inN = (x, z) => z < -250 && z > -485 && x > 325 && x < 640;
      return { res, traffic: g.traffic.cars.filter((t) => inN(t.pos.x, t.pos.z)).length, peds: g.peds.peds.filter((p) => inN(p.pos.x, p.pos.z) && p.ch.root.visible).length };
    });
    check('northgate drive: Northgate Rd end to end, no NaN, no flips', !drv.res.nan && drv.res.maxTilt < 20 && drv.res.minAbove > -0.4 && drv.res.dist > 200, drv.res);
    check('northgate: traffic and NPCs present', drv.traffic >= 1 && drv.peds >= 4, { traffic: drv.traffic, peds: drv.peds });
    check('no page errors (northgate)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 5.4: Industrial (no highway)
  if (run('industrial')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, I = g.world.town.industrial, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      d.teleport(835, -300, 0); await wait(2500);
      const info = g.renderer.info.render, inI = (x, z) => x > 690 && x < 985 && z < -280 && z > -485;
      const f0 = I.forklift.dist, p0 = I.forklift.pos.clone(); await wait(1500);
      return {
        y: +g.controls.player.position.y.toFixed(2), wh: I.warehouses, cont: I.containers, landmarks: I.landmarks.map((l) => l.name),
        forkMoved: +(I.forklift.pos.distanceTo(p0)).toFixed(2), forkSpeed: +((I.forklift.dist - f0) / 1.5).toFixed(2),
        workers: g.peds.peds.filter((p) => p.home && inI(p.pos.x, p.pos.z) && p.role === 'worker').length,
        lanes: g.traffic.graph.lanes.filter((l) => l.pts.some((p) => inI(p.x, p.z))).length,
        places: g.world.places.filter((p) => inI(p.x, p.z)).map((p) => p.kind), props: g.world.town.propCars.filter((p) => inI(p.x, p.z)).length,
        calls: info.calls, fps: g.stats().fps,
      };
    });
    check('industrial: warehouses, container stacks, graffiti, gantry crane', r.wh >= 6 && r.cont >= 40 && r.landmarks.length >= 2, r);
    check('industrial: slow forklift doing laps, port workers', r.forkMoved > 1 && r.forkSpeed < 2.5 && r.workers >= 3, { forkMoved: r.forkMoved, forkSpeed: r.forkSpeed, workers: r.workers });
    check('industrial: lanes, minimap marker, stealable utes, flat, perf', r.lanes >= 20 && r.places.includes('industry') && r.props >= 2 && Math.abs(r.y + 4.4) < 0.3 && r.calls < 500 && r.fps >= 45, r);
    const drv = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen)); await wait(1400);
      const c = g.controls.car; c.health = 100; c.dead = false; c.body.dead = false;
      for (const t of [...g.traffic.cars]) if ((Math.abs(t.pos.x - 790) < 8 || Math.abs(t.pos.z + 470) < 8) && t.pos.z < -200) g.traffic.removeCar(t);
      const res = await d.drivePoints([...d.lanePoints(790, -222, 790, -458), ...d.lanePoints(800, -470, 958, -470)], { speed: 15, timeout: 60 });
      return { res };
    });
    check('industrial drive: King St + Wharf Rd end to end, no NaN, no flips', !drv.res.nan && drv.res.maxTilt < 20 && drv.res.minAbove > -0.4 && drv.res.dist > 300, drv.res);
    check('no page errors (industrial)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ Step 6: vibe pass
  if (run('vibe')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const { zoneLevels } = await import('/src/audio/ambience.js');
      g.lighting.setDusk(0);
      const c0 = g.skyLife.state.cloudX0; await wait(1500); const c1 = g.skyLife.state.cloudX0;
      const birdsDay = g.skyLife.state.birdsVisible;
      const z = { suburb: zoneLevels({ x: 0, z: 0 }, 0), beach: zoneLevels({ x: 800, z: 100 }, 0), downtown: zoneLevels({ x: 780, z: -90 }, 0), night: zoneLevels({ x: 0, z: 0 }, 1) };
      g.lighting.setDusk(1); await wait(300);
      const birdsNight = g.skyLife.state.birdsVisible;
      g.lighting.setDusk(0);
      // Peds: ~60 total, far ones asleep.
      d.teleport(0, 0, 0); await wait(800);
      const P = g.peds.peds, asleep = P.filter((p) => !p.ch.root.visible).length;
      // Warm light inside Terrace Central only.
      d.teleport(553, -104, Math.PI); await wait(400); const inStore = g.shopLight.intensity;
      d.teleport(470, -60, 0); await wait(400); const outside = g.shopLight.intensity;
      // Automatic day/night cycle.
      g.dayCycle.on = true; g.dayCycle.t = g.dayCycle.period / 2 - 0.05; await wait(400);
      const cycDusk = g.lighting.dusk; g.dayCycle.on = false; g.lighting.setDusk(0);
      return { c0, c1, birdsDay, birdsNight, z, peds: P.length, asleep, inStore, outside, cycDusk, lights: (() => { let n = 0; g.scene.traverse((o) => { if (o.isLight && o.castShadow) n++; }); return n; })() };
    });
    check('clouds drift', r.c1 > r.c0 || r.c1 < r.c0 - 1000, { c0: r.c0, c1: r.c1 });
    check('birds by day, gone at night', r.birdsDay && !r.birdsNight);
    check('ambience by zone: birds/wind suburb, waves beach, traffic downtown, crickets at night', r.z.suburb.birds > 0.5 && r.z.beach.waves > 0.8 && r.z.downtown.traffic > 0.5 && r.z.night.crickets > 0.3 && r.z.suburb.waves === 0, r.z);
    check('pedestrians capped ~90 (Phase 6), far ones asleep', r.peds >= 50 && r.peds <= 92 && r.asleep > r.peds / 3, { peds: r.peds, asleep: r.asleep });
    check('warm pooled light inside the store, off outside', r.inStore > 1 && r.outside === 0, { inStore: r.inStore, outside: r.outside });
    check('optional automatic day/night cycle reaches night', r.cycDusk > 0.95, { dusk: r.cycDusk });
    check('still exactly ONE shadow-casting light', r.lights === 1, { lights: r.lights });
    check('no page errors (vibe)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 5.1 step 1: car damage
  if (run('damage')) {
    await load();
    await fresh();
    const crash = (speed, angle = 0) => ev(async ({ speed, angle }) => {
      const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      if (g.controls.mode === 'drive') g.controls.respawnAt(g.controls.car.position, 0);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen && c.type === 'sedan')); await wait(1400);
      const c = g.controls.car; c.health = 100; c.dead = false; c.body.dead = false;
      for (const t of [...g.traffic.cars]) if (Math.hypot(t.pos.x - 553, t.pos.z + 80) < 30) g.traffic.removeCar(t);
      // Terrace Central's solid facade is at z = -94.3; start 12 m south of it facing north.
      const yaw = Math.PI + angle;
      c.body.teleport(553, g.world.terrain.getHeight(553, -82), -82, yaw);
      await wait(400);
      const e0 = c.crash?.events || 0, h0 = c.health;
      const v = { x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed };
      c.body.body.setLinvel(v, true); c.body.lastVel = { ...v }; // no fake 'impact' from the teleport kick
      await wait(2000);
      return { loss: +(h0 - c.health).toFixed(2), events: (c.crash?.events || 0) - e0, last: +(c.crash?.last || 0).toFixed(2) };
    }, { speed, angle });
    const head = await crash(25);
    check('head-on at 25 m/s into a wall costs 8-12 health', head.loss >= 8 && head.loss <= 12, head);
    check('one crash = one damage event', head.events === 1, head);
    const slow = await crash(10, 0.5);
    check('10 m/s scrape costs under 2', slow.loss < 2, slow);
    const unit = await ev(async () => { const m = await import('/src/combat/damageConfig.js'); return { v4: m.impactDamage(4), v25: m.impactDamage(25), top: m.impactDamage(60), pole: +m.propDamage({ carDamage: 20 }, 15).toFixed(2), car25: m.impactDamage(25, m.DAMAGE.carVsCar), police: m.DAMAGE.policeContact }; });
    check('damage curve: <5 m/s nothing, 25 m/s = 10, capped at 25, car-vs-car half, pole at 15 m/s ~3, police contact 2', unit.v4 === 0 && unit.v25 === 10 && unit.top === 25 && unit.car25 === 5 && unit.pole === 3 && unit.police === 2, unit);
    check('no page errors (damage)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 5.1 step 2: crimes need witnesses
  if (run('witness')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, C = g.crimes, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      // Isolated scene on Terrace Pde in front of Terrace Central's solid facade (z -94.3).
      const S = { x: 540, z: -88 };
      d.teleport(S.x - 2, S.z, 0);
      for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
      const saved = g.peds.peds.map((p) => ({ p, gone: p.gone }));
      for (const p of g.peds.peds) p.gone = true;
      const car = g.vehicles.cars.find((c) => !c.hero && !c.dead && !c.impounded && !c.stolen);
      car.body.teleport(S.x, g.world.terrain.getHeight(S.x, S.z), S.z, Math.PI / 2);
      await wait(500);
      const walker = g.peds.peds.find((p) => !p.home);
      const place = (p, x, z, yaw) => { p.gone = false; p.state = 'pause'; p.timer = 99; p.flee = 0; p.cower = 0; p.startled = 0; p.hp = 100; p.pos.set(x, g.world.terrain.getHeight(x, z), z); p.yaw = yaw; };
      const hide = (p) => { p.gone = true; };
      const run = async (setup, mid = null) => {
        g.wanted.clear(true); g.police.reset(); C.clear();
        setup();
        await wait(150);
        const n = C.report('theft', car.position);
        await wait(800);
        const early = g.wanted.heat;
        if (mid) mid();
        await wait(1400);
        return { witnesses: n, early, heat: g.wanted.heat, cops: g.police.cars.length };
      };
      const toCar = (x, z) => Math.atan2(S.x - x, S.z - z);
      const out = {};
      out.a = await run(() => {});
      out.aW = d.getWitnesses({ x: S.x, y: car.position.y, z: S.z });
      out.b = await run(() => place(walker, S.x + 13, S.z, toCar(S.x + 13, S.z)));
      out.c = await run(() => place(walker, S.x, -100, toCar(S.x, -100)));
      out.d = await run(() => place(walker, S.x + 13, S.z, toCar(S.x + 13, S.z) + Math.PI));
      out.e = await run(() => place(walker, S.x, S.z + 3, toCar(S.x, S.z + 3) + Math.PI));
      const cancelled0 = C.st.cancelled;
      out.f = await run(() => place(walker, S.x + 13, S.z, toCar(S.x + 13, S.z)), () => { walker.state = 'dead'; walker.downT = 0; });
      out.fCancelled = C.st.cancelled - cancelled0;
      hide(walker); walker.state = 'pause';
      const cop = g.peds.peds.find((p) => p.role === 'cop');
      out.g = await run(() => place(cop, S.x + 50, S.z + 1, toCar(S.x + 50, S.z + 1)));
      hide(cop);
      for (const s of saved) s.p.gone = s.gone;
      g.wanted.clear(true); g.police.reset();
      return out;
    });
    check('(a) nobody around: no heat, no cops', r.a.witnesses === 0 && r.a.heat === 0 && r.a.cops === 0 && r.aW.length === 0, { a: r.a, w: r.aW });
    check('(b) NPC 15 m away, facing, clear view: heat after ~1.5 s (not before)', r.b.witnesses >= 1 && r.b.early === 0 && r.b.heat === 25, r.b);
    check('(c) NPC behind a wall: nothing', r.c.witnesses === 0 && r.c.heat === 0, r.c);
    check('(d) NPC 15 m away facing away: nothing', r.d.witnesses === 0 && r.d.heat === 0, r.d);
    check('(e) NPC 3 m away facing away: counts', r.e.witnesses >= 1 && r.e.heat === 25, r.e);
    check('(f) witness killed during the delay: report cancelled', r.f.witnesses >= 1 && r.f.heat === 0 && r.fCancelled === 1, { f: r.f, cancelled: r.fCancelled });
    check('(g) cop 50 m away with line of sight: counts', r.g.witnesses >= 1 && r.g.heat === 25, r.g);
    check('no page errors (witness)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 5.1 step 4: full map + navigation
  if (run('map')) {
    await load();
    await fresh();
    const tab = () => page.keyboard.press('Tab');
    let m = await ev(() => ({ mode: window.__gta.mapUI.mode }));
    await tab(); await wait(200);
    const opened = await ev(async () => {
      const g = window.__gta, t0 = g.physics.world.timestep, p0 = g.controls.player.position.clone();
      const steps0 = g.renderer.info.render.frame;
      // Is the world paused? Hold W for a moment: the player must not move.
      g.controls.input.setVirtual('KeyW', true); await new Promise((q) => setTimeout(q, 500)); g.controls.input.setVirtual('KeyW', false);
      const moved = g.controls.player.position.distanceTo(p0);
      const ov = [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '30');
      return { mode: g.mapUI.mode, open: g.mapUI.open, locked: !!document.pointerLockElement, moved: +moved.toFixed(3), overlay: ov && getComputedStyle(ov).display !== 'none', t0, steps0 };
    });
    check('Tab: minimap -> full map (overlay, pointer lock released, world paused)', m.mode === 1 && opened.mode === 2 && opened.open && opened.overlay && !opened.locked && opened.moved < 0.01, { start: m, opened });
    // Click on the map at the screen position of a world point near the town centre.
    const target = { x: 505, z: -60 };
    const sp = await ev((t) => { const M = window.__gta.mapUI; M.st.scale = 2; M.st.cx = t.x + 20; M.st.cz = t.z + 10; M.draw(); const [sx, sy] = M.toScreen(t.x, t.z), r = M.st && document.querySelector('canvas[style*="100%"]').getBoundingClientRect(); return { x: r.left + sx, y: r.top + sy }; }, target);
    await page.mouse.click(sp.x, sp.y);
    await wait(200);
    const wp = await ev(() => ({ wp: window.__gta.nav.waypoint, route: window.__gta.nav.route.length, beacon: window.__gta.scene.getObjectByName('waypoint-beacon')?.visible }));
    const off = wp.wp ? Math.hypot(wp.wp.x - target.x, wp.wp.z - target.z) : 999;
    check('click sets a waypoint at the matching world spot (<10 m) with a route (map only, no beacon)', off < 10 && wp.route > 2 && !wp.beacon, { off: +off.toFixed(1), ...wp });
    // Wheel + pinch zoom the map, never the page.
    const z = await ev(() => {
      const M = window.__gta.mapUI, box = document.querySelector('canvas[style*="100%"]').parentElement, s0 = M.st.scale;
      const e1 = new WheelEvent('wheel', { deltaY: -200, cancelable: true, bubbles: true, clientX: 400, clientY: 300 }); box.dispatchEvent(e1);
      const e2 = new WheelEvent('wheel', { deltaY: -30, ctrlKey: true, cancelable: true, bubbles: true, clientX: 400, clientY: 300 }); box.dispatchEvent(e2);
      return { s0, s1: M.st.scale, prevented: e1.defaultPrevented && e2.defaultPrevented, scale: window.visualViewport ? window.visualViewport.scale : 1 };
    });
    check('wheel / pinch zoom the map, page zoom untouched', z.s1 !== z.s0 && z.prevented && z.scale === 1, z);
    // Drag pans.
    const c0 = await ev(() => ({ cx: window.__gta.mapUI.st.cx }));
    await page.mouse.move(500, 300); await page.mouse.down(); await page.mouse.move(400, 300, { steps: 5 }); await page.mouse.up();
    const c1 = await ev(() => ({ cx: window.__gta.mapUI.st.cx, wp: !!window.__gta.nav.waypoint, clicks: window.__gta.mapUI.st.clicks }));
    check('drag pans (and does not set a new waypoint)', c1.cx > c0.cx + 20 && c1.clicks === 1, { c0, c1 });
    // Persisted across reloads.
    const saved = await ev(() => JSON.parse(localStorage.getItem('gta-waypoint') || 'null'));
    check('waypoint saved to localStorage', saved && Math.abs(saved.x - wp.wp.x) < 0.01);
    // Right-click clears.
    await page.mouse.click(sp.x, sp.y, { button: 'right' });
    await wait(150);
    const cleared = await ev(() => ({ wp: window.__gta.nav.waypoint, route: window.__gta.nav.route.length }));
    check('right-click clears the waypoint', cleared.wp === null && cleared.route === 0, cleared);
    // Marker snap: click on the hospital marker.
    const hs = await ev(() => { const M = window.__gta.mapUI, pl = window.__gta.world.places.find((p) => p.kind === 'hospital'), [sx, sy] = M.toScreen(pl.x, pl.z), r = document.querySelector('canvas[style*="100%"]').getBoundingClientRect(); return { x: r.left + sx + 6, y: r.top + sy + 4, px: pl.x, pz: pl.z }; });
    await page.mouse.click(hs.x, hs.y); await wait(150);
    const snap = await ev(() => window.__gta.nav.waypoint);
    check('clicking a marker snaps the waypoint to that place', snap && Math.abs(snap.x - hs.px) < 0.01 && Math.abs(snap.z - hs.pz) < 0.01 && !!snap.label, snap);
    // Close (Tab -> hidden), the world runs again; Esc also closes.
    await tab(); await wait(300);
    const closed = await ev(async () => {
      const g = window.__gta, p0 = g.controls.player.position.clone();
      g.controls.input.setVirtual('KeyW', true); await new Promise((q) => setTimeout(q, 600)); g.controls.input.setVirtual('KeyW', false);
      return { mode: g.mapUI.mode, open: g.mapUI.open, moved: +g.controls.player.position.distanceTo(p0).toFixed(2), locked: g.controls.input.locked };
    });
    check('Tab again closes the map (hidden), the world resumes', closed.mode === 0 && !closed.open && closed.moved > 0.5 && !closed.locked, closed);
    await tab(); await tab(); await wait(150);
    await page.keyboard.press('Escape'); await wait(150);
    const esc = await ev(() => ({ open: window.__gta.mapUI.open, settings: [...document.querySelectorAll('div')].some((d) => /Settings/i.test(d.textContent || '') && getComputedStyle(d).display !== 'none' && d.children.length < 30 && d.offsetHeight > 0 && d.style.zIndex === '25') }));
    check('Esc closes the full map', !esc.open, esc);
    // Route recompute + arrival.
    const nav = await ev(async () => {
      const g = window.__gta, N = g.nav, d = g.debug;
      d.teleport(470, -92, 0);
      N.set(612, -60, null, g.controls.player.position);
      const len = N.route.length;
      d.teleport(470, 30, 0); N.st.checkT = 0; await new Promise((q) => setTimeout(q, 300));
      const rer = N.st.reroutes;
      d.teleport(612, -62, 0); await new Promise((q) => setTimeout(q, 300));
      return { len, rer, after: N.waypoint };
    });
    check('route re-computed when off the path; waypoint clears on arrival', nav.len > 2 && nav.rer >= 1 && nav.after === null, nav);
    check('no page errors (map)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 5.2 step 2: gun shop + POIs on the maps
  if (run('pois')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, W = g.world, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const door = W.town.interiors.doorAt.gunShop, gun = W.places.find((p) => p.kind === 'guns');
      const off = gun ? Math.hypot(gun.x - door.x, gun.z - door.z) : 999;
      // Standing next to the shop: on the minimap.
      g.mapUI.setMode(1); // minimap showing
      d.teleport(door.x + 3, door.z + 4, 0); await wait(600);
      const mm = g.minimap.markers.find((m) => m.kind === 'guns');
      // Full map at the default zoom, from the spawn side of the suburb too.
      if (g.mapUI.mode !== 1) g.mapUI.setMode(1);
      g.mapUI.setMode(2); await wait(200);
      const fm = g.mapUI.st.markers.find((m) => m.kind === 'guns');
      g.mapUI.setMode(1);
      d.teleport(0, 0, 0); await wait(300);
      g.mapUI.setMode(2); await wait(200);
      const fmFar = g.mapUI.st.markers.find((m) => m.kind === 'guns'), scale = g.mapUI.st.scale;
      // Clicking the marker snaps the waypoint to the shop.
      const cvs = document.querySelector('canvas[style*="100%"]').getBoundingClientRect();
      g.mapUI.clickAt(cvs.left + fmFar.x + 4, cvs.top + fmFar.y + 3);
      const wp = g.nav.waypoint;
      const legend = [...document.querySelectorAll('div')].some((el) => el.textContent.startsWith('LEGEND') && /Gun shop/.test(el.textContent));
      g.mapUI.setMode(1); g.nav.clear();
      const has = (pred) => W.places.some(pred);
      const pois = {
        house62: has((p) => p.kind === 'home'), police: has((p) => p.kind === 'police'), hospital: has((p) => p.kind === 'hospital'),
        departmentStore: has((p) => /Terrace Central/.test(p.label)), quickStop: has((p) => /Quick Stop/.test(p.label)), gunShop: has((p) => p.kind === 'guns'),
        parks: W.places.filter((p) => p.kind === 'park').length >= 2, beach: has((p) => p.kind === 'beach'), downtown: has((p) => /Terrace Tower|City Plaza/.test(p.label)),
        industrial: has((p) => p.kind === 'industry'), school: has((p) => p.kind === 'school'), shoppingCentre: has((p) => /Northgate Plaza/.test(p.label)),
      };
      return { off: +off.toFixed(2), label: gun?.label, mm, fm, fmFar, scale, wp, legend, pois };
    });
    check('gun shop marker at the real door (<5 m), labelled Barrel & Bolt', r.off < 5 && r.label === 'Barrel & Bolt', { off: r.off, label: r.label });
    check('gun shop marker on the minimap when standing next to it', r.mm && r.mm.inView, r.mm);
    check('gun shop marker on the full map at the default zoom (near + from the suburb)', r.fm?.inView && r.fmFar?.inView && r.scale === 0.6, { fm: r.fm, fmFar: r.fmFar, scale: r.scale });
    check('clicking the gun shop marker sets the waypoint to the shop', r.wp && /Barrel/.test(r.wp.label || ''), r.wp);
    check('full map legend lists the gun shop', r.legend);
    check('every POI has a marker (highway: none built)', Object.values(r.pois).every(Boolean), r.pois);
    check('no page errors (pois)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 5.3 step 2: hitting a cop = 5 stars
  if (run('copstars')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, W = g.weapons, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      // Empty industrial yard road, nobody around.
      const S = { x: 860, z: -470 };
      d.teleport(S.x, S.z, Math.PI / 2); await wait(300);
      for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
      const saved = g.peds.peds.map((p) => ({ p, gone: p.gone }));
      for (const p of g.peds.peds) p.gone = true;
      g.wanted.clear(true); g.police.reset(); g.crimes.clear(); g.crimes.st.forceWitness = false;
      const shootAt = (x, y, z, id = 'pistol') => W.debugShot({ x: x - 6, y, z }, { x: 1, y: 0, z: 0 }, id);
      const res = {};
      // (c) miss a lone cop: nothing.
      let o = g.police.foot.spawn(null, { x: S.x + 8, z: S.z }); o.state = 'hold';
      const missed = W.debugShot({ x: S.x + 2, y: o.pos.y + 1.2, z: S.z + 3 }, { x: 1, y: 0, z: 0 }, 'pistol');
      await wait(1800);
      res.miss = { kind: missed.kind, stars: g.wanted.stars };
      // (a) hit the lone cop: 5 stars at once, solid, full grace, police dispatched.
      g.police.foot.remove(o); o = g.police.foot.spawn(null, { x: S.x + 8, z: S.z }); o.state = 'hold';
      const hit = shootAt(o.pos.x, o.pos.y + 1.2, o.pos.z);
      const w0 = d.wanted();
      res.hit = { kind: hit.kind, stars: w0.stars, phase: w0.wantedPhase, grace: w0.graceRemaining, heat: g.wanted.heat };
      await wait(2500);
      res.hit.cops = g.police.cars.length;
      // (d) already at 2 stars -> 5.
      g.wanted.clear(true); g.police.reset(); g.wanted.add('test', 61);
      const two = g.wanted.stars;
      o = g.police.foot.spawn(null, { x: S.x + 8, z: S.z }); o.state = 'hold';
      shootAt(o.pos.x, o.pos.y + 1.2, o.pos.z);
      res.two = { before: two, after: g.wanted.stars };
      // (b) shoot (and kill) a civilian with no witnesses: no heat.
      g.wanted.clear(true); g.police.reset(); g.crimes.clear();
      const civ = g.peds.peds.find((p) => !p.home && p.role !== 'cop');
      civ.gone = false; civ.state = 'pause'; civ.timer = 99; civ.hp = 100; civ.pos.set(S.x + 8, g.world.terrain.getHeight(S.x + 8, S.z + 4), S.z + 4); civ.yaw = 0;
      await wait(200);
      for (let k = 0; k < 4 && civ.state !== 'dead'; k++) shootAt(civ.pos.x, civ.pos.y + 1.2, civ.pos.z, 'rifle');
      await wait(2000);
      res.civ = { dead: civ.state === 'dead', heat: g.wanted.heat, stars: g.wanted.stars };
      for (const s of saved) s.p.gone = s.gone;
      g.wanted.clear(true); g.police.reset();
      return res;
    });
    check('miss a cop: no stars', r.miss.kind !== 'officer' && r.miss.stars === 0, r.miss);
    check('hit a lone cop with nobody around: 5 stars at once, solid, 15 s grace', r.hit.kind === 'officer' && r.hit.stars === 5 && r.hit.phase === 'solid' && r.hit.grace === 15 && r.hit.heat >= 300, r.hit);
    check('police dispatched within the first seconds', r.hit.cops >= 1, r.hit);
    check('hit a cop at 2 stars: straight to 5', r.two.before === 2 && r.two.after === 5, r.two);
    check('shooting a civilian with no witness: still no heat', r.civ.dead && r.civ.heat === 0, r.civ);
    check('no page errors (copstars)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.1: property damage + speeding fines
  if (run('speeding')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, S = g.speeding, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
      g.wanted.clear(true); g.police.reset();
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen && c.type === 'sedan')); await wait(1400);
      const car = g.controls.car; car.health = 100; car.dead = false; car.body.dead = false;
      const at = async (kmh) => { car.body.teleport(400, g.world.terrain.getHeight(400, -215 - 2.2), -217.2, Math.PI / 2); await wait(300); const v = { x: kmh / 3.6, y: 0, z: 0 }; car.body.body.setLinvel(v, true); car.body.lastVel = { ...v }; await wait(120); };
      const out = {};
      g.wallet.set(1000);
      await at(100);
      const s1 = S.status(); out.status = { limit: s1.limit, street: s1.street, kmh: Math.round(s1.speedKmh), over: s1.over };
      const h0 = g.wanted.heat;
      out.fine = S.tryFine('test-cam', 'camera'); out.cash1 = g.wallet.cash;
      out.cool = S.tryFine('test-cam', 'camera');
      await at(68); out.atLimit = S.tryFine('test-cam-2', 'camera');
      await at(100); g.wanted.add('test', 25); out.wanted = S.tryFine('test-cam-3', 'camera'); g.wanted.clear(true); g.police.reset();
      await at(100); car.emergency = { on: true, update() {} }; out.siren = S.tryFine('test-cam-4', 'camera'); car.emergency = null;
      out.heatAfter = g.wanted.heat - h0;
      g.wallet.set(100); await at(100); S.tryFine('test-cam-5', 'camera'); out.floor = g.wallet.cash;
      out.hud = { ...g.limitHud.st };
      // Property damage: breaking street furniture and destroying a car (witnessed) -> no heat.
      g.crimes.st.forceWitness = true; g.wanted.clear(true);
      const it = g.breakables.sets.find((s) => s.name === 'streetLight').items.find((i) => !i.broken);
      g.breakables.breakItem(it, { x: 1, y: 0, z: 0, setY() { return this; }, normalize() { return this; } });
      g.combat.emit('propBroken', { item: it, byPlayer: true, x: it.x, z: it.z });
      const victim = g.vehicles.cars.find((c) => c !== car && !c.hero && !c.dead && !c.impounded);
      g.combat.damageCar(victim, 500);
      await wait(1800);
      out.property = { heat: g.wanted.heat, stars: g.wanted.stars, victimDead: !!victim.dead };
      g.crimes.st.forceWitness = false;
      g.controls.respawnAt(car.position, 0);
      return out;
    });
    check('limit + street known on the road (ring road = arterial 60)', r.status.limit === 60 && r.status.street === 'Ring Rd North' && r.status.over, r.status);
    check('caught over limit + 10: -$200 once, then cooldown', r.fine && r.cash1 === 800 && r.cool === false, r);
    check('no fine at limit + 10 or under', r.atLimit === false, r);
    check('no fine while wanted, none with the siren on', r.wanted === false && r.siren === false, r);
    check('speeding never adds heat; cash never below 0', r.heatAfter === 0 && r.floor === 0, r);
    check('HUD shows the limit sign + street chip while driving', r.hud.visible && r.hud.limit === 60 && r.hud.street === 'Ring Rd North', r.hud);
    check('breaking street furniture or destroying a car (even witnessed): no heat', r.property.heat === 0 && r.property.stars === 0 && r.property.victimDead, r.property);
    check('no page errors (speeding)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.2: map-only route, fade, labels, street names
  if (run('mapnav')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, N = g.nav, W = g.world, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const { ICON } = await import('/src/ui/mapIcons.js');
      // Streets: unique, non-empty names on every road.
      const names = W.network.allRoads.map((r) => r.street);
      const streets = { count: names.length, empty: names.filter((n) => !n).length, dupes: names.filter((n, i) => names.indexOf(n) !== i) };
      // POIs + legend.
      const kinds = [...new Set(W.places.map((p) => p.kind))];
      const unlabelled = W.places.filter((p) => !p.label).length, unknown = kinds.filter((k) => !ICON[k]);
      g.mapUI.setMode(1); d.teleport(470, -92, 0); await wait(300);
      g.mapUI.setMode(2); await wait(300);
      const legendKinds = [...document.querySelectorAll('[data-kind]')].map((e) => e.dataset.kind);
      const labels = g.mapUI.st.labels.length, inView = g.mapUI.st.markers.filter((m) => m.inView).length, streetNames = g.mapUI.st.streetNames.length;
      g.mapUI.setMode(1);
      // Route: map-only, fades/trims the driven part, clears on arrival.
      const beacon = !!g.scene.getObjectByName('waypoint-beacon');
      d.teleport(340, -92, Math.PI / 2); await wait(200);
      N.set(600, -60, null, g.controls.player.position);
      const len0 = N.route.length, route = N.route.slice();
      let i = 0; for (; i < route.length && N.progress < 150; i += 3) { d.teleport(route[i].x, route[i].z, 0); await wait(60); }
      const after = { progress: Math.round(N.progress), trimmed: N.st.trimmed || 0, len: N.route.length, cum0: Math.round(N.cum[0] || 0) };
      d.teleport(600, -62, 0); await wait(300);
      const arrived = N.waypoint === null && N.route.length === 0;
      return { streets, kinds, unlabelled, unknown, legendKinds, labels, inView, streetNames, beacon, len0, after, arrived, chip: [...document.querySelectorAll('div')].some((e) => /\d+ m$/.test(e.textContent || '') && e.style.border?.includes('ffcf4a')) };
    });
    check('every road has a unique, non-empty street name', r.streets.empty === 0 && r.streets.dupes.length === 0, r.streets);
    check('every POI type is in the icon registry and has a label', r.unknown.length === 0 && r.unlabelled === 0, { unknown: r.unknown, unlabelled: r.unlabelled });
    check('legend lists exactly the icon types in use', r.legendKinds.length === r.kinds.length && r.kinds.every((k) => r.legendKinds.includes(k)), { legend: r.legendKinds, kinds: r.kinds });
    check('full map: labels + street names drawn at the default zoom', r.labels >= Math.min(5, r.inView) && r.streetNames >= 3, { labels: r.labels, inView: r.inView, streetNames: r.streetNames });
    check('no world beacon / on-screen distance chip', !r.beacon && !r.chip, { beacon: r.beacon, chip: r.chip });
    check('route behind me fades and is removed', r.after.progress >= 100 && r.after.trimmed > 0 && r.after.len < r.len0, { len0: r.len0, ...r.after });
    check('route + pin clear on arrival', r.arrived);
    check('no page errors (mapnav)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.3: street signs
  if (run('signs')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, W = g.world, R = W.citySigns.registry, plan = W.town.plan, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      // Every grid junction (node where a N-S and an E-W street meet) has a blade with both names.
      const missing = [], wrong = [];
      for (const n of plan.nodes) {
        const b = R.blades.find((q) => Math.abs(q.x - n.x) < 0.5 && Math.abs(q.z - n.z) < 0.5);
        if (!b) { missing.push([n.x, n.z]); continue; }
        const names = W.network.allRoads.filter((rd) => rd.samples.some((s) => Math.hypot(s.x - n.x, s.z - n.z) < 1.2)).map((rd) => rd.street);
        if (!b.names.every((nm) => names.includes(nm)) || b.names[0] === b.names[1]) wrong.push({ at: [n.x, n.z], blade: b.names, roads: names });
      }
      // Every road has a speed-limit sign matching its configured limit.
      const roadsNoSign = W.network.allRoads.filter((rd) => !R.limits.some((l) => l.road === rd.street)).map((rd) => rd.street);
      const mismatch = R.limits.filter((l) => !l.change && !l.school && W.network.allRoads.find((rd) => rd.street === l.road)?.speedLimit !== l.limit);
      const downtownChange = R.limits.some((l) => l.change && l.limit === 40) && R.limits.some((l) => l.change && l.limit === 60);
      const school = R.limits.some((l) => l.school);
      const breakable = ['streetBlade', 'limitSign'].every((n) => g.breakables.sets.some((s) => s.name === n));
      g.debug.teleport(470, -92, 0); await wait(2500);
      return { nodes: plan.nodes.length, blades: R.blades.length, missing, wrong: wrong.slice(0, 5), roadsNoSign, mismatch: mismatch.slice(0, 5), limits: R.limits.length, downtownChange, school, breakable, calls: g.renderer.info.render.calls, fps: g.stats().fps };
    });
    check('every junction has a blade sign with its two street names', r.missing.length === 0 && r.wrong.length === 0, { nodes: r.nodes, blades: r.blades, missing: r.missing.slice(0, 5), wrong: r.wrong });
    check('every road has a speed-limit sign matching the config (+ downtown change, school zone)', r.roadsNoSign.length === 0 && r.mismatch.length === 0 && r.downtownChange && r.school, r);
    check('signs are breakable sets (no heat)', r.breakable);
    check('draw calls within budget (<550), fps >= 45', r.calls < 550 && r.fps >= 45, { calls: r.calls, fps: r.fps });
    check('no page errors (signs)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.4: the highway
  if (run('highway')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, T = g.world.terrain, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const H = await import('/src/city/highwayPlan.js');
      for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
      g.wanted.clear(true); g.police.reset();
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen && c.type === 'sedan')); await wait(1400);
      const car = g.controls.car; car.health = 100; car.dead = false; car.body.dead = false;
      const runs = {};
      const go = async (name, pts, speed = 60) => {
        car.health = 100; const d0 = g.combat.damageLog.length;
        g.controls.input.setVirtual('ShiftLeft', true);
        const res = await d.drivePoints(pts, { speed, timeout: 60 });
        g.controls.input.setVirtual('ShiftLeft', false);
        runs[name] = { ok: res.ok, reason: res.reason, maxKmh: res.maxSpeed, maxTilt: res.maxTilt, nan: res.nan, maxAbove: res.maxAbove, damage: g.combat.damageLog.slice(d0).filter((e) => !e.tag.startsWith('breakable:')).length, health: car.health };
      };
      const z = H.HWY.z, inner = H.HWY.median + H.HWY.lane / 2, outer = inner + H.HWY.lane;
      const along = (xa, xb, dz) => { const out = [], s = Math.sign(xb - xa); for (let x = xa; s > 0 ? x <= xb : x >= xb; x += 6 * s) out.push({ x, z: z + dz }); return out; };
      await go('eastbound (outer lane)', along(345, 955, -outer));
      await go('westbound (outer lane)', along(955, 345, outer));
      await go('west ramp: ring road -> motorway', [...d.lanePoints(330, -222, 330, -246), ...along(338, 520, -outer)], 30);
      await go('east ramp: motorway -> industrial', [...along(820, 962, -outer), ...d.lanePoints(970, -258, 970, -284)], 30);
      // On the deck: the car is up on the bridge, not down on the street.
      car.body.teleport(400, T.driveHeight(400, z - outer, 10), z - outer, Math.PI / 2); await wait(300);
      const v = { x: 20, y: 0, z: 0 }; car.body.body.setLinvel(v, true); car.body.lastVel = { ...v };
      let minY = 99; for (let k = 0; k < 150; k++) { await new Promise((q) => requestAnimationFrame(q)); if (Math.abs(car.position.x - 420) < 6) minY = Math.min(minY, car.position.y); }
      const deckY = H.HWY.deckY;
      g.controls.respawnAt(car.position, 0); await wait(200);
      // Traffic: a car on the motorway lane runs it end to end at ~90 km/h, on the decks.
      const L = g.traffic.graph.lanes.find((l) => l.road?.highway && !l.road.ramp && l.pts[0].x < l.pts[l.pts.length - 1].x);
      const tc = g.traffic.cars[0] || null;
      let traffic = null;
      if (L) {
        const { TrafficCar } = await import('/src/traffic/trafficCar.js');
        const { CAR_TYPES } = await import('/src/vehicles/carTypes.js');
        const t = new TrafficCar({ id: 'hw-test', type: 'sedan', cfg: CAR_TYPES.sedan, paint: '#888888', lane: L, s: 2, cruise: 12, physics: g.physics, scene: g.scene, wheels: g.traffic.cars[0]?.wheels || g.scene.getObjectByName('traffic-wheels'), wheelOffset: 0, terrain: T, rng: { next: () => 0.5, chance: () => false, range: (a) => a, int: (a) => a, pick: (a) => a[0], fork() { return this; } } });
        let maxV = 0, deckSeen = 0, laneChanges = 0, last = L; const t0 = performance.now();
        for (let k = 0; k < 60 * 40; k++) {
          t.update(1 / 60, { lanes: g.traffic.graph.lanes, obstacles: [], honk: () => {} });
          maxV = Math.max(maxV, t.v);
          if (Math.abs(t.pos.x - 420) < 5 || Math.abs(t.pos.x - 790) < 5) deckSeen = Math.max(deckSeen, t.pos.y);
          if (t.lane !== last) { laneChanges++; last = t.lane; }
          if (laneChanges >= 2) break;
        }
        traffic = { maxKmh: Math.round(maxV * 3.6), deckY: +deckSeen.toFixed(2), laneChanges, endX: Math.round(t.pos.x), ms: Math.round(performance.now() - t0) };
        g.scene.remove(t.group); t.body.setEnabled(false);
      }
      // Police routing onto the motorway.
      const P = g.police, from = P.nearestLanePoint(470, -217), to = P.nearestLanePoint(700, -254.2);
      const route = P.routeTo(from.lane, to.lane);
      const policeOk = route.length > 0 && g.traffic.graph.lanes[route[route.length - 1]].road?.highway === true;
      return { runs, minY: +minY.toFixed(2), deckY, traffic, policeOk, routeLen: route.length, limits: g.world.network.allRoads.filter((x) => x.highway).map((x) => [x.street, x.speedLimit]) };
    });
    for (const [k, v] of Object.entries(r.runs)) check(`highway ${k}: full throttle + boost, no damage, no flips`, !v.nan && v.damage === 0 && v.maxTilt < 25, v); // maxAbove is vs the ground under the bridges, not the deck
    check('the overpass carries the car over the street (stays on the deck)', r.minY > r.deckY - 0.8, { minY: r.minY, deckY: r.deckY });
    check('traffic runs the motorway at 80-100 km/h, over the decks, and on to the next lanes', r.traffic && r.traffic.maxKmh >= 80 && r.traffic.maxKmh <= 100 && r.traffic.deckY > r.deckY - 0.5 && r.traffic.laneChanges >= 2, r.traffic);
    check('police can route onto the motorway', r.policeOk, { len: r.routeLen });
    check('limits: motorway 100, ramps 80', r.limits.every(([n, l]) => (/Ramp/.test(n) ? l === 80 : l === 100)), r.limits);
    check('no page errors (highway)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.1 step 2: speeding = pull-over pursuit, then a fine
  if (run('pullover') || run('enforce')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, S = g.speeding, TC = g.trafficCops, PO = g.pullOver, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const frames = async (n, fn) => { for (let k = 0; k < n; k++) { fn?.(); await new Promise((q) => requestAnimationFrame(q)); } };
      for (const t of [...g.traffic.cars]) g.traffic.removeCar(t); // isolate the radar posts
      g.wanted.clear(true); g.police.reset(); g.wallet.set(5000);
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen && c.type === 'sedan')); await wait(1400);
      const car = g.controls.car; car.health = 100;
      const out = { cams: g.speedCams.cams.length, camPlaces: g.world.places.filter((p) => p.kind === 'camera').length, aheadSigns: g.world.network.cameraAheadSigns.length, radarPlaces: g.world.places.filter((p) => p.kind === 'radar').length };
      const hold = (vx, vz) => { const vv = car.body.body.linvel(); car.body.body.setLinvel({ x: vx, y: vv.y, z: vz }, true); car.body.lastVel = { x: vx, y: vv.y, z: vz }; };
      const radarAt = async (post, dist, side, speed = 35, ms = 300) => {
        const fx = Math.sin(post.yaw), fz = Math.cos(post.yaw), x = post.x + fx * dist + fz * side, z = post.z + fz * dist - fx * side;
        car.body.teleport(x, g.world.terrain.driveHeight(x, z, post.y + 3), z, post.yaw + Math.PI); await wait(200);
        await frames(Math.round(ms / 16), () => hold(-fx * speed, -fz * speed));
      };
      const P0 = TC.posts[0], h0 = g.wanted.heat;
      // 1. Speeding past a radar post with line of sight -> pursuit, no stars, no fine yet.
      const f0 = S.st.fines, c0 = g.wallet.cash;
      await radarAt(P0, 35, 8.5);
      out.start = { state: PO.st.state, stars: g.wanted.stars, fines: S.st.fines - f0, away: P0.away, catcher: PO.st.catcher?.id };
      // 2. Keep driving at 25 m/s along the motorway for 3 s: the cop follows, never faster than 0.95x, never rams.
      const fx = -Math.sin(P0.yaw), fz = -Math.cos(P0.yaw);
      PO.st.maxCopKmh = 0;
      await frames(180, () => hold(fx * 25, fz * 25));
      out.follow = { state: PO.st.state, maxCopKmh: +PO.st.maxCopKmh.toFixed(0), dist: +PO.st.dist.toFixed(1) };
      // 3. Stop: the cop pulls up behind, officer walks up, 3 s issuing, -$200 once, pursuit over.
      const t0 = performance.now(); let issued = null;
      while (performance.now() - t0 < 14000 && PO.st.state !== 'leaving' && PO.st.state !== 'idle') { hold(0, 0); if (PO.st.state === 'issuing' && issued === null) issued = +((performance.now() - t0) / 1000).toFixed(1); await new Promise((q) => requestAnimationFrame(q)); }
      out.stop = { issuedAfter: issued, state: PO.st.state, fines: S.st.fines - f0, cash: g.wallet.cash - c0, stars: g.wanted.stars, minGap: +PO.st.minGap.toFixed(1), officer: PO.officer.root.visible };
      await wait(PO.st.state === 'leaving' ? 9000 : 100);
      out.after = { state: PO.st.state, postBack: !P0.away };
      // 4. Drive off while it's issuing: pursuit resumes, no fine; then flee > 150 m: lost, no fine.
      const P1 = TC.posts[1], f1 = S.st.fines;
      await radarAt(P1, 30, 8.5, 0, 100); PO.start(P1.catcher); // detection itself is covered above
      const st1 = PO.st.state;
      let t1 = performance.now();
      while (performance.now() - t1 < 12000 && PO.st.state !== 'issuing') { hold(0, 0); await new Promise((q) => requestAnimationFrame(q)); }
      const issuing = PO.st.state === 'issuing';
      await wait(800);
      const g1 = { x: Math.sin(P1.yaw + Math.PI), z: Math.cos(P1.yaw + Math.PI) };
      await frames(40, () => hold(g1.x * 12, g1.z * 12));
      out.driveOff = { started: st1, issuing, state: PO.st.state, resumed: PO.st.resumed, fines: S.st.fines - f1 };
      const lost0 = PO.st.lost, p = car.position;
      car.body.teleport(p.x + g1.x * 220, g.world.terrain.getHeight(p.x + g1.x * 220, p.z + g1.z * 220), p.z + g1.z * 220, Math.atan2(g1.x, g1.z)); await wait(400);
      out.flee = { state: PO.st.state, lost: PO.st.lost - lost0, fines: S.st.fines - f1, stars: g.wanted.stars };
      // 5. Same post again within the cooldown: no pursuit.
      await frames(6, () => hold(g1.x * 35, g1.z * 35)); out.cooldown = S.cooling(P1.id) > 15 && PO.st.state === 'idle' ? 'idle' : `no cooldown (${S.cooling(P1.id)})`; // the post we just lost
      // 6. Wrong arc (driving away behind the officer), wanted, siren: no pursuit. Wanted mid-pursuit cancels.
      const P2 = TC.posts[2];
      await radarAt(P2, -25, 8.5, -35); out.behind = PO.st.state;
      g.wanted.add('test', 25); await radarAt(P2, 35, 8.5); out.wanted = PO.st.state; g.wanted.clear(true); g.police.reset();
      car.emergency = { on: true, update() {} }; await radarAt(P2, 35, 8.5); out.siren = PO.st.state; car.emergency = null;
      const cx0 = PO.st.cancelled;
      PO.start(TC.posts[3].catcher); const s3 = PO.st.state; g.wanted.add('test', 25); await wait(300);
      out.midWanted = { started: s3, state: PO.st.state, cancelled: PO.st.cancelled - cx0, postBack: !TC.posts[3].away };
      g.wanted.clear(true); g.police.reset();
      out.wall = TC.sees(540, -4.4, -81, Math.PI, { x: 540, y: -4.4, z: -110 }, false);
      out.clear = TC.sees(520, -4.4, -81, Math.PI / 2, { x: 550, y: -4.4, z: -86 }, false);
      out.heat = g.wanted.heat - h0;
      out.police = g.debug.damageEvents().filter((e) => /police|pullover/.test(e.tag)).length;
      g.controls.respawnAt(car.position, 0);
      return out;
    });
    check('cameras disabled: none spawned, no CAMERA AHEAD signs, no camera map icons (radar cops shown)', r.cams === 0 && r.camPlaces === 0 && r.aheadSigns === 0 && r.radarPlaces === 5, { cams: r.cams, camPlaces: r.camPlaces, aheadSigns: r.aheadSigns, radar: r.radarPlaces });
    check('speeding past a radar cop with line of sight -> pull-over pursuit, 0 stars, no fine yet', r.start.state === 'pursuit' && r.start.stars === 0 && r.start.fines === 0 && r.start.away, r.start);
    check('cop follows, never faster than 0.95x your speed (90 km/h -> <= 86)', r.follow.state === 'pursuit' && r.follow.maxCopKmh <= 87, r.follow);
    check('stop beside the cop -> officer walks up, -$200 once, pursuit ends, no stars', r.stop.issuedAfter !== null && r.stop.fines === 1 && r.stop.cash === -200 && r.stop.stars === 0, r.stop);
    check('the cop never rams (stays > 4 m away)', r.stop.minGap > 4 && r.police === 0, { minGap: r.stop.minGap, policeHits: r.police });
    check('after the fine the cop drives off and the post resets', r.after.state === 'idle' && r.after.postBack, r.after);
    check('drive off while it is issuing -> pursuit resumes, no fine', r.driveOff.started === 'pursuit' && r.driveOff.issuing && r.driveOff.state === 'pursuit' && r.driveOff.resumed >= 1 && r.driveOff.fines === 0, r.driveOff);
    check('flee (> 150 m) -> "lost the police", pursuit over, no fine, no stars', r.flee.state === 'idle' && r.flee.lost === 1 && r.flee.fines === 0 && r.flee.stars === 0, r.flee);
    check('same cop again within 20 s: no new pursuit', r.cooldown === 'idle', { cooldown: r.cooldown });
    check('out of the officer\'s arc / wanted / siren on: no pursuit', r.behind === 'idle' && r.wanted === 'idle' && r.siren === 'idle', { behind: r.behind, wanted: r.wanted, siren: r.siren });
    check('becoming wanted mid-pursuit cancels the pull-over', r.midWanted.started === 'pursuit' && r.midWanted.state === 'idle' && r.midWanted.cancelled === 1 && r.midWanted.postBack, r.midWanted);
    check('radar: behind a wall not seen, clear view seen', r.wall === false && r.clear === true, { wall: r.wall, clear: r.clear });
    check('never any heat from speeding', r.heat === 0, { heat: r.heat });
    check('no page errors (pullover)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.6a: kit shops (enterable + buy menus)
  if (run('shops')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, M = g.shopMenu, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const shops = g.world.town.shops, out = { n: shops.length, walk: [], places: 0 };
      // Walk in through every door to the counter.
      for (const s of shops) {
        const yaw = Math.atan2(s.centre.x - s.door.x, s.centre.z - s.door.z);
        d.teleport(s.door.x, s.door.z, yaw); await wait(350);
        await d.tap('KeyE'); await wait(700);
        const inner = { x: s.door.x + (s.centre.x - s.door.x) * 0.45, z: s.door.z + (s.centre.z - s.door.z) * 0.45 };
        await d.walkToWorld(inner.x, inner.z, 5000);
        const p = await d.walkToWorld(s.counter.x, s.counter.z, 5000);
        out.walk.push({ id: s.id, dist: +Math.hypot(p[0] - s.counter.x, p[2] - s.counter.z).toFixed(2) });
      }
      // Buy menu: food heals, chemist heals 50, full health refuses food, clothes change the outfit.
      const byKind = (k) => shops.find((s) => s.kind === k);
      const cafe = byKind('cafe');
      d.teleport(cafe.counter.x, cafe.counter.z, 0); await wait(400);
      out.prompt = d.state().prompt;
      await d.tap('KeyE'); await wait(200);
      out.opened = { open: M.open, locked: g.controls.input.locked, rows: document.querySelectorAll('.gta-panel button[data-i]').length };
      g.wallet.set(500); g.combat.setHp(40);
      const b1 = M.buy(2); out.food = { bought: b1, hp: g.combat.hp, cash: g.wallet.cash - 500 };
      g.combat.setHp(100); out.fullRefused = M.buy(0) === false && g.wallet.cash === 480;
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true })); await wait(200);
      out.closed = !M.open && !g.controls.input.locked;
      M.openMenu(byKind('chemist')); g.combat.setHp(30); const c0 = g.wallet.cash;
      M.buy(0); out.chemist = { hp: g.combat.hp, cash: g.wallet.cash - c0 }; M.close(); await wait(50);
      M.openMenu(byKind('fashion')); const geo0 = g.controls.player.character.mesh.geometry, c1 = g.wallet.cash;
      const b2 = M.buy(0); out.clothes = { bought: b2, cash: g.wallet.cash - c1, changed: g.controls.player.character.mesh.geometry !== geo0, again: M.buy(0) };
      M.close(); g.wallet.set(5); M.openMenu(byKind('pizza')); g.combat.setHp(50); out.broke = M.buy(0) === false && g.combat.hp < 51; M.close();
      out.places = g.world.places.filter((p) => ['food', 'chemist', 'clothes'].includes(p.kind)).length;
      out.prices = shops.every((s) => s.menu.every((it) => (it.hp && !it.outfit ? (s.kind === 'chemist' || (it.price >= 8 && it.price <= 20 && it.hp >= 10 && it.hp <= 25)) : it.price > 0)));
      d.teleport(640, -60, 0); await wait(600);
      out.calls = g.renderer.info.render.calls;
      return out;
    });
    const far = r.walk.filter((w) => !(w.dist < 1.3));
    check('13 enterable kit shops (7 Terrace Pde + 6 downtown)', r.n >= 12, { n: r.n });
    check('every shop: walk in through the door to the counter', far.length === 0, far.length ? far : r.walk.length);
    check('counter prompt + E opens the menu (input paused)', /Press E to shop/.test(r.prompt || '') && r.opened.open && r.opened.locked && r.opened.rows >= 2, { prompt: r.prompt, ...r.opened });
    check('food: -$20, +25 health; refused at full health; Esc closes', r.food.bought && r.food.hp >= 65 && r.food.hp < 67 && r.food.cash === -20 && r.fullRefused && r.closed, { food: r.food, full: r.fullRefused, closed: r.closed });
    check('chemist first aid: -$40, +50 health', r.chemist.hp >= 80 && r.chemist.hp < 82 && r.chemist.cash === -40, r.chemist);
    check('clothes: -$60 new outfit colour (no re-buy of what you wear)', r.clothes.bought && r.clothes.cash === -60 && r.clothes.changed && r.clothes.again === false, r.clothes);
    check('not enough cash: refused', r.broke);
    check('menus priced to spec (food $8-20 / +10..25)', r.prices);
    check('shops on the map (food / chemist / clothes icons)', r.places >= 12, { places: r.places });
    check('draw calls downtown < 550', r.calls < 550, { calls: r.calls });
    check('no page errors (shops)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.6b: traffic lights + landmarks
  if (run('city')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, L = g.traffic.lights, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const out = { st: L.st };
      // Cycle sanity: never both axes green; an all-red gap exists.
      let both = 0, allRed = 0;
      const sig = (t, a) => { L.setTime(t); return L.junctions[0][a]; };
      for (let t = 0; t < 33; t += 0.25) { const e = sig(t, 'ew'), n = L.junctions[0].ns; if (e === 'green' && n === 'green') both++; if (e === 'red' && n === 'red') allRed++; }
      out.both = both; out.allRed = allRed;
      // AI obeys: one car on an east-west approach, others parked out of the way.
      const j = L.junctions[2];
      const lane = g.traffic.graph.lanes.find((l) => l.signal && l.signal.j === j && l.signal.axis === 'ew');
      const car = g.traffic.cars.find((c) => !c.trafficCop);
      for (const c of [...g.traffic.cars]) if (c !== car) g.traffic.removeCar(c);
      L.setTime(14 + 3 + 1.5 + 1 - j.offset); // cross street green -> Pde red
      car.lane = lane; car.s = lane.len - 32; car.v = 9;
      await wait(7000);
      out.red = { light: j.ew, sameLane: car.lane === lane, toLine: +(lane.len - car.s).toFixed(2), v: +car.v.toFixed(2), atRed: car.atRed };
      L.setTime(-j.offset + 0.2); // Pde green
      await wait(5000);
      out.green = { light: j.ew, moved: car.lane !== lane, v: +car.v.toFixed(2) };
      // Lamp colours follow the phase.
      const head = j.heads.find((h) => h.axis === 'ew'), c = new (g.scene.children[0].color?.constructor || Object)();
      const col = (i) => { const a = L.lampMesh.instanceColor.array; return [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]].map((v) => +v.toFixed(2)); };
      out.lamp = { green: col(head.lamps[2]), red: col(head.lamps[0]) };
      void c;
      // Landmarks.
      out.places = g.world.places.filter((p) => ['City Hall', 'Terrace Stadium', 'TV Tower'].includes(p.label)).length;
      const R = g.physics.RAPIER, W = g.physics.world;
      const ray = (x, y, z, dx, dz, len) => { const h = W.castRay(new R.Ray({ x, y, z }, { x: dx, y: 0, z: dz }), len, true); return h ? +h.timeOfImpact.toFixed(2) : null; };
      out.hallWall = ray(522, -2.5, -26, 1, 0, 30);     // from Station St east into City Hall
      out.stadiumWall = ray(450, 0, 60, 0, 1, 40) ;     // from The Esplanade south: gate is open on the town side
      out.stadiumSide = ray(380, -2, 112, 1, 0, 40);    // from the west into the stands
      out.tvShaft = ray(420, g.world.terrain.getHeight(440, 232) + 5, 232, 1, 0, 40);
      const now = new Date(), m = now.getMinutes() + now.getSeconds() / 60;
      out.clock = { faces: g.landmarks.clock.faces, dMin: +Math.abs(g.landmarks.clock.minute - m).toFixed(2) };
      out.pad = [g.world.terrain.getHeight(420, 100), g.world.terrain.getHeight(480, 125)].map((v) => +v.toFixed(2));
      // Perf at two viewpoints (walker downtown, then aerial over the stadium / city).
      g.debug.teleport(700, -95, 0); await wait(1200);
      let f0 = g.renderer.info.render.frame, t0 = performance.now(); await wait(2000);
      out.fpsStreet = Math.round((g.renderer.info.render.frame - f0) / ((performance.now() - t0) / 1000)); out.callsStreet = g.renderer.info.render.calls;
      return out;
    });
    check('6 signalised junctions on Terrace Pde, 24 approaches with lights', r.st.junctions === 6 && r.st.approaches === 24 && r.st.heads === 24, r.st);
    check('signal cycle: never both green, all-red clearance exists', r.both === 0 && r.allRed > 0, { both: r.both, allRed: r.allRed });
    check('AI car stops at the stop line on red', r.red.light === 'red' && r.red.sameLane && r.red.toLine > -0.3 && r.red.toLine < 6 && r.red.v < 0.3, r.red);
    check('AI car goes on green', r.green.light === 'green' && r.green.moved, r.green);
    check('lamps show the phase (green lit, red dark on green)', r.lamp.green[1] > 0.8 && r.lamp.red[0] < 0.3, r.lamp);
    check('3 landmarks on the map (City Hall, Terrace Stadium, TV Tower)', r.places === 3, { places: r.places });
    check('landmarks are solid (City Hall wall, stadium stands, TV shaft), stadium gate open', r.hallWall !== null && r.hallWall < 12 && r.stadiumSide !== null && r.tvShaft !== null && (r.stadiumWall === null || r.stadiumWall > 30), r);
    check('City Hall clock shows the real time (4 faces)', r.clock.faces === 4 && r.clock.dMin < 1, r.clock);
    check('stadium sits on a flat graded pad', Math.abs(r.pad[0] - r.pad[1]) < 0.05, r.pad);
    check('downtown street: draw calls < 550, fps >= 45', r.callsStreet < 550 && r.fpsStreet >= 45, { calls: r.callsStreet, fps: r.fpsStreet });
    check('no page errors (city)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.6c: NPC activities + buses / taxis / vans
  if (run('life')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, S = g.traffic.service, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const P = g.peds.peds, out = { peds: P.length, acts: {} };
      for (const p of P) if (p.home?.action) out.acts[p.home.action] = (out.acts[p.home.action] || 0) + 1;
      out.stopWaiters = P.filter((p) => p.home && (g.world.town.stops || []).some((s) => Math.hypot(s.x + 2.2 - p.home.x, s.z - p.home.z) < 0.1)).length;
      out.stops = (g.world.town.stops || []).length;
      // Buses keep to their loop and pull up at stops; 35 s sample.
      const offLoop = (x, z) => Math.min(Math.abs(z + 85) + Math.max(0, 330 - x, x - 970), Math.abs(x - 970) + Math.max(0, -85 - z, z - 45), Math.abs(z - 45) + Math.max(0, 330 - x, x - 970), Math.abs(x - 330) + Math.max(0, -85 - z, z - 45));
      let worst = 0, dwellSeen = 0; const s0 = S.buses.map((b) => b.stops);
      for (let k = 0; k < 70; k++) { await wait(500); for (const b of S.buses) { worst = Math.max(worst, offLoop(b.pos.x, b.pos.z)); if (b.dwell > 0 && b.v < 0.3) dwellSeen++; } }
      out.bus = { n: S.buses.length, worst: +worst.toFixed(1), stopsMade: S.buses.map((b, i) => b.stops - s0[i]), dwellSeen };
      out.taxis = S.taxis.map((t) => ({ paint: t.paint, jack: !t.noJack && !t.isPolice }));
      out.vans = S.vans.length;
      out.busJack = S.buses.every((b) => b.noJack) && S.vans.every((v) => v.noJack);
      out.moving = [...S.taxis, ...S.vans].filter((t) => t.v > 0.5 || t.atRed).length;
      g.debug.teleport(745, -95, 0); await wait(1500);
      const f0 = g.renderer.info.render.frame, t0 = performance.now(); await wait(2000);
      out.fps = Math.round((g.renderer.info.render.frame - f0) / ((performance.now() - t0) / 1000)); out.calls = g.renderer.info.render.calls;
      return out;
    });
    check('NPC population ~90 (80-92)', r.peds >= 80 && r.peds <= 92, { peds: r.peds });
    check('new activities: dancers, phone calls, waving, window shoppers', (r.acts.dance || 0) >= 2 && (r.acts.phone || 0) >= 5 && (r.acts.wave || 0) >= 1 && (r.acts.look || 0) >= 8, r.acts);
    check('someone waiting at every bus stop', r.stops > 0 && r.stopWaiters === r.stops, { stops: r.stops, waiters: r.stopWaiters });
    check('2 buses stay on their loop (Pde -> Ring Rd East -> Esplanade -> Ring Rd West)', r.bus.n === 2 && r.bus.worst < 12, r.bus);
    check('buses pull up at stops (dwell)', r.bus.stopsMade.some((n) => n >= 1) && r.bus.dwellSeen > 0, r.bus);
    check('3 yellow taxis (carjackable) + 2 delivery vans; buses / vans not carjackable', r.taxis.length === 3 && r.taxis.every((t) => t.paint === '#f2c41a' && t.jack) && r.vans === 2 && r.busJack, { taxis: r.taxis, vans: r.vans, busJack: r.busJack });
    check('taxis / vans are driving', r.moving >= 3, { moving: r.moving });
    check('City Plaza with crowds: draw calls < 550, fps >= 45', r.calls < 550 && r.fps >= 45, { calls: r.calls, fps: r.fps });
    check('no page errors (life)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.6d: vibe (crowd murmur, glowing signs)
  if (run('vibe6')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const { zoneLevels } = await import('/src/audio/ambience.js');
      const out = { plaza: zoneLevels({ x: 745, z: -20 }).crowd, pde: zoneLevels({ x: 500, z: -85 }).crowd, suburb: zoneLevels({ x: 0, z: 0 }).crowd, gate: zoneLevels({ x: 450, z: 72 }).crowd };
      g.debug.teleport(745, -20, 0); await wait(5000);
      out.live = +g.ambience.levels.crowd.toFixed(2);
      const kit = g.world.town.interiors && g.world.town.shops ? g.world.town : null;
      g.lighting.setDusk(0); await wait(300); const day = [kit?.kitAtlas?.mat?.emissiveIntensity, g.landmarks.atlas.mat.emissiveIntensity];
      g.lighting.setDusk(1); await wait(300); const night = [kit?.kitAtlas?.mat?.emissiveIntensity, g.landmarks.atlas.mat.emissiveIntensity];
      g.lighting.setDusk(0);
      out.glow = { day, night };
      return out;
    });
    check('crowd murmur on busy streets (plaza / Pde / stadium gate), silent in the suburb', r.plaza > 0.9 && r.pde > 0.5 && r.gate > 0.5 && r.suburb === 0 && r.live > 0.5, r);
    check('shop signs + billboards glow at dusk', r.glow.night[1] > r.glow.day[1] + 0.8 && (r.glow.night[0] === undefined || r.glow.night[0] > r.glow.day[0] + 0.8), r.glow);
    check('no page errors (vibe6)', errors.length === 0, errors.slice(0, 3));
  }
  // ------------------------------------------------------------ 6.1 step 3: airport + autonomous aircraft
  if (run('airport')) {
    await load();
    await fresh();
    const r = await ev(async () => {
      const g = window.__gta, d = g.debug, A = g.airport, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const out = {};
      // Sim-time fast-forward (0.1 s steps) with the player far away in town.
      d.teleport(470, -60, 0); await wait(300);
      const visited = {}, moved = {};
      let stuck = 0, nan = 0, multiBook = 0;
      const ff = (secs, onStep) => {
        for (let t = 0; t < secs; t += 0.1) {
          A.update(0.1);
          for (const p of A.planes) {
            (visited[p.id] ||= new Set()).add(p.state);
            if (!Number.isFinite(p.pos.x + p.pos.z + p.alt)) nan++;
            const m = moved[p.id] ||= { s: -1, st: '', t: 0 };
            if (p.s !== m.s || p.state !== m.st) { m.s = p.s; m.st = p.state; m.t = 0; } else if (!['parked', 'hold'].includes(p.state)) { m.t += 0.1; if (m.t > 60) stuck++; }
          }
          const ids = A.gates.map((x) => x.by).filter(Boolean); if (new Set(ids).size !== ids.length) multiBook++;
          onStep?.(t);
        }
      };
      const t0 = A.st.t;
      ff(420);
      const states = Object.values(visited);
      out.ops = { simT: +(A.st.t - t0).toFixed(0), departures: A.st.departures, airborne: A.st.airborne, arrivals: A.st.arrivals, parkedIn: A.st.parkedIn, chirps: A.st.chirps, nan: nan + A.st.nan, stuck, doubleBook: A.st.doubleBook + multiBook, fullDeparture: states.some((s) => ['pushback', 'taxiOut', 'hold', 'lineup', 'takeoff'].every((k) => s.has(k))), fullArrival: states.some((s) => ['final', 'rollout', 'taxiIn', 'parked'].every((k) => s.has(k))), active: A.planes.length };
      // Runway blocked by the player (on foot on the centre line): departures hold, arrivals go around.
      d.teleport(500, -705, 0); await wait(300);
      const ga0 = A.st.goArounds; let lined = 0, held = 0; const already = new Set(A.planes.filter((p) => p.state === 'lineup' || p.state === 'takeoff').map((p) => p.id));
      if (!A.planes.some((p) => p.state === 'final')) A.spawnArrival(2000);
      ff(160, () => { for (const p of A.planes) { if (already.has(p.id)) continue; if (p.state === 'lineup' || (p.state === 'takeoff' && p.alt < 3)) lined++; if (p.state === 'hold') held++; } });
      out.blocked = { busy: A.runwayBusy(true), lined, held: held > 0, goArounds: A.st.goArounds - ga0 };
      d.teleport(470, -60, 0); await wait(300);
      const tk0 = A.st.airborne; ff(150);
      out.cleared = { airborne: A.st.airborne - tk0 };
      // Taxiing aircraft brake for the player: stand on the taxiway in front of a taxiing plane.
      let braked = 0, hit = 0, target = null;
      for (let t = 0; t < 300 && !target; t += 0.1) { A.update(0.1); target = A.planes.find((q) => q.state === 'taxiOut' && Math.abs(q.pos.z + 645) < 1 && q.v > 4 && q.pos.x < 800); }
      if (target) {
        out.brakeSetup = true; const tr = { x: Math.sin(target.yaw), z: Math.cos(target.yaw) };
        d.teleport(target.pos.x + tr.x * (target.cfg.L / 2 + 22), target.pos.z + tr.z * (target.cfg.L / 2 + 22), 0);
        for (let k = 0; k < 480; k++) { await new Promise((q) => requestAnimationFrame(q)); const f = g.controls.player.position, dd = Math.hypot(target.pos.x - f.x, target.pos.z - f.z); if (target.v < 0.2 && dd < target.cfg.L / 2 + 25) braked++; if (dd < target.cfg.L / 2 - 1) hit++; }
      }
      out.brake = { setup: !!out.brakeSetup, braked: braked > 0, hit };
      d.teleport(470, -60, 0); await wait(300);
      // Colliders: ground aircraft solid, airborne none; no boarding prompt.
      out.colliders = A.planes.map((p) => ({ ground: p.alt < 3, on: p.m.rb.isEnabled() })).every((c) => c.ground === c.on);
      const parked = A.planes.find((p) => p.state === 'parked');
      if (parked) { d.teleport(parked.pos.x + 4, parked.pos.z + 3, 0); await wait(500); out.prompt = d.state().prompt || ''; }
      // Road links: a motorway lane reaches Terminal Dr through the lane graph (AI traffic + police routing).
      const lanes = g.traffic.graph.lanes, start = lanes.find((l) => l.road?.highway && !l.road.ramp), goal = (l) => l.pts.some((p) => Math.abs(p.z + 540) < 3 && p.x > 380 && p.x < 580);
      const seen = new Set([start.id]), q = [start]; let found = false;
      while (q.length) { const l = q.shift(); if (goal(l)) { found = true; break; } for (const e of [...(l.exits || []), ...(l.branches || [])]) { const n = lanes[e.lane]; if (n && !seen.has(n.id)) { seen.add(n.id); q.push(n); } } }
      out.route = found;
      // Drive in and out (Airport Rd -> Terminal Dr -> Airport Link) with zero damage events.
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && c.type === 'sedan')); await wait(1200);
      const car = g.controls.car; car.health = 100;
      for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
      car.body.teleport(332.2, -4.3, -478, Math.PI); await wait(600);
      const dmg0 = g.combat.damageLog.length;
      const pts = [...d.lanePoints(330, -478, 330, -540), ...d.lanePoints(330, -540, 620, -540), ...d.lanePoints(620, -540, 620, -478)];
      const res = await d.drivePoints(pts, { speed: 15, timeout: 80 });
      out.drive = { ok: res.ok, reason: res.reason, dist: res.dist, damage: g.combat.damageLog.slice(dmg0).map((e) => e.tag) };
      out.limit = g.speeding.status()?.limit;
      g.controls.respawnAt(car.position, 0);
      // Perf: walker at the terminal, then the airport from the apron.
      d.teleport(520, -545, Math.PI); await wait(1500);
      const f0 = g.renderer.info.render.frame, tt = performance.now(); await wait(2000);
      out.perf = { fps: Math.round((g.renderer.info.render.frame - f0) / ((performance.now() - tt) / 1000)), calls: g.renderer.info.render.calls, lights: g.world.town.airport.lights.count, places: g.world.places.filter((p) => p.kind === 'airport').length, streets: g.world.network.allRoads.filter((x) => x.airport).map((x) => `${x.street}:${x.speedLimit}`) };
      return out;
    });
    check('aircraft loop: a full departure (pushback -> taxi -> hold -> lineup -> takeoff -> airborne) and a full arrival (final -> rollout -> taxi -> parked), no NaN, nothing stuck', r.ops.fullDeparture && r.ops.fullArrival && r.ops.airborne >= 1 && r.ops.parkedIn >= 1 && r.ops.nan === 0 && r.ops.stuck === 0, r.ops);
    check('gates never double-booked', r.ops.doubleBook === 0, { doubleBook: r.ops.doubleBook });
    check('runway blocked by the player: departures hold, arrivals go around', r.blocked.busy === 'player' && r.blocked.lined === 0 && (r.blocked.held || r.blocked.goArounds >= 1) && r.blocked.goArounds >= 1, r.blocked);
    check('runway clear again: departures resume', r.cleared.airborne >= 1, r.cleared);
    check('taxiing aircraft brake for the player (never run them over)', r.brake.setup && r.brake.braked && r.brake.hit === 0, r.brake);
    check('ground aircraft solid, airborne ones have no collider; no boarding prompt', r.colliders && !/board/i.test(r.prompt || ''), { colliders: r.colliders, prompt: r.prompt });
    check('airport roads connect to the motorway in the lane graph (AI traffic + police)', r.route);
    check('drive in and out of the airport roads: zero damage events, limit 60', r.drive.ok && r.drive.damage.length === 0 && r.limit === 60, { ...r.drive, limit: r.limit });
    check('Airport on the map, airport street names, limits 60', r.perf.places === 1 && r.perf.streets.length === 3 && r.perf.streets.every((s) => s.endsWith(':60')), r.perf);
    check('airport: draw calls < 600, fps >= 45', r.perf.calls < 600 && r.perf.fps >= 45, { calls: r.perf.calls, fps: r.perf.fps });
    check('no page errors (airport)', errors.length === 0, errors.slice(0, 3));
  }
} finally {
  await context.close();
  await browser.close();
}
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exit(1); }
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
