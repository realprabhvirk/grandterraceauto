// Phase 6.2: in-game braking test (Playwright + installed Edge, headless 960x540, numeric asserts).
// Every car type at 15/30/45/60/70 m/s (capped at the car's boosted top speed), with and without input
// noise, on the airport runway (flat, long) with parked cars on its shoulders and the normal traffic
// running; then tap-S spam, S in a turn, S then W, S through the stop into reverse, S + handbrake, and
// braking on the motorway bridge hump. Plus the vehicle-sim regression (0-100, top speed, steering).
// Usage: .\dev.cmd node scripts/braketest.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let fails = 0, passes = 0;
const check = (name, ok, info) => { (ok ? passes++ : fails++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${info === undefined ? '' : JSON.stringify(info)}`); };
try {
  await page.goto('http://127.0.0.1:5173/?cam=player', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  // Shared helper: brake run with an accumulated trace.
  await page.evaluate(() => {
    const g = window.__gta, d = g.debug, wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const raf = () => new Promise((q) => requestAnimationFrame(q));
    let seed = 99; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    // Parked cars on the runway shoulders (present but out of the braking line).
    const parkedIdx = g.vehicles.cars.map((c, i) => i).filter((i) => !g.vehicles.cars[i].impounded).slice(0, 4);
    parkedIdx.forEach((i, k) => { const c = g.vehicles.cars[i]; c.body.teleport(860 - k * 120, -4.4, -705 + (k % 2 ? 19 : -19), -Math.PI / 2); });
    window.__bt = {
      async enter(type) {
        if (g.controls.mode === 'drive') { const old = g.controls.car; g.controls.respawnAt(old.position, 0); await wait(300); old.body.teleport(-240 + Math.random() * 30, g.world.terrain.getHeight(-240, -480) + 1, -480 - Math.random() * 30, 0); }
        const i = g.vehicles.cars.findIndex((c, k) => c.type === type && !c.dead && !c.impounded && !parkedIdx.includes(k));
        d.enter(i); await wait(1200);
        return !!g.controls.car;
      },
      /** opts: { v, x, z, yaw, scenario, noise, steer } */
      async run(o) {
        const car = g.controls.car, I = g.controls.input, cfg = car.cfg;
        car.health = 100; car.dead = false; car.body.dead = false;
        const v = Math.min(o.v, cfg.top * 1.15 * 0.99), y = g.world.terrain.driveHeight ? g.world.terrain.driveHeight(o.x, o.z, 40) : g.world.terrain.getHeight(o.x, o.z);
        car.body.teleport(o.x, y, o.z, o.yaw); await wait(500);
        const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw);
        car.body.body.setLinvel({ x: fx * v, y: 0, z: fz * v }, true); car.body.lastVel = { x: fx * v, y: 0, z: fz * v };
        I.clearVirtual(); I.setVirtual('KeyW', true); if (v > cfg.top) I.setVirtual('ShiftLeft', true);
        for (let k = 0; k < 18; k++) await raf();
        I.setVirtual('KeyW', false); I.setVirtual('ShiftLeft', false);
        const all = new Map(), grab = () => { for (const e of d.carTrace()) all.set(e.t, e); };
        const p0 = { ...car.position }, v0 = car.body.state.speed, dmg0 = g.combat.damageLog.length;
        const tStart = (d.carTrace().slice(-1)[0] || { t: 0 }).t; // measure from the moment S goes down
        let t = 0, yawMax = 0, flip = false, stopAt = null;
        const t0 = performance.now();
        while (t < 14) {
          t = (performance.now() - t0) / 1000;
          const S = o.scenario === 'tap' ? (t % 0.5) < 0.2 : o.scenario === 'sw' ? t < 0.5 : true;
          I.setVirtual('KeyS', S); I.setVirtual('KeyW', o.scenario === 'sw' && t >= 0.5);
          I.setVirtual('Space', o.scenario === 'hb');
          const st = (o.steer || 0) + (o.noise ? (rnd() - 0.5) * o.noise : 0);
          I.setVirtual('KeyA', st > 0.25); I.setVirtual('KeyD', st < -0.25);
          await raf(); grab();
          yawMax = Math.max(yawMax, Math.abs(car.body.body.angvel().y));
          if (car.body.up().y < 0.3) flip = true;
          const sp = car.body.state.speed;
          if (stopAt === null && sp < 0.3 && o.scenario !== 'sw') stopAt = t;
          if (o.scenario === 'reverse' ? (stopAt !== null && t > stopAt + 1.5) : o.scenario === 'sw' ? t > 2 : stopAt !== null) break;
        }
        I.clearVirtual();
        const tr = [...all.values()].sort((a, b) => a.t - b.t).filter((e) => e.t > tStart);
        const br = tr.filter((e) => e.mode === 'brake');
        let lift = 0, liftRun = 0, revJerk = 0, prev = '';
        for (const e of tr) { lift = e.lift.some(Boolean) ? lift + 1 : 0; liftRun = Math.max(liftRun, lift); if (prev === 'brake' && e.mode === 'reverse') revJerk = Math.abs(e.jerk); prev = e.mode; }
        const p1 = car.position, dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
        const meanDecel = stopAt ? v0 / stopAt / 9.81 : 0;
        return {
          car: cfg.label, scenario: o.scenario || 'hold', v: +v0.toFixed(1), noise: o.noise || 0,
          minPitch: +Math.min(0, ...tr.map((e) => e.pitch)).toFixed(2), maxRate: +Math.max(0, ...tr.map((e) => Math.abs(e.pitchRate))).toFixed(1),
          maxVy: +Math.max(0, ...tr.map((e) => Math.abs(e.vy))).toFixed(2), peakDecel: +Math.max(0, ...br.map((e) => -e.axG)).toFixed(2),
          maxJerk: +Math.max(0, ...br.slice(2).map((e) => Math.abs(e.jerk))).toFixed(0), liftRun, revJerk: +revJerk.toFixed(0),
          dist: +dist.toFixed(1), expect: meanDecel ? +((v0 * v0) / (2 * meanDecel * 9.81)).toFixed(1) : null, meanDecel: +meanDecel.toFixed(2),
          yawMax: +yawMax.toFixed(2), flip, damage: g.combat.damageLog.slice(dmg0).map((e) => e.tag), steps: tr.length,
        };
      },
    };
  });
  const types = ['hatch', 'sedan', 'ute', 'suv'];
  const RW = { x: 950, z: -705 - 4, yaw: -Math.PI / 2 };
  const results = [];
  for (const type of types) {
    const ok = await page.evaluate((t) => window.__bt.enter(t), type);
    if (!ok) { check(`${type}: found a car`, false); continue; }
    for (const v of [15, 30, 45, 60, 70]) for (const noise of [0, 0.6]) {
      if (noise && v !== 45 && v !== 15) continue;
      const r = await page.evaluate((o) => window.__bt.run(o), { ...RW, v, noise });
      results.push(r);
      const okDist = r.expect ? Math.abs(r.dist - r.expect) / r.expect <= 0.2 : false;
      check(`${type} hold S from ${r.v} m/s${noise ? ' (noise)' : ''}: pitch >= -6, lift <= 3 steps, |vy| < 1, decel 0.3-1.1 g, jerk ok, distance +-20%, no flip, no damage`,
        r.minPitch >= -6 && r.liftRun <= 3 && r.maxVy < 1.0 && r.peakDecel >= 0.3 && r.peakDecel <= 1.1 && r.maxJerk < 150 && okDist && !r.flip && r.damage.length === 0, r);
    }
    const tap = await page.evaluate((o) => window.__bt.run(o), { ...RW, v: 30, scenario: 'tap' });
    check(`${type} tap-S spam doesn't accumulate (decel <= 1.1 g, pitch >= -6)`, tap.peakDecel <= 1.1 && tap.minPitch >= -6 && tap.liftRun <= 3 && !tap.flip, tap);
    const turn = await page.evaluate((o) => window.__bt.run(o), { ...RW, v: 25, steer: 0.6 });
    check(`${type} braking in a corner doesn't spin (yaw rate < 1.5 rad/s)`, turn.yawMax < 1.5 && !turn.flip && turn.minPitch >= -6 && turn.liftRun <= 3, turn);
    const sw = await page.evaluate((o) => window.__bt.run(o), { ...RW, v: 30, scenario: 'sw' });
    check(`${type} S then W immediately: no lift / flip`, sw.liftRun <= 3 && !sw.flip && sw.minPitch >= -6, sw);
    const rev = await page.evaluate((o) => window.__bt.run(o), { ...RW, v: 15, scenario: 'reverse' });
    check(`${type} S held through the stop: brake -> reverse is smooth (jerk < 150, no lift)`, rev.revJerk < 150 && rev.liftRun <= 3 && rev.minPitch >= -6 && !rev.flip, rev);
    const hb = await page.evaluate((o) => window.__bt.run(o), { ...RW, v: 30, scenario: 'hb' });
    check(`${type} S + handbrake: stays grounded, no flip`, hb.liftRun <= 3 && !hb.flip && hb.minPitch >= -6, hb);
    // Motorway bridge hump (x 420): brake over the crest, westbound outer lane, traffic removed from the motorway only.
    await page.evaluate(() => { const g = window.__gta; for (const t of [...g.traffic.cars]) if (Math.abs(t.pos.z + 252) < 14) g.traffic.removeCar(t); });
    const crest = await page.evaluate((o) => window.__bt.run(o), { x: 520, z: -252 - 2.2 - 3.5, yaw: -Math.PI / 2, v: 38 });
    check(`${type} braking over the motorway bridge crest stays grounded`, crest.liftRun <= 3 && !crest.flip && crest.minPitch >= -8 && crest.damage.length === 0, crest);
  }
  check('no page errors (braketest)', errors.length === 0, errors.slice(0, 3));
} finally {
  await browser.close();
}
// Regression: vehicle-sim bench vs the Phase 6.1 numbers (0-100 s, top km/h, turn deg/3 s).
const BASE = { hatch: [5.8, 126, 119], sedan: [5.2, 139, 134], ute: [5.8, 129, 156], suv: [7.6, 117, 153] };
const sim = execFileSync(process.execPath, [path.join(root, 'scripts', 'vehicle-sim.mjs')], { cwd: root, encoding: 'utf8' });
for (const line of sim.split('\n').filter((l) => /0-100/.test(l))) {
  const name = line.trim().split(/\s+/)[0], m = line.match(/0-100 ([\d.]+)s top (\d+) km\/h .* turn@\d+km\/h (\d+)deg/);
  const b = BASE[name]; if (!m || !b) continue;
  const [t100, top, turn] = [+m[1], +m[2], +m[3]];
  check(`${name}: 0-100 / top speed / steering unchanged (vehicle-sim, within 5%)`, Math.abs(t100 - b[0]) <= b[0] * 0.05 + 0.1 && Math.abs(top - b[1]) <= b[1] * 0.05 && Math.abs(turn - b[2]) <= b[2] * 0.05, { t100, top, turn, base: b });
}
console.log(fails ? `${fails} check(s) FAILED` : `All ${passes} checks passed`);
process.exitCode = fails ? 1 : 0;
