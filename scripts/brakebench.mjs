// Phase 6.2: headless braking bench (plain Node + Rapier, no browser). Every car type at 15/30/45/60/70 m/s
// (capped at the car's boosted top speed) on flat ground, then hold S until stopped; plus tap-S, S while
// turning, S then W, S through the stop (brake -> reverse), S + handbrake, S over a crest, with input noise.
// Prints max nose-down pitch, pitch rate, wheel lift, vertical velocity, decel, jerk, stopping distance.
// Usage: .\dev.cmd node scripts/brakebench.mjs [type] [--json]
import RAPIER from '@dimforge/rapier3d-compat';
import { CAR_TYPES } from '../src/vehicles/carTypes.js';
import { VehicleBody } from '../src/vehicles/vehicleBody.js';
import { G_STATIC } from '../src/physics/physicsWorld.js';

await RAPIER.init();
const STEP = 1 / 60;
const args = process.argv.slice(2), json = args.includes('--json');
const types = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : Object.keys(CAR_TYPES);
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function makeWorld(crest) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 2000).setTranslation(0, -0.5, 1000).setCollisionGroups(G_STATIC));
  if (crest) { // a smooth 1.2 m crest made of tilted plates at z 200..260
    for (let k = 0; k < 12; k++) { const z = 200 + k * 5, a = Math.sin((k / 11) * Math.PI) * 0.0; const h = 1.2 * Math.sin(((k + 0.5) / 12) * Math.PI); world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.5, 2.6).setTranslation(0, h - 0.5, z).setRotation({ x: Math.sin(-Math.cos(((k + 0.5) / 12) * Math.PI) * 0.12), y: 0, z: 0, w: 1 }).setCollisionGroups(G_STATIC)); void a; }
  }
  return world;
}

/** One run: spin up to v, then run the scenario's input function; returns metrics. */
export function brakeRun(name, v, scenario = 'hold', { noise = 0, crest = false } = {}) {
  const cfg = CAR_TYPES[name], world = makeWorld(crest);
  const car = new VehicleBody({ world, RAPIER }, cfg, { x: 0, y: 0, z: 0, yaw: 0 });
  for (let t = 0; t < 1.5; t += STEP) { car.update(STEP, null); world.step(); }
  // Spin up: set the velocity (cars can't all reach 70 m/s), let it settle 0.5 s at full throttle.
  const vTop = cfg.top * 1.15, v0 = Math.min(v, vTop);
  car.body.setLinvel({ x: 0, y: 0, z: v0 }, true); car.lastVel = { x: 0, y: 0, z: v0 };
  const boost = v0 > cfg.top;
  for (let t = 0; t < 0.5; t += STEP) { car.update(STEP, { throttle: 1, reverse: 0, steer: 0, handbrake: false, boost }); world.step(); }
  const z0 = car.position.z, sStart = car.state.speed;
  const m = { car: name, v: +sStart.toFixed(1), scenario, noise, minPitch: 0, maxPitchRate: 0, liftRun: 0, maxVy: 0, peakDecel: 0, maxJerk: 0, dist: 0, flip: false, time: 0, revJerk: 0, maxYawRate: 0, airborne: 0 };
  let lift = 0, stopT = 0, t = 0, prevMode = '';
  const n = () => (noise ? (rnd() - 0.5) * noise : 0);
  while (t < 20) {
    let inp = { throttle: 0, reverse: 1, steer: n() * 0.3, handbrake: false, boost: false };
    if (scenario === 'tap') inp.reverse = (t % 0.5) < 0.2 ? 1 : 0;
    if (scenario === 'turn') inp.steer = 0.6 + n() * 0.2;
    if (scenario === 'sw') { inp = t < 0.4 ? inp : { throttle: 1, reverse: 0, steer: 0, handbrake: false, boost: false }; }
    if (scenario === 'hb') inp.handbrake = true;
    car.update(STEP, inp); world.step(); t += STEP;
    const tr = car.trace.buf[car.trace.buf.length - 1];
    m.minPitch = Math.min(m.minPitch, tr.pitch); m.maxPitchRate = Math.max(m.maxPitchRate, Math.abs(tr.pitchRate));
    m.maxVy = Math.max(m.maxVy, Math.abs(tr.vy)); m.peakDecel = Math.max(m.peakDecel, -tr.axG);
    if (t > 0.05) m.maxJerk = Math.max(m.maxJerk, Math.abs(tr.jerk));
    if (tr.mode === 'brake' && t > 0.2) m.peakDecel2 = Math.max(m.peakDecel2 || 0, -tr.axG);
    if (prevMode === 'brake' && tr.mode === 'reverse') m.revJerk = Math.abs(tr.jerk);
    prevMode = tr.mode;
    const lifted = tr.comp.some((c) => c === -1);
    lift = lifted ? lift + 1 : 0; m.liftRun = Math.max(m.liftRun, lift);
    if (tr.comp.every((c) => c === -1)) m.airborne++;
    m.maxYawRate = Math.max(m.maxYawRate, Math.abs(car.body.angvel().y));
    if (car.up().y < 0.3) m.flip = true;
    if (scenario === 'sw' && t > 2) break;
    if (scenario === 'reverse' && t > 6) break;
    if (scenario !== 'reverse' && scenario !== 'sw' && car.state.speed < 0.3) { m.stopAt = t; break; }
  }
  m.dist = +(car.position.z - z0).toFixed(1); m.time = +t.toFixed(2); m.meanDecel = +(m.stopAt ? sStart / m.stopAt / 9.81 : 0).toFixed(2);
  m.expect = +((sStart * sStart) / (2 * Math.max(0.1, m.peakDecel) * 9.81)).toFixed(1);
  for (const k of ['minPitch', 'maxPitchRate', 'maxVy', 'peakDecel', 'maxJerk', 'revJerk', 'maxYawRate']) m[k] = +m[k].toFixed(2);
  return m;
}

const rows = [];
for (const name of types) {
  for (const v of [15, 30, 45, 60, 70]) rows.push(brakeRun(name, v, 'hold'));
  rows.push(brakeRun(name, 45, 'hold', { noise: 0.6 }));
  rows.push(brakeRun(name, 30, 'tap'));
  rows.push(brakeRun(name, 30, 'turn'));
  rows.push(brakeRun(name, 30, 'sw'));
  rows.push(brakeRun(name, 15, 'reverse'));
  rows.push(brakeRun(name, 30, 'hb'));
  rows.push(brakeRun(name, 40, 'hold', { crest: true }));
}
if (json) console.log(JSON.stringify(rows));
else for (const r of rows) console.log(`${r.car.padEnd(6)} ${r.scenario.padEnd(7)} v${String(r.v).padStart(5)} n${r.noise} pitch ${String(r.minPitch).padStart(6)} rate ${String(r.maxPitchRate).padStart(6)} lift ${String(r.liftRun).padStart(3)} air ${String(r.airborne).padStart(3)} vy ${String(r.maxVy).padStart(5)} decel ${String(r.peakDecel).padStart(5)}g mean ${r.meanDecel} pk2 ${(r.peakDecel2 || 0).toFixed(2)} jerk ${String(r.maxJerk).padStart(6)} rev ${String(r.revJerk).padStart(5)} dist ${String(r.dist).padStart(6)} (v2/2a ${r.expect}) yaw ${r.maxYawRate} flip ${r.flip}`);
