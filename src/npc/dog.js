// Low-poly dog on a leash: merged body/head/tail + 4 legs that trot, a leash line from the
// owner's hand to the collar. Sits while the owner pauses.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, merge } from '../utils/geom.js';

const COATS = [['#b07a45', '#7a5232'], ['#2b2522', '#f1ece2'], ['#e8dcc4', '#c9b58f'], ['#6b6b6b', '#d9d4c8']];
const LEASH = new THREE.LineBasicMaterial({ color: '#c8322a' });
const _h = new THREE.Vector3();

export function buildDog(rng) {
  const [coat, patch] = rng.pick(COATS);
  const s = rng.range(0.8, 1.15);
  const group = new THREE.Group();
  group.name = 'dog';
  const body = new THREE.Mesh(merge([
    box(0.26, 0.24, 0.62, 0, 0.42, 0, coat),
    box(0.2, 0.2, 0.22, 0, 0.62, 0.34, coat),          // head
    box(0.12, 0.1, 0.14, 0, 0.58, 0.5, patch),         // snout
    box(0.05, 0.1, 0.06, -0.08, 0.76, 0.3, patch), box(0.05, 0.1, 0.06, 0.08, 0.76, 0.3, patch), // ears
    box(0.27, 0.06, 0.1, 0, 0.53, 0.2, '#c8322a'),     // collar
  ]), MAT.solid);
  body.castShadow = true;
  const tail = new THREE.Mesh(box(0.05, 0.05, 0.26, 0, 0, -0.13, coat), MAT.solid);
  tail.position.set(0, 0.5, -0.3);
  const legGeo = box(0.07, 0.32, 0.07, 0, -0.16, 0, coat);
  const legs = [[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.22], [0.09, -0.22]].map(([x, z]) => {
    const m = new THREE.Mesh(legGeo, MAT.solid);
    m.position.set(x, 0.32, z);
    group.add(m);
    return m;
  });
  group.add(body, tail);
  group.scale.setScalar(s);
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const leash = new THREE.Line(geo, LEASH);
  leash.frustumCulled = false;
  let phase = 0, sit = 0;
  return {
    group, leash,
    /** Place beside/ahead of the owner and animate. hand: owner's hand bone (Object3D). */
    update(dt, { x, y, z, yaw, speed, hand, visible }) {
      group.visible = leash.visible = visible;
      if (!visible) return;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const tx = x + fx * 1.25 - fz * 0.45, tz = z + fz * 1.25 + fx * 0.45;
      group.position.x += (tx - group.position.x) * Math.min(1, dt * 6);
      group.position.z += (tz - group.position.z) * Math.min(1, dt * 6);
      group.position.y = y;
      group.rotation.y = yaw;
      phase += dt * (3 + speed * 5);
      const k = Math.min(1, speed / 1.2);
      sit += ((speed < 0.2 ? 1 : 0) - sit) * Math.min(1, dt * 4);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55 * k; });
      legs[2].rotation.x -= sit * 1.2; legs[3].rotation.x -= sit * 1.2;
      body.rotation.x = -sit * 0.35;
      body.position.y = -sit * 0.1 + Math.abs(Math.sin(phase)) * 0.025 * k;
      tail.rotation.y = Math.sin(phase * 1.7) * 0.6;
      tail.rotation.x = -0.5;
      hand.getWorldPosition(_h);
      const pos = geo.attributes.position;
      pos.setXYZ(0, _h.x, _h.y - 0.28, _h.z);
      pos.setXYZ(1, group.position.x + fx * 0.2 * s, y + 0.55 * s, group.position.z + fz * 0.2 * s);
      pos.needsUpdate = true;
    },
  };
}
