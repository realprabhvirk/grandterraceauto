// Phase 5 test suite (numeric/state asserts only - no screenshots).
// Usage (dev server running): .\dev.cmd node scripts/phase5test.mjs [section ...]
//   sections: pov cabin zoom carhp burn stars push arrest ko steal parked
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
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && c.type === 'sedan')); await new Promise((q) => setTimeout(q, 1400));
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
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && c.type === 'sedan')); await new Promise((q) => setTimeout(q, 1400));
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
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && c.type === 'sedan')); await new Promise((q) => setTimeout(q, 1400));
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
      d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && c.type === 'sedan')); await new Promise((q) => setTimeout(q, 1400));
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
} finally {
  await context.close();
  await browser.close();
}
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exit(1); }
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
