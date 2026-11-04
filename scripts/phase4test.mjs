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
    await ev(async () => { const g = window.__gta; g.debug.enter(); await new Promise((r) => setTimeout(r, 1500)); const S = g.world.network.main.samples[200]; g.controls.car.body.teleport(S.x - S.nx * 1.8, S.h, S.z - S.nz * 1.8, Math.atan2(S.tx, S.tz)); await new Promise((r) => setTimeout(r, 1200)); });
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
} finally {
  await context.close();
  await browser.close();
}
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exit(1); }
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
