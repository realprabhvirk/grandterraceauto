// Phase 5.3: camera jitter / random shake. Usage (dev server running): .\dev.cmd node scripts/shaketest.mjs [report]
// Scripted walk / run / jump / POV / drive (chase, cabin, cinematic, crests) runs with the jitter
// monitor on. Pass/fail thresholds come from the flat-ground walking reference run.
import { chromium } from 'playwright';

const reportOnly = process.argv.includes('report');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const ev = (fn, arg) => page.evaluate(fn, arg);
try {
  await page.goto('http://127.0.0.1:5173/?cam=player', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  const runs = await ev(async () => {
    const g = window.__gta, d = g.debug, I = g.controls.input, J = g.jitter, wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const out = {};
    const rec = async (name, fn) => { J.start(); await fn(); J.stop(); out[name] = J.stats(); };
    for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
    // ---- on foot (Terrace Pde footpath, flat) ----
    d.teleport(380, -94.8 + 2, Math.PI / 2); g.controls.player.state.yaw = Math.PI / 2; await wait(500);
    await rec('walk (third)', async () => { I.setVirtual('KeyW', true); await wait(3000); I.setVirtual('KeyW', false); });
    d.teleport(380, -79, Math.PI / 2); g.controls.player.state.yaw = Math.PI / 2; await wait(400);
    await rec('run (third)', async () => { I.setVirtual('KeyW', true); I.setVirtual('ShiftLeft', true); await wait(3000); I.setVirtual('KeyW', false); I.setVirtual('ShiftLeft', false); });
    await rec('jump (third)', async () => { for (let k = 0; k < 3; k++) { await d.tap('Space'); await wait(800); } });
    while (g.controls.cameraMode !== 'first') await d.tap('KeyC');
    d.teleport(380, -94.8 + 2, Math.PI / 2); g.controls.player.state.yaw = Math.PI / 2; await wait(400);
    await rec('walk (POV)', async () => { I.setVirtual('KeyW', true); await wait(3000); I.setVirtual('KeyW', false); });
    while (g.controls.cameraMode !== 'third') await d.tap('KeyC');
    await rec('standing still (third)', async () => { await wait(2000); });
    // ---- driving (ring road north straight, full throttle + boost) ----
    d.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && c.type === 'sedan')); await wait(1400);
    const car = g.controls.car; car.health = 100; car.dead = false; car.body.dead = false;
    const drive = async (cam, name, pts, secs = 6, speed = 60) => {
      while (g.controls.cameraMode !== cam) await d.tap('KeyC');
      const [a, b] = pts;
      car.body.teleport(a.x, g.world.terrain.getHeight(a.x, a.z), a.z, Math.atan2(b.x - a.x, b.z - a.z));
      g.controls.chase.reset(car); await wait(500);
      await rec(name, async () => { I.setVirtual('ShiftLeft', true); await Promise.race([d.drivePoints(pts, { speed, timeout: secs }), wait(secs * 1000 + 600)]); I.setVirtual('ShiftLeft', false); });
    };
    const straight = d.lanePoints(336, -215, 958, -215);
    await drive('chase', 'drive straight (chase)', straight);
    await drive('cabin', 'drive straight (cabin)', straight);
    await drive('cinematic', 'drive straight (cinematic)', straight);
    const ap = await import('/src/vehicles/autopilot.js');
    await drive('chase', 'drive crests: Grand Terrace (chase)', ap.buildRoutes(g.world)[0].points, 10, 22);
    await drive('chase', 'drive downtown + Northgate (chase)', d.lanePoints(420, -222, 420, -462), 6);
    while (g.controls.cameraMode !== 'chase') await d.tap('KeyC');
    // ---- a real crash still shakes ----
    car.health = 100;
    car.body.teleport(553, g.world.terrain.getHeight(553, -82), -82, Math.PI); await wait(400);
    while (g.controls.cameraMode !== 'cabin') await d.tap('KeyC');
    J.start();
    const v = { x: 0, y: 0, z: -25 }; car.body.body.setLinvel(v, true); car.body.lastVel = { ...v };
    await wait(1500); J.stop(); out['real crash 25 m/s (cabin)'] = J.stats();
    while (g.controls.cameraMode !== 'chase') await d.tap('KeyC');
    return out;
  });
  for (const [k, v] of Object.entries(runs)) console.log(`${k.padEnd(38)} posRMS ${v.posRMS} posMax ${v.posMax} focusRMS ${v.focusRMS} rotMax ${v.rotMax} shakeMax ${v.shakeMax} spikes ${v.spikeCount} steps ${JSON.stringify(v.steps)}`);
  if (!reportOnly) {
    const ref = runs['walk (third)'];
    for (const [k, v] of Object.entries(runs)) {
      if (k.startsWith('real crash')) continue;
      const driving = k.startsWith('drive');
      // Thresholds: flat-walk reference x3 (on foot); driving at up to ~50 m/s gets an absolute 0.06 m / frame.
      const lim = driving ? 0.06 : Math.max(0.01, ref.posRMS * 3);
      check(`${k}: smooth camera (posRMS ${v.posRMS} < ${lim.toFixed(3)}), no spikes`, v.posRMS < lim && (v.spikeCount === 0 || k.includes('cinematic')), { posMax: v.posMax, spikes: v.spikes.slice(0, 3) });
      check(`${k}: no shake without an impact`, v.shakeMax < 0.05 || k.includes('jump'), { shakeMax: v.shakeMax });
    }
    const c = runs['real crash 25 m/s (cabin)'];
    check('a real 25 m/s crash still shakes the camera', c.shakeMax > 0.3, { shakeMax: c.shakeMax });
  }
} finally {
  await context.close();
  await browser.close();
}
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exit(1); }
const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
