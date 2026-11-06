// Emergency vehicles the player can steal (patrol cars from the station bay, the hospital's
// ambulance): a roof light bar + livery on a normal drivable Car. Y toggles lights + siren.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, merge } from '../utils/geom.js';

const RED = new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), BLUE = new THREE.MeshBasicMaterial({ color: '#2a6bff' });
const OFF = new THREE.MeshBasicMaterial({ color: '#2a2a2e' });

/** kind: 'police' | 'ambulance'. Adds the kit to car.model and sets car.emergency. */
export function addEmergencyKit(car, kind) {
  const c = car.cfg, z = (c.roofSpan[0] + c.roofSpan[1]) / 2;
  const parts = [box(1.1, 0.12, 0.3, 0, c.roof + 0.06, z, '#2a2a2e', { jitter: 0.02 })];
  if (kind === 'ambulance') {
    parts.push(box(c.W + 0.02, 0.16, c.L * 0.8, 0, c.belt - 0.12, -0.1, '#2f6fc0', { jitter: 0.02 }));
    parts.push(box(c.W + 0.02, 0.08, c.L * 0.8, 0, c.belt - 0.24, -0.1, '#e2c25a', { jitter: 0.02 }));
  } else {
    parts.push(box(c.W + 0.02, 0.12, c.L * 0.7, 0, c.belt - 0.15, 0, '#2d4f7c', { jitter: 0.02 }));
  }
  const livery = new THREE.Mesh(merge(parts), MAT.solid);
  livery.castShadow = true;
  const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.26), OFF), lampR = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.26), OFF);
  lampL.position.set(0.28, c.roof + 0.17, z); lampR.position.set(-0.28, c.roof + 0.17, z);
  car.model.add(livery, lampL, lampR);
  let t = 0;
  car.emergency = {
    kind, on: false,
    toggle() { this.on = !this.on; return this.on; },
    update(dt) {
      t += dt;
      const f = this.on && Math.floor(t * 6) % 2 === 0;
      lampL.material = this.on ? (f ? RED : OFF) : OFF;
      lampR.material = this.on ? (f ? OFF : BLUE) : OFF;
    },
  };
  return car.emergency;
}
