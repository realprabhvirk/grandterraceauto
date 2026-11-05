// Town street surfaces: asphalt, lane markings, zebra crossings, kerbs around every block
// and around the outside of the ring road, and wide paved footpaths. Two merged meshes
// (asphalt+markings as a decal, kerbs+paving) - flat ground, so physics is just terrain.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, merge } from '../utils/geom.js';
import { ROAD } from '../world/roadNetwork.js';
import { T } from './townPlan.js';

const C = PALETTE.town;

/** Horizontal rectangle (thin box) helper: x0..x1, z0..z1, top at y. */
const slab = (x0, x1, z0, z1, top, th, color, jitter = 0.03) => box(x1 - x0, th, z1 - z0, (x0 + x1) / 2, top - th / 2, (z0 + z1) / 2, color, { jitter });

export function buildTownRoads(plan) {
  const { X, Z, hw, kerb, path, h } = T;
  const asphalt = [], marks = [], kerbs = [], paving = [];
  const xa = X[0], xb = X[X.length - 1], za = Z[0], zb = Z[Z.length - 1];

  // Asphalt: every street, extended over its end intersections.
  for (const x of X) asphalt.push(slab(x - hw, x + hw, za - hw, zb + hw, h + 0.06, 0.2, PALETTE.road.asphalt, 0.035));
  for (const z of Z) asphalt.push(slab(xa - hw, xb + hw, z - hw, z + hw, h + 0.061, 0.2, PALETTE.road.asphalt, 0.035));
  // Extra streets outside the main grid (Northgate).
  for (const r of plan.roads.filter((q) => q.extra && !(q.highway && !q.ramp))) { // the motorway has its own mesh (city/highway.js)
    const a = r.samples[0], b = r.samples[r.samples.length - 1];
    asphalt.push(slab(Math.min(a.x, b.x) - hw, Math.max(a.x, b.x) + hw, Math.min(a.z, b.z) - hw, Math.max(a.z, b.z) + hw, h + 0.06, 0.2, PALETTE.road.asphalt, 0.035));
  }
  const exits = plan.roads.filter((q) => q.extra && q.samples[q.samples.length - 1].z === za).map((q) => q.samples[0].x);

  // Dashed centre lines between intersections + stop lines on give-way approaches.
  const dash = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
    for (let s = 0; s + 3 <= len; s += 6) {
      const cx = ax + tx * (s + 1.5), cz = az + tz * (s + 1.5);
      marks.push(box(tx ? 3 : 0.14, 0.02, tz ? 3 : 0.14, cx, h + 0.075, cz, C.line, { jitter: 0.01 }));
    }
  };
  const gap = hw + 4;
  for (const { a, b } of plan.edges) {
    if (a.highway && b.highway) continue; // motorway markings come from city/highway.js
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
    dash(a.x + dx * gap, a.z + dz * gap, b.x - dx * gap, b.z - dz * gap);
  }
  // Zebra crossings: mid-block on Terrace Pde and across Market / Station St near the Pde.
  const zebra = (cx, cz, alongX) => {
    for (let k = -hw + 0.6; k <= hw - 0.5; k += 1.1) {
      marks.push(alongX ? box(3, 0.02, 0.55, cx, h + 0.076, cz + k, C.line, { jitter: 0.01 }) : box(0.55, 0.02, 3, cx + k, h + 0.076, cz, C.line, { jitter: 0.01 }));
    }
  };
  zebra((X[1] + X[2]) / 2, Z[1], true);
  zebra(X[1], Z[1] - 14, false);
  zebra(X[2], Z[1] + 14, false);
  for (const n of plan.nodes) {
    if (n.links.length < 3) continue;
    for (const m of n.links) {
      const isMain = (n.z === m.z && (n.z === Z[1] || n.z === za || n.z === zb)) || (n.x === m.x && (n.x === xa || n.x === xb));
      if (isMain) continue;
      // Give-way line across the left (inbound) half of the approach.
      const dx = Math.sign(m.x - n.x), dz = Math.sign(m.z - n.z);
      const cx = n.x + dx * (hw + 1.2) + dz * hw / 2, cz = n.z + dz * (hw + 1.2) - dx * hw / 2;
      marks.push(box(dx ? 0.35 : hw, 0.02, dz ? 0.35 : hw, cx, h + 0.076, cz, C.line, { jitter: 0.01 }));
    }
  }

  // Kerbs + paving around a rectangle (kerb faces at x0..x1, z0..z1). inward: footpath
  // inside the rectangle (blocks) or outside it (around the ring road).
  const ring = (x0, x1, z0, z1, inward, skip = () => false) => {
    const s = inward ? 1 : -1, k = kerb, p = path;
    const sides = [
      // [axis 'x' strip along x at z, from, to, z (kerb face), dir into footpath]
      ['x', x0, x1, z0, s], ['x', x0, x1, z1, -s], ['z', z0, z1, x0, s], ['z', z0, z1, x1, -s],
    ];
    for (const [ax, a0, a1, at, d] of sides) {
      const ext = inward ? 0 : k + p; // outer ring strips overlap at the corners
      const A0 = a0 - ext, A1 = a1 + ext;
      // Split around skipped spans (the Terrace Link mouth).
      const spans = [];
      let cur = A0;
      for (let t = A0; t <= A1; t += 0.5) {
        const pos = ax === 'x' ? [t, at] : [at, t];
        if (skip(pos[0], pos[1])) { if (t - cur > 0.6) spans.push([cur, t]); cur = t + 0.5; }
      }
      if (A1 - cur > 0.6) spans.push([cur, A1]);
      for (const [b0, b1] of spans) {
        const k0 = at, k1 = at + d * k, p1 = at + d * (k + p);
        if (ax === 'x') {
          kerbs.push(slab(b0, b1, Math.min(k0, k1), Math.max(k0, k1), h + 0.17, 0.25, PALETTE.road.curb));
          paving.push(slab(b0, b1, Math.min(k1, p1), Math.max(k1, p1), h + 0.08, 0.14, C.paving, 0.04));
        } else {
          kerbs.push(slab(Math.min(k0, k1), Math.max(k0, k1), b0, b1, h + 0.17, 0.25, PALETTE.road.curb));
          paving.push(slab(Math.min(k1, p1), Math.max(k1, p1), b0, b1, h + 0.08, 0.14, C.paving, 0.04));
        }
      }
    }
  };
  for (const b of plan.blocks) ring(b.x0, b.x1, b.z0, b.z1, true);
  const linkGap = ROAD.curbOut + 0.2;
  ring(xa - hw, xb + hw, za - hw, zb + hw, false, (x, z) => (x < xa && Math.abs(z - Z[1]) < linkGap) || (z < za && exits.some((ex) => Math.abs(x - ex) < hw + 0.3)));

  const road = new THREE.Mesh(merge([...asphalt, ...marks]), MAT.decal);
  road.receiveShadow = true;
  road.name = 'town-roads';
  const kp = new THREE.Mesh(merge([...kerbs, ...paving]), MAT.solid);
  kp.receiveShadow = true;
  kp.name = 'town-kerbs';
  const group = new THREE.Group();
  group.name = 'town-streets';
  group.add(road, kp);
  return group;
}
