// Low-poly yard trees, instanced: two species (round eucalypt-ish icosphere crown and a
// stacked-cone pine), trunk + foliage per species = 4 draw calls for every tree.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { cylinder, icosa, painted, merge } from '../utils/geom.js';
import { makeRng } from '../utils/rng.js';

const WHITE = '#ffffff';

function roundTree() {
  return {
    trunk: merge([
      cylinder(0.16, 0.24, 2.6, 6, 0, 0, 0, WHITE),
      cylinder(0.08, 0.12, 1.2, 5, 0.35, 2.0, 0.1, WHITE),
    ]),
    leaves: merge([
      icosa(1.9, 0, 0, 3.6, 0, WHITE, { sy: 0.8 }),
      icosa(1.35, 0, 1.1, 3.2, 0.6, WHITE, { sy: 0.85 }),
      icosa(1.25, 0, -0.9, 3.4, -0.5, WHITE, { sy: 0.8 }),
      icosa(1.1, 0, 0.2, 4.5, -0.2, WHITE, { sy: 0.85 }),
    ]),
  };
}

function pineTree() {
  return {
    trunk: cylinder(0.14, 0.2, 1.6, 6, 0, 0, 0, WHITE),
    leaves: merge([
      painted(new THREE.ConeGeometry(1.8, 2.6, 7), WHITE, 0, 2.4, 0, 0.08),
      painted(new THREE.ConeGeometry(1.4, 2.2, 7), WHITE, 0, 3.6, 0, 0.08),
      painted(new THREE.ConeGeometry(0.95, 1.8, 7), WHITE, 0, 4.7, 0, 0.08),
    ]),
  };
}

/**
 * Instanced trees at the given spots (plus any extra placed elsewhere).
 * @returns { group, trunks: [{x, y, z, r, h}] } trunks feed the physics colliders.
 */
export function buildTrees(spots, terrain) {
  const rng = makeRng(2020);
  const group = new THREE.Group();
  group.name = 'trees';
  const species = [roundTree(), pineTree()];
  const buckets = [[], []];
  for (const s of spots) buckets[rng.chance(0.68) ? 0 : 1].push({ ...s, scale: rng.range(0.85, 1.3), rot: rng.range(0, Math.PI * 2), leaf: rng.int(0, 99), trunkPale: rng.chance(0.35) });
  const trunks = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  species.forEach((sp, k) => {
    const list = buckets[k];
    if (!list.length) return;
    const trunk = new THREE.InstancedMesh(sp.trunk, MAT.solid, list.length);
    const leaves = new THREE.InstancedMesh(sp.leaves, MAT.solid, list.length);
    list.forEach((t, i) => {
      const y = terrain.getHeight(t.x, t.z) - 0.05;
      q.setFromAxisAngle(Y, t.rot);
      p.set(t.x, y, t.z);
      sc.setScalar(t.scale);
      m.compose(p, q, sc);
      trunk.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      trunk.setColorAt(i, col.set(k === 0 && t.trunkPale ? PALETTE.tree.trunkPale : PALETTE.tree.trunk));
      leaves.setColorAt(i, col.set(PALETTE.tree.leaves[t.leaf % PALETTE.tree.leaves.length]));
      trunks.push({ x: t.x, y, z: t.z, r: 0.25 * t.scale, h: 2.5 * t.scale });
    });
    for (const mesh of [trunk, leaves]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  });
  return { group, trunks };
}
