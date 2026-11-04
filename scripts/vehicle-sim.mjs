// Headless vehicle tuning bench (plain Node, no browser): flat ground + a crest bump.
// Runs each car type through settle / accelerate / brake / turn / handbrake / crest and
// prints numbers. Usage: .\dev.cmd node scripts/vehicle-sim.mjs [type]
import RAPIER from '@dimforge/rapier3d-compat';
import { CAR_TYPES } from '../src/vehicles/carTypes.js';
import { VehicleBody } from '../src/vehicles/vehicleBody.js';
import { G_STATIC } from '../src/physics/physicsWorld.js';

await RAPIER.init();
const STEP = 1 / 60;
const types = process.argv[2] ? [process.argv[2]] : Object.keys(CAR_TYPES);

function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0).setCollisionGroups(G_STATIC));
  // Crest: a long, gentle 1.4 m hump across the track at z = 400.
  const hump = RAPIER.ColliderDesc.cuboid(30, 0.7, 6).setTranslation(0, 0, 400).setRotation({ x: 0.0, y: 0, z: 0, w: 1 });
  world.createCollider(hump.setCollisionGroups(G_STATIC));
  return world;
}

const deg = (r) => (r * 180) / Math.PI;
for (const name of types) {
  const cfg = CAR_TYPES[name];
  const world = makeWorld();
  const car = new VehicleBody({ world, RAPIER }, cfg, { x: 0, y: 0, z: 0, yaw: 0 });
  const run = (sec, input, each) => { for (let t = 0; t < sec; t += STEP) { car.update(STEP, input); world.step(); each?.(t); } };
  run(2, null);
  const settleY = car.position.y;
  const sag = cfg.rest - car.wheel(0).susp;
  // 0-100 km/h time + top speed after 12 s.
  let t100 = null, t = 0;
  run(12, { throttle: 1, reverse: 0, steer: 0, handbrake: false, boost: false }, (tt) => { t = tt; if (t100 === null && car.state.speed * 3.6 >= 100) t100 = tt; });
  const top = car.state.speed * 3.6;
  // Brake from top speed.
  const z0 = car.position.z;
  let stopT = 0;
  run(8, { throttle: 0, reverse: 1, steer: 0, handbrake: false, boost: false }, (tt) => { if (car.state.speed > 0.5) stopT = tt; });
  const brakeDist = car.position.z - z0;
  // Steady turn at ~40 km/h: get up to speed then full lock.
  car.teleport(0, 0, -200, 0); run(1, null);
  run(6, { throttle: 0.55, reverse: 0, steer: 0, handbrake: false, boost: false });
  const v40 = car.state.speed * 3.6;
  let maxRoll = 0, minUpY = 1;
  const yaw0 = car.yaw();
  run(3, { throttle: 0.35, reverse: 0, steer: 1, handbrake: false, boost: false }, () => {
    const up = car.up(); minUpY = Math.min(minUpY, up.y);
    maxRoll = Math.max(maxRoll, deg(Math.asin(Math.min(1, Math.abs(car.left().y)))));
  });
  const turned = deg(Math.abs(car.yaw() - yaw0));
  // Handbrake turn.
  run(1.2, { throttle: 0.4, reverse: 0, steer: 1, handbrake: true, boost: false }, () => { minUpY = Math.min(minUpY, car.up().y); });
  // Crest jump at full boost.
  car.teleport(0, 0, 250, 0); run(1, null);
  let maxY = 0, airT = 0;
  run(9, { throttle: 1, reverse: 0, steer: 0, handbrake: false, boost: true }, () => {
    maxY = Math.max(maxY, car.position.y); if (car.state.grounded === 0) airT += STEP; minUpY = Math.min(minUpY, car.up().y);
  });
  console.log(`${name.padEnd(6)} settleY ${settleY.toFixed(3)} sag ${sag.toFixed(3)} | 0-100 ${t100 ? t100.toFixed(1) + 's' : '  -  '} top ${top.toFixed(0)} km/h | brake ${brakeDist.toFixed(1)} m in ${stopT.toFixed(1)} s | ` +
    `turn@${v40.toFixed(0)}km/h ${turned.toFixed(0)}deg/3s roll ${maxRoll.toFixed(1)}deg | crest maxY ${maxY.toFixed(2)} air ${airT.toFixed(2)}s | min up.y ${minUpY.toFixed(2)} speedSign ${Math.sign(car.state.speed)}`);
}
