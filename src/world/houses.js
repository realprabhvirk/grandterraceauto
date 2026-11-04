// Regular houses: 4 procedural variants (2 flat-roof, 2 pitched), each split into
// walls / roof / detail / glass parts. Every part is one InstancedMesh, so all ~30
// houses cost 16 draw calls. Walls and roofs take per-instance colours from the palette.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, boxB, merge } from '../utils/geom.js';
import { addWindow, addDoor, addGarageDoor, hipRoof, gableRoof } from './houseParts.js';

const H = PALETTE.house;
const WHITE = '#ffffff';

// Footprint data used by the layout (w along the street, d toward the back).
export const VARIANTS = [
  { name: 'flat-single', w: 12, d: 9, frontYard: 6.5, garageX: 3.3, driveW: 5.0, wallH: 3.2 },
  { name: 'flat-double', w: 11, d: 9, frontYard: 6.0, garageX: 3.4, driveW: 3.6, wallH: 3.0 },
  { name: 'gable-single', w: 13, d: 9.5, frontYard: 6.5, garageX: 3.9, driveW: 5.0, wallH: 2.85 },
  { name: 'hip-wide', w: 14, d: 10, frontYard: 6.0, garageX: -4.2, driveW: 5.0, wallH: 2.8 },
];

function variantParts(v, index) {
  const out = { walls: [], roof: [], detail: [], glass: [] };
  const fz = v.d / 2 + 0.005; // front wall plane
  const light = index % 2 === 0;
  const frame = light ? H.frameLight : H.frame;
  const win = (x, y, w, h, face = 'z', z = fz) => addWindow(out, { x, y, z, w, h, face, frame, glassColor: H.glass });

  if (v.name === 'flat-single') {
    out.walls.push(boxB(v.w, v.wallH, v.d, 0, 0, 0, WHITE, { jitter: 0.03 }));
    out.roof.push(boxB(v.w + 0.3, 0.38, v.d + 0.3, 0, v.wallH, 0, WHITE)); // parapet slab
    out.detail.push(boxB(v.w + 0.06, 0.42, v.d + 0.06, 0, 0, 0, H.base));
    out.detail.push(boxB(2.6, 0.12, 1.4, -0.9, 2.5, fz + 0.65, H.frame)); // entry awning
    addGarageDoor(out, { x: v.garageX, z: fz, w: 4.6, h: 2.25, color: H.garage, dark: H.garageDark, frame });
    addDoor(out, { x: -0.9, z: fz, color: H.door, frame, glassColor: H.glass });
    win(-4.0, 1.55, 2.4, 1.3);
    win(v.w / 2 + 0.005, 1.6, 1.8, 1.1, 'x', 0);
    win(-v.w / 2 - 0.005, 1.6, 1.8, 1.1, '-x', 0);
    win(-2.5, 1.6, 2.2, 1.2, '-z', -fz);
    win(2.8, 1.6, 1.4, 1.0, '-z', -fz);
  } else if (v.name === 'flat-double') {
    const uh = 2.8, ux = -1.3, uw = 8, ud = 7.2, uz = -0.6;
    out.walls.push(boxB(v.w, v.wallH, v.d, 0, 0, 0, WHITE, { jitter: 0.03 }));
    out.walls.push(boxB(uw, uh, ud, ux, v.wallH, uz, WHITE, { jitter: 0.03 }));
    out.roof.push(boxB(v.w + 0.25, 0.25, v.d + 0.25, 0, v.wallH, 0, WHITE));
    out.roof.push(boxB(uw + 0.5, 0.3, ud + 0.5, ux, v.wallH + uh, uz, WHITE));
    out.detail.push(boxB(v.w + 0.06, 0.4, v.d + 0.06, 0, 0, 0, H.base));
    addGarageDoor(out, { x: v.garageX, z: fz, w: 3.0, h: 2.2, color: H.garage, dark: H.garageDark, frame });
    addDoor(out, { x: 0.6, z: fz, color: H.door, frame, glassColor: H.glass, sidelight: true });
    win(-3.4, 1.5, 2.2, 1.3);
    const ufz = uz + ud / 2 + 0.005;
    win(ux - 2.0, v.wallH + 1.45, 1.8, 1.25, 'z', ufz);
    win(ux + 1.8, v.wallH + 1.45, 1.8, 1.25, 'z', ufz);
    win(ux + uw / 2 + 0.005, v.wallH + 1.45, 1.4, 1.1, 'x', uz);
    win(v.w / 2 + 0.005, 1.5, 1.6, 1.1, 'x', -1.5);
    win(-1, 1.5, 2.4, 1.2, '-z', -fz);
  } else if (v.name === 'gable-single') {
    out.walls.push(boxB(v.w, v.wallH, v.d, 0, 0, 0, WHITE, { jitter: 0.03 }));
    out.detail.push(boxB(v.w + 0.06, 0.4, v.d + 0.06, 0, 0, 0, H.base));
    gableRoof(out, { y: v.wallH, W: v.w, D: v.d, pitch: 24, overhang: 0.5, color: WHITE, fascia: frame, soffit: H.frameLight });
    addGarageDoor(out, { x: v.garageX, z: fz, w: 4.6, h: 2.2, color: H.garage, dark: H.garageDark, frame });
    addDoor(out, { x: 0.2, z: fz, color: H.door, frame, glassColor: H.glass });
    win(-2.6, 1.5, 1.6, 1.2);
    win(-5.0, 1.5, 1.6, 1.2);
    win(-v.w / 2 - 0.005, 1.5, 1.6, 1.1, '-x', 0);
    win(-3, 1.5, 2.0, 1.2, '-z', -fz);
    win(2.5, 1.5, 2.0, 1.2, '-z', -fz);
  } else {
    out.walls.push(boxB(v.w, v.wallH, v.d, 0, 0, 0, WHITE, { jitter: 0.03 }));
    out.detail.push(boxB(v.w + 0.06, 0.42, v.d + 0.06, 0, 0, 0, H.base));
    hipRoof(out, { y: v.wallH, W: v.w, D: v.d, pitch: 23, overhang: 0.6, color: WHITE, fascia: frame, soffit: H.frameLight });
    // Small entry porch with two posts.
    out.detail.push(boxB(0.16, 2.6, 0.16, 0.2, 0, fz + 1.6, frame));
    out.detail.push(boxB(0.16, 2.6, 0.16, 2.6, 0, fz + 1.6, frame));
    out.detail.push(boxB(2.9, 0.14, 1.9, 1.4, 2.6, fz + 0.85, frame));
    out.detail.push(boxB(3.1, 0.12, 2.0, 1.4, 0, fz + 0.95, H.base));
    addGarageDoor(out, { x: v.garageX, z: fz, w: 4.8, h: 2.2, color: H.garage, dark: H.garageDark, frame });
    addDoor(out, { x: 1.4, z: fz, color: H.door, frame, glassColor: H.glass });
    win(4.6, 1.5, 2.2, 1.3);
    win(v.w / 2 + 0.005, 1.5, 1.6, 1.1, 'x', 1);
    win(v.w / 2 + 0.005, 1.5, 1.2, 1.0, 'x', -2.6);
    win(-3.5, 1.5, 2.0, 1.2, '-z', -fz);
    win(2.5, 1.5, 2.4, 1.2, '-z', -fz);
  }
  return {
    walls: merge(out.walls),
    roof: merge(out.roof),
    detail: merge(out.detail),
    glass: merge(out.glass),
  };
}

/**
 * @param lots   regular lots from layout (x, z, rot, h, variant, flip, wallColor, roofColor)
 * @returns { group, colliders }
 */
export function buildHouses(lots) {
  const group = new THREE.Group();
  group.name = 'houses';
  const colliders = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);

  VARIANTS.forEach((v, vi) => {
    const mine = lots.filter((l) => l.variant === vi);
    if (!mine.length) return;
    const parts = variantParts(v, vi);
    for (const [name, geo] of Object.entries(parts)) {
      const mesh = new THREE.InstancedMesh(geo, name === 'glass' ? MAT.glass : MAT.solid, mine.length);
      mesh.name = `house-${v.name}-${name}`;
      mesh.castShadow = name !== 'glass';
      mesh.receiveShadow = true;
      mine.forEach((lot, i) => {
        q.setFromAxisAngle(Y, lot.rot);
        s.set(lot.flip ? -1 : 1, 1, 1);
        p.set(lot.x, lot.h, lot.z);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        if (name === 'walls') col.set(PALETTE.walls[lot.wallColor % PALETTE.walls.length]);
        else if (name === 'roof') col.set(PALETTE.roofs[lot.roofColor % PALETTE.roofs.length]);
        else col.set(WHITE);
        mesh.setColorAt(i, col);
      });
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    for (const lot of mine) {
      const tall = v.name === 'flat-double' ? v.wallH + 2.8 : v.wallH + 1.5;
      colliders.push({ x: lot.x, y: lot.h + tall / 2, z: lot.z, hx: v.w / 2, hy: tall / 2, hz: v.d / 2, rot: lot.rot });
    }
  });
  return { group, colliders };
}
