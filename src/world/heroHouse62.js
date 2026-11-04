// 62 GRAND TERRACE - the hero house, matched to reference/house62/front-dusk.png.
//
// Two-storey Queensland home: cream rendered ground floor with piers between three tall
// shuttered windows, recessed entry with a projecting hip roof, double garage on the
// right with a dark slatted door; cream weatherboard upper storey with a rendered box
// projecting over the garage; charcoal tiled hip roofs (a lower roof wraps the ground
// floor). Front yard: open lawn, rendered letterbox pillar, green telecom pillar + pit,
// mulch beds with cordylines and grasses, exposed-aggregate driveway, timber paling side
// fences, gums out the back, TV antenna on the ridge.
//
// EVERYTHING you might want to tweak is in the constants below.
// Lot-local space: +X = right as you face the house from the street, +Z = toward the
// street, Y = up, origin = ground level at the house centre.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, boxB, cylinder, icosa, painted, trisGeometry, merge } from '../utils/geom.js';
import { addWindow, hipRoof } from './houseParts.js';
import { wallSlab } from './wallSlab.js';
import { buildInterior, INTERIOR } from './house62Interior.js';
import { buildDoors } from './house62Doors.js';

// ----------------------------------------------------------------------------------
// TWEAKABLES
// ----------------------------------------------------------------------------------
const H = PALETTE.hero;
const COL = {
  render: H.render, cladding: H.cladding, claddingLine: H.claddingLine, renderBox: H.renderBox,
  base: H.base, trim: H.trim, roof: H.roof, caps: H.caps, fascia: H.fascia, soffit: H.soffit,
  door: H.door, garage: H.garage, garageLine: H.garageLine, glass: PALETTE.house.glass,
  pavers: H.pavers, shutter: H.shutter, mulch: H.mulch, fence: H.fence,
};

const DIM = {
  groundH: 3.0,
  living: { x0: -9.4, x1: 0.5, z0: -6, z1: 4.6 },     // left wing (living room)
  entry: { x0: 0.5, x1: 3.9, z0: -6, z1: 3.2 },       // recessed entry (front door wall at z1)
  garage: { x0: 3.9, x1: 10.2, z0: -6, z1: 5.0 },     // double garage, on the right
  upper: { x0: -7.6, x1: 4.2, z0: -6, z1: 2.6, h: 2.9 },     // weatherboard upper storey
  upperBox: { x0: 4.2, x1: 9.2, z0: -6, z1: 3.3, h: 2.9 },   // rendered box over the garage
  roofPitch: 22, upperPitch: 23, overhang: 0.55,
  portico: { x0: 0.0, x1: 4.4, z0: 1.0, z1: 5.6 },    // projecting hip over the entry
  columns: [0.75, 3.62], columnZ: 4.75,
  door: { x: 2.2, w: 1.0, h: 2.3 },
  garageDoor: { x: 7.05, w: 5.3, h: 2.3 },
  livingWindows: [-7.6, -4.9, -2.2], livingWindowW: 1.3, livingWindowH: 1.9,
  upperWindows: [[-6.0, 1.25, 1.15], [-4.1, 1.25, 1.15], [-1.6, 0.75, 1.15], [0.3, 0.7, 0.6]], // [x, w, h]
  boxWindows: [5.55, 7.85], boxWindowW: 1.15, boxWindowH: 1.2,
  letterbox: [3.6, 11.6],
  telecom: [-7.4, 12.7], pit: [-4.6, 11.7],
  sideFence: { x0: -12.6, x1: 12.6, z0: -11, z1: 4.2, h: 1.8 },
  sidePathX: -10.9,
  gums: [[-6.5, -9.3, 1.25], [7.5, -9.6, 1.1], [1.0, -10.2, 0.9]], // [x, z, scale]
};

// Lot placement (used by layout.js / terrain flattening / car spawn).
export const HERO_LOT = {
  setback: 21,          // house origin distance from the road centreline (m)
  rise: 0.15,           // pad height above the road
  padCenter: [0, 1.4],
  padHalf: [12.9, 12.6],
  garageX: DIM.garageDoor.x,
  garageFrontZ: DIM.garage.z1,
  driveW: 5.6,
};
/** Lot-local X the player spawns at on the footpath (in line with the front door). */
export const HERO_PATH_X = DIM.door.x;
const BOUNDARY_Z = HERO_LOT.setback - 7.3; // front property line in local Z (road boundary = 7.3 m)

// ----------------------------------------------------------------------------------

function numeralsTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = H.numerals;
  g.font = '500 190px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('62', 128, 136);
  g.fillStyle = '#3a3a3a';
  g.fillRect(270, 40, 228, 176);
  g.fillStyle = '#f2efe8';
  g.font = 'bold 140px "Segoe UI", Arial, sans-serif';
  g.fillText('62', 384, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function numberPlane(w, h, half, x, y, z) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + (half ? 0.5 : 0));
  g.translate(x, y, z);
  return g;
}

/** Thin white plantation-shutter slats behind a front-facing window's glass. */
function shutters(out, x, y, z, w, h) {
  for (let yy = y - h / 2 + 0.06; yy < y + h / 2 - 0.03; yy += 0.085) {
    out.push(box(w - 0.04, 0.035, 0.008, x, yy, z + 0.04, COL.shutter, { jitter: 0.02 }));
  }
  out.push(box(0.04, h - 0.02, 0.01, x, y, z + 0.042, COL.shutter)); // centre stile
}

/** Horizontal weatherboard shadow lines across a wall face (face: 'z' at z, or 'x' at x). */
function weatherboards(out, face, at, from, to, y0, y1) {
  for (let y = y0 + 0.22; y < y1 - 0.05; y += 0.2) {
    if (face === 'z') out.push(box(to - from, 0.022, 0.016, (from + to) / 2, y, at + 0.008, COL.claddingLine, { jitter: 0.015 }));
    else out.push(box(0.016, 0.022, to - from, at + Math.sign(at) * 0.008, y, (from + to) / 2, COL.claddingLine, { jitter: 0.015 }));
  }
}

function cordyline(out, x, z, s = 1) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.07 * s, 0.75 * s, 3);
    g.translate(0, 0.36 * s, 0);
    g.rotateZ(0.5 + (i % 2) * 0.2);
    g.rotateY(a);
    out.push(painted(g, i % 3 === 0 ? '#7a2532' : H.cordyline, x, 0.05, z, 0.12));
  }
}
function grassClump(out, x, z, s = 1) {
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ConeGeometry(0.05 * s, 0.6 * s, 3);
    g.translate(0, 0.28 * s, 0);
    g.rotateZ(0.25 + (i % 3) * 0.12);
    g.rotateY((i / 6) * Math.PI * 2);
    out.push(painted(g, H.grass, x, 0.05, z, 0.12));
  }
}
function shrub(out, x, z, r, color) {
  out.push(icosa(r, 1, x, r * 0.72, z, color, { sy: 0.82, jitter: 0.12 }));
}

function gumTree(out, x, z, s) {
  out.push(cylinder(0.16 * s, 0.24 * s, 5.5 * s, 7, x, 0, z, H.gumTrunk, { jitter: 0.05 }));
  for (const [dx, dz] of [[0.8, 0.3], [-0.7, 0.2], [0.1, -0.6]]) {
    const g = new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 2.2 * s, 5);
    g.translate(0, 1.1 * s, 0);
    g.rotateZ(-dx * 0.5);
    g.rotateX(dz * 0.5);
    out.push(painted(g, H.gumTrunk, x, 4.4 * s, z, 0.05));
  }
  const crowns = [[0, 7.4, 0, 2.2], [1.4, 6.6, 0.6, 1.6], [-1.3, 6.8, 0.3, 1.7], [0.3, 8.6, -0.4, 1.4], [-0.4, 6.2, -1.1, 1.3]];
  crowns.forEach(([dx, dy, dz, r], i) => out.push(icosa(r * s, 1, x + dx * s, dy * s, z + dz * s, H.gumLeaf[i % 3], { sy: 0.72, jitter: 0.12 })));
}

function wheelieBin(out, x, z, lid) {
  out.push(boxB(0.58, 0.95, 0.7, x, 0, z, H.binBody, { jitter: 0.04 }));
  out.push(boxB(0.62, 0.07, 0.76, x, 0.95, z + 0.02, lid));
}

function hillsHoist(out, x, z) {
  const c = H.clothesline;
  out.push(cylinder(0.04, 0.05, 2.1, 6, x, 0, z, c));
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(0.04, 0.04, 2.1);
    g.translate(0, 0, 1.05);
    g.rotateX(-0.1);
    g.rotateY((i / 4) * Math.PI * 2 + 0.4);
    out.push(painted(g, c, x, 2.05, z, 0.02));
  }
}

/** TV antenna: mast with a yagi boom and cross elements. */
function antenna(out, x, y, z) {
  const c = H.antenna;
  out.push(cylinder(0.025, 0.03, 1.5, 5, x, y, z, c));
  out.push(box(1.7, 0.03, 0.03, x + 0.2, y + 1.45, z, c));
  for (let i = 0; i < 7; i++) out.push(box(0.025, 0.025, 0.55 - i * 0.04, x - 0.55 + i * 0.25, y + 1.45, z, c));
}

/**
 * Ground-hugging rectangle in lot space, draped over the real terrain (cells of `step` m).
 * `lift` = metres above the ground.
 */
function draped(list, terrain, lot, x0, x1, z0, z1, color, lift, step = 1.2) {
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  const y = (lx, lz) => terrain.getHeight(lot.x + lx * c + lz * s, lot.z - lx * s + lz * c) + lift - lot.h;
  const nx = Math.max(1, Math.ceil((x1 - x0) / step)), nz = Math.max(1, Math.ceil((z1 - z0) / step));
  const tris = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const xa = x0 + ((x1 - x0) * i) / nx, xb = x0 + ((x1 - x0) * (i + 1)) / nx;
    const za = z0 + ((z1 - z0) * j) / nz, zb = z0 + ((z1 - z0) * (j + 1)) / nz;
    const A = [xa, y(xa, za), za], B = [xb, y(xb, za), za], C = [xb, y(xb, zb), zb], D = [xa, y(xa, zb), zb];
    tris.push([A, D, C], [A, C, B]); // counter-clockwise from above
  }
  list.push(trisGeometry(tris, color, 0.03));
}

/** Flat downward-facing plane (soffits). */
function downPlane(w, d, x, y, z, color) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(Math.PI / 2);
  return painted(g, color, x, y, z, 0.01);
}

/** Merge geometries that only have position/normal/uv (lamps, numerals). */
function mergePlain(list) {
  const pos = [], nrm = [], uv = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (uv.length === (pos.length / 3) * 2) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/**
 * Build 62 Grand Terrace on its lot.
 * @param lot     hero lot from layout (x, z, rot, h)
 * @param terrain for draping paths/lawn over the ground near the verge
 */
export function buildHeroHouse(lot, terrain) {
  const solid = [];
  const out = { walls: solid, roof: solid, detail: solid, glass: [] };
  const lamps = [];
  const GH = DIM.groundH, Lv = DIM.living, En = DIM.entry, Ga = DIM.garage, U = DIM.upper, UB = DIM.upperBox;
  const windows = []; // recorded for the interior's 'view out' panes
  const win = (x, y, w, h, face, z, frame = COL.trim) => { windows.push({ x, y, z, w, h, face }); addWindow(out, { x, y, z, w, h, face, frame, glassColor: COL.glass, frameT: 0.07 }); };
  const blk = (b, h, y0, color) => solid.push(boxB(b.x1 - b.x0, h, b.z1 - b.z0, (b.x0 + b.x1) / 2, y0, (b.z0 + b.z1) / 2, color, { jitter: 0.02 }));

  // ---- Hollow shell: outer skin + inner lining, real openings for the doors ----------------
  const IW = PALETTE.interior;
  const shell = { solid, colliders: [] };
  const W = (axis, at, from, to, y0, y1, inward, outer, inner, openings = []) => wallSlab(shell, { axis, at, from, to, y0, y1, inward, outer, inner, openings });
  const dO = DIM.door, gO = DIM.garageDoor;
  W('x', Lv.z1, Lv.x0, Lv.x1, 0, GH, -1, COL.render, IW.wall);                 // living front
  W('z', Lv.x0, Lv.z0, Lv.z1, 0, GH, 1, COL.render, IW.wall);                  // left side
  W('x', Lv.z0, Lv.x0, Ga.x0, 0, GH, 1, COL.render, IW.wall);                  // back (living + hall)
  W('x', Lv.z0, Ga.x0, Ga.x1, 0, GH, 1, COL.render, IW.garageWall);            // back (garage)
  W('z', Lv.x1, En.z1, Lv.z1, 0, GH, -1, COL.render, IW.wall);                 // living return beside the porch
  W('x', En.z1, En.x0, En.x1, 0, GH, -1, COL.render, IW.wall, [{ a: dO.x - dO.w / 2, b: dO.x + dO.w / 2, top: dO.h }]); // front door
  W('x', Ga.z1, Ga.x0, Ga.x1, 0, GH, -1, COL.render, IW.garageWall, [{ a: gO.x - gO.w / 2, b: gO.x + gO.w / 2, top: gO.h }]); // garage door
  W('z', Ga.x1, Ga.z0, Ga.z1, 0, GH, -1, COL.render, IW.garageWall);           // garage right side
  W('z', Ga.x0, En.z1, Ga.z1, 0, GH, 1, COL.render, IW.garageWall);            // garage return beside the porch
  // Subtle plinth.
  for (const b of [Lv, Ga]) solid.push(boxB(b.x1 - b.x0 + 0.04, 0.16, 0.04, (b.x0 + b.x1) / 2, 0, b.z1 + 0.01, COL.base));
  // Rendered piers between the three tall living-room windows (gives the bay rhythm).
  const lw = DIM.livingWindowW;
  const piers = [Lv.x0 + 0.35, (DIM.livingWindows[0] + DIM.livingWindows[1]) / 2, (DIM.livingWindows[1] + DIM.livingWindows[2]) / 2, Lv.x1 - 0.45];
  piers.forEach((px, i) => solid.push(boxB(i === 0 || i === 3 ? 0.7 : 1.3, GH - 0.02, 0.14, px, 0, Lv.z1 + 0.07, COL.render, { jitter: 0.02 })));

  // ---- Upper storey ------------------------------------------------------------------
  W('x', U.z1, U.x0, U.x1, GH, GH + U.h, -1, COL.cladding, IW.wallWarm);       // upstairs front
  W('z', U.x0, U.z0, U.z1, GH, GH + U.h, 1, COL.cladding, IW.wallWarm);        // upstairs left
  W('x', U.z0, U.x0, U.x1, GH, GH + U.h, 1, COL.cladding, IW.wallWarm);        // upstairs back
  W('x', UB.z1, UB.x0, UB.x1, GH, GH + UB.h, -1, COL.renderBox, IW.wallWarm);  // box front
  W('z', UB.x1, UB.z0, UB.z1, GH, GH + UB.h, -1, COL.renderBox, IW.wallWarm);  // box right
  W('x', UB.z0, UB.x0, UB.x1, GH, GH + UB.h, 1, COL.renderBox, IW.wallWarm);   // box back
  W('z', UB.x0, U.z1, UB.z1, GH, GH + UB.h, 1, COL.renderBox, IW.wallWarm);    // box return
  void blk;
  weatherboards(solid, 'z', U.z1, U.x0, U.x1, GH, GH + U.h);
  weatherboards(solid, 'x', U.x0, U.z0, U.z1, GH, GH + U.h);
  // Corner trims on the weatherboard.
  solid.push(boxB(0.1, U.h, 0.1, U.x0, GH, U.z1, COL.soffit));

  // ---- Roofs: lower wrap-around hip, entry portico hip, upper hips --------------------
  const gx0 = Lv.x0, gx1 = Ga.x1, gz0 = Lv.z0, gz1 = Ga.z1;
  // The lower roofs are clipped where the (hollow) upstairs sits on them.
  const upperClip = [[U.x0, UB.x1, U.z0, U.z1], [UB.x0, UB.x1, U.z1 - 0.01, UB.z1]];
  hipRoof(out, { cx: (gx0 + gx1) / 2, cz: (gz0 + gz1) / 2, y: GH, W: gx1 - gx0, D: gz1 - gz0, pitch: DIM.roofPitch, overhang: DIM.overhang, color: COL.roof, fascia: COL.fascia, soffit: COL.soffit, fasciaH: 0.24, caps: COL.caps, clip: upperClip });
  const P = DIM.portico;
  hipRoof(out, { cx: (P.x0 + P.x1) / 2, cz: (P.z0 + P.z1) / 2, y: GH, W: P.x1 - P.x0, D: P.z1 - P.z0, pitch: 27, overhang: 0.45, color: COL.roof, fascia: COL.fascia, soffit: COL.soffit, fasciaH: 0.24, caps: COL.caps, clip: upperClip });
  const uy = GH + U.h;
  hipRoof(out, { cx: (U.x0 + UB.x1) / 2, cz: (U.z0 + U.z1) / 2, y: uy, W: UB.x1 - U.x0, D: U.z1 - U.z0, pitch: DIM.upperPitch, overhang: DIM.overhang, color: COL.roof, fascia: COL.fascia, soffit: COL.soffit, fasciaH: 0.24, caps: COL.caps });
  hipRoof(out, { cx: (UB.x0 + UB.x1) / 2, cz: (UB.z1 + -1.5) / 2, y: uy, W: UB.x1 - UB.x0, D: UB.z1 + 1.5, pitch: DIM.upperPitch, overhang: DIM.overhang, color: COL.roof, fascia: COL.fascia, soffit: COL.soffit, fasciaH: 0.24, caps: COL.caps });
  {
    const d = (U.z1 - U.z0) / 2 + DIM.overhang;
    const top = uy + d * Math.tan(THREE.MathUtils.degToRad(DIM.upperPitch));
    antenna(solid, 1.2, top - 0.05, (U.z0 + U.z1) / 2);
  }

  // ---- Entry: recessed door, porch, columns ------------------------------------------
  const dr = DIM.door, ez = En.z1 + 0.005;
  // Door frame (the panel itself is animated - see house62Doors.js).
  solid.push(boxB(0.08, dr.h + 0.08, 0.26, dr.x - dr.w / 2 - 0.04, 0, ez - 0.08, COL.trim));
  solid.push(boxB(0.08, dr.h + 0.08, 0.26, dr.x + dr.w / 2 + 0.04, 0, ez - 0.08, COL.trim));
  solid.push(boxB(dr.w + 0.16, 0.08, 0.26, dr.x, dr.h, ez - 0.08, COL.trim));
  // Narrow sidelight to the right of the door.
  addWindow(out, { x: dr.x + 0.95, y: 1.2, z: ez, w: 0.35, h: 2.1, face: 'z', frame: COL.trim, glassColor: COL.glass, sill: false, mullion: false, frameT: 0.06 });
  for (const cx of DIM.columns) solid.push(boxB(0.38, GH, 0.38, cx, 0, DIM.columnZ, COL.render, { jitter: 0.02 }));
  solid.push(boxB(En.x1 - En.x0 + 0.4, 0.15, Ga.z1 - En.z1 + 0.25, (En.x0 + En.x1) / 2, 0, (En.z1 + Ga.z1 + 0.25) / 2, COL.pavers, { jitter: 0.05 }));
  solid.push(downPlane(P.x1 - P.x0 - 0.2, P.z1 - En.z1, (P.x0 + P.x1) / 2, GH - 0.005, (En.z1 + P.z1) / 2, COL.soffit));
  lamps.push(new THREE.BoxGeometry(0.22, 0.03, 0.22).translate(dr.x, GH - 0.02, (En.z1 + P.z1) / 2 - 0.4));
  // Pot plant by the door (as in the photo).
  solid.push(cylinder(0.2, 0.15, 0.36, 8, dr.x - 0.85, 0.15, En.z1 + 0.45, H.pot));
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ConeGeometry(0.05, 0.55, 3);
    g.translate(0, 0.27, 0); g.rotateZ(0.5); g.rotateY((i / 6) * Math.PI * 2);
    solid.push(painted(g, H.grass, dr.x - 0.85, 0.5, En.z1 + 0.45, 0.1));
  }

  // ---- Garage door (dark, slim horizontal slats) -------------------------------------
  const gd = DIM.garageDoor, gz = Ga.z1 + 0.005;
  // Frame only - the roller door is animated in house62Doors.js.
  solid.push(boxB(0.12, gd.h + 0.12, 0.3, gd.x - gd.w / 2 - 0.06, 0, gz - 0.1, COL.trim));
  solid.push(boxB(0.12, gd.h + 0.12, 0.3, gd.x + gd.w / 2 + 0.06, 0, gz - 0.1, COL.trim));
  solid.push(boxB(gd.w + 0.24, 0.12, 0.3, gd.x, gd.h, gz - 0.1, COL.trim));

  // ---- Windows (dark charcoal frames, white shutters behind the glass) -----------------
  const wy = 1.38;
  for (const x of DIM.livingWindows) {
    win(x, wy, lw, DIM.livingWindowH, 'z', Lv.z1 + 0.005);
    shutters(solid, x, wy, Lv.z1 + 0.005, lw, DIM.livingWindowH);
    solid.push(box(lw, 0.06, 0.06, x, wy - DIM.livingWindowH / 2 + 0.42, Lv.z1 + 0.05, COL.trim)); // transom
  }
  const upY = GH + 1.5;
  for (const [x, w, h] of DIM.upperWindows) {
    const y = h < 1 ? upY + 0.3 : upY;
    win(x, y, w, h, 'z', U.z1 + 0.005);
    shutters(solid, x, y, U.z1 + 0.005, w, h);
  }
  for (const x of DIM.boxWindows) {
    win(x, upY, DIM.boxWindowW, DIM.boxWindowH, 'z', UB.z1 + 0.005);
    shutters(solid, x, upY, UB.z1 + 0.005, DIM.boxWindowW, DIM.boxWindowH);
  }
  // Sides and back.
  win(Lv.x0 - 0.005, 1.5, 1.4, 1.2, '-x', 0.5);
  win(Lv.x0 - 0.005, 1.5, 1.0, 1.2, '-x', -3.5);
  win(U.x0 - 0.005, upY, 1.2, 1.1, '-x', -1.5);
  win(UB.x1 + 0.005, upY, 1.0, 1.1, 'x', -1.0);
  win(Ga.x1 + 0.005, 1.4, 0.8, 0.9, 'x', -3.5);
  win(-5.5, 1.2, 3.0, 2.1, '-z', Lv.z0 - 0.005);
  win(-1.2, 1.5, 1.4, 1.2, '-z', Lv.z0 - 0.005);
  win(-5.0, upY, 1.4, 1.2, '-z', U.z0 - 0.005);
  win(-1.0, upY, 1.4, 1.2, '-z', U.z0 - 0.005);
  win(5.5, upY, 1.4, 1.2, '-z', UB.z0 - 0.005);

  // ---- Downpipes ------------------------------------------------------------------------
  for (const [x, z, h] of [[Lv.x0 - 0.06, Lv.z1 - 0.1, GH], [Ga.x1 + 0.06, Ga.z1 - 0.12, GH], [UB.x1 + 0.06, UB.z1 - 0.12, U.h], [U.x0 - 0.06, U.z1 - 0.1, U.h]]) {
    solid.push(boxB(0.08, h, 0.08, x, h === GH ? 0 : GH, z, COL.fascia));
  }

  // ---- Numerals: small "62" on the right porch column + letterbox plate ---------------
  const tex = numeralsTexture();
  const numGeos = [numberPlane(0.34, 0.17, false, DIM.columns[1], 1.9, DIM.columnZ + 0.195)];

  // ---- Front yard ---------------------------------------------------------------------
  const dwX0 = HERO_LOT.garageX - HERO_LOT.driveW / 2, dwX1 = HERO_LOT.garageX + HERO_LOT.driveW / 2;
  // Rendered letterbox pillar in the lawn beside the driveway (slot + plate).
  {
    const [x, z] = DIM.letterbox;
    solid.push(boxB(0.42, 1.55, 0.36, x, -0.4, z, H.letterbox, { jitter: 0.04 }));
    solid.push(boxB(0.46, 0.05, 0.4, x, 1.15, z, H.letterboxCap));
    solid.push(box(0.26, 0.035, 0.02, x, 0.98, z + 0.185, '#2a2a2a'));
    solid.push(box(0.2, 0.2, 0.02, x, 0.7, z + 0.185, '#8f8b84'));
    numGeos.push(numberPlane(0.17, 0.13, true, x, 0.42, z + 0.186));
  }
  // Green telecom pillar + concrete pit lid on the lawn near the footpath.
  solid.push(boxB(0.24, 0.55, 0.2, DIM.telecom[0], 0, DIM.telecom[1], H.telecom, { jitter: 0.04 }));
  solid.push(boxB(0.27, 0.04, 0.23, DIM.telecom[0], 0.55, DIM.telecom[1], '#456c49'));
  // Front garden bed along the living wing: mulch, stone edging, cordylines, grasses, shrubs.
  const rng = (() => { let s = 62; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const bedZ0 = Lv.z1 + 0.15, bedZ1 = Lv.z1 + 1.45;
  solid.push(boxB(Lv.x1 - Lv.x0 + 0.2, 0.08, bedZ1 - bedZ0, (Lv.x0 + Lv.x1) / 2, 0, (bedZ0 + bedZ1) / 2, COL.mulch, { jitter: 0.1 }));
  solid.push(boxB(Lv.x1 - Lv.x0 + 0.3, 0.1, 0.12, (Lv.x0 + Lv.x1) / 2, 0, bedZ1 + 0.05, H.edging));
  for (let x = Lv.x0 + 0.4; x < Lv.x1 - 0.2; x += 0.75) {
    const z = (bedZ0 + bedZ1) / 2 + (rng() - 0.5) * 0.5, r = rng();
    if (r < 0.28) cordyline(solid, x, z, 0.8 + rng() * 0.4);
    else if (r < 0.55) grassClump(solid, x, z, 0.9 + rng() * 0.4);
    else shrub(solid, x, z, 0.26 + rng() * 0.16, PALETTE.tree.leaves[Math.floor(rng() * 5)]);
    if (rng() < 0.35) solid.push(icosa(0.09, 0, x + 0.2, 0.42, z + 0.2, H.flowers[Math.floor(rng() * 4)], { jitter: 0.05 }));
  }
  // Right-hand bed between the driveway and the side fence.
  const rbx0 = dwX1 + 0.25, rbx1 = DIM.sideFence.x1 - 0.2;
  solid.push(boxB(rbx1 - rbx0, 0.08, BOUNDARY_Z - 0.5 - (Ga.z1 + 0.5), (rbx0 + rbx1) / 2, 0, (BOUNDARY_Z - 0.5 + Ga.z1 + 0.5) / 2, COL.mulch, { jitter: 0.1 }));
  for (let z = Ga.z1 + 1.0; z < BOUNDARY_Z - 0.8; z += 1.1) {
    const x = (rbx0 + rbx1) / 2 + (rng() - 0.5) * 0.8, r = rng();
    if (r < 0.35) cordyline(solid, x, z, 1.0 + rng() * 0.4);
    else shrub(solid, x, z, 0.4 + rng() * 0.3, PALETTE.tree.leaves[Math.floor(rng() * 5)]);
  }
  shrub(solid, rbx1 - 0.6, BOUNDARY_Z - 1.4, 0.9, PALETTE.tree.leaves[2]);
  // Garden spike lights.
  for (const x of [-6.3, -3.5, -0.9]) lamps.push(new THREE.BoxGeometry(0.07, 0.12, 0.07).translate(x, 0.16, bedZ1 - 0.15));

  // ---- Timber paling side fences, rear fence, back yard ---------------------------------
  const F = DIM.sideFence;
  for (const fx of [F.x0, F.x1]) {
    const len = F.z1 - F.z0;
    solid.push(boxB(0.04, F.h, len, fx, 0, (F.z0 + F.z1) / 2, COL.fence, { jitter: 0.05 }));
    for (let z = F.z0; z <= F.z1 + 0.01; z += 2.4) solid.push(boxB(0.1, F.h + 0.06, 0.1, fx, 0, z, H.fencePost));
    for (let z = F.z0 + 0.08; z < F.z1; z += 0.15) solid.push(boxB(0.06, F.h - 0.04, 0.1, fx, 0.02, z, COL.fence, { jitter: 0.07 }));
    solid.push(boxB(0.08, 0.06, len, fx, F.h - 0.25, (F.z0 + F.z1) / 2, H.fencePost)); // rail
  }
  solid.push(boxB(F.x1 - F.x0, F.h, 0.04, (F.x0 + F.x1) / 2, 0, F.z0, COL.fence, { jitter: 0.05 }));
  solid.push(boxB(5.5, 0.12, 2.8, -5.0, 0, Lv.z0 - 1.5, COL.pavers, { jitter: 0.06 })); // alfresco
  hillsHoist(solid, 4.0, -8.6);
  wheelieBin(solid, F.x0 + 0.6, -1.0, H.binLidRed);
  wheelieBin(solid, F.x0 + 0.6, -1.9, H.binLidYellow);
  for (const [x, z, s] of DIM.gums) gumTree(solid, x, z, s);

  // ---- Draped ground details: lawn stripes, side path, driveway joints ------------------
  {
    const z0 = bedZ1 + 0.2, z1 = BOUNDARY_Z - 0.1;
    let k = 0;
    for (const [a, b] of [[DIM.sidePathX + 0.7, dwX0 - 0.1]]) {
      for (let x = a; x < b - 0.05; x += 1.4, k++) draped(solid, terrain, lot, x, Math.min(b, x + 1.4), z0, z1, k % 2 ? H.lawn : H.lawnStripe, 0.025);
    }
    // Lawn in front of the porch up to the bed line.
    draped(solid, terrain, lot, Lv.x1 + 0.1, dwX0 - 0.1, Ga.z1 + 0.3, z0, H.lawn, 0.025);
    // Concrete side path down the left of the house, from the footpath.
    draped(solid, terrain, lot, DIM.sidePathX - 0.6, DIM.sidePathX + 0.6, -6, HERO_LOT.setback - 6.85, COL.pavers, 0.05);
    for (const jz of [8.2, 11.2, 14.2]) draped(solid, terrain, lot, dwX0 + 0.1, dwX1 - 0.1, jz, jz + 0.05, H.joint, 0.1, 6);
    // Pit lid.
    draped(solid, terrain, lot, DIM.pit[0] - 0.3, DIM.pit[0] + 0.3, DIM.pit[1] - 0.22, DIM.pit[1] + 0.22, H.pit, 0.04, 1);
  }

  // ---- Assemble: 4 draw calls (solid, glass, lamps, numerals) ---------------------------
  const group = new THREE.Group();
  group.name = 'hero-62';
  group.position.set(lot.x, lot.h, lot.z);
  group.rotation.y = lot.rot;
  const solidMesh = new THREE.Mesh(merge(solid), MAT.solid);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  const glassMesh = new THREE.Mesh(merge(out.glass), MAT.heroGlass);
  glassMesh.receiveShadow = true;
  const lampMesh = new THREE.Mesh(mergePlain(lamps), MAT.lamp);
  const numMesh = new THREE.Mesh(mergePlain(numGeos), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4 }));
  group.add(solidMesh, glassMesh, lampMesh, numMesh);

  // ---- Interior + doors -------------------------------------------------------------------
  const interior = buildInterior(windows);
  group.add(interior.group, ...interior.lights);
  const doors = buildDoors({
    door: { x: dr.x, w: dr.w, h: dr.h, z: ez }, garage: { x: gd.x, w: gd.w, h: gd.h, z: gz },
    colors: { door: COL.door, frame: COL.trim, garage: COL.garage, line: COL.garageLine, glass: COL.glass },
  });
  group.add(doors.group);
  group.updateMatrixWorld(true);

  // ---- Colliders (world space boxes) ------------------------------------------------------
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  const toWorld = (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c });
  const colliders = [];
  const addBox = (x0, x1, z0, z1, y0, y1) => {
    const w = toWorld((x0 + x1) / 2, (z0 + z1) / 2);
    colliders.push({ x: w.x, y: lot.h + (y0 + y1) / 2, z: w.z, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, hz: (z1 - z0) / 2, rot: lot.rot });
  };
  // Shell walls + interior (floors, partitions, stairs ramp, furniture) + the piers outside.
  const addSpec = (b) => {
    const w = toWorld((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    colliders.push({ x: w.x, y: lot.h + (b.y0 + b.y1) / 2, z: w.z, hx: (b.x1 - b.x0) / 2, hy: (b.y1 - b.y0) / 2, hz: (b.z1 - b.z0) / 2, rot: lot.rot, rotX: b.rotX || 0 });
  };
  for (const b of shell.colliders) addSpec(b);
  for (const b of interior.colliders) addSpec(b);
  addBox(Lv.x0, Lv.x1, Lv.z1, Lv.z1 + 0.14, 0, GH); // living-room piers
  // Eaves (above head height, outside the walls only): stop cameras tucking under the overhangs.
  const ov = DIM.overhang;
  addBox(gx0 - ov, gx1 + ov, gz1, gz1 + ov, GH - 0.15, GH + 0.9);
  addBox(gx0 - ov, gx1 + ov, gz0 - ov, gz0, GH - 0.15, GH + 0.9);
  addBox(gx0 - ov, gx0, gz0, gz1, GH - 0.15, GH + 0.9);
  addBox(gx1, gx1 + ov, gz0, gz1, GH - 0.15, GH + 0.9);
  addBox(P.x0 - 0.45, P.x1 + 0.45, En.z1 + 0.2, P.z1 + 0.45, GH - 0.15, GH + 0.9);
  // Toggle colliders for the doors (world space, created by physicsWorld, handles fed back).
  const toggles = doors.toggles.map((t) => {
    const b = t.box, w = toWorld((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    return { id: t.id, x: w.x, y: lot.h + (b.y0 + b.y1) / 2, z: w.z, hx: (b.x1 - b.x0) / 2, hy: (b.y1 - b.y0) / 2, hz: (b.z1 - b.z0) / 2, rot: lot.rot };
  });
  for (const cx of DIM.columns) addBox(cx - 0.19, cx + 0.19, DIM.columnZ - 0.19, DIM.columnZ + 0.19, 0, GH);
  addBox(En.x0 - 0.2, En.x1 + 0.2, En.z1, Ga.z1 + 0.25, 0, 0.15); // porch slab (walkable)
  addBox(DIM.letterbox[0] - 0.21, DIM.letterbox[0] + 0.21, DIM.letterbox[1] - 0.18, DIM.letterbox[1] + 0.18, -0.4, 1.2);
  addBox(DIM.telecom[0] - 0.12, DIM.telecom[0] + 0.12, DIM.telecom[1] - 0.1, DIM.telecom[1] + 0.1, 0, 0.6);
  for (const fx of [F.x0, F.x1]) addBox(fx - 0.06, fx + 0.06, F.z0, F.z1, 0, F.h);
  addBox(F.x0, F.x1, F.z0 - 0.06, F.z0 + 0.06, 0, F.h);
  for (const [tx, tz, ts] of DIM.gums) addBox(tx - 0.25 * ts, tx + 0.25 * ts, tz - 0.25 * ts, tz + 0.25 * ts, 0, 5);
  addBox(F.x0 + 0.25, F.x0 + 0.95, -2.3, -0.6, 0, 1.0); // bins

  // ---- Runtime: interior visibility / lights / window glow, door animation ---------------
  const center = toWorld(0, 0);
  const localOf = (p) => { const dx = p.x - lot.x, dz = p.z - lot.z; return { x: dx * c - dz * s, y: p.y - lot.h, z: dx * s + dz * c }; };
  let lit = 0;
  const update = (dt, { player, night }) => {
    doors.update(dt);
    const d = player ? Math.hypot(player.x - center.x, player.z - center.z) : 999;
    const near = d < INTERIOR.nearDist;
    const lp = player ? localOf(player) : null;
    const inside = !!lp && lp.x > Lv.x0 && lp.x < Ga.x1 && lp.z > Lv.z0 && lp.z < Ga.z1 && lp.y > -0.5 && lp.y < 6;
    interior.group.visible = near;
    const want = near && (night > 0.5 || inside) ? 1 : 0;
    lit += (want - lit) * Math.min(1, dt * 3);
    for (const l of interior.lights) l.intensity = lit * INTERIOR.lightIntensity;
    MAT.interiorLamp.emissiveIntensity = lit * 1.6;
    // 62's windows glow with its own lights (plus the usual dusk glow).
    MAT.heroGlass.emissiveIntensity = Math.max(MAT.glass.emissiveIntensity, (night > 0.5 || inside ? 1 : 0) * 1.1);
    MAT.innerPane.color.set(night > 0.5 ? PALETTE.interior.paneNight : PALETTE.interior.paneDay);
    return { inside, near };
  };
  // Interaction targets (E): front door, garage door (usable from inside a car too).
  const targets = [
    { id: 'frontDoor', key: 'E', range: 2.8, position: () => ({ ...toWorld(dr.x, ez), y: lot.h }), label: () => (doors.state.frontTarget > 0.5 ? 'Press E to close' : 'Press E to open'), action: () => doors.toggleFront() },
    { id: 'garageDoor', key: 'E', range: 4.2, inCar: true, position: () => ({ ...toWorld(gd.x, gz), y: lot.h }), label: () => (doors.state.garageTarget > 0.5 ? 'Press E to close the garage' : 'Press E to open the garage'), action: () => doors.toggleGarage() },
  ];
  return { group, colliders, toggles, numbersTexture: tex, update, targets, doors, attach: (h) => doors.attach(h), localOf };
}
