// Rapier world: terrain heightfield (identical triangulation to the render mesh), box
// colliders for houses / hero details / fences, cylinders for trunks and poles.
// Fixed 60 Hz stepping. Collision groups keep queries cheap and unambiguous.
import RAPIER from '@dimforge/rapier3d-compat';
import { MAP } from '../world/terrain.js';

const STEP = 1 / 60;

// Interaction groups: 16-bit membership << 16 | 16-bit filter.
export const GROUP = { STATIC: 0x1, CAR: 0x2, PLAYER: 0x4 };
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const G_STATIC = groups(GROUP.STATIC, GROUP.CAR | GROUP.PLAYER);
export const G_CAR = groups(GROUP.CAR, GROUP.STATIC | GROUP.CAR | GROUP.PLAYER);
export const G_PLAYER = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.CAR);

export function createPhysics(world) {
  const phys = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  phys.timestep = STEP;
  const add = (desc) => phys.createCollider(desc.setCollisionGroups(G_STATIC));

  // Terrain: Rapier heightfield is centred on the collider; layout index = ix*(nz+1)+iz,
  // nrows = z subdivisions, ncols = x subdivisions. The visual mesh uses the same
  // anti-diagonal cell split, so physics and visuals agree exactly.
  const n = MAP.n;
  add(RAPIER.ColliderDesc.heightfield(n, n, world.terrain.rapierHeights(), { x: MAP.half * 2, y: 1, z: MAP.half * 2 }).setFriction(1.0));

  for (const c of world.colliders) {
    const half = c.rot / 2;
    add(RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz)
      .setTranslation(c.x, c.y, c.z)
      .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }));
  }
  for (const t of world.trunks) {
    add(RAPIER.ColliderDesc.cylinder(t.h / 2, t.r + 0.05).setTranslation(t.x, t.y + t.h / 2, t.z));
  }
  for (const p of world.poles || []) {
    add(RAPIER.ColliderDesc.cylinder(p.h / 2, p.r).setTranslation(p.x, p.y + p.h / 2, p.z));
  }
  // Keep everyone inside the playable area.
  const wall = MAP.half - 40;
  for (const [x, z, hx, hz] of [[wall, 0, 1, wall], [-wall, 0, 1, wall], [0, wall, wall, 1], [0, -wall, wall, 1]]) {
    add(RAPIER.ColliderDesc.cuboid(hx, 60, hz).setTranslation(x, 30, z));
  }

  let acc = 0;
  const listeners = [];
  return {
    world: phys,
    RAPIER,
    STEP,
    /** Register a per-substep callback (vehicles, character). */
    onStep(fn) { listeners.push(fn); },
    /** Advance with a fixed step; calls every listener before each world step. */
    step(dt) {
      acc = Math.min(acc + dt, STEP * 5);
      while (acc >= STEP) {
        for (const fn of listeners) fn(STEP);
        phys.step();
        acc -= STEP;
      }
    },
  };
}
