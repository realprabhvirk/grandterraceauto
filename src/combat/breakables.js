// Breakable street props. Each "set" is a group of instanced props sharing toughness and
// car damage (street lights, power poles, regulatory signs, bollards, bins, letterboxes...).
// A fast car breaks a prop BEFORE its collider would stop the car: the collider is disabled,
// the prop tips over (0.6 s, pivot at the base) and stays as debris; street lights spark and
// go dark. Broken props are restored after ~3 min when they're out of view.
import * as THREE from 'three';
import { G_STATIC } from '../physics/physicsWorld.js';

const CELL = 12, RESTORE_AFTER = 180;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _axis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function createBreakables({ physics }) {
  const { world, RAPIER } = physics;
  const sets = [];
  const grid = new Map();
  const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

  /**
   * meshes: [{ mesh: InstancedMesh, mode: 'follow' | 'hide' }]  (instance i = item i)
   * items:  [{ x, y, z, rot }] base positions;  r/h = collider radius/height
   */
  function addSet({ name, meshes, items, r, h, toughness, carDamage, sparks = false, onBreak = null }) {
    const set = { name, meshes, items: [], r, h, toughness, carDamage, sparks, onBreak };
    items.forEach((it, i) => {
      const col = world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(it.x, it.y + h / 2, it.z).setCollisionGroups(G_STATIC));
      const base = meshes.map(({ mesh }) => { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); return m; });
      const item = { set, i, x: it.x, y: it.y, z: it.z, col, base, broken: false, t: 0, dir: new THREE.Vector3(), restoreT: 0 };
      set.items.push(item);
      const k = key(it.x, it.z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(item);
    });
    sets.push(set);
    return set;
  }

  function near(x, z) {
    const out = [], cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const l = grid.get(`${cx + dx},${cz + dz}`); if (l) out.push(...l); }
    return out;
  }

  function breakItem(item, dir) {
    if (item.broken) return;
    item.broken = true; item.t = 0; item.restoreT = 0;
    item.dir.copy(dir).setY(0).normalize();
    item.col.setEnabled(false);
  }

  return {
    sets, addSet, breakItem,
    /**
     * Test a moving car against nearby props. car: { x, z, fx, fz, speed (m/s, signed), halfLen, halfW }.
     * Returns the broken items (caller applies car/player damage, sounds, wanted heat).
     */
    hitTest(car) {
      const v = Math.abs(car.speed);
      if (v < 2) return [];
      const sgn = Math.sign(car.speed) || 1;
      const out = [];
      for (const it of near(car.x, car.z)) {
        if (it.broken) continue;
        const dx = it.x - car.x, dz = it.z - car.z;
        const ahead = (dx * car.fx + dz * car.fz) * sgn, lat = Math.abs(dx * car.fz - dz * car.fx);
        if (ahead < 0 || ahead > car.halfLen + it.set.r + 0.35 + v * 0.03 || lat > car.halfW + it.set.r + 0.05) continue;
        if (v < it.set.toughness) continue; // too slow: the collider stops the car instead
        breakItem(it, _p.set(car.fx * sgn, 0, car.fz * sgn));
        out.push(it);
      }
      return out;
    },
    update(dt, focus) {
      for (const set of sets) {
        let dirty = false;
        for (const it of set.items) {
          if (!it.broken) continue;
          if (it.t < 1) {
            it.t = Math.min(1, it.t + dt / 0.6);
            const k = 1 - (1 - it.t) * (1 - it.t);
            _axis.crossVectors(UP, it.dir).normalize();
            _q.setFromAxisAngle(_axis, k * 1.42);
            set.meshes.forEach(({ mesh, mode }, mi) => {
              if (mode === 'hide') { _m.makeScale(0, 0, 0); mesh.setMatrixAt(it.i, _m); return; }
              // Rotate about the prop's base point.
              _m.copy(it.base[mi]);
              _p.set(it.x, it.y, it.z);
              const rot = new THREE.Matrix4().makeRotationFromQuaternion(_q);
              const toBase = new THREE.Matrix4().makeTranslation(-_p.x, -_p.y, -_p.z);
              const back = new THREE.Matrix4().makeTranslation(_p.x, _p.y, _p.z);
              mesh.setMatrixAt(it.i, back.multiply(rot).multiply(toBase).multiply(_m));
            });
            dirty = true;
          } else {
            it.restoreT += dt;
            if (it.restoreT > RESTORE_AFTER && Math.hypot(it.x - focus.x, it.z - focus.z) > 70) {
              it.broken = false;
              it.col.setEnabled(true);
              set.meshes.forEach(({ mesh }, mi) => mesh.setMatrixAt(it.i, it.base[mi]));
              dirty = true;
            }
          }
        }
        if (dirty) set.meshes.forEach(({ mesh }) => { mesh.instanceMatrix.needsUpdate = true; });
      }
    },
    stats() { return Object.fromEntries(sets.map((s) => [s.name, { total: s.items.length, broken: s.items.filter((i) => i.broken).length }])); },
  };
}
