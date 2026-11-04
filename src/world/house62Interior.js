// 62 Grand Terrace - interior (first pass): entry hall + stairs, open living / dining /
// kitchen, garage; upstairs landing/rumpus, 3 bedrooms and a bathroom. Low-poly furniture
// merged into one mesh. 4 non-shadow point lights (always present, intensity 0 when off,
// so no shader recompiles). Everything is in lot-local space (+X right as seen from the
// street, +Z toward the street), matching heroHouse62.js.
//
// TWEAK THE LAYOUT HERE: rooms, partitions, door openings, stairs and furniture spots.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, boxB, cylinder, icosa, merge } from '../utils/geom.js';
import { partition } from './wallSlab.js';

const I = PALETTE.interior;

export const INTERIOR = {
  floorY: 0.15,          // ground floor finished level (same as the porch)
  upperY: 3.15,          // upstairs finished level
  upperSlab: [3.0, 3.15],
  groundCeil: 2.97, upperCeil: 5.88,
  door: { w: 0.9, h: 2.1 },
  // Room boxes (for reference + floor finishes): [x0, x1, z0, z1]
  rooms: {
    living: [-9.4, 0.5, -1.0, 4.6], dining: [-9.4, 0.5, -3.0, -1.0], kitchen: [-9.4, 0.5, -6, -3.0],
    hall: [0.5, 3.9, -6, 3.2], garage: [3.9, 10.2, -6, 5.0],
    rumpus: [-3.0, 4.2, -6, 2.6], bed2: [-7.6, -3.0, -1.6, 2.6], bed3: [-7.6, -3.0, -6, -1.6],
    master: [4.2, 9.2, -2.0, 3.3], bath: [4.2, 9.2, -6, -2.0],
  },
  // Stairs rise toward the street from the back of the hall.
  stair: { x0: 2.25, x1: 3.75, zBottom: -5.2, zTop: -0.9, steps: 16 },
  // Partitions: [axis, at, from, to, openings[[a, b]]] - axis 'z' = wall runs along z at x = at.
  ground: [
    ['z', 0.5, -6, 3.2, [[-2.6, 1.6, 2.5]]],      // living | hall (wide open-plan opening)
    ['z', 3.9, -6, 3.2, [[1.7, 2.6]]],            // hall | garage (internal door)
  ],
  upper: [
    ['z', -3.0, -6, 2.6, [[0.4, 1.3], [-3.6, -2.7]]], // rumpus | bed 2 + bed 3
    ['x', -1.6, -7.6, -3.0, []],                      // bed 2 | bed 3
    ['z', 4.2, -6, 2.6, [[0.6, 1.5], [-4.4, -3.5]]],  // landing | master + bathroom
    ['x', -2.0, 4.2, 9.2, []],                        // master | bathroom
  ],
  lights: [[-5.0, 2.65, 1.8], [-5.5, 2.65, -4.0], [1.4, 2.65, -1.0], [0.4, 5.55, 0.2]],
  lightIntensity: 16,
  nearDist: 25,          // interior only renders / lights within this distance of the house
};

// ---------------------------------------------------------------------------------
// Furniture (all bottom-aligned boxes etc. pushed into `s`)
// ---------------------------------------------------------------------------------
function sofa(s, x, z, rot, len = 2.4) {
  // rot: 0 = facing +z, 1 = facing -x, 2 = facing -z, 3 = facing +x
  const parts = [
    [len, 0.42, 0.95, 0, 0, 0, I.sofa], [len, 0.45, 0.22, 0, 0.42, -0.36, I.sofa],
    [0.2, 0.25, 0.95, -len / 2 + 0.1, 0.42, 0, I.sofa], [0.2, 0.25, 0.95, len / 2 - 0.1, 0.42, 0, I.sofa],
    [0.5, 0.32, 0.12, -len / 4, 0.48, -0.2, I.cushion], [0.5, 0.32, 0.12, len / 4, 0.48, -0.2, I.rug2],
  ];
  for (const [w, h, d, px, py, pz, c] of parts) {
    const [rx, rz, rw, rd] = rot % 2 === 0 ? [px * (rot ? -1 : 1), pz * (rot ? -1 : 1), w, d] : [pz * (rot === 1 ? 1 : -1), px * (rot === 1 ? -1 : 1), d, w];
    s.push(boxB(rw, h, rd, x + rx, INTERIOR.floorY + py, z + rz, c));
  }
}
function table(s, x, y, z, w, d, h, color) {
  s.push(boxB(w, 0.05, d, x, y + h - 0.05, z, color));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.push(boxB(0.06, h - 0.05, 0.06, x + sx * (w / 2 - 0.08), y, z + sz * (d / 2 - 0.08), color));
}
function chair(s, x, y, z, faceZ) {
  s.push(boxB(0.44, 0.05, 0.44, x, y + 0.44, z, I.timberDark));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.push(boxB(0.04, 0.44, 0.04, x + sx * 0.18, y, z + sz * 0.18, I.timberDark));
  s.push(boxB(0.44, 0.45, 0.04, x, y + 0.49, z - faceZ * 0.2, I.timberDark));
}
function bed(s, x, y, z, w, l, duvet, headAtZ) {
  // Head end toward headAtZ (+1 / -1 along z).
  s.push(boxB(w + 0.1, 0.3, l + 0.1, x, y, z, I.timberDark));
  s.push(boxB(w, 0.2, l, x, y + 0.3, z, I.linen));
  s.push(boxB(w + 0.02, 0.06, l * 0.68, x, y + 0.5, z - headAtZ * l * 0.14, duvet));
  s.push(boxB(w + 0.1, 0.9, 0.08, x, y, z + headAtZ * (l / 2 + 0.05), I.timberDark));
  for (const px of w > 1.2 ? [-w / 4, w / 4] : [0]) s.push(boxB(0.5, 0.12, 0.3, x + px, y + 0.5, z + headAtZ * (l / 2 - 0.25), I.linen));
}
function wardrobe(s, x, y, z, w, d) {
  s.push(boxB(w, 2.2, d, x, y, z, I.wardrobe));
  s.push(box(0.02, 2.1, 0.01, x, y + 1.1, z + d / 2 + 0.005, '#cfc8b8'));
}
function plant(s, x, y, z, r = 0.3) {
  s.push(cylinder(0.16, 0.12, 0.3, 8, x, y, z, I.pot));
  s.push(icosa(r, 1, x, y + 0.3 + r * 0.8, z, I.plant, { sy: 1.2, jitter: 0.12 }));
}

function furniture(s, lamps) {
  const F = INTERIOR.floorY, U = INTERIOR.upperY;
  // --- Living: rug, sofa facing the TV on the side wall, coffee table, floor lamp -------
  s.push(boxB(3.4, 0.02, 2.8, -5.6, F, 2.3, I.rug));
  sofa(s, -4.6, 2.3, 1, 2.6);                       // facing -x toward the TV wall
  table(s, -6.3, F, 2.3, 1.1, 0.6, 0.42, I.timberDark);
  s.push(boxB(0.45, 0.5, 2.0, -9.05, F, 2.3, I.timberDark));        // TV unit
  s.push(boxB(0.06, 0.7, 1.4, -9.0, F + 0.75, 2.3, I.tv));          // TV
  s.push(cylinder(0.03, 0.03, 1.5, 6, -3.6, F, 0.9, I.rail));
  lamps.push(cylinder(0.22, 0.28, 0.32, 8, -3.6, F + 1.5, 0.9, I.lampShade));
  plant(s, -8.9, F, 4.1, 0.38);
  // --- Dining: table + 6 chairs, pendant ---------------------------------------------
  table(s, -5.0, F, -2.0, 2.0, 1.0, 0.76, I.timberDark);
  for (const dx of [-0.65, 0, 0.65]) { chair(s, -5.0 + dx, F, -2.75, 1); chair(s, -5.0 + dx, F, -1.25, -1); }
  lamps.push(cylinder(0.25, 0.35, 0.25, 8, -5.0, 2.35, -2.0, I.lampShade));
  s.push(cylinder(0.01, 0.01, 0.4, 4, -5.0, 2.58, -2.0, I.rail));
  // --- Kitchen: back bench + overhead cupboards, fridge, island + stools --------------
  s.push(boxB(6.2, 0.86, 0.62, -5.7, F, -5.62, I.cabinet));
  s.push(boxB(6.24, 0.04, 0.66, -5.7, F + 0.86, -5.6, I.benchtop));
  s.push(boxB(6.2, 0.7, 0.36, -5.7, F + 1.55, -5.75, I.cabinet));
  s.push(boxB(0.6, 0.02, 0.45, -6.2, F + 0.9, -5.6, I.steel));        // cooktop
  s.push(boxB(0.7, 0.02, 0.42, -4.4, F + 0.9, -5.6, I.steel));        // sink
  s.push(boxB(0.9, 1.85, 0.7, -1.6, F, -5.6, I.appliance));           // fridge
  s.push(boxB(2.6, 0.88, 0.9, -5.4, F, -3.6, I.cabinet));             // island
  s.push(boxB(2.7, 0.04, 1.0, -5.4, F + 0.88, -3.6, I.benchtop));
  for (const dx of [-0.8, 0, 0.8]) { s.push(cylinder(0.17, 0.17, 0.05, 8, -5.4 + dx, F + 0.66, -2.85, I.timberDark)); s.push(cylinder(0.03, 0.03, 0.66, 5, -5.4 + dx, F, -2.85, I.rail)); }
  for (const dx of [-0.7, 0.7]) lamps.push(cylinder(0.12, 0.16, 0.2, 8, -5.4 + dx, 2.4, -3.6, I.lampShade));
  // --- Hall: console + mirror + plant --------------------------------------------------
  s.push(boxB(1.1, 0.8, 0.35, 0.85, F, -4.8, I.timberDark));
  s.push(box(0.02, 0.9, 0.7, 0.62, F + 1.5, -4.8, I.mirror));
  plant(s, 0.85, F, 2.7, 0.3);
  // --- Garage: shelving + workbench ------------------------------------------------------
  s.push(boxB(0.5, 2.0, 3.0, 9.85, 0.08, -3.8, I.timberDark));
  for (const y of [0.6, 1.2, 1.8]) s.push(boxB(0.52, 0.03, 3.0, 9.85, 0.08 + y, -3.8, I.wardrobe));
  s.push(boxB(2.2, 0.9, 0.7, 6.0, 0.08, -5.55, I.timberDark));
  // --- Upstairs rumpus / landing: bookshelf, beanbags, rug --------------------------------
  s.push(boxB(2.6, 0.02, 2.2, -0.9, U, -3.4, I.rug2));
  s.push(boxB(0.4, 1.9, 1.8, -2.75, U, -4.6, I.timberDark));
  s.push(icosa(0.45, 1, -1.2, U + 0.3, -3.0, I.cushion, { sy: 0.6, jitter: 0.08 }));
  s.push(icosa(0.42, 1, -0.2, U + 0.28, -2.4, I.rug, { sy: 0.6, jitter: 0.08 }));
  plant(s, 3.9, U, 2.2, 0.32);
  // --- Master (over the garage) ------------------------------------------------------------
  bed(s, 6.7, U, -0.6, 1.6, 2.0, I.duvet[0], -1);
  for (const dx of [-1.15, 1.15]) {
    s.push(boxB(0.45, 0.5, 0.4, 6.7 + dx, U, -1.6 + 0.3, I.timberDark));
    lamps.push(cylinder(0.1, 0.14, 0.2, 8, 6.7 + dx, U + 0.55, -1.3, I.lampShade));
  }
  wardrobe(s, 8.85, U, 1.2, 0.6, 2.4);
  s.push(boxB(2.4, 0.02, 1.6, 6.7, U, 1.2, I.rug));
  // --- Bathroom ---------------------------------------------------------------------------
  s.push(boxB(1.7, 0.55, 0.75, 7.9, U, -5.5, I.bath));
  s.push(boxB(1.5, 0.08, 0.6, 7.9, U + 0.48, -5.5, I.wetTile));
  s.push(boxB(1.2, 0.8, 0.5, 5.3, U, -2.35, I.cabinet));
  s.push(box(1.0, 0.7, 0.02, 5.3, U + 1.5, -2.09, I.mirror));
  s.push(boxB(0.4, 0.42, 0.6, 4.65, U, -5.45, I.bath));             // toilet
  s.push(boxB(0.4, 0.4, 0.18, 4.65, U + 0.42, -5.72, I.bath));
  s.push(boxB(0.02, 1.9, 1.2, 7.0, U, -4.6, I.mirror));             // shower screen
  // --- Bedroom 2 (front left): single bed, desk + chair, wardrobe ---------------------------
  bed(s, -6.6, U, 0.6, 1.0, 2.0, I.duvet[1], -1);
  s.push(boxB(1.2, 0.75, 0.55, -4.0, U, 2.15, I.timberDark));
  chair(s, -4.0, U, 1.55, 1);
  wardrobe(s, -3.5, U, -0.9, 0.9, 0.6);
  // --- Bedroom 3 (back left) ----------------------------------------------------------------
  bed(s, -5.4, U, -4.6, 1.4, 2.0, I.duvet[2], -1);
  wardrobe(s, -7.2, U, -2.6, 0.6, 1.6);
  s.push(boxB(1.8, 0.02, 1.2, -5.4, U, -2.8, I.rug2));
}

/**
 * Build the interior.
 * @param windows  [{x, y, z, w, h, face}] window openings recorded by heroHouse62.js
 *                 (the outer face); inner "view out" panes are placed on the lining.
 * @returns { group, colliders (lot-local boxes, some with rotX), lights[], update() }
 */
export function buildInterior(windows) {
  const solid = [], lamps = [], panes = [];
  const out = { solid, colliders: [] };
  const D = INTERIOR.door, F = INTERIOR.floorY, U = INTERIOR.upperY;

  // --- Floors -----------------------------------------------------------------------------
  const floor = (x0, x1, z0, z1, y0, y1, color, collide = true) => {
    solid.push(boxB(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, color, { jitter: 0.03 }));
    if (collide) out.colliders.push({ x0, x1, z0, z1, y0, y1 });
  };
  floor(-9.2, 0.5, -5.8, 4.4, 0, F, I.timber);
  floor(0.5, 3.9, -5.8, 3.2, 0, F, I.tile);
  floor(3.9, 10.0, -5.8, 5.0, 0, 0.08, I.garageFloor);
  // Upstairs slab with the stair void cut out.
  const St = INTERIOR.stair, [s0, s1] = INTERIOR.upperSlab;
  for (const [x0, x1, z0, z1, c] of [
    [-7.6, St.x0, -6, 2.6, I.carpet], [St.x1, 4.2, -6, 2.6, I.carpet],
    [St.x0, St.x1, -6, St.zBottom, I.carpet], [St.x0, St.x1, St.zTop, 2.6, I.carpet],
    [4.2, 9.2, -2.0, 3.3, I.carpet], [4.2, 9.2, -6, -2.0, I.wetTile],
  ]) {
    floor(x0, x1, z0, z1, s0 + 0.02, s1, c);
    solid.push(boxB(x1 - x0, 0.02, z1 - z0, (x0 + x1) / 2, s0, (z0 + z1) / 2, I.ceiling, { jitter: 0.01 }));
  }
  // Ground-floor ceilings outside the upstairs footprint (under the lower roof), and the
  // upstairs ceiling. Downward planes only (no edges to see from inside).
  const ceil = (x0, x1, z0, z1, y) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    solid.push(paintPlane(g, I.ceiling));
    out.colliders.push({ x0, x1, z0, z1, y0: y, y1: y + 0.08 });
  };
  ceil(-9.4, -7.6, -6, 4.6, INTERIOR.groundCeil);
  ceil(-7.6, 0.5, 2.6, 4.6, INTERIOR.groundCeil);
  ceil(0.5, 3.9, 2.6, 3.2, INTERIOR.groundCeil);
  ceil(3.9, 10.2, 3.3, 5.0, INTERIOR.groundCeil);
  ceil(9.2, 10.2, -6, 3.3, INTERIOR.groundCeil);
  ceil(-7.6, 4.2, -6, 2.6, INTERIOR.upperCeil);
  ceil(4.2, 9.2, -6, 3.3, INTERIOR.upperCeil);

  // --- Partitions with door openings --------------------------------------------------------
  for (const [axis, at, from, to, ops] of INTERIOR.ground) {
    partition(out, { axis, at, from, to, y0: 0, y1: INTERIOR.groundCeil + 0.03, color: I.wall, openings: ops.map(([a, b, top]) => ({ a, b, top: top ?? D.h })) });
  }
  for (const [axis, at, from, to, ops] of INTERIOR.upper) {
    partition(out, { axis, at, from, to, y0: U - 0.02, y1: INTERIOR.upperCeil + 0.03, color: I.wallWarm, openings: ops.map(([a, b]) => ({ a, b, top: U + D.h })) });
  }

  // --- Stairs: solid treads, stringer, handrail; ramp collider + under-stair cupboard --------
  const rise = (U - F) / St.steps, run = (St.zTop - St.zBottom) / St.steps;
  for (let i = 0; i < St.steps; i++) {
    const za = St.zBottom + i * run;
    solid.push(boxB(St.x1 - St.x0, F + (i + 1) * rise, run, (St.x0 + St.x1) / 2, 0, za + run / 2, i % 2 ? I.stair : '#a37b57', { jitter: 0.03 }));
  }
  const len = Math.hypot(St.zTop - St.zBottom, U - F), ang = Math.atan2(U - F, St.zTop - St.zBottom);
  out.colliders.push({ x0: St.x0, x1: St.x1, z0: (St.zBottom + St.zTop) / 2 - len / 2, z1: (St.zBottom + St.zTop) / 2 + len / 2, y0: (F + U) / 2 - 0.06, y1: (F + U) / 2 + 0.06, rotX: -ang });
  out.colliders.push({ x0: St.x0, x1: St.x1, z0: St.zTop - 1.7, z1: St.zTop, y0: 0, y1: 1.85 }); // nobody walks under the top flight
  // Handrail along the open side + balustrade round the stair void upstairs.
  for (let i = 0; i <= 8; i++) {
    const z = St.zBottom + (i / 8) * (St.zTop - St.zBottom), y = F + (i / 8) * (U - F);
    solid.push(boxB(0.04, 0.9, 0.04, St.x0 + 0.04, y, z, I.rail));
  }
  const railLen = Math.hypot(St.zTop - St.zBottom, U - F);
  const rail = new THREE.BoxGeometry(0.06, 0.06, railLen).rotateX(-ang).translate(St.x0 + 0.04, (F + U) / 2 + 0.9, (St.zBottom + St.zTop) / 2);
  solid.push(paintPlane(rail, I.rail));
  for (const [x0, x1, z0, z1] of [[St.x0 - 0.04, St.x0 + 0.04, St.zBottom, St.zTop], [St.x0, St.x1, St.zBottom - 0.04, St.zBottom + 0.04], [St.x1 - 0.04, St.x1 + 0.04, St.zBottom, St.zTop - 0.2]]) {
    solid.push(boxB(x1 - x0, 0.06, z1 - z0, (x0 + x1) / 2, U + 0.95, (z0 + z1) / 2, I.rail));
    const n = Math.max(2, Math.round(Math.max(x1 - x0, z1 - z0) / 0.3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      solid.push(boxB(0.03, 0.95, 0.03, x0 + (x1 - x0) * t, U, z0 + (z1 - z0) * t, I.rail));
    }
    out.colliders.push({ x0, x1, z0, z1, y0: U, y1: U + 1.0 });
  }

  furniture(solid, lamps);
  // Furniture colliders (rough boxes so you can't walk through the big pieces).
  for (const b of [
    [-5.1, -4.1, 1.0, 3.6, F, F + 0.85], [-9.3, -8.8, 1.3, 3.3, F, F + 0.6], [-6.0, -4.0, -2.5, -1.5, F, F + 0.8],
    [-8.8, -2.6, -6, -5.3, F, F + 0.9], [-6.7, -4.1, -4.1, -3.1, F, F + 0.9], [-2.05, -1.15, -6, -5.25, F, F + 1.9],
    [5.85, 7.55, -1.65, 0.45, U, U + 0.6], [-7.15, -6.05, -0.45, 1.65, U, U + 0.6], [-6.15, -4.65, -5.65, -3.55, U, U + 0.6],
    [7.05, 8.75, -5.9, -5.1, U, U + 0.6], [9.6, 10.1, -5.3, -2.3, 0.08, 2.1], [4.9, 7.1, -5.9, -5.2, 0.08, 1.0],
  ]) out.colliders.push({ x0: b[0], x1: b[1], z0: b[2], z1: b[3], y0: b[4], y1: b[5] });

  // --- Inner "view out" panes on the lining behind every window ------------------------------
  for (const wdw of windows) {
    const t = 0.205; // wall thickness + a hair
    const g = wdw.face === 'z' ? new THREE.PlaneGeometry(wdw.w, wdw.h).rotateY(Math.PI).translate(wdw.x, wdw.y, wdw.z - t)
      : wdw.face === '-z' ? new THREE.PlaneGeometry(wdw.w, wdw.h).translate(wdw.x, wdw.y, wdw.z + t)
      : wdw.face === 'x' ? new THREE.PlaneGeometry(wdw.w, wdw.h).rotateY(-Math.PI / 2).translate(wdw.x - t, wdw.y, wdw.z)
      : new THREE.PlaneGeometry(wdw.w, wdw.h).rotateY(Math.PI / 2).translate(wdw.x + t, wdw.y, wdw.z);
    panes.push(g);
  }

  const group = new THREE.Group();
  group.name = 'hero-62-interior';
  const solidMesh = new THREE.Mesh(merge(solid), MAT.solid);
  solidMesh.receiveShadow = true;
  solidMesh.castShadow = true;
  const lampMesh = new THREE.Mesh(merge(lamps), MAT.interiorLamp);
  const paneMesh = new THREE.Mesh(mergePlain(panes), MAT.innerPane);
  group.add(solidMesh, lampMesh, paneMesh);

  const lights = INTERIOR.lights.map(([x, y, z]) => {
    const l = new THREE.PointLight('#ffd7a3', 0, 9, 2);
    l.position.set(x, y, z);
    l.castShadow = false;
    return l;
  });
  return { group, colliders: out.colliders, lights };
}

function paintPlane(g, color) {
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
  const geo = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function mergePlain(list) {
  const pos = [], nrm = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}
