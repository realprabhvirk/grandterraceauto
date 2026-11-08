// Small roadworks on Grand Terrace: breakable cones along the kerb lane, a barrier, an
// A-frame "ROADWORKS" sign, a dug patch; two hi-vis workers stand on the verge (spots).
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { boxB, cylinder, merge } from '../utils/geom.js';
import { ROAD } from '../world/roadNetwork.js';

export function buildRoadworks({ network, terrain, atlas, avoid = [] }) {
  const S = network.main.samples, n = S.length;
  // A straight stretch away from junctions and the hero house.
  let i0 = Math.round(n * 0.4);
  for (let i = Math.round(n * 0.3); i < n * 0.7; i += 4) {
    const s = S[i];
    if (network.junctions.some((j) => Math.hypot(j.x - s.x, j.z - s.z) < 45)) continue;
    if (avoid.some((a) => Math.hypot(a.x - s.x, a.z - s.z) < a.r)) continue;
    i0 = i; break;
  }
  const side = 1, group = new THREE.Group();
  group.name = 'roadworks';
  const at = (k, lat) => { const s = S[Math.max(0, Math.min(n - 1, i0 + k))]; const x = s.x + s.nx * lat * side, z = s.z + s.nz * lat * side; return { x, z, y: terrain.getHeight(x, z), s }; };
  // Cones along the kerb lane (outside the traffic lane), breakable.
  const cones = [];
  for (let k = -6; k <= 6; k += 2) { const p = at(k, ROAD.halfW - 0.55); cones.push({ x: p.x, y: p.y + 0.06, z: p.z, rot: 0 }); }
  const coneGeo = merge([cylinder(0.02, 0.17, 0.62, 8, 0, 0, 0, '#f07a1a'), cylinder(0.11, 0.13, 0.1, 8, 0, 0.3, 0, '#f4f1e8'), boxB(0.4, 0.04, 0.4, 0, 0, 0, '#2b2b2e')]);
  const coneMesh = new THREE.InstancedMesh(coneGeo, MAT.instanced, cones.length);
  const m = new THREE.Matrix4();
  cones.forEach((c, k) => coneMesh.setMatrixAt(k, m.makeTranslation(c.x, c.y, c.z)));
  coneMesh.castShadow = true;
  coneMesh.computeBoundingSphere();
  group.add(coneMesh);
  // Dug patch + barrier on the verge, A-frame sign facing oncoming traffic.
  const statics = [];
  const patch = at(0, ROAD.halfW + 1.0), yaw = Math.atan2(patch.s.tx, patch.s.tz);
  statics.push(boxB(1.4, 0.08, 3.2, 0, 0, 0, '#5a4a3c', { rotY: 0 }).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(patch.x, patch.y + 0.03, patch.z)));
  const bar = at(-1, ROAD.halfW + 2.1);
  statics.push(merge([boxB(2.4, 0.3, 0.06, 0, 0.55, 0, '#f4f1e8'), boxB(0.6, 0.3, 0.07, -0.6, 0.55, 0, '#e2553e'), boxB(0.6, 0.3, 0.07, 0.6, 0.55, 0, '#e2553e'), boxB(0.08, 0.9, 0.3, -1.1, 0, 0, '#3a3a3c'), boxB(0.08, 0.9, 0.3, 1.1, 0, 0, '#3a3a3c')]).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw + Math.PI / 2).setPosition(bar.x, bar.y, bar.z)));
  const sign = at(-14, ROAD.halfW + 1.4);
  statics.push(merge([boxB(0.9, 0.8, 0.05, 0, 0.5, 0.05, '#f2d23a'), boxB(0.05, 0.9, 0.5, -0.42, 0, 0, '#3a3a3c'), boxB(0.05, 0.9, 0.5, 0.42, 0, 0, '#3a3a3c')]).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw + Math.PI).setPosition(sign.x, sign.y, sign.z)));
  const sm = new THREE.Mesh(merge(statics), MAT.solid);
  sm.castShadow = sm.receiveShadow = true;
  group.add(sm);
  atlas.sign({ rot: yaw + Math.PI, y: sign.y, toW: (lx, lz) => ({ x: sign.x + lx * Math.cos(yaw + Math.PI) + lz * Math.sin(yaw + Math.PI), z: sign.z - lx * Math.sin(yaw + Math.PI) + lz * Math.cos(yaw + Math.PI) }) },
    atlas.row('ROADWORKS', '#f2d23a', '#1d1d1d'), 0.85, 0.35, 0, 0.92, 0.085, { u0: 0.15, u1: 0.85 });
  // Worker spots on the verge (hi-vis): one points at the hole, one watches traffic.
  const w1 = at(1, ROAD.halfW + 2.3), w2 = at(-3, ROAD.halfW + 2.6);
  const spots = [
    { role: 'worker', x: w1.x, y: w1.y, z: w1.z, yaw: Math.atan2(patch.x - w1.x, patch.z - w1.z), action: 'point' },
    { role: 'worker', x: w2.x, y: w2.y, z: w2.z, yaw: yaw + Math.PI, action: 'look' },
  ];
  const def = { name: 'cone', meshes: [{ mesh: coneMesh, mode: 'follow' }], items: cones, r: 0.18, h: 0.65, toughness: 1, carDamage: 0.5 };
  return { group, def, spots, centre: { x: patch.x, z: patch.z } };
}
