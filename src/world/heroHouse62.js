// 62 GRAND TERRACE - the hero house.
//
// Original modern Queensland two-storey (no reference photos were supplied): light
// render, dark base band, charcoal hip roof with eaves/fascia/soffits and solar panels,
// flat-roofed double-garage wing, timber-batten entry porch, framed windows with sills,
// garden beds, hedge, Colorbond side fences, brick letterbox with "62", wall lights,
// a palm and a frangipani, Hills hoist and wheelie bins out the back.
//
// EVERYTHING you might want to tweak to match the real house is in the constants
// below. Lot-local space: +X = right as you face the house from the street,
// +Z = toward the street, Y = up, origin = ground level at the house centre.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, boxB, cylinder, icosa, painted, trisGeometry, merge } from '../utils/geom.js';
import { addWindow, addDoor, addGarageDoor, hipRoof } from './houseParts.js';

// ----------------------------------------------------------------------------------
// TWEAKABLES
// ----------------------------------------------------------------------------------
const COL = {
  render: PALETTE.hero.render,          // main wall render
  garageWall: PALETTE.hero.renderShade, // garage wing render (slightly darker)
  base: PALETTE.hero.base,              // base band / plinth
  trim: PALETTE.hero.trim,              // window frames, porch fascia, feature frame
  roof: PALETTE.hero.roof,
  fascia: PALETTE.hero.fascia,
  soffit: PALETTE.hero.soffit,
  sill: PALETTE.hero.soffit,
  timber: PALETTE.hero.timber,          // porch battens
  door: PALETTE.hero.door,
  garageDoor: PALETTE.hero.garage,
  glass: PALETTE.house.glass,
  pavers: PALETTE.hero.pavers,
  letterbox: PALETTE.hero.letterbox,
  hedge: PALETTE.hero.hedge,
  mulch: PALETTE.ground.mulch,
  fence: PALETTE.hero.fence,
};

const DIM = {
  ground: { x0: -9, x1: 7, z0: -5, z1: 5, h: 3.0 },   // whole ground floor incl. garage
  garageX1: -3.2,                                      // garage wing spans x0..garageX1
  upper: { x0: -3.6, x1: 7, z0: -5, z1: 3.9, h: 2.8 }, // upper storey (set back 1.1 m)
  baseH: 0.45,                                         // dark base band
  bandH: 0.2,                                          // trim band between storeys
  slabT: 0.28,                                         // flat roof / ledge thickness
  roof: { pitch: 24, overhang: 0.6 },
  porch: { x0: -1.6, x1: 3.4, depth: 2.4, h: 2.65 },
  garageDoor: { x: -6.1, w: 5.0, h: 2.3 },
  door: { x: 1.0, w: 1.0, h: 2.2 },
  livingWindow: { x: 5.0, w: 2.6, h: 1.6 },
  path: { x: 1.0, w: 1.3 },
  letterboxX: -2.65,
  hedge: { h: 0.8, d: 0.62 },
  sideFence: { x0: -12.6, x1: 11.6, z0: -11, z1: 6, h: 1.8 },
  solar: { rows: 2, cols: 4 },
};

// Lot placement (used by layout.js / terrain flattening).
export const HERO_LOT = {
  setback: 21,          // house origin distance from the road centreline (m)
  rise: 0.15,           // pad height above the road
  padCenter: [-0.5, 1.4],
  padHalf: [12.6, 12.6],
  garageX: DIM.garageDoor.x,
  garageFrontZ: DIM.ground.z1,
  driveW: 5.4,
};
/** Lot-local X of the front path (the player spawns on the footpath in line with it). */
export const HERO_PATH_X = DIM.path.x;
const BOUNDARY_Z = HERO_LOT.setback - 7.3; // front property line in local Z (road boundary = 7.3 m)

// ----------------------------------------------------------------------------------

function numeralsTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  // Left half: brushed-metal style wall numerals on transparent.
  g.fillStyle = PALETTE.hero.numerals;
  g.font = '600 200px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('62', 128, 136);
  // Right half: letterbox plate, dark numerals on a cream plate.
  g.fillStyle = PALETTE.hero.plate;
  g.fillRect(268, 28, 232, 200);
  g.fillStyle = PALETTE.hero.numerals;
  g.font = 'bold 150px "Segoe UI", Arial, sans-serif';
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

/** Hedge segment along X at depth z: a box with lumpy icosphere top. */
function hedge(out, x0, x1, z) {
  const { h, d } = DIM.hedge;
  const len = x1 - x0;
  out.push(boxB(len, h * 0.8 + 0.4, d, (x0 + x1) / 2, -0.4, z, COL.hedge, { jitter: 0.08 })); // sunk 0.4 m: sits near the road corridor edge
  const n = Math.max(1, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) / n) * len;
    out.push(icosa(0.36, 1, x, h * 0.8, z + ((i % 2) - 0.5) * 0.06, COL.hedge, { sx: 1.25, sy: 0.55, sz: 0.95, jitter: 0.1 }));
  }
}

function shrub(out, x, z, r, color) {
  out.push(icosa(r, 0, x, r * 0.75, z, color, { sy: 0.85, jitter: 0.12 }));
}

function palm(out, x, z) {
  const segs = 6, H = 6.2;
  let px = x, pz = z;
  for (let i = 0; i < segs; i++) {
    const y0 = (i / segs) * H;
    out.push(cylinder(0.15 - i * 0.008, 0.19 - i * 0.008, H / segs + 0.05, 7, px, y0, pz, PALETTE.hero.palmTrunk, { jitter: 0.06 }));
    px += 0.06; // gentle lean
  }
  const top = H;
  out.push(icosa(0.32, 0, px, top + 0.1, pz, PALETTE.hero.palmLeaf, { jitter: 0.1 }));
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + 0.3;
    const g = new THREE.BoxGeometry(0.5, 0.05, 2.6);
    g.translate(0, 0, 1.3);
    g.rotateX(0.35 + (i % 3) * 0.12); // droop
    g.rotateY(a);
    out.push(painted(g, PALETTE.hero.palmLeaf, px, top + 0.15, pz, 0.12));
  }
}

function frangipani(out, x, z) {
  // Short forked trunk, wide umbrella crown, cream flower clusters.
  out.push(cylinder(0.14, 0.2, 1.4, 6, x, 0, z, PALETTE.tree.trunkPale));
  for (const [dx, dz] of [[0.7, 0.3], [-0.6, 0.4], [0.1, -0.7]]) {
    const g = new THREE.CylinderGeometry(0.08, 0.11, 1.4, 5);
    g.translate(0, 0.7, 0);
    g.rotateZ(-dx * 0.55);
    g.rotateX(dz * 0.55);
    out.push(painted(g, PALETTE.tree.trunkPale, x, 1.3, z, 0.05));
    const bx = x + dx * 1.3, bz = z + dz * 1.3;
    out.push(icosa(0.8, 1, bx, 2.75, bz, PALETTE.hero.frangipaniLeaf, { sy: 0.62, jitter: 0.12 }));
    out.push(icosa(0.6, 1, bx + 0.45, 2.6, bz - 0.3, PALETTE.hero.frangipaniLeaf, { sy: 0.6, jitter: 0.12 }));
    out.push(icosa(0.55, 1, bx - 0.4, 2.65, bz + 0.35, PALETTE.hero.frangipaniLeaf, { sy: 0.6, jitter: 0.12 }));
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + dx * 3;
      out.push(icosa(0.11, 0, bx + Math.cos(a) * 0.62, 3.08 + (k % 2) * 0.06, bz + Math.sin(a) * 0.62, PALETTE.hero.frangipaniFlower, { jitter: 0.04 }));
    }
  }
}

function wheelieBin(out, x, z, lid) {
  out.push(boxB(0.58, 0.95, 0.7, x, 0, z, PALETTE.hero.binBody, { jitter: 0.04 }));
  out.push(boxB(0.62, 0.07, 0.76, x, 0.95, z + 0.02, lid));
  out.push(cylinder(0.09, 0.09, 0.06, 6, x - 0.24, 0.02, z - 0.36, '#2a2a2a'));
  out.push(cylinder(0.09, 0.09, 0.06, 6, x + 0.24, 0.02, z - 0.36, '#2a2a2a'));
}

function hillsHoist(out, x, z) {
  const c = PALETTE.hero.clothesline;
  out.push(cylinder(0.04, 0.05, 2.1, 6, x, 0, z, c));
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(0.04, 0.04, 2.1);
    g.translate(0, 0, 1.05);
    g.rotateX(-0.1);
    g.rotateY((i / 4) * Math.PI * 2 + 0.4);
    out.push(painted(g, c, x, 2.05, z, 0.02));
  }
}

function wallLamp(solid, lamps, x, y, z, faceZ = true) {
  if (faceZ) {
    solid.push(box(0.16, 0.28, 0.05, x, y, z + 0.025, COL.trim));
    lamps.push(new THREE.BoxGeometry(0.1, 0.18, 0.07).translate(x, y, z + 0.08));
  } else {
    solid.push(box(0.05, 0.28, 0.16, x + 0.025, y, z, COL.trim));
    lamps.push(new THREE.BoxGeometry(0.07, 0.18, 0.1).translate(x + 0.08, y, z));
  }
}

/**
 * Build 62 Grand Terrace on its lot.
 * @param lot     hero lot from layout (x, z, rot, h)
 * @param terrain for draping the front path over the verge
 */
export function buildHeroHouse(lot, terrain) {
  const solid = [];
  const out = { walls: solid, roof: solid, detail: solid, glass: [] };
  const lamps = [];
  const G = DIM.ground, U = DIM.upper;
  const fz = G.z1 + 0.005, ufz = U.z1 + 0.005;
  const win = (x, y, w, h, face = 'z', z = fz, extra = {}) =>
    addWindow(out, { x, y, z, w, h, face, frame: COL.trim, glassColor: COL.glass, ...extra });

  // ---- Walls -------------------------------------------------------------------
  const gW = DIM.garageX1 - G.x0;
  solid.push(boxB(gW, G.h, G.z1 - G.z0, (G.x0 + DIM.garageX1) / 2, 0, (G.z0 + G.z1) / 2, COL.garageWall, { jitter: 0.025 }));
  const mW = G.x1 - DIM.garageX1;
  solid.push(boxB(mW, G.h, G.z1 - G.z0, (DIM.garageX1 + G.x1) / 2, 0, (G.z0 + G.z1) / 2, COL.render, { jitter: 0.025 }));
  solid.push(boxB(U.x1 - U.x0, U.h, U.z1 - U.z0, (U.x0 + U.x1) / 2, G.h, (U.z0 + U.z1) / 2, COL.render, { jitter: 0.025 }));
  // Base band (plinth) and the trim band between storeys.
  solid.push(boxB(G.x1 - G.x0 + 0.06, DIM.baseH, G.z1 - G.z0 + 0.06, (G.x0 + G.x1) / 2, 0, (G.z0 + G.z1) / 2, COL.base, { jitter: 0.03 }));
  solid.push(boxB(U.x1 - U.x0 + 0.1, DIM.bandH, U.z1 - U.z0 + 0.1, (U.x0 + U.x1) / 2, G.h + DIM.slabT - 0.02, (U.z0 + U.z1) / 2, COL.trim, { jitter: 0.02 }));
  // Pilaster where the garage wing meets the house.
  solid.push(boxB(0.22, G.h, 0.12, DIM.garageX1, 0, fz + 0.04, COL.render));

  // ---- Flat roof over the garage wing + front ledge (L-shaped slab) ---------------
  solid.push(boxB(U.x0 - G.x0 + 0.3, DIM.slabT, G.z1 - G.z0 + 0.6, (G.x0 - 0.3 + U.x0) / 2, G.h, (G.z0 + G.z1) / 2, COL.fascia, { jitter: 0.02 }));
  solid.push(boxB(G.x1 + 0.25 - U.x0, DIM.slabT, G.z1 + 0.3 - U.z1, (U.x0 + G.x1 + 0.25) / 2, G.h, (U.z1 + G.z1 + 0.3) / 2, COL.fascia, { jitter: 0.02 }));
  // Thin light soffit strip under the front ledge overhang.
  solid.push(downPlane(G.x1 - G.x0 + 0.5, 0.3, (G.x0 + G.x1) / 2, G.h - 0.005, G.z1 + 0.15, COL.soffit));

  // ---- Main hip roof + ridge cap + solar ---------------------------------------
  const rW = U.x1 - U.x0, rD = U.z1 - U.z0, rcx = (U.x0 + U.x1) / 2, rcz = (U.z0 + U.z1) / 2;
  const roofY = G.h + U.h;
  hipRoof(out, { cx: rcx, cz: rcz, y: roofY, W: rW, D: rD, pitch: DIM.roof.pitch, overhang: DIM.roof.overhang, color: COL.roof, fascia: COL.fascia, soffit: COL.soffit, fasciaH: 0.26 });
  {
    const w = rW / 2 + DIM.roof.overhang, d = rD / 2 + DIM.roof.overhang;
    const t = Math.tan(THREE.MathUtils.degToRad(DIM.roof.pitch));
    const ridgeHalf = w - d, top = roofY + d * t;
    solid.push(box(ridgeHalf * 2 + 0.2, 0.09, 0.22, rcx, top + 0.02, rcz, COL.fascia));
    // Solar panels on the street-facing slope.
    const slopeLen = d / Math.cos(THREE.MathUtils.degToRad(DIM.roof.pitch));
    const pitch = THREE.MathUtils.degToRad(DIM.roof.pitch);
    for (let r = 0; r < DIM.solar.rows; r++) {
      const u = 0.3 + r * 0.31; // fraction up the slope (panel centre)
      for (let c = 0; c < DIM.solar.cols; c++) {
        const x = rcx + (c - (DIM.solar.cols - 1) / 2) * 1.08;
        const y = roofY + u * d * t + 0.07, z = rcz + d - u * d;
        const panel = new THREE.BoxGeometry(1.0, 0.05, slopeLen * 0.28);
        panel.rotateX(pitch);
        solid.push(painted(panel, PALETTE.hero.solar, x, y, z, 0.03));
        const rim = new THREE.BoxGeometry(1.04, 0.04, slopeLen * 0.28 + 0.04);
        rim.rotateX(pitch);
        solid.push(painted(rim, PALETTE.hero.solarFrame, x, y - 0.02, z, 0.02));
      }
    }
  }

  // ---- Garage door + front door + porch ------------------------------------------
  const gd = DIM.garageDoor;
  addGarageDoor(out, { x: gd.x, z: fz, w: gd.w, h: gd.h, color: COL.garageDoor, dark: COL.trim, frame: COL.trim });
  const dr = DIM.door;
  addDoor(out, { x: dr.x, z: fz, w: dr.w, h: dr.h, color: COL.door, frame: COL.trim, glassColor: COL.glass, sidelight: true, handle: '#cdb98a' });
  // Vertical timber battens either side of the entry.
  for (const [a, b] of [[-0.3, 0.35], [2.12, 2.95]]) {
    for (let x = a; x <= b; x += 0.16) solid.push(boxB(0.07, DIM.porch.h - DIM.baseH, 0.05, x, DIM.baseH, fz + 0.025, COL.timber, { jitter: 0.08 }));
  }
  const P = DIM.porch, pz1 = G.z1 + P.depth;
  solid.push(boxB(P.x1 - P.x0, 0.22, P.depth + 0.1, (P.x0 + P.x1) / 2, P.h, G.z1 + P.depth / 2, COL.trim, { jitter: 0.02 }));
  solid.push(downPlane(P.x1 - P.x0 - 0.1, P.depth - 0.05, (P.x0 + P.x1) / 2, P.h - 0.005, G.z1 + P.depth / 2, COL.soffit));
  for (const px of [P.x0 + 0.2, P.x1 - 0.2]) {
    solid.push(boxB(0.34, 0.5, 0.34, px, 0.18, pz1 - 0.22, COL.base));
    solid.push(boxB(0.18, P.h - 0.68, 0.18, px, 0.68, pz1 - 0.22, COL.render));
  }
  solid.push(boxB(P.x1 - P.x0 + 0.4, 0.18, P.depth + 0.2, (P.x0 + P.x1) / 2, 0, G.z1 + P.depth / 2 + 0.1, COL.pavers, { jitter: 0.06 }));
  solid.push(boxB(2.0, 0.09, 0.45, DIM.path.x, 0, pz1 + 0.4, COL.pavers));
  // Potted plants either side of the entry, standing on the porch slab.
  for (const px of [-0.95, 3.0]) {
    solid.push(cylinder(0.24, 0.19, 0.52, 8, px, 0.18, G.z1 + 0.55, COL.trim));
    solid.push(icosa(0.34, 1, px, 0.98, G.z1 + 0.55, PALETTE.tree.leaves[1], { sy: 1.25, jitter: 0.12 }));
    solid.push(icosa(0.2, 0, px + 0.12, 1.32, G.z1 + 0.5, PALETTE.tree.leaves[3], { jitter: 0.1 }));
  }

  // ---- Windows -----------------------------------------------------------------
  const lw = DIM.livingWindow;
  win(lw.x, 1.5, lw.w, lw.h);
  win(-1.6, 1.5, 0.8, 1.6);
  const uy = G.h + DIM.slabT + 1.25;
  win(-1.6, uy, 1.8, 1.3, 'z', ufz);
  win(1.6, uy, 1.2, 1.3, 'z', ufz);
  win(4.8, uy, 2.6, 1.5, 'z', ufz);
  // Charcoal box frame around the big upstairs window (modern feature).
  {
    const x = 4.8, w = 2.6 + 0.5, h = 1.5 + 0.44, t = 0.22, dpt = 0.34;
    solid.push(box(w, t, dpt, x, uy + h / 2 - t / 2, ufz + dpt / 2, COL.trim));
    solid.push(box(w, t, dpt, x, uy - h / 2 + t / 2, ufz + dpt / 2, COL.trim));
    solid.push(box(t, h, dpt, x - w / 2 + t / 2, uy, ufz + dpt / 2, COL.trim));
    solid.push(box(t, h, dpt, x + w / 2 - t / 2, uy, ufz + dpt / 2, COL.trim));
  }
  // Sides and back.
  win(G.x1 + 0.005, 1.5, 1.6, 1.3, 'x', 1.5);
  win(G.x1 + 0.005, 1.5, 1.2, 1.1, 'x', -2.6);
  win(U.x1 + 0.005, uy, 1.8, 1.3, 'x', -0.4);
  win(U.x0 - 0.005, uy, 1.4, 1.2, '-x', -1.5);
  win(G.x0 - 0.005, 1.6, 0.8, 0.8, '-x', -2.0);
  win(3.0, 1.15, 2.6, 2.1, '-z', G.z0 - 0.005);
  win(-1.0, 1.5, 1.4, 1.2, '-z', G.z0 - 0.005);
  win(-1.5, uy, 1.4, 1.2, '-z', U.z0 - 0.005);
  win(3.5, uy, 1.8, 1.3, '-z', U.z0 - 0.005);

  // ---- Downpipes, AC unit ----------------------------------------------------------
  solid.push(boxB(0.09, roofY, 0.09, U.x1 + 0.06, 0, U.z1 - 0.1, COL.fascia));
  solid.push(boxB(0.09, G.h, 0.09, G.x0 - 0.06, 0, G.z1 - 0.1, COL.fascia));
  solid.push(boxB(0.32, 0.6, 0.85, G.x1 + 0.18, 0.15, -3.6, '#d8d6cf'));
  solid.push(box(0.02, 0.4, 0.4, G.x1 + 0.35, 0.47, -3.6, '#8f918c'));

  // ---- Wall numbers "62" + lamps -------------------------------------------------
  const tex = numeralsTexture();
  const numGeos = [numberPlane(0.84, 0.42, false, -2.55, 2.05, fz + 0.012)];
  wallLamp(solid, lamps, G.x0 + 0.35, 2.25, fz);
  wallLamp(solid, lamps, DIM.garageX1 - 0.35, 2.25, fz);
  wallLamp(solid, lamps, 0.02, 1.95, fz + 0.05);
  lamps.push(new THREE.BoxGeometry(0.34, 0.03, 0.34).translate(dr.x, P.h - 0.02, G.z1 + P.depth / 2));

  // ---- Front yard ----------------------------------------------------------------
  const bz = BOUNDARY_Z - DIM.hedge.d / 2 - 0.1;
  const dwX0 = HERO_LOT.garageX - HERO_LOT.driveW / 2, dwX1 = HERO_LOT.garageX + HERO_LOT.driveW / 2;
  hedge(solid, DIM.sideFence.x0 + 0.3, dwX0 - 0.4, bz);
  hedge(solid, DIM.letterboxX + 0.5, DIM.path.x - DIM.path.w / 2 - 0.15, bz);
  hedge(solid, DIM.path.x + DIM.path.w / 2 + 0.15, DIM.sideFence.x1 - 0.3, bz);
  // Letterbox: rendered brick pillar with cap, slot, number plate and a little lamp.
  {
    const x = DIM.letterboxX, z = bz;
    solid.push(boxB(0.55, 1.55, 0.5, x, -0.4, z, COL.letterbox, { jitter: 0.08 }));
    solid.push(boxB(0.66, 0.08, 0.6, x, 1.15, z, COL.base));
    solid.push(box(0.32, 0.04, 0.02, x, 0.95, z + 0.255, '#2a2a2a'));
    numGeos.push(numberPlane(0.3, 0.26, true, x, 0.62, z + 0.252));
    lamps.push(new THREE.BoxGeometry(0.14, 0.12, 0.14).translate(x, 1.29, z));
  }
  // Garden beds with shrubs and flowers.
  const rng = (() => { let s = 62; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const bed = (x0, x1, z0, z1, plants) => {
    solid.push(boxB(x1 - x0, 0.1, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, COL.mulch, { jitter: 0.08 }));
    solid.push(boxB(x1 - x0 + 0.1, 0.06, 0.06, (x0 + x1) / 2, 0, z1 + 0.03, COL.pavers));
    for (let i = 0; i < plants; i++) {
      const x = x0 + ((i + 0.5) / plants) * (x1 - x0), z = (z0 + z1) / 2 + (rng() - 0.5) * (z1 - z0) * 0.4;
      shrub(solid, x, z, 0.3 + rng() * 0.18, PALETTE.tree.leaves[Math.floor(rng() * 5)]);
      if (rng() < 0.6) solid.push(icosa(0.11, 0, x + 0.2, 0.62, z + 0.18, PALETTE.hero.flowers[Math.floor(rng() * 4)], { jitter: 0.05 }));
    }
  };
  bed(P.x1 + 0.3, G.x1 + 0.1, G.z1 + 0.05, G.z1 + 1.5, 5);
  bed(DIM.garageX1 + 0.1, P.x0 - 0.1, G.z1 + 0.05, G.z1 + 1.2, 2);
  bed(DIM.path.x + 1.2, DIM.sideFence.x1 - 0.6, bz - 1.6, bz - 0.4, 7);
  // Garden spike lights.
  for (const x of [P.x1 + 1.0, P.x1 + 2.6]) lamps.push(new THREE.BoxGeometry(0.08, 0.14, 0.08).translate(x, 0.2, G.z1 + 1.45));
  // Trees: frangipani in the front lawn, palm in the back corner, small round tree front-left.
  const treeParts = [];
  frangipani(treeParts, 7.4, 9.6);
  palm(treeParts, 9.8, -8.4);
  palm(treeParts, -11.2, -9.2);
  solid.push(cylinder(1.25, 1.25, 0.08, 10, 7.4, 0, 9.6, COL.mulch));
  solid.push(...treeParts);

  // ---- Side fences (Colorbond panels on posts), back yard bits -----------------------
  const F = DIM.sideFence;
  for (const fx of [F.x0, F.x1]) {
    const len = F.z1 - F.z0;
    solid.push(boxB(0.05, F.h, len, fx, 0, (F.z0 + F.z1) / 2, COL.fence, { jitter: 0.03 }));
    for (let z = F.z0; z <= F.z1 + 0.01; z += 2.4) solid.push(boxB(0.09, F.h + 0.05, 0.09, fx, 0, z, '#5d6157'));
    // Ribs on the panels.
    for (let z = F.z0 + 0.2; z < F.z1; z += 0.3) solid.push(boxB(0.07, F.h - 0.1, 0.04, fx, 0.05, z, COL.fence, { jitter: 0.02 }));
  }
  solid.push(boxB(F.x1 - F.x0, F.h, 0.05, (F.x0 + F.x1) / 2, 0, F.z0, COL.fence, { jitter: 0.03 }));
  solid.push(boxB(6.5, 0.12, 3.2, 3.0, 0, G.z0 - 1.6, COL.pavers, { jitter: 0.06 })); // alfresco slab
  hillsHoist(solid, -5.5, -8.2);
  wheelieBin(solid, G.x0 - 0.65, 2.6, PALETTE.hero.binLidRed);
  wheelieBin(solid, G.x0 - 0.65, 1.7, PALETTE.hero.binLidYellow);

  // ---- Mowing stripes on the front lawn + saw-cut joints in the driveway (draped) ----
  {
    const lawnA = PALETTE.hero.lawn, lawnB = PALETTE.hero.lawnStripe;
    const z0 = pz1 + 0.6, z1 = BOUNDARY_Z - DIM.hedge.d - 0.2;
    const spans = [[DIM.sideFence.x0 + 0.3, dwX0 - 0.15], [dwX1 + 0.15, DIM.path.x - DIM.path.w / 2 - 0.05], [DIM.path.x + DIM.path.w / 2 + 0.05, DIM.sideFence.x1 - 0.3]];
    let k = 0;
    for (const [a, b] of spans) {
      for (let x = a; x < b - 0.05; x += 1.3, k++) {
        draped(solid, terrain, lot, x, Math.min(b, x + 1.3), z0, z1, k % 2 ? lawnA : lawnB, 0.025);
      }
    }
    for (const jz of [7.6, 10.4, 13.2, 15.8]) draped(solid, terrain, lot, dwX0 + 0.1, dwX1 - 0.1, jz, jz + 0.05, PALETTE.hero.joint, 0.1, 6);
    draped(solid, terrain, lot, HERO_LOT.garageX - 0.025, HERO_LOT.garageX + 0.025, G.z1 + 0.3, HERO_LOT.setback - 3.9, PALETTE.hero.joint, 0.1, 1);
  }

  // ---- Front path: pavers from the porch step to the footpath, draped on terrain --
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  const toWorld = (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c });
  for (let z = pz1 + 0.95; z < HERO_LOT.setback - 6.85; z += 0.72) {
    const w = toWorld(DIM.path.x, z);
    const y = terrain.getHeight(w.x, w.z) - lot.h;
    solid.push(boxB(DIM.path.w, 0.09, 0.56, DIM.path.x, Math.max(y, -0.4) - 0.02, z, COL.pavers, { jitter: 0.07 }));
  }

  // ---- Assemble: 4 draw calls (solid, glass, lamps, numerals) ---------------------------
  const group = new THREE.Group();
  group.name = 'hero-62';
  group.position.set(lot.x, lot.h, lot.z);
  group.rotation.y = lot.rot;

  const solidMesh = new THREE.Mesh(merge(solid), MAT.solid);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  const glassMesh = new THREE.Mesh(merge(out.glass), MAT.glass);
  glassMesh.receiveShadow = true;
  const lampMesh = new THREE.Mesh(mergeLamps(lamps), MAT.lamp);
  const numMesh = new THREE.Mesh(mergeLamps(numGeos), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4 }));
  numMesh.receiveShadow = true;
  group.add(solidMesh, glassMesh, lampMesh, numMesh);
  group.updateMatrixWorld(true);

  // ---- Colliders (world space boxes) ------------------------------------------------------
  const colliders = [];
  const addBox = (x0, x1, z0, z1, y0, y1) => {
    const w = toWorld((x0 + x1) / 2, (z0 + z1) / 2);
    colliders.push({ x: w.x, y: lot.h + (y0 + y1) / 2, z: w.z, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, hz: (z1 - z0) / 2, rot: lot.rot });
  };
  addBox(G.x0, G.x1, G.z0, G.z1, 0, roofY + 2);
  // Walkable slabs so feet sit on them (character controller auto-steps these).
  addBox(P.x0 - 0.2, P.x1 + 0.2, G.z1, pz1 + 0.2, 0, 0.18);
  addBox(DIM.path.x - 1.0, DIM.path.x + 1.0, pz1 + 0.18, pz1 + 0.62, 0, 0.09);
  addBox(-0.25, 6.25, G.z0 - 3.2, G.z0, 0, 0.12);
  for (const px of [P.x0 + 0.2, P.x1 - 0.2]) addBox(px - 0.17, px + 0.17, pz1 - 0.39, pz1 - 0.05, 0, P.h);
  addBox(DIM.letterboxX - 0.3, DIM.letterboxX + 0.3, bz - 0.28, bz + 0.28, 0, 1.25);
  for (const [x0, x1] of [[F.x0 + 0.3, dwX0 - 0.4], [DIM.letterboxX + 0.5, DIM.path.x - DIM.path.w / 2 - 0.15], [DIM.path.x + DIM.path.w / 2 + 0.15, F.x1 - 0.3]]) {
    addBox(x0, x1, bz - DIM.hedge.d / 2, bz + DIM.hedge.d / 2, 0, DIM.hedge.h);
  }
  for (const fx of [F.x0, F.x1]) addBox(fx - 0.06, fx + 0.06, F.z0, F.z1, 0, F.h);
  addBox(F.x0, F.x1, F.z0 - 0.06, F.z0 + 0.06, 0, F.h);
  for (const [tx, tz] of [[7.4, 9.6], [9.8, -8.4], [-11.2, -9.2]]) addBox(tx - 0.2, tx + 0.2, tz - 0.2, tz + 0.2, 0, 3);
  addBox(G.x0 - 1.0, G.x0 - 0.3, 1.3, 3.0, 0, 1.0);

  return { group, colliders, numbersTexture: tex };
}

/**
 * Ground-hugging rectangle in lot space, draped over the real terrain (cells of step m).
 * lift = metres above the ground.
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

/** Flat downward-facing plane (soffits) - no edge faces to shimmer. */
function downPlane(w, d, x, y, z, color) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(Math.PI / 2);
  return painted(g, color, x, y, z, 0.01);
}

/** Merge geometries that only have position/normal/uv (lamps, numerals). */
function mergeLamps(list) {
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
