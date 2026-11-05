// Hitscan: one ray against the physics world (terrain, buildings, props, cars) and the
// people (pedestrians + police officers) using simple hit zones: a head sphere and a body
// capsule from the bones. Returns the nearest hit with what was hit.
import * as THREE from 'three';
import { groups, GROUP } from '../physics/physicsWorld.js';

const RAY_GROUPS = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.CAR);
const _h = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** Ray (o, unit d) vs sphere (c, r): distance or Infinity. */
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc < 0 ? 0 : Infinity);
}
/** Ray vs capsule (segment a-b, radius r): approximate entry distance or Infinity. */
export function rayCapsule(o, d, a, b, r) {
  // Closest points between the ray and the segment.
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const wx = o.x - a.x, wy = o.y - a.y, wz = o.z - a.z;
  const A = 1, B = d.x * ux + d.y * uy + d.z * uz, C = ux * ux + uy * uy + uz * uz;
  const D = d.x * wx + d.y * wy + d.z * wz, E = ux * wx + uy * wy + uz * wz;
  const den = A * C - B * B;
  let t = den > 1e-9 ? (B * E - C * D) / den : 0, s = den > 1e-9 ? (A * E - B * D) / den : 0;
  s = Math.max(0, Math.min(1, s));
  t = Math.max(0, B * s - D);
  const px = o.x + d.x * t - (a.x + ux * s), py = o.y + d.y * t - (a.y + uy * s), pz = o.z + d.z * t - (a.z + uz * s);
  const dist2 = px * px + py * py + pz * pz;
  if (dist2 > r * r) return Infinity;
  return Math.max(0, t - Math.sqrt(r * r - dist2));
}

/** Hit zones of a character (world): head sphere + body capsule. */
export function zonesOf(ch, scale = 1, out = {}) {
  ch.bones.head.updateWorldMatrix(true, false);
  out.head = out.head || new THREE.Vector3(); out.a = out.a || new THREE.Vector3(); out.b = out.b || new THREE.Vector3();
  out.head.set(0, 0.14, 0.01).applyMatrix4(ch.bones.head.matrixWorld);
  ch.bones.torso.getWorldPosition(out.b); out.b.y += 0.42 * scale;
  ch.root.getWorldPosition(out.a); out.a.y += 0.25 * scale;
  out.headR = 0.15 * scale; out.bodyR = 0.24 * scale;
  return out;
}

export function createHitscan({ physics, world, peds, police, vehicles, traffic, breakables }) {
  const { RAPIER } = physics;
  const zone = {};
  let colMap = null, colMapN = -1, colMapT = 0;
  function colliderMap() {
    const n = vehicles.cars.length + traffic.cars.length + police.cars.length;
    if (colMap && n === colMapN && performance.now() - colMapT < 500) return colMap;
    colMapT = performance.now();
    colMap = new Map();
    for (const c of vehicles.cars) for (const k of c.body.colliders) colMap.set(k.handle, { kind: 'car', car: c });
    for (const t of traffic.cars) colMap.set(t.body.collider(0).handle, { kind: 'car', car: t });
    for (const p of police.cars) colMap.set(p.body.collider(0).handle, { kind: 'car', car: p, police: true });
    for (const s of breakables.sets) for (const it of s.items) colMap.set(it.col.handle, { kind: 'prop', item: it });
    colMapN = n;
    return colMap;
  }
  /** People that can be shot: { kind, ref, ch, scale, pos }. */
  function targets(exclude) {
    const out = [];
    for (const p of peds.peds) if (p.ch.root.visible && p.state !== 'dead' && p !== exclude) out.push({ kind: 'ped', ref: p, ch: p.ch, scale: p.scale || 1, pos: p.pos, down: p.state === 'down' });
    for (const o of police.foot.officers) if (o.state !== 'dead' && o !== exclude && !o.cutscene) out.push({ kind: 'officer', ref: o, ch: o.ch, scale: 1, pos: o.pos });
    return out;
  }

  return {
    targets,
    /**
     * Cast from origin along unit dir up to maxD. opts.exclude: a person to skip (the shooter).
     * Returns { point, normal, dist, kind: 'terrain'|'wall'|'car'|'prop'|'ped'|'officer'|'none', ref, zone }.
     */
    cast(origin, dir, maxD = 150, opts = {}) {
      let best = { dist: maxD, kind: 'none', point: origin.clone().addScaledVector(dir, maxD), normal: dir.clone().negate() };
      const hit = physics.world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), maxD, true, undefined, RAY_GROUPS, opts.excludeCollider);
      if (hit && hit.timeOfImpact < best.dist) {
        const c = hit.collider, info = colliderMap().get(c.handle);
        const kind = info ? info.kind : c.shape.type === RAPIER.ShapeType.HeightField ? 'terrain' : 'wall';
        best = { dist: hit.timeOfImpact, kind, ref: info?.car || info?.item || null, police: !!info?.police, point: origin.clone().addScaledVector(dir, hit.timeOfImpact), normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z) };
      }
      for (const t of targets(opts.exclude)) {
        // Cheap reject: distance from the ray to the person's position.
        _h.set(t.pos.x - origin.x, t.pos.y + 1 - origin.y, t.pos.z - origin.z);
        const along = _h.dot(dir);
        if (along < 0 || along > best.dist + 1) continue;
        if (_h.lengthSq() - along * along > 4) continue;
        if (t.down) continue;
        zonesOf(t.ch, t.scale, zone);
        const th = raySphere(origin, dir, zone.head, zone.headR);
        const tb = rayCapsule(origin, dir, zone.a, zone.b, zone.bodyR);
        const tt = Math.min(th, tb);
        if (tt < best.dist) {
          best = { dist: tt, kind: t.kind, ref: t.ref, zone: th <= tb ? 'head' : 'body', point: origin.clone().addScaledVector(dir, tt), normal: dir.clone().negate() };
        }
      }
      return best;
    },
  };
}
