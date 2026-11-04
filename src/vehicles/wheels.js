// Every wheel of every car is one instance of a single InstancedMesh (1 draw call).
// Unit wheel: radius 1, width 1, axle along X, rim face on +X. Instances are scaled to
// (width, radius, radius); wheels on the car's right side are turned 180 deg so the rim
// faces outward.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { paint, merge } from '../utils/geom.js';

const C = PALETTE.cars;

function unitWheel(rimColor) {
  const parts = [];
  const tyre = new THREE.CylinderGeometry(1, 1, 1, 16);
  tyre.rotateZ(Math.PI / 2);
  parts.push(paint(tyre, C.tyre, 0.04, 11));
  const rim = new THREE.CylinderGeometry(0.64, 0.64, 0.12, 12);
  rim.rotateZ(Math.PI / 2);
  parts.push(paint(rim.translate(0.46, 0, 0), rimColor, 0.03, 12));
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 8);
  hub.rotateZ(Math.PI / 2);
  parts.push(paint(hub.translate(0.5, 0, 0), C.hub, 0.02, 13));
  // Five dark spoke gaps make the rotation readable.
  for (let k = 0; k < 5; k++) {
    const s = new THREE.BoxGeometry(0.04, 0.42, 0.13);
    s.translate(0.53, 0.4, 0);
    s.rotateX((k / 5) * Math.PI * 2);
    parts.push(paint(s, C.hub, 0.02, 20 + k));
  }
  return merge(parts);
}

export function createWheelInstances(count) {
  const mesh = new THREE.InstancedMesh(unitWheel(C.rim), MAT.solid, count);
  mesh.name = 'car-wheels';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // instances move every frame; cheaper than recomputing bounds
  const hero = new THREE.InstancedMesh(unitWheel(C.rimHero), MAT.solid, 4);
  hero.name = 'car-wheels-hero';
  hero.castShadow = true;
  hero.frustumCulled = false;
  return { mesh, hero };
}
