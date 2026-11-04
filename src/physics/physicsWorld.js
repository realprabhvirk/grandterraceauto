// Rapier world: terrain heightfield (identical triangulation to the render mesh), box
// colliders for houses / hero details / fences, cylinders for trunks and poles.
// Fixed 60 Hz stepping. Collision groups keep queries cheap and unambiguous.
import RAPIER from '@dimforge/rapier3d-compat';
import { MAP } from '../world/terrain.js';

const STEP = 1 / 60;

// Interaction groups: 16-bit membership << 16 | 16-bit filter.
export const GROUP = { STATIC: 0x1, CAR: 0x2, PLAYER: 0x4, NPC: 0x8 };
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const G_STATIC = groups(GROUP.STATIC, GROUP.CAR | GROUP.PLAYER);
export const G_CAR = groups(GROUP.CAR, GROUP.STATIC | GROUP.CAR | GROUP.PLAYER | GROUP.NPC);
export const G_PLAYER = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.CAR | GROUP.NPC);
export const G_NPC = groups(GROUP.NPC, GROUP.PLAYER | GROUP.CAR);

export function createPhysics(world) {
  const phys = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  phys.timestep = STEP;
  const add = (desc) => phys.createCollider(desc.setCollisionGroups(G_STATIC));

  // Terrain: Rapier heightfield is centred on the collider; layout index = ix*(nz+1)+iz,
  // nrows = z subdivisions, ncols = x subdivisions. The visual mesh uses the same
  // anti-diagonal cell split, so physics and visuals agree exactly.
  add(RAPIER.ColliderDesc.heightfield(MAP.nz, MAP.nx, world.terrain.rapierHeights(), { x: MAP.x1 - MAP.x0, y: 1, z: MAP.z1 - MAP.z0 })
    .setTranslation(MAP.cx, 0, MAP.cz).setFriction(1.0));

  // Yaw (rot) then optional pitch (rotX, e.g. the stair ramp in 62): q = qY(rot) * qX(rotX).
  const quat = (rot, rotX = 0) => {
    const cy = Math.cos(rot / 2), sy = Math.sin(rot / 2), cx = Math.cos(rotX / 2), sx = Math.sin(rotX / 2);
    return { x: cy * sx, y: sy * cx, z: -sy * sx, w: cy * cx };
  };
  for (const c of world.colliders) {
    add(RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z).setRotation(quat(c.rot, c.rotX)));
  }
  // Switchable colliders (62's doors): handles go back to their owner.
  const toggles = {};
  for (const t of world.toggles || []) {
    toggles[t.id] = add(RAPIER.ColliderDesc.cuboid(t.hx, t.hy, t.hz).setTranslation(t.x, t.y, t.z).setRotation(quat(t.rot)));
  }
  for (const t of world.trunks) {
    add(RAPIER.ColliderDesc.cylinder(t.h / 2, t.r + 0.05).setTranslation(t.x, t.y + t.h / 2, t.z));
  }
  for (const p of world.poles || []) {
    add(RAPIER.ColliderDesc.cylinder(p.h / 2, p.r).setTranslation(p.x, p.y + p.h / 2, p.z));
  }
  // Keep everyone inside the playable area.
  const wx0 = MAP.x0 + 40, wx1 = MAP.x1 - 40, wz0 = MAP.z0 + 40, wz1 = MAP.z1 - 40;
  const mx = (wx0 + wx1) / 2, mz = (wz0 + wz1) / 2, hx2 = (wx1 - wx0) / 2, hz2 = (wz1 - wz0) / 2;
  for (const [x, z, hx, hz] of [[wx1, mz, 1, hz2], [wx0, mz, 1, hz2], [mx, wz1, hx2, 1], [mx, wz0, hx2, 1]]) {
    add(RAPIER.ColliderDesc.cuboid(hx, 60, hz).setTranslation(x, 30, z));
  }

  let acc = 0;
  const listeners = [];
  return {
    world: phys,
    RAPIER,
    toggles,
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
