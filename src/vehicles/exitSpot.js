// Find a valid free spot to put the player when leaving a car. Candidates in order:
// driver's door (right-hand drive = the car's right, local -X), passenger side, behind,
// in front, then rings 0.8-3 m around the car. Each candidate must pass:
//   1. ground raycast (real floor: slabs, garage floor, terrain) close to the car's level,
//   2. free capsule overlap test against walls and cars,
//   3. line of sight from the car centre (no wall between) - keeps you in the same room,
//      e.g. inside 62's garage instead of outside it.
// Last resort: stand at the seat with the car's colliders ghosted for 1 s.
import * as THREE from 'three';
import { groups, GROUP } from '../physics/physicsWorld.js';

const _v = new THREE.Vector3();
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);
const STATIC_AND_CARS = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.CAR);

export function carLocalToWorld(car, x, y, z, out = new THREE.Vector3()) {
  car.group.updateMatrixWorld(true);
  return out.set(x, y, z).applyMatrix4(car.group.matrixWorld);
}

export function findExitSpot(physics, car, terrain, { radius, half }) {
  const { world, RAPIER } = physics;
  const cfg = car.cfg, hw = cfg.W / 2, sz = cfg.seat[2];
  const zf = cfg.wheelBase / 2 + cfg.frontOverhang, zr = zf - cfg.L, zm = (zf + zr) / 2;
  const cands = [
    [-(hw + 0.6), sz], [-(hw + 0.6), sz - 1.0], [-(hw + 0.6), sz + 1.0],
    [hw + 0.6, sz], [hw + 0.6, sz - 1.0],
    [0, zr - 0.9], [0, zf + 0.9],
  ];
  for (const r of [0.8, 1.4, 2.0, 2.6, 3.0]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      cands.push([Math.cos(a) * (hw + r), zm + Math.sin(a) * (cfg.L / 2 + r)]);
    }
  }
  const shape = new RAPIER.Capsule(half, radius);
  const cp = car.position;
  const centre = { x: cp.x, y: cp.y + 1.0, z: cp.z };
  const own = new Set(car.body.colliders.map((c) => c.handle));
  for (const [lx, lz] of cands) {
    const p = carLocalToWorld(car, lx, 0, lz, _v);
    // 1. Ground: cast down from above the car's roof line.
    const down = world.castRay(new RAPIER.Ray({ x: p.x, y: cp.y + 2.2, z: p.z }, { x: 0, y: -1, z: 0 }), 6, true, undefined, STATIC_ONLY);
    if (!down) continue;
    const floorY = cp.y + 2.2 - down.timeOfImpact;
    if (Math.abs(floorY - cp.y) > 1.2) continue;
    // 2. Capsule must be free of walls and other cars.
    const hit = world.intersectionWithShape({ x: p.x, y: floorY + half + radius + 0.04, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, undefined, STATIC_AND_CARS, undefined, undefined, (c) => !own.has(c.handle));
    if (hit) continue;
    // 3. No wall between the car and the spot.
    const to = { x: p.x - centre.x, y: floorY + 1.0 - centre.y, z: p.z - centre.z };
    const dist = Math.hypot(to.x, to.y, to.z) || 1;
    const block = world.castRay(new RAPIER.Ray(centre, { x: to.x / dist, y: to.y / dist, z: to.z / dist }), dist, true, undefined, STATIC_ONLY);
    if (block && block.timeOfImpact < dist - 0.05) continue;
    return { position: new THREE.Vector3(p.x, floorY, p.z), local: [lx, lz] };
  }
  // Nowhere free: stand at the seat; the caller ghosts the car's colliders for a moment.
  const seat = carLocalToWorld(car, cfg.seat[0], 0, sz, _v);
  return { position: new THREE.Vector3(seat.x, cp.y, seat.z), local: [cfg.seat[0], sz], ghostCar: true };
}
