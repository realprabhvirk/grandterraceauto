// Phase 4 test suite (numeric/state asserts only - no screenshots).
// Usage (dev server running): .\dev.cmd node scripts/phase4test.mjs [section ...]
//   sections: garage (default: all)
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
const load = async (q = '?cam=player') => {
  await page.goto(`http://127.0.0.1:5173/${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  await wait(600);
};

try {
  // ---------------------------------------------------------------- Step 1: garage
  if (run('garage')) {
    await load();
    await ev(() => window.__gta.debug.enter());
    await wait(1500);
    let s = await ev(() => window.__gta.debug.state());
    check('in-car prompt for the garage', /garage/i.test(s.prompt || ''), s.prompt);
    await ev(() => window.__gta.debug.tap('KeyE'));
    await wait(2600);
    const doors = await ev(() => window.__gta.debug.doors());
    check('E from the car opens the garage', doors.garage > 0.95, doors);
    // Reverse in until the car is well inside.
    await ev(async () => {
      const g = window.__gta, I = g.controls.input, t0 = performance.now();
      I.setVirtual('KeyS', true);
      while (performance.now() - t0 < 9000 && g.debug.heroCarLocal().z > 0.8) await new Promise((r) => requestAnimationFrame(r));
      I.setVirtual('KeyS', false);
    });
    await wait(1800);
    const carIn = await ev(() => window.__gta.debug.heroCarLocal());
    check('hero car reversed into the garage', carIn.x > 4.5 && carIn.x < 9.6 && carIn.z < 3 && carIn.z > -5, carIn);
    await ev(() => window.__gta.debug.tap('KeyF'));
    await wait(1400);
    const out = await ev(() => window.__gta.debug.heroLocal());
    s = await ev(() => window.__gta.debug.state());
    check('got out on foot inside the garage', s.mode === 'walk' && out.x > 3.95 && out.x < 10.15 && out.z > -5.95 && out.z < 4.95, out);
    // Open the internal door and walk through to the hall.
    await ev(() => window.__gta.debug.walkTo(4.6, 2.15));
    s = await ev(() => window.__gta.debug.state());
    check('prompt for the internal door', /open|close/i.test(s.prompt || ''), s.prompt);
    await ev(() => window.__gta.debug.tap('KeyE'));
    await wait(900);
    const hall = await ev(() => window.__gta.debug.walkTo(2.4, 2.15));
    await ev(() => window.__gta.debug.walkTo(1.5, 0.5));
    const inHall = await ev(() => window.__gta.debug.heroLocal());
    check('walked from the garage into the hall', inHall.x > 0.5 && inHall.x < 3.9 && inHall.z > -6 && inHall.z < 3.2, { hall, inHall });
    // Drive the car back out.
    await ev(() => window.__gta.debug.walkTo(4.6, 2.15));
    await ev(() => window.__gta.debug.walkTo(5.4, 0.5));
    s = await ev(() => window.__gta.debug.state());
    await ev(() => window.__gta.debug.tap('KeyF'));
    await wait(1500);
    await ev(async () => {
      const g = window.__gta, I = g.controls.input, t0 = performance.now();
      I.setVirtual('KeyW', true);
      while (performance.now() - t0 < 6000 && g.debug.heroCarLocal().z < 9) await new Promise((r) => requestAnimationFrame(r));
      I.setVirtual('KeyW', false); I.setVirtual('Space', true);
      await new Promise((r) => setTimeout(r, 1500));
      I.setVirtual('Space', false);
    });
    const carOut = await ev(() => window.__gta.debug.heroCarLocal());
    check('drove the hero car back out', carOut.z > 6, { prompt: s.prompt, carOut });
    // Exit on the driveway: must be a valid spot next to the car.
    await ev(() => window.__gta.debug.tap('KeyF'));
    await wait(1500);
    const dw = await ev(() => { const g = window.__gta, p = g.controls.player.position, c = g.vehicles.cars.find((v) => v.hero).position; return { mode: g.controls.mode, d: Math.hypot(p.x - c.x, p.z - c.z), dy: p.y - g.world.terrain.getHeight(p.x, p.z) }; });
    check('driveway exit next to the car', dw.mode === 'walk' && dw.d > 1 && dw.d < 4.5 && Math.abs(dw.dy) < 0.6, dw);
    // Exit on the street.
    await ev(async () => { const g = window.__gta; g.debug.enter(); await new Promise((r) => setTimeout(r, 1500)); const M = g.world.network.main.samples, clear = (s) => g.vehicles.cars.every((v) => v === g.controls.car || Math.hypot(v.position.x - s.x, v.position.z - s.z) > 12); let i = 200; while (i < M.length - 20 && !clear(M[i])) i += 4; const S = M[i]; g.controls.car.body.teleport(S.x - S.nx * 1.8, S.h, S.z - S.nz * 1.8, Math.atan2(S.tx, S.tz)); await new Promise((r) => setTimeout(r, 1200)); });
    await ev(() => window.__gta.debug.tap('KeyF'));
    await wait(1500);
    const st = await ev(() => { const g = window.__gta, p = g.controls.player.position, c = g.vehicles.cars.find((v) => v.hero).position; return { mode: g.controls.mode, d: Math.hypot(p.x - c.x, p.z - c.z), exit: g.controls.lastExit }; });
    check('street exit next to the car', st.mode === 'walk' && st.d > 1 && st.d < 4.5, st);
  }
  // ---------------------------------------------------------------- Step 2: cameras
  if (run('cameras')) {
    await load();
    const cam = () => ev(() => ({ m: window.__gta.debug.state().cameraMode, inside: window.__gta.debug.cameraInside(), w: window.__gta.debug.state().wheelAngle }));
    const seq = [];
    for (let i = 0; i < 2; i++) { await ev(() => window.__gta.debug.tap('KeyC')); await wait(500); seq.push(await cam()); }
    check('on foot: C cycles first -> third', seq.map((s) => s.m).join() === 'first,third', seq);
    check('on foot: camera never inside a collider', seq.every((s) => !s.inside), seq);
    // First person indoors (62's hall).
    await ev(() => window.__gta.debug.teleportLocal(1.5, 0.16, 0.5, Math.PI));
    await ev(() => window.__gta.debug.tap('KeyC')); await wait(500);
    const fpIn = await cam();
    check('first person works indoors', fpIn.m === 'first' && !fpIn.inside, fpIn);
    await ev(() => window.__gta.debug.tap('KeyC')); await wait(300);
    // In a car.
    await ev(() => window.__gta.debug.enter()); await wait(1500);
    const carSeq = [await cam()];
    for (let i = 0; i < 3; i++) { await ev(() => window.__gta.debug.tap('KeyC')); await wait(700); carSeq.push(await cam()); }
    check('in car: chase -> cabin -> cinematic -> chase', carSeq.map((s) => s.m).join() === 'chase,cabin,cinematic,chase', carSeq.map((s) => s.m));
    check('in car: camera never inside a collider', carSeq.every((s) => !s.inside), carSeq);
    await ev(() => window.__gta.debug.tap('KeyC')); await wait(500); // cabin
    await ev(() => { window.__gta.controls.input.setVirtual('KeyA', true); }); await wait(900);
    const left = await cam();
    await ev(() => { const I = window.__gta.controls.input; I.setVirtual('KeyA', false); I.setVirtual('KeyD', true); }); await wait(1400);
    const right = await cam();
    await ev(() => window.__gta.controls.input.setVirtual('KeyD', false));
    await wait(4000);
    const mir = await ev(() => ({ ...window.__gta.mirrors.state, stats: window.__gta.stats() }));
    check('cabin mirrors live (or auto-disabled to the fallback)', (mir.phase === 'run' && !mir.disabled && mir.stats.fps >= 40) || mir.disabled, { phase: mir.phase, disabled: mir.disabled, base: Math.round(mir.fpsBase), on: Math.round(mir.fpsOn), fps: mir.stats.fps, calls: mir.stats.calls });
    check('cabin steering wheel tracks steering', left.m === 'cabin' && left.w < -0.5 && right.w > 0.5, { left: left.w, right: right.w });
    // Cinematic: drive a bit and sample the director for 9 s.
    await ev(() => window.__gta.debug.tap('KeyC')); await wait(300);
    await ev(() => window.__gta.controls.input.setVirtual('KeyW', true));
    let bad = 0;
    const shots = new Set();
    for (let i = 0; i < 18; i++) { await wait(500); const s = await ev(() => ({ inside: window.__gta.debug.cameraInside(), shot: window.__gta.controls.cinematic.shot })); if (s.inside) bad++; shots.add(s.shot); }
    await ev(() => window.__gta.controls.input.setVirtual('KeyW', false));
    check('cinematic: shots change and never clip', bad === 0 && shots.size >= 2, { bad, shots: [...shots] });
  }
  // ---------------------------------------------------------------- Step 3: health / destruction
  if (run('combat')) {
    await load();
    await ev(() => window.__gta.debug.enter()); await wait(1500);
    // Ram a power pole at speed: line the car up 30 m before it on the verge.
    await ev(() => {
      const g = window.__gta, it = g.breakables.sets.find((s) => s.name === 'powerPole').items[3];
      const S = g.world.network.main.samples; let best = S[0], bd = 1e9;
      for (const s of S) { const d = Math.hypot(s.x - it.x, s.z - it.z); if (d < bd) { bd = d; best = s; } }
      const x = it.x - best.tx * 30, z = it.z - best.tz * 30;
      g.controls.car.body.teleport(x, g.world.terrain.getHeight(x, z), z, Math.atan2(best.tx, best.tz));
      window.__pole = it;
    });
    await wait(600);
    const before = await ev(() => window.__gta.debug.state());
    await ev(async () => {
      const g = window.__gta, I = g.controls.input, t0 = performance.now();
      I.setVirtual('KeyW', true); I.setVirtual('ShiftLeft', true);
      while (performance.now() - t0 < 6000 && !window.__pole.broken) await new Promise((r) => requestAnimationFrame(r));
      I.setVirtual('KeyW', false); I.setVirtual('ShiftLeft', false); I.setVirtual('KeyS', true);
      await new Promise((r) => setTimeout(r, 1500)); I.setVirtual('KeyS', false);
    });
    const after = await ev(() => ({ s: window.__gta.debug.state(), broken: window.__pole.broken }));
    check('ramming a power pole breaks it', after.broken, after.broken);
    check('car health dropped', after.s.carHealth < 100, { before: before.carHealth, after: after.s.carHealth });
    check('player health unchanged in a car (Phase 5: the car takes it all)', after.s.health >= before.health, { before: before.health, after: after.s.health });
    // Hit a pedestrian (stood still for the test).
    const hit = await ev(async () => {
      const g = window.__gta, p = g.peds.peds.find((q) => q.ch.root.visible && q.state !== 'down') || g.peds.peds[0];
      p.state = 'pause'; p.timer = 30; p.action = 'look';
      const car = g.controls.car, a = 0.7;
      const x = p.pos.x - Math.sin(a) * 18, z = p.pos.z - Math.cos(a) * 18;
      car.body.teleport(x, g.world.terrain.getHeight(x, z), z, a);
      await new Promise((r) => setTimeout(r, 500));
      const I = g.controls.input; I.setVirtual('KeyW', true);
      const t0 = performance.now();
      while (performance.now() - t0 < 5000 && p.state !== 'down') await new Promise((r) => requestAnimationFrame(r));
      I.setVirtual('KeyW', false); I.setVirtual('KeyS', true);
      const down = p.state === 'down', stats = g.peds.stats();
      await new Promise((r) => setTimeout(r, 1200)); I.setVirtual('KeyS', false);
      await new Promise((r) => setTimeout(r, 5200));
      return { down, fleeing: stats.fleeing, recovered: p.state !== 'down' };
    });
    check('pedestrian knocked down', hit.down, hit);
    check('pedestrian gets back up', hit.recovered, hit);
    // Knock-out -> hospital respawn, -$200.
    const ko = await ev(async () => {
      const g = window.__gta, cash0 = g.wallet.cash;
      if (g.controls.mode === 'drive') { g.controls.respawnAt(g.controls.car.position, 0); await new Promise((r) => setTimeout(r, 300)); }
      g.combat.damagePlayer(500, 'test');
      await new Promise((r) => setTimeout(r, 6000)); // Phase 5: 4.5 s KO cutscene
      const sp = g.spawns.hospital().position, p = g.controls.player.position;
      return { cash0, cash: g.wallet.cash, mode: g.controls.mode, d: +Math.hypot(p.x - sp.x, p.z - sp.z).toFixed(2), hp: g.combat.hp };
    });
    check('knocked out -> hospital respawn, -$200, full health', ko.cash === ko.cash0 - 200 && ko.mode === 'walk' && ko.d < 2 && ko.hp === 100, ko);
  }
  // ---------------------------------------------------------------- Step 4: theft / wanted / police
  if (run('police')) {
    await load();
    // Witnessed theft of a parked car: stand at its driver's door with a pedestrian watching.
    await ev(() => {
      const g = window.__gta, car = g.vehicles.cars.find((c) => !c.hero && !c.impounded);
      const lot = g.world.layout.hero;
      const c = car.position, yaw = car.body.yaw();
      const dx = -Math.cos(yaw) * (car.cfg.W / 2 + 0.7), dz = Math.sin(yaw) * (car.cfg.W / 2 + 0.7);
      g.controls.player.teleport({ x: c.x + dx, y: g.world.terrain.getHeight(c.x + dx, c.z + dz), z: c.z + dz }, yaw);
      const p = g.peds.peds[0];
      p.pos.set(c.x + Math.sin(yaw) * 10, g.world.terrain.getHeight(c.x + Math.sin(yaw) * 10, c.z + Math.cos(yaw) * 10), c.z + Math.cos(yaw) * 10);
      p.state = 'pause'; p.timer = 30;
      window.__theftCar = car; void lot;
    });
    await wait(700);
    const pre = await ev(() => window.__gta.debug.state());
    await ev(async () => { window.__gta.crimes.st.forceWitness = true; const I = window.__gta.controls.input; I.setVirtual('KeyF', true); await new Promise((r) => setTimeout(r, 1500)); I.setVirtual('KeyF', false); });
    await wait(1400);
    let s = await ev(() => window.__gta.debug.state());
    check('hold F breaks into a parked car', s.mode === 'drive' && s.stolen, { prompt: pre.prompt, mode: s.mode, stolen: s.stolen });
    check('witnessed theft -> wanted >= 1 star', s.stars >= 1, { stars: s.stars, heat: s.heat });
    await wait(7000);
    s = await ev(() => window.__gta.debug.state());
    check('police spawn and pursue', s.police.length >= 2 && s.police.some((p) => p.mode === 'route' || p.mode === 'chase'), s.police);
    // Busted: bring a cop right up to the stopped car.
    const bust = await ev(async () => {
      const g = window.__gta, cop = g.police.cars[0], p = g.controls.car.position, f = g.controls.car.body.forward();
      cop.pos.set(p.x + f.x * 7, p.y, p.z + f.z * 7); cop.mode = 'chase';
      const cash0 = g.wallet.cash, stolen = g.controls.car;
      // Phase 5: an officer gets out, pulls the player out, BUSTED cutscene (~5 s).
      const t0 = performance.now(); let seen = false;
      while (performance.now() - t0 < 20000) { if (g.cutscene.active) seen = true; else if (seen) break; await new Promise((r) => setTimeout(r, 100)); }
      await new Promise((r) => setTimeout(r, 300));
      const sp = g.spawns.police().position, q = g.controls.player.position;
      return { cash0, cash: g.wallet.cash, stars: g.wanted.stars, mode: g.controls.mode, d: +Math.hypot(q.x - sp.x, q.z - sp.z).toFixed(1), impounded: !!stolen.impounded };
    });
    check('busted: -$500, wanted cleared, at the station, car impounded', bust.cash === bust.cash0 - 500 && bust.stars === 0 && bust.mode === 'walk' && bust.d < 3 && bust.impounded, bust);
    // Escape: get wanted, go far away, fast-forward the search timer.
    const esc = await ev(async () => {
      const g = window.__gta;
      g.wanted.add('carjack'); g.wanted.add('pedHit');
      await new Promise((r) => setTimeout(r, 3000));
      const S = g.world.network.main.samples, far = S[S.length - 10];
      g.controls.player.teleport({ x: far.x, y: far.h, z: far.z }, 0);
      for (const c of g.police.cars) { c.pos.set(S[10].x, S[10].h, S[10].z); c.mode = 'route'; c.lane = g.traffic.graph.lanes[0]; c.s = 1; }
      const stars0 = g.wanted.stars;
      g.wanted.fastForward(60);
      await new Promise((r) => setTimeout(r, 1500));
      const searching = g.wanted.searching;
      await new Promise((r) => setTimeout(r, 11000));
      return { stars0, searching, stars: g.wanted.stars };
    });
    check('escape: stars flash then clear', esc.stars0 >= 1 && esc.searching && esc.stars === 0, esc);
    // Carjack a traffic car.
    const cj = await ev(async () => {
      const g = window.__gta, t = g.traffic.cars[0], n0 = g.traffic.cars.length;
      const yaw = Math.atan2(t.fwd.x, t.fwd.z), x = t.pos.x - Math.cos(yaw) * 2.2, z = t.pos.z + Math.sin(yaw) * 2.2;
      g.controls.player.teleport({ x, y: g.world.terrain.getHeight(x, z), z }, yaw);
      t.v = 0; t.cruise = 0.01;
      await new Promise((r) => setTimeout(r, 400));
      const prompt = g.debug.state().prompt;
      await g.debug.tap('KeyF');
      await new Promise((r) => setTimeout(r, 1500));
      const s = g.debug.state();
      return { prompt, mode: s.mode, stolen: s.stolen, stars: s.stars, trafficLeft: g.traffic.cars.length, trafficStart: n0 };
    });
    check('carjack: driver pulled out, you drive off, wanted up', cj.mode === 'drive' && cj.stolen && cj.stars >= 1 && cj.trafficLeft === cj.trafficStart - 1, cj);
  }
  // ---------------------------------------------------------------- Step 5: minimap
  if (run('minimap')) {
    await load();
    const mm = await ev(async () => {
      const g = window.__gta, cv = [...document.querySelectorAll('canvas')].find((c) => c.width === 190);
      await new Promise((r) => setTimeout(r, 400));
      const px = cv.getContext('2d').getImageData(95, 60, 1, 1).data;
      const v0 = g.minimap.visible;
      await g.debug.tap('Tab');
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' }));
      const v1 = g.minimap.visible; // Phase 5.1: Tab = minimap -> full map -> hidden -> minimap
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' }));
      return { drawn: px[3] > 0, v0, v1, v2: g.minimap.visible, places: g.world.places.map((p) => p.kind) };
    });
    check('minimap draws and Tab toggles it', mm.drawn && mm.v0 && !mm.v1 && mm.v2, mm);
    check('minimap has 62, police and hospital markers', ['home', 'police', 'hospital'].every((k) => mm.places.includes(k)), mm.places);
  }
  // ---------------------------------------------------------------- Step 6: Terrace Town Centre
  if (run('town')) {
    await load();
    const st = () => ev(() => window.__gta.debug.state());
    // Terrace Central: walk to the door, E to open, walk inside.
    await ev(() => window.__gta.debug.teleport(553, -89.5, Math.PI));
    await wait(700);
    await ev(() => window.__gta.debug.walkToWorld(553, -92.6));
    let s = await st();
    check('Terrace Central door prompt', /open/.test(s.prompt || ''), s.prompt);
    await ev(() => window.__gta.debug.tap('KeyE'));
    await wait(900);
    let p = await ev(() => window.__gta.debug.walkToWorld(553, -104));
    const tc = await ev(() => { const T = window.__gta.world.town; return { inside: T.interiors.chunks.length, vis: T.group.children.filter((c) => /inside/.test(c.name) && c.visible).length, people: T.interiors.people.length }; });
    check('walked inside Terrace Central', p[2] < -100 && tc.vis >= 1 && tc.people >= 6, { p, tc });
    // Quick Stop: in through the door, snack at the counter.
    await ev(() => window.__gta.debug.teleport(391.5, -80.5, 0));
    await wait(700);
    await ev(() => window.__gta.debug.walkToWorld(391.5, -77.6));
    await ev(() => window.__gta.debug.tap('KeyE'));
    await wait(900);
    await ev(() => window.__gta.debug.walkToWorld(391.5, -74.6));
    p = await ev(() => window.__gta.debug.walkToWorld(399.6, -74.1));
    const before = await ev(() => { window.__gta.combat.setHp(50); return { cash: window.__gta.wallet.cash }; });
    s = await st();
    check('Quick Stop counter prompt', /snack/.test(s.prompt || ''), { prompt: s.prompt, p });
    await ev(() => window.__gta.debug.tap('KeyE'));
    await wait(300);
    s = await st();
    check('snack: +25 health, -$20', s.health >= 75 && s.health < 76.5 && s.cash === before.cash - 20, { health: s.health, cash: s.cash, before });
    // Life in town.
    await wait(2500);
    const tw = await ev(() => window.__gta.debug.town());
    check('traffic + pedestrians in town', tw.traffic >= 2 && tw.peds >= 4, tw);
    // Busiest view: town centre on foot.
    await ev(() => window.__gta.debug.teleport(470, -92, 0));
    await wait(3500);
    const perf = await ev(() => ({ calls: window.__gta.renderer.info.render.calls, fps: window.__gta.stats().fps, tris: window.__gta.renderer.info.render.triangles }));
    check('town perf: draw calls < 450, fps >= 45', perf.calls < 450 && perf.fps >= 45, perf);
    // Respawn points: hospital (KO) and police station are in town.
    await ev(() => window.__gta.combat.damagePlayer(500, 'test'));
    await wait(6000);
    s = await st();
    const sp = await ev(() => ({ h: window.__gta.spawns.hospital().position, pol: window.__gta.spawns.police().position }));
    check('KO respawns at the town hospital', Math.hypot(s.player[0] - sp.h.x, s.player[2] - sp.h.z) < 4, { player: s.player, h: sp.h });
    check('police respawn point is the town station', sp.pol.x > 300 && Math.abs(sp.pol.z + 92) < 3, sp.pol);
    // Ring road loop in the hero car.
    await ev(() => { const c = window.__gta.vehicles.cars.find((x) => x.hero); c.health = 100; c.dead = false; c.body.dead = false; window.__gta.debug.enter(); });
    await wait(800);
    const loop = await ev(() => window.__gta.debug.driveTownLoop());
    check('drove the ring road loop', loop.ok, loop);
    s = await st();
    check('no NaN after town run', s.player.every(Number.isFinite) && (s.car?.pos || []).every(Number.isFinite), s.car);
    check('no page errors (town)', errors.length === 0, errors.slice(0, 3));
  }
  // ---------------------------------------------------------------- Step 7: NPC variety
  if (run('npcs')) {
    await load();
    const sample = (secs) => ev(async (secs) => {
      const g = window.__gta, P = g.peds.peds;
      const s0 = P.map((p) => [p.pos.x, p.pos.z]), c0 = g.cyclists.riders.map((c) => [c.pos.x, c.pos.z]);
      await new Promise((r) => setTimeout(r, secs * 1000));
      const moved = P.map((p, i) => ({ role: p.role, awake: p.ch.root.visible, d: Math.hypot(p.pos.x - s0[i][0], p.pos.z - s0[i][1]), home: p.home ? Math.hypot(p.pos.x - p.home.x, p.pos.z - p.home.z) : null }));
      const walkers = moved.filter((m) => m.awake && ['walker', 'shopper', 'jogger', 'dogWalker'].includes(m.role));
      return {
        stats: g.peds.stats(), cyc: g.cyclists.stats(), cycMoved: g.cyclists.riders.filter((c, i) => c.group.visible && Math.hypot(c.pos.x - c0[i][0], c.pos.z - c0[i][1]) > 3).length,
        walkers: walkers.length, movedFrac: +(walkers.filter((m) => m.d > 1).length / Math.max(1, walkers.length)).toFixed(2),
        jog: moved.filter((m) => m.role === 'jogger' && m.awake).map((m) => +(m.d / secs).toFixed(1)),
        homeOk: moved.filter((m) => m.home !== null && m.awake).every((m) => m.home < 0.5), homeAwake: moved.filter((m) => m.home !== null && m.awake).length,
        staff: g.world.town.interiors.people.map((p) => p.role), dogs: P.filter((p) => p.dog).length,
        nan: P.some((p) => !Number.isFinite(p.pos.x + p.pos.y + p.pos.z)) || g.cyclists.riders.some((c) => !Number.isFinite(c.pos.x + c.pos.z)),
      };
    }, secs);
    // Town centre (shoppers, police on foot, shopkeepers, cyclists, bench sitters in the gardens).
    await ev(() => window.__gta.debug.teleport(470, -60, 0));
    await wait(1500);
    const a = await sample(3);
    const roles = a.stats.roles, need = ['walker', 'jogger', 'dogWalker', 'shopper', 'sitter', 'picnic', 'cop', 'worker', 'paramedic', 'shopkeeper'];
    check('~40 pedestrians, every role present', a.stats.total >= 36 && a.stats.total <= 64 && need.every((r) => roles[r] > 0), roles);
    check('cyclists + shop staff (cashiers, guard) + dogs', a.cyc.total === 3 && a.staff.includes('cashier') && a.staff.includes('guard') && a.dogs >= 3, { cyc: a.cyc, staff: a.staff, dogs: a.dogs });
    check('town walkers move, stationary people hold their spots', a.walkers >= 3 && a.movedFrac >= 0.6 && a.homeOk && a.homeAwake >= 6, a);
    check('a cyclist is riding in town', a.cycMoved >= 1, { cyc: a.cyc, moved: a.cycMoved });
    // Wattle Park: jogger + dog walker on the loop, sitter, picnickers.
    const wp = await ev(() => { const w = window.__gta.world.town.wattle.centre; window.__gta.debug.teleport(w.x - 24, w.z, Math.PI / 2); return w; });
    await wait(1500);
    const b = await sample(3);
    check('Wattle Park: jogger runs, picnic + bench people stay put', b.jog.length >= 1 && Math.max(...b.jog) > 3.2 && b.homeOk, { jog: b.jog, homeOk: b.homeOk, wp });
    check('no NaN in NPC positions', !a.nan && !b.nan, { a: a.nan, b: b.nan });
    // Knock down a police officer on foot outside the station: falls, gets up, returns to the spot.
    await ev(() => window.__gta.debug.enter());
    await wait(800);
    const k = await ev(async () => {
      const g = window.__gta, p = g.peds.peds.find((q) => q.role === 'cop');
      const car = g.controls.car, a = Math.PI;
      const x = p.home.x, z = p.home.z + 20;
      car.body.teleport(x, g.world.terrain.getHeight(x, z), z, a);
      await new Promise((r) => setTimeout(r, 500));
      const I = g.controls.input; I.setVirtual('KeyW', true);
      const t0 = performance.now();
      while (performance.now() - t0 < 6000 && p.state !== 'down') await new Promise((r) => requestAnimationFrame(r));
      I.setVirtual('KeyW', false); I.setVirtual('KeyS', true);
      const down = p.state === 'down';
      await new Promise((r) => setTimeout(r, 1200)); I.setVirtual('KeyS', false);
      const t1 = performance.now();
      while (performance.now() - t1 < 14000 && !(p.state === 'home' && Math.hypot(p.pos.x - p.home.x, p.pos.z - p.home.z) < 0.3 && p.flee <= 0)) await new Promise((r) => requestAnimationFrame(r));
      return { down, state: p.state, back: +Math.hypot(p.pos.x - p.home.x, p.pos.z - p.home.z).toFixed(2), stars: g.wanted.stars };
    });
    check('police officer on foot knocked down', k.down, k);
    check('gets up and walks back to the spot', k.back < 0.3, k);
    check('no page errors (npcs)', errors.length === 0, errors.slice(0, 3));
  }
} finally {
  await context.close();
  await browser.close();
}
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exit(1); }
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
