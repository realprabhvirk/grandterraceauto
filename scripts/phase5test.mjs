// Phase 5 test suite (numeric/state asserts only - no screenshots).
// Usage (dev server running): .\dev.cmd node scripts/phase5test.mjs [section ...]
//   sections: pov cabin zoom carhp burn stars push arrest ko steal parked guns copguns
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
        const x = 380 + types.indexOf(t) * 30; g.controls.car.body.teleport(x, g.world.terrain.getHeight(x, -87.2), -87.2, Math.PI / 2);
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
    const r = await ev(async () => {
      const g = window.__gta, W = g.wanted;
      // Unit: unseen 6 s -> flashing; seen again stops it; 5 s of flashing clears.
      W.clear(true); W.add('test', 70);
      W.update(5.9, { seen: false, nearest: 50 }); const a = W.searching;
      W.update(0.2, { seen: false, nearest: 50 }); const b = W.searching;
      W.update(0.1, { seen: true, nearest: 30 }); const c = W.searching;
      W.update(0.1, { seen: true, nearest: 130 }); const far = W.searching;
      for (let i = 0; i < 49; i++) W.update(0.1, { seen: false, nearest: 130 });
      const stillOn = W.stars;
      W.update(0.2, { seen: false, nearest: 130 });
      return { a, b, c, far, stillOn, after: W.stars };
    });
    check('no flashing before 6 s unseen', r.a === false, r);
    check('flashing after 6 s unseen', r.b === true, r);
    check('a cop seeing you stops the flashing', r.c === false, r);
    check('nearest cop >120 m -> flashing', r.far === true, r);
    check('5 s of flashing clears the level', r.stillOn > 0 && r.after === 0, r);
    // Live: wanted, cops spawn, player teleports far away -> stand down.
    const live = await ev(async () => {
      const g = window.__gta, d = g.debug;
      d.teleport(470, -92, 0);
      g.wanted.add('test', 70);
      await new Promise((q) => setTimeout(q, 3500));
      const cops = g.police.cars.length;
      d.teleport(20, 120, 0); // far away in the suburb
      const t0 = performance.now(); let flashT = null;
      while (g.wanted.stars && performance.now() - t0 < 15000) { if (g.wanted.searching && flashT === null) flashT = (performance.now() - t0) / 1000; await new Promise((q) => setTimeout(q, 100)); }
      return { cops, flashT, clearT: +((performance.now() - t0) / 1000).toFixed(1), stars: g.wanted.stars, modes: g.police.cars.map((c) => c.mode) };
    });
    check('live escape: flashing then cleared, cops stand down', live.stars === 0 && live.clearT < 9 && live.modes.every((m) => m === 'patrol'), live);
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
      d.placeCop(470, -110, 0);
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
      const h0 = g.wanted.heat;
      const b = W.debugShot(from(at(p, 'body')), { x: 1, y: 0, z: 0 }, 'pistol');
      const hpAfterBody = p.hp, heatShoot = g.wanted.heat - h0;
      p.state = 'pause'; p.flee = 0; p.cower = 0; await wait(50);
      const hd = W.debugShot(from(at(p, 'head')), { x: 1, y: 0, z: 0 }, 'pistol');
      const hpAfterHead = p.hp;
      const h1 = g.wanted.heat;
      p.state = 'pause'; p.flee = 0; p.cower = 0; await wait(50);
      if (p.state !== 'dead') W.debugShot(from(at(p, 'body')), { x: 1, y: 0, z: 0 }, 'rifle');
      const killed = p.state === 'dead', heatKill = g.wanted.heat - h1;
      const t0 = performance.now(); let fadeStart = null, goneAt = null;
      while (performance.now() - t0 < 8000) { if (p.fadeMat && fadeStart === null) fadeStart = (performance.now() - t0) / 1000; if (p.gone) { goneAt = (performance.now() - t0) / 1000; break; } await wait(50); }
      // Officer: shoot +100, kill +150.
      g.wanted.clear(true);
      // Shot in the same tick it appears (an officer with no car and no wanted level would walk off).
      const o = g.police.foot.spawn(null, { x: P.x + 6, z: P.z }); o.state = 'hold';
      const ot = { x: o.pos.x, y: o.pos.y + 1.2, z: o.pos.z };
      const c0 = g.wanted.heat;
      W.debugShot({ x: ot.x - 5, y: ot.y, z: ot.z }, { x: 1, y: 0, z: 0 }, 'pistol');
      const copShot = g.wanted.heat - c0, copHp = o.hp;
      for (let i = 0; i < 8 && o.state !== 'dead'; i++) W.debugShot({ x: ot.x - 5, y: ot.y, z: ot.z }, { x: 1, y: 0, z: 0 }, 'pistol');
      const copKill = g.wanted.heat - c0 - copShot;
      return { b, hd, hpAfterBody, hpAfterHead, heatShoot, killed, heatKill, fadeStart, goneAt, copShot, copHp, copDead: o.state === 'dead', copKill, hitMarkers: W.hud.state.hitMarkers };
    });
    check('body shot: body zone, 25 damage', hits.b?.zone === 'body' && hits.hpAfterBody === 75, hits);
    check('headshot: head zone, x2 damage', hits.hd?.zone === 'head' && hits.hd.dmg === 50 && hits.hpAfterHead === 25, hits);
    check('heat: shooting a civilian +50, killing +80', hits.heatShoot === 50 && hits.killed && hits.heatKill === 80, hits);
    check('shot ped goes down, fades after ~5 s, gone by ~6.5 s', hits.fadeStart > 4.3 && hits.fadeStart < 5.8 && hits.goneAt > 5.5 && hits.goneAt < 7.2, { fadeStart: hits.fadeStart, goneAt: hits.goneAt });
    check('cops: 150 hp, shooting +100, killing +150', hits.copHp === 125 && hits.copShot === 100 && hits.copDead && hits.copKill === 150, hits);
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
} finally {
  await context.close();
  await browser.close();
}
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exit(1); }
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
