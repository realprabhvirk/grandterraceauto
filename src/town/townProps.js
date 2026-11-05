// Town street furniture. Breakable (instanced): street trees, street lights, bins, give-way
// signs. Static: bus shelters. Also builds the pedestrian loops round every block.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, boxB, cylinder, icosa, merge } from '../utils/geom.js';
import { PALETTE } from '../art/palette.js';
import { T } from './townPlan.js';
import { frame } from './townKit.js';

function instanced(geo, mat, items, shadow = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  mesh.count = items.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  items.forEach((it, i) => { m.compose(new THREE.Vector3(it.x, it.y, it.z), q.setFromAxisAngle(Y, it.rot || 0), it.s ? new THREE.Vector3(it.s, it.s, it.s) : one); mesh.setMatrixAt(i, m); });
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function buildTownProps({ plan, rng, chunk, atlas, avoid }) {
  const group = new THREE.Group();
  group.name = 'town-props';
  const defs = [];
  const { X, Z, hw, kerb, path, h } = T;
  const y = h + 0.08;
  const nearNode = (x, z, r) => plan.nodes.some((n) => Math.hypot(n.x - x, n.z - z) < r);
  const blocked = (x, z, r = 2) => avoid.some((a) => x > a.x0 - r && x < a.x1 + r && z > a.z0 - r && z < a.z1 + r);

  // Kerb-side spots round every block (and outside the ring road), every `step` metres.
  const spots = (inset, step, phase = 0) => {
    const out = [];
    const edge = (ax, az, bx, bz, nx, nz) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let s = 6 + phase; s < len - 6; s += step) {
        const x = ax + ((bx - ax) * s) / len + nx * inset, z = az + ((bz - az) * s) / len + nz * inset;
        if (!nearNode(x, z, hw + 9) && !blocked(x, z)) out.push({ x, z, rot: Math.atan2(-nx, -nz) });
      }
    };
    for (const b of plan.blocks) {
      edge(b.x0, b.z0, b.x1, b.z0, 0, 1); edge(b.x0, b.z1, b.x1, b.z1, 0, -1);
      edge(b.x0, b.z0, b.x0, b.z1, 1, 0); edge(b.x1, b.z0, b.x1, b.z1, -1, 0);
    }
    const XL = X[X.length - 1];
    const o = { x0: X[0] - hw, x1: XL + hw, z0: Z[0] - hw, z1: Z[2] + hw };
    edge(o.x0, o.z0, o.x1, o.z0, 0, -1); edge(o.x0, o.z1, o.x1, o.z1, 0, 1);
    edge(o.x0, o.z0, o.x0, o.z1, -1, 0); edge(o.x1, o.z0, o.x1, o.z1, 1, 0);
    return out;
  };

  // --- Street trees ------------------------------------------------------------------------------
  const trees = spots(kerb + 1.1, 16).filter((p) => !(Math.abs(p.z - Z[1]) < 12 && p.x > X[0] && p.x < X[1] && p.z > Z[1])).map((p) => ({ ...p, y, s: rng.range(0.85, 1.15), rot: rng.range(0, 6.28) }));
  const treeGeo = merge([
    cylinder(0.13, 0.18, 3.2, 6, 0, 0, 0, PALETTE.tree.trunk),
    boxB(1.1, 0.12, 1.1, 0, 0, 0, '#6d5a48'),
    icosa(1.7, 0, 0, 4.2, 0, '#5f8a45', { sy: 0.9 }),
    icosa(1.2, 0, 0.6, 5.2, 0.3, '#6f9a52', { sy: 0.85 }),
  ]);
  const treeMesh = instanced(treeGeo, MAT.solid, trees);
  group.add(treeMesh);
  defs.push({ name: 'streetTree', meshes: [{ mesh: treeMesh, mode: 'follow' }], items: trees, r: 0.2, h: 3.2, toughness: 9, carDamage: 18 });

  // --- Street lights (kerb side, opposite phase to the trees) -----------------------------------
  const lights = spots(kerb + 0.5, 32, 8).map((p) => ({ ...p, y: h + 0.05 }));
  const poleGeo = merge([cylinder(0.08, 0.11, 7, 7, 0, 0, 0, '#7d807c'), box(0.12, 0.12, 1.8, 0, 6.95, 0.85, '#7d807c')]);
  const headGeo = box(0.5, 0.16, 0.9, 0, 6.85, 1.65, '#e9e2cf');
  const poleMesh = instanced(poleGeo, MAT.solid, lights);
  const headMesh = instanced(headGeo, MAT.streetHead, lights, false);
  group.add(poleMesh, headMesh);
  defs.push({ name: 'townLight', meshes: [{ mesh: poleMesh, mode: 'follow' }, { mesh: headMesh, mode: 'hide' }], items: lights, r: 0.12, h: 7, toughness: 8, carDamage: 20, sparks: true });

  // --- Bins (public litter bins at corners and bus stops) ---------------------------------------
  const bins = [];
  for (const b of plan.blocks) for (const [x, z] of [[b.x0 + 1.4, b.z0 + 1.4], [b.x1 - 1.4, b.z0 + 1.4], [b.x0 + 1.4, b.z1 - 1.4], [b.x1 - 1.4, b.z1 - 1.4]]) if (!blocked(x, z, 0.5)) bins.push({ x, y, z, rot: 0 });
  const binMesh = instanced(merge([cylinder(0.3, 0.27, 0.95, 8, 0, 0, 0, '#3d5e45'), cylinder(0.33, 0.33, 0.08, 8, 0, 0.95, 0, '#2b2b2e')]), MAT.solid, bins);
  group.add(binMesh);
  defs.push({ name: 'townBin', meshes: [{ mesh: binMesh, mode: 'follow' }], items: bins, r: 0.32, h: 1, toughness: 2, carDamage: 2 });

  // --- Give-way signs on minor approaches (face = atlas row) ------------------------------------
  const signs = [];
  for (const n of plan.nodes) {
    if (n.links.length < 3) continue;
    for (const m of n.links) {
      const isMain = (n.z === m.z && (n.z === Z[1] || n.z === Z[0] || n.z === Z[2])) || (n.x === m.x && (n.x === X[0] || n.x === X[X.length - 1]));
      if (isMain) continue;
      const dx = Math.sign(m.x - n.x), dz = Math.sign(m.z - n.z);
      // Left side of the inbound lane (keep left), just behind the kerb.
      const x = n.x + dx * (hw + 3) + dz * (hw + kerb + 0.6), z = n.z + dz * (hw + 3) - dx * (hw + kerb + 0.6);
      signs.push({ x, y, z, rot: Math.atan2(-dx, -dz) + Math.PI });
    }
  }
  const row = atlas.row('GIVE WAY', '#c8322a', '#ffffff', 'bold 44px Arial');
  const face = new THREE.PlaneGeometry(0.75, 0.6);
  const uv = face.attributes.uv;
  for (let k = 0; k < uv.count; k++) { uv.setX(k, 0.3 + uv.getX(k) * 0.4); uv.setY(k, 1 - (row + 1 - uv.getY(k)) / 16); }
  face.rotateY(Math.PI).translate(0, 2.3, -0.035);
  const signPole = instanced(merge([cylinder(0.04, 0.04, 2.6, 6, 0, 0, 0, '#8d8f8a'), box(0.8, 0.65, 0.04, 0, 2.3, 0, '#f4f1e8')]), MAT.solid, signs);
  const signFace = instanced(face, atlas.mat, signs, false);
  group.add(signPole, signFace);
  defs.push({ name: 'townSign', meshes: [{ mesh: signPole, mode: 'follow' }, { mesh: signFace, mode: 'follow' }], items: signs, r: 0.08, h: 2.7, toughness: 5, carDamage: 6 });

  // --- Bus shelters on Terrace Pde (static) -------------------------------------------------------
  const stops = [];
  for (const [x, north] of [[462, true], [478, false], [372, true]]) {
    const z = Z[1] + (north ? -1 : 1) * (hw + kerb + 2.9);
    const F = frame(x, z, 0, north ? 1 : -1, y);
    const ch = chunk(north ? (x < X[1] ? 'b00' : 'b10') : 'b11');
    ch.box(F, 4.2, 0.12, 1.7, 0, 2.5, -0.2, '#5c6772');
    for (const s of [-1, 1]) ch.block(F, 0.1, 2.5, 0.1, s * 2, 0, -0.9, '#5c6772');
    ch.box(F, 4, 1.8, 0.05, 0, 0.5, -0.95, '#9fc4d6', { glassy: true });
    ch.block(F, 3, 0.45, 0.45, 0, 0, -0.6, PALETTE.town.wood);
    ch.block(F, 0.08, 2.7, 0.08, 2.6, 0, 0.5, '#8d8f8a');
    ch.box(F, 0.5, 0.6, 0.04, 2.6, 2.1, 0.5, '#2f6b5a');
    atlas.sign(F, atlas.row('BUS', '#2f6b5a', '#ffffff'), 0.46, 0.3, 2.6, 2.4, 0.53, { u0: 0.4, u1: 0.6 });
    stops.push({ x, z });
  }

  // --- Pedestrian loops (mid footpath round each block and outside the ring) --------------------
  const lines = [];
  const loop = (x0, x1, z0, z1, inset, outward) => {
    const pts = [], add = (x, z, ox, oz) => pts.push({ x, z, y, ox, oz, detour: null });
    const a = { x0: x0 + inset, x1: x1 - inset, z0: z0 + inset, z1: z1 - inset };
    const runs = [[a.x0, a.z0, a.x1, a.z0, 0, -1], [a.x1, a.z0, a.x1, a.z1, 1, 0], [a.x1, a.z1, a.x0, a.z1, 0, 1], [a.x0, a.z1, a.x0, a.z0, -1, 0]];
    for (const [ax, az, bx, bz, nx, nz] of runs) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.5));
      for (let k = 0; k < n; k++) add(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, outward * nx, outward * nz);
    }
    pts.push({ ...pts[0] });
    lines.push(pts);
  };
  const mid = kerb + path / 2;
  for (const b of plan.blocks) loop(b.x0, b.x1, b.z0, b.z1, mid, -1); // ox/oz: away from the road
  loop(X[0] - hw, X[X.length - 1] + hw, Z[0] - hw, Z[2] + hw, -mid, 1);

  return { group, defs, lines, stops };
}
