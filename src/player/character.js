// Low-poly player figure (~1.75 m) with a simple procedural walk cycle.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, boxB, merge } from '../utils/geom.js';

const C = PALETTE.player;

function limb(w, h, d, colorTop, colorBottom, split = 0.5) {
  // Pivot at the top (shoulder / hip): geometry hangs down from y = 0.
  return merge([
    box(w, h * split, d, 0, -h * split / 2, 0, colorTop),
    box(w * 0.92, h * (1 - split), d * 0.92, 0, -h * split - (h * (1 - split)) / 2, 0, colorBottom),
  ]);
}

export function createCharacter() {
  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(merge([
    boxB(0.46, 0.58, 0.26, 0, 0.92, 0, C.shirt),
    boxB(0.48, 0.1, 0.28, 0, 0.84, 0, C.shorts),
    boxB(0.12, 0.08, 0.12, 0, 1.5, 0, C.skin),        // neck
    boxB(0.26, 0.28, 0.27, 0, 1.56, 0, C.skin),       // head
    boxB(0.28, 0.09, 0.29, 0, 1.79, -0.01, C.hair),   // hair
    boxB(0.28, 0.12, 0.06, 0, 1.68, -0.13, C.hair),
    box(0.04, 0.04, 0.02, -0.06, 1.66, 0.136, '#2b2420'), // eyes
    box(0.04, 0.04, 0.02, 0.06, 1.66, 0.136, '#2b2420'),
  ]), MAT.solid);
  body.add(torso);

  const legGeo = limb(0.19, 0.86, 0.22, C.shorts, C.skin, 0.45);
  const armGeo = limb(0.13, 0.62, 0.15, C.shirt, C.skin, 0.4);
  const mk = (geo, x, y) => { const m = new THREE.Mesh(geo, MAT.solid); m.position.set(x, y, 0); body.add(m); return m; };
  const legL = mk(legGeo, -0.11, 0.88), legR = mk(legGeo, 0.11, 0.88);
  const armL = mk(armGeo, -0.31, 1.46), armR = mk(armGeo, 0.31, 1.46);
  // Shoes.
  const shoe = box(0.2, 0.1, 0.3, 0, -0.81, 0.04, '#e8e2d6');
  legL.geometry = merge([legGeo.clone(), shoe.clone()]);
  legR.geometry = merge([legGeo, shoe]);
  armL.rotation.z = 0.06; armR.rotation.z = -0.06;

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  let phase = 0;
  return {
    root,
    /** speed in m/s, airborne flag. */
    animate(dt, speed, airborne) {
      const k = Math.min(1, speed / 4);
      phase += dt * (3 + speed * 1.6);
      const swing = airborne ? 0.5 : Math.sin(phase) * 0.75 * k;
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
      body.position.y = airborne ? 0 : Math.abs(Math.cos(phase)) * 0.05 * k;
    },
  };
}
