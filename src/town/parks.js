// Two parks. Central Gardens (town, behind the south shops): lawn, gravel paths, fountain,
// bandstand, benches, trees. Wattle Park (suburb, near the cul-de-sacs): loop path,
// benches, playground (swings, slide, climbing frame), pond, picnic shelter, trees.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, boxB, cylinder, icosa, merge, painted } from '../utils/geom.js';
import { PALETTE } from '../art/palette.js';
import { T } from './townPlan.js';

const C = PALETTE.town;

function bench(list, x, y, z, rot) {
  const g = [boxB(1.8, 0.08, 0.5, 0, 0.42, 0, C.wood), boxB(1.8, 0.4, 0.07, 0, 0.55, -0.24, C.wood), boxB(0.08, 0.42, 0.45, -0.8, 0, 0, '#3a3a3c'), boxB(0.08, 0.42, 0.45, 0.8, 0, 0, '#3a3a3c')];
  const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
  for (const q of g) list.push(q.applyMatrix4(m));
}
function tree(list, x, y, z, s = 1, tint = '#5f8a45') {
  list.push(cylinder(0.16 * s, 0.22 * s, 3.6 * s, 6, x, y, z, PALETTE.tree.trunk), icosa(2.2 * s, 0, x, y + 4.6 * s, z, tint, { sy: 0.85 }), icosa(1.5 * s, 0, x + 0.8 * s, y + 5.6 * s, z + 0.4 * s, '#6f9a52', { sy: 0.8 }));
}

/** Central Gardens: x 429..511, z -56..35.7 (behind the south shops of Terrace Pde). */
export function buildCentralGardens(ch, atlas, rng) {
  const x0 = 429.5, x1 = 510.5, z0 = -57, z1 = T.Z[2] - T.hw - T.kerb - T.path + 0.2, y = T.h + 0.06;
  const cx = 470, cz = (z0 + z1) / 2 - 2;
  const S = ch.solid, trunks = [], benches = [];
  S.push(box(x1 - x0, 0.1, z1 - z0, (x0 + x1) / 2, y + 0.0, (z0 + z1) / 2, C.grassPark, { jitter: 0.06 }));
  S.push(box(3, 0.1, z1 - z0, cx, y + 0.02, (z0 + z1) / 2, C.gravel), box(x1 - x0, 0.1, 3, (x0 + x1) / 2, y + 0.021, cz, C.gravel));
  // Gravel ring round the fountain.
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; S.push(box(2.8, 0.1, 2.4, cx + Math.cos(a) * 9, y + 0.022, cz + Math.sin(a) * 9, C.gravel, { rotY: -a })); }
  // Fountain.
  S.push(cylinder(4.2, 4.4, 0.7, 16, cx, y, cz, C.concrete), cylinder(3.9, 3.9, 0.08, 16, cx, y + 0.55, cz, C.water));
  S.push(cylinder(0.35, 0.5, 1.8, 8, cx, y + 0.5, cz, C.concrete), cylinder(1.3, 0.4, 0.4, 10, cx, y + 2.2, cz, C.concrete), cylinder(1.1, 1.1, 0.06, 10, cx, y + 2.55, cz, C.water));
  ch.colliders.push({ x: cx, y: y + 0.35, z: cz, hx: 3.6, hy: 0.35, hz: 3.6, rot: Math.PI / 8 });
  // Bandstand (west lawn).
  const bx = 446, bz = cz + 22;
  S.push(cylinder(4.6, 4.8, 0.7, 8, bx, y, bz, '#e9e4d8'));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; S.push(cylinder(0.12, 0.12, 3, 6, bx + Math.cos(a) * 4.2, y + 0.7, bz + Math.sin(a) * 4.2, '#f4f1e8')); }
  S.push(painted(new THREE.ConeGeometry(5.4, 2.2, 8).rotateY(Math.PI / 8), '#2f6b5a', bx, y + 4.8, bz));
  ch.colliders.push({ x: bx, y: y + 0.35, z: bz, hx: 4.2, hy: 0.35, hz: 4.2, rot: 0 });
  // Benches around the fountain, trees around the edge.
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5; const x = cx + Math.cos(a) * 12.5, z = cz + Math.sin(a) * 12.5; bench(S, x, y, z, Math.atan2(cx - x, cz - z)); benches.push({ x, y, z, yaw: Math.atan2(cx - x, cz - z) }); }
  for (let k = 0; k < 16; k++) {
    const x = rng.range(x0 + 3, x1 - 3), z = rng.range(z0 + 4, z1 - 3);
    if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4 || Math.hypot(x - cx, z - cz) < 16 || Math.hypot(x - bx, z - bz) < 8) continue;
    const s = rng.range(0.9, 1.25);
    tree(S, x, y, z, s);
    trunks.push({ x, y, z, r: 0.22 * s, h: 3.6 * s });
  }
  atlas.sign({ rot: 0, y, toW: (lx, lz) => ({ x: cx + lx, z: z1 - 0.2 + lz }) }, atlas.row('CENTRAL GARDENS', '#2f6b5a', '#f4f1e8'), 6, 0.6, 0, 2.2, 0.12);
  S.push(boxB(6.4, 0.9, 0.2, cx, y + 1.75, z1 - 0.2, '#2f6b5a'), boxB(0.15, 1.8, 0.15, cx - 3, y, z1 - 0.2, '#3a3a3c'), boxB(0.15, 1.8, 0.15, cx + 3, y, z1 - 0.2, '#3a3a3c'));
  return { trunks, benches, centre: { x: cx, z: cz }, bounds: { x0, x1, z0, z1 }, paths: [[cx, z0], [cx, z1], [x0, cz], [x1, cz]] };
}

/** Pick a flat open spot for Wattle Park near the cul-de-sacs (before trees are placed). */
export function findWattleSite(network, layout, terrain) {
  let best = null;
  for (const pad of network.pads) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) for (const r of [42, 52, 62, 72]) {
    const x = pad.x + Math.cos(a) * r, z = pad.z + Math.sin(a) * r;
    if (Math.abs(x) > 205 || Math.abs(z) > 205) continue;
    const n = network.index.nearest(x, z, 40);
    if (n && n.d < 24) continue;
    if (layout.lots.some((l) => Math.hypot(l.x - x, l.z - z) < (l.kind === 'hero' ? 42 : 30))) continue;
    if (network.pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 22)) continue;
    let lo = Infinity, hi = -Infinity;
    for (let dx = -18; dx <= 18; dx += 6) for (let dz = -14; dz <= 14; dz += 7) { const h = terrain.getHeight(x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const score = (hi - lo) * 3 + (n ? Math.abs(n.d - 30) * 0.1 : 4) + r * 0.02;
    if (!best || score < best.score) best = { x, z, score, range: hi - lo, pad };
  }
  return best;
}

/** Wattle Park geometry (draped on the terrain). */
export function buildWattlePark(site, terrain, atlas, rng) {
  const S = [], trunks = [], colliders = [], benches = [];
  const H = (x, z) => terrain.getHeight(x, z);
  const { x: cx, z: cz } = site;
  // Loop path (ellipse) of short draped gravel segments.
  const rx = 17, rz = 12, N = 44, loop = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, xn = cx + Math.cos(a1) * rx, zn = cz + Math.sin(a1) * rz;
    const len = Math.hypot(xn - x, zn - z) + 0.4, mx = (x + xn) / 2, mz = (z + zn) / 2;
    S.push(box(1.8, 0.12, len, mx, H(mx, mz) + 0.03, mz, C.gravel, { rotY: Math.atan2(xn - x, zn - z) }));
    loop.push({ x, z, y: H(x, z) + 0.06 });
  }
  // Pond (inside the loop, east): water disc at the lowest local height + stone rim.
  const px = cx + 7, pz = cz + 1, ph = Math.min(H(px, pz), H(px + 3, pz), H(px - 3, pz), H(px, pz + 3), H(px, pz - 3));
  S.push(cylinder(4.6, 4.6, 0.25, 16, px, ph - 0.1, pz, '#8d8478'), cylinder(4.2, 4.2, 0.2, 16, px, ph - 0.02, pz, C.water));
  for (let k = 0; k < 4; k++) S.push(icosa(0.5, 0, px + Math.cos(k * 1.7) * 4.5, ph + 0.1, pz + Math.sin(k * 1.7) * 4.5, '#9a958b', { sy: 0.6 }));
  // Playground (inside the loop, west): swings, slide, climbing frame on bark.
  const gx = cx - 7, gz = cz, gy = H(gx, gz);
  S.push(box(9, 0.08, 7, gx, gy + 0.04, gz, '#9a7752'));
  const P = C.play;
  for (const s of [-1, 1]) S.push(painted(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6).rotateX(s * 0.25), P[1], gx - 2.5 + s * 1.6, gy + 1.25, gz - 2.2));
  S.push(painted(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6).rotateZ(Math.PI / 2), P[1], gx - 2.5, gy + 2.5, gz - 2.2));
  for (const dx of [-0.6, 0.6]) { S.push(boxB(0.5, 0.05, 0.2, gx - 2.5 + dx, gy + 0.5, gz - 2.2, '#2b2b2e')); S.push(boxB(0.02, 2.0, 0.02, gx - 2.5 + dx, gy + 0.5, gz - 2.2, '#9a9a9a')); }
  S.push(boxB(1.4, 1.5, 1.4, gx + 2.4, gy, gz - 1.6, P[0]), boxB(1.6, 0.1, 1.6, gx + 2.4, gy + 1.5, gz - 1.6, P[2]));
  S.push(painted(new THREE.BoxGeometry(0.8, 0.08, 3.2).rotateX(0.5), P[2], gx + 2.4, gy + 0.85, gz + 0.6));
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) S.push(cylinder(0.05, 0.05, 1.8, 5, gx + dx, gy, gz + 2.6 + dz, P[3]));
  for (const yy of [0.6, 1.2, 1.8]) S.push(boxB(1.7, 0.05, 1.7, gx, gy + yy, gz + 2.6, P[3]));
  colliders.push({ x: gx + 2.4, y: gy + 0.75, z: gz - 1.6, hx: 0.7, hy: 0.75, hz: 0.7, rot: 0 }, { x: gx, y: gy + 0.9, z: gz + 2.6, hx: 0.85, hy: 0.9, hz: 0.85, rot: 0 });
  // Picnic shelter (north of the loop) with a table.
  const sx = cx, sz = cz - rz - 6, sy = H(sx, sz);
  S.push(box(6, 0.12, 4.6, sx, sy + 0.04, sz, C.concrete));
  for (const [dx, dz] of [[-2.6, -2], [2.6, -2], [-2.6, 2], [2.6, 2]]) S.push(boxB(0.18, 2.6, 0.18, sx + dx, sy, sz + dz, C.wood));
  S.push(painted(new THREE.ConeGeometry(4.4, 1.4, 4).rotateY(Math.PI / 4).scale(1, 1, 0.8), '#7a3f31', sx, sy + 3.3, sz));
  S.push(boxB(2.6, 0.08, 1.0, sx, sy + 0.75, sz, C.wood), boxB(2.6, 0.06, 0.3, sx, sy + 0.45, sz - 0.75, C.wood), boxB(2.6, 0.06, 0.3, sx, sy + 0.45, sz + 0.75, C.wood));
  colliders.push({ x: sx, y: sy + 0.4, z: sz, hx: 1.3, hy: 0.4, hz: 0.5, rot: 0 });
  // Benches on the loop, trees around, sign.
  for (const k of [5, 16, 27, 38]) { const p = loop[k], yaw = Math.atan2(cx - p.x, cz - p.z); const bxp = p.x - Math.sin(yaw) * 1.4, bzp = p.z - Math.cos(yaw) * 1.4; bench(S, bxp, H(bxp, bzp), bzp, yaw); benches.push({ x: bxp, y: H(bxp, bzp), z: bzp, yaw }); }
  for (let k = 0; k < 11; k++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(1.25, 1.6);
    const x = cx + Math.cos(a) * rx * r, z = cz + Math.sin(a) * rz * r;
    if (Math.hypot(x - sx, z - sz) < 6) continue;
    const s = rng.range(0.85, 1.2);
    tree(S, x, H(x, z), z, s, '#6a8f3e');
    trunks.push({ x, y: H(x, z), z, r: 0.22 * s, h: 3.6 * s });
  }
  const signX = cx - rx - 3, signZ = cz, signY = H(signX, signZ);
  S.push(boxB(0.15, 1.6, 0.15, signX, signY, signZ - 2, '#3a3a3c'), boxB(0.15, 1.6, 0.15, signX, signY, signZ + 2, '#3a3a3c'), boxB(0.15, 0.8, 4.4, signX, signY + 1.4, signZ, '#2f6b5a'));
  atlas.sign({ rot: -Math.PI / 2, y: signY, toW: (lx, lz) => ({ x: signX - lz, z: signZ + lx }) }, atlas.row('WATTLE PARK', '#2f6b5a', '#f4f1e8'), 4, 0.6, 0, 1.8, 0.09);
  // Picnic rug + basket on the lawn inside the loop (two picnickers sit here).
  const rx0 = cx, rz0 = cz + 5.5, ry = H(rx0, rz0);
  S.push(box(2.2, 0.03, 1.6, rx0, ry + 0.03, rz0, '#c8553e'), box(2.2, 0.035, 0.18, rx0, ry + 0.035, rz0 - 0.4, '#f4f1e8'), box(2.2, 0.035, 0.18, rx0, ry + 0.035, rz0 + 0.4, '#f4f1e8'));
  S.push(boxB(0.45, 0.28, 0.3, rx0, ry, rz0 - 0.2, '#a8743f'), box(0.3, 0.04, 0.3, rx0 + 0.4, ry + 0.05, rz0 + 0.3, '#e2c25a'));
  const picnic = [{ x: rx0 - 1.0, y: ry, z: rz0, yaw: Math.PI / 2 }, { x: rx0 + 1.0, y: ry, z: rz0, yaw: -Math.PI / 2 }];
  // Jogging line round the loop path (closed polyline for pedestrians).
  const line = loop.map((p) => { const ox = p.x - cx, oz = p.z - cz, l = Math.hypot(ox, oz) || 1; return { x: p.x, z: p.z, y: p.y, ox: ox / l, oz: oz / l, detour: null }; });
  line.push({ ...line[0] });
  const mesh = new THREE.Mesh(merge(S), MAT.solid);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = 'wattle-park';
  return { mesh, trunks, colliders, benches, loop, line, picnic, centre: { x: cx, z: cz } };
}
