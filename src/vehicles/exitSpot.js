// Find a valid free spot to put the player when leaving a car: driver's door first
// (right-hand drive = the car's right, local -X), then passenger side, behind, in front,
// further out. Each candidate is tested with the player capsule against walls and cars.
import * as THREE from 'three';
import { groups, GROUP } from '../physics/physicsWorld.js';

const _v = new THREE.Vector3();

export function carLocalToWorld(car, x, y, z, out = new THREE.Vector3()) {
  car.group.updateMatrixWorld(true);
  return out.set(x, y, z).applyMatrix4(car.group.matrixWorld);
}

export function findExitSpot(physics, car, terrain, { radius, half }) {
  const { world, RAPIER } = physics;
  const cfg = car.cfg, hw = cfg.W / 2;
  const sz = cfg.seat[2];
  const zf = cfg.wheelBase / 2 + cfg.frontOverhang, zr = zf - cfg.L;
  const cands = [
    [-(hw + 0.7), sz], [-(hw + 0.7), sz - 1.2], [-(hw + 0.7), sz + 1.2],
    [hw + 0.7, sz], [hw + 0.7, sz - 1.2],
    [0, zr - 1.0], [0, zf + 1.0],
    [-(hw + 1.8), sz], [hw + 1.8, sz], [-(hw + 2.8), sz], [hw + 2.8, sz],
  ];
  const shape = new RAPIER.Capsule(half, radius);
  const filter = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.CAR);
  const carY = car.position.y;
  for (const [lx, lz] of cands) {
    const p = carLocalToWorld(car, lx, 0, lz, _v);
    const y = terrain.getHeight(p.x, p.z);
    if (Math.abs(y - carY) > 1.6) continue;
    const hit = world.intersectionWithShape({ x: p.x, y: y + half + radius + 0.06, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, undefined, filter);
    if (!hit) return { position: new THREE.Vector3(p.x, y, p.z), local: [lx, lz] };
  }
  // Nowhere free (car wedged between walls): stand on the roof rather than inside anything.
  const top = carLocalToWorld(car, 0, cfg.roof + 0.1, sz, _v);
  return { position: top.clone(), local: [0, sz], roof: true };
}
