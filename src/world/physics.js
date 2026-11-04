// Rapier world: terrain heightfield (same grid as the render mesh), box colliders for
// houses / hero details, cylinders for tree trunks. Fixed 60 Hz stepping.
import RAPIER from '@dimforge/rapier3d-compat';
import { MAP } from './terrain.js';

const STEP = 1 / 60;

export function createPhysics(world) {
  const phys = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  phys.timestep = STEP;

  // Terrain: Rapier heightfield is centred on the collider; layout index = ix*(nz+1)+iz
  // (verified with a raycast probe), nrows = z subdivisions, ncols = x subdivisions.
  const n = MAP.n;
  const hf = RAPIER.ColliderDesc.heightfield(n, n, world.terrain.rapierHeights(), { x: MAP.half * 2, y: 1, z: MAP.half * 2 });
  phys.createCollider(hf.setFriction(0.8));

  for (const c of world.colliders) {
    const half = c.rot / 2;
    const desc = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz)
      .setTranslation(c.x, c.y, c.z)
      .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
    phys.createCollider(desc);
  }
  for (const t of world.trunks) {
    phys.createCollider(RAPIER.ColliderDesc.cylinder(t.h / 2, t.r + 0.05).setTranslation(t.x, t.y + t.h / 2, t.z));
  }
  // Keep everyone inside the map.
  const wall = MAP.half - 40;
  for (const [x, z, hx, hz] of [[wall, 0, 1, wall], [-wall, 0, 1, wall], [0, wall, wall, 1], [0, -wall, wall, 1]]) {
    phys.createCollider(RAPIER.ColliderDesc.cuboid(hx, 60, hz).setTranslation(x, 30, z));
  }

  let acc = 0;
  return {
    world: phys,
    RAPIER,
    /** Advance with a fixed step; calls fn(STEP) per sub-step before each world step. */
    step(dt, fn) {
      acc = Math.min(acc + dt, STEP * 5);
      while (acc >= STEP) {
        fn?.(STEP);
        phys.step();
        acc -= STEP;
      }
    },
  };
}
