// Town buildings (exteriors): 10 shopfronts on Terrace Pde, the police station with its
// patrol-car bay, the hospital with an ambulance bay, the petrol station, Terrace Central's
// facade + car park, and filler flats/offices. Static parked cars are merged geometry.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { paint } from '../utils/geom.js';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { buildCarGeometry } from '../vehicles/carModels.js';
import { frame, building } from './townKit.js';
import { T } from './townPlan.js';

const C = PALETTE.town;
export const SHOPS = [
  // North side of Terrace Pde (face +z), then south side (face -z), west -> east.
  { kind: 'cafe', name: 'BEAN THERE CAFE' }, { kind: 'bakery', name: 'GOLDEN CRUST BAKERY' }, { kind: 'chemist', name: 'PARADE CHEMIST' },
  { kind: 'barber', name: 'SHARP CUTS BARBER' }, { kind: 'guns', name: 'BARREL & BOLT', interior: true }, // Phase 5: enterable gun shop (townInteriors.js)
  { kind: 'electronics', name: 'VOLT ELECTRONICS' }, { kind: 'fashion', name: 'THREADS FASHION' }, { kind: 'bank', name: 'TERRACE SAVINGS BANK' },
  { kind: 'takeaway', name: 'WOK & ROLL TAKEAWAY' }, { kind: 'bottle', name: 'CORNER BOTTLE SHOP' },
];
export const SHOP_X = [435.6, 452.8, 470, 487.2, 504.4];
export const ROW_Z = { north: T.Z[1] - T.front, south: T.Z[1] + T.front };

/** Static parked car (merged into a chunk) + switchable collider; stealable (becomes a real car). */
let propId = 0;
const carCache = new Map();
export function staticCar(ch, x, z, yaw, type, color, extra = null, kind = 'civ') {
  const cfg = CAR_TYPES[type], key = `${type}|${color}`;
  if (!carCache.has(key)) {
    const g = buildCarGeometry(type, cfg, color);
    const wheels = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.CylinderGeometry(cfg.wheelR, cfg.wheelR, cfg.wheelW, 10).rotateZ(Math.PI / 2).translate(sx * cfg.track / 2, cfg.wheelR, sz * cfg.wheelBase / 2);
      wheels.push(paint(w, '#262628', 0.03));
    }
    carCache.set(key, { paint: g.paint, glass: paint(g.glass.clone(), '#33414c', 0.02), wheels });
  }
  const c = carCache.get(key);
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, T.h + 0.04, z);
  const solidGeos = [c.paint.clone().applyMatrix4(m), ...c.wheels.map((w) => w.clone().applyMatrix4(m))];
  if (extra) for (const g of extra(cfg)) solidGeos.push(g.applyMatrix4(m));
  const glassGeos = [c.glass.clone().applyMatrix4(m)];
  ch.solid.push(...solidGeos);
  ch.glass.push(...glassGeos);
  const zMid = cfg.frontOverhang - cfg.L / 2 + cfg.wheelBase / 2;
  const cx = x + Math.sin(yaw) * zMid, cz = z + Math.cos(yaw) * zMid;
  const id = `propcar-${propId++}`;
  const prop = { id, x, z, yaw, type, color, kind, solidGeos, glassGeos, cfg,
    toggle: { id, x: cx, y: T.h + cfg.roof / 2, z: cz, hx: cfg.W / 2, hy: cfg.roof / 2, hz: cfg.L / 2, rot: yaw } };
  ch.props.push(prop);
  return prop;
}

/** Ambulance livery: blue + yellow bands and a red/blue light bar. */
export const ambulanceExtras = (cfg) => [
  paint(new THREE.BoxGeometry(cfg.W + 0.02, 0.16, cfg.L * 0.8).translate(0, cfg.belt - 0.12, -0.1), '#2f6fc0', 0.02),
  paint(new THREE.BoxGeometry(cfg.W + 0.02, 0.08, cfg.L * 0.8).translate(0, cfg.belt - 0.24, -0.1), '#e2c25a', 0.02),
  ...patrolExtras(cfg).slice(0, 3),
];

/** Police light bar + stripe for a static patrol car. */
export const patrolExtras = (cfg) => [
  paint(new THREE.BoxGeometry(1.1, 0.12, 0.3).translate(0, cfg.roof + 0.06, -0.1), '#2a2a2e', 0.02),
  paint(new THREE.BoxGeometry(0.5, 0.1, 0.26).translate(-0.28, cfg.roof + 0.14, -0.1), '#c8322a', 0.02),
  paint(new THREE.BoxGeometry(0.5, 0.1, 0.26).translate(0.28, cfg.roof + 0.14, -0.1), '#2a5ad0', 0.02),
  paint(new THREE.BoxGeometry(cfg.W + 0.02, 0.16, cfg.L * 0.62).translate(0, cfg.belt - 0.2, 0), '#2d5aa0', 0.02),
];

function shopfront(ch, atlas, F, { w, d, name, wall, awning }) {
  const H = 7.4;
  ch.block(F, w, H, d, 0, 0, -d / 2, wall);
  ch.box(F, w + 0.2, 0.5, 0.5, 0, H, -0.15, '#efe9dd'); // cornice
  ch.box(F, w, 1.2, 0.2, 0, H + 0.5, -0.1, wall);        // parapet
  // Ground floor: shop window either side of a recessed door.
  const doorW = 1.8, side = (w - doorW - 1.2) / 2;
  for (const s of [-1, 1]) ch.box(F, side, 2.3, 0.12, s * (doorW / 2 + 0.3 + side / 2), 0.55, 0.05, '#5a7183', { glassy: true });
  ch.box(F, doorW, 2.5, 0.12, 0, 0, -0.02, '#3c4a55', { glassy: true });
  ch.box(F, w, 0.55, 0.16, 0, 0, 0.06, '#8d7f70'); // stall riser
  // Awning over the footpath + sign board above it.
  ch.box(F, w - 0.4, 0.18, 2.6, 0, 3.15, 1.3, awning);
  ch.box(F, w - 0.4, 0.45, 0.06, 0, 2.75, 2.58, awning);
  atlas.sign(F, atlas.row(name, '#f4f1e8', '#2b2b2e'), w - 1.4, 0.82, 0, 3.95, 0.13);
  ch.box(F, w - 1.2, 1.0, 0.1, 0, 3.45, 0.06, '#2b2b2e');
  // First floor: three windows.
  for (const x of [-w / 3, 0, w / 3]) ch.box(F, 1.8, 1.6, 0.12, x, 4.9, 0.05, '#4d6577', { glassy: true });
}

/** All exteriors. chunks: map of block key -> chunk. */
export function buildTownBuildings({ chunk, atlas, plan, rng }) {
  const out = { places: [], spawns: {}, carpark: [], doorsAt: {} };
  const yN = 1, yS = -1; // face +z (north row) / -z (south row)

  // ---- Shops on Terrace Pde --------------------------------------------------------------------
  SHOPS.forEach((s, k) => {
    const north = k < 5, x = SHOP_X[k % 5];
    const ch = chunk(north ? 'b10' : 'b11');
    const F = frame(x, north ? ROW_Z.north : ROW_Z.south, 0, north ? yN : yS, T.h);
    if (s.interior) return; // Barrel & Bolt: its map marker comes from the real door (town.js)
    shopfront(ch, atlas, F, { w: 16.6, d: 14, name: s.name, wall: C.shopWalls[k % C.shopWalls.length], awning: C.awnings[k % C.awnings.length] });
    out.places.push({ kind: 'shop', x, z: F.cz, label: s.name });
  });

  // ---- Police station (brick, blue trim) + patrol car bay -------------------------------------
  {
    const ch = chunk('b00');
    const F = frame(358, ROW_Z.north, 0, 1, T.h);
    building(ch, F, { w: 38, d: 22, floors: 2, floorH: 3.8, wall: C.brick, trim: C.police, roof: C.roofFlat });
    ch.box(F, 38.2, 0.9, 0.2, 0, 3.0, 0.02, C.police);
    for (let k = 0; k < 62; k += 2) ch.box(F, 0.6, 0.45, 0.22, -18.3 + k * 0.6, 3.45, 0.03, '#f4f1e8');
    ch.box(F, 7, 0.4, 3, 0, 0, 1.4, C.concrete);                // steps
    ch.box(F, 7.4, 0.25, 3.4, 0, 3.0, 1.6, C.police);            // entry canopy
    ch.box(F, 3.2, 2.6, 0.12, 0, 0.4, 0.05, '#3c4a55', { glassy: true });
    atlas.sign(F, atlas.row('POLICE', C.police, '#ffffff', 'bold 46px Arial'), 9, 1.0, 0, 6.3, 0.12, { u0: 0.3, u1: 0.7 });
    ch.box(F, 9.4, 1.3, 0.1, 0, 5.65, 0.06, '#f4f1e8');
    // Blue lamp on a post at the entry.
    ch.box(F, 0.14, 3.4, 0.14, 4.6, 0, 2.6, '#2b2b2e');
    ch.box(F, 0.5, 0.5, 0.5, 4.6, 3.4, 2.6, '#3f7fe0');
    // Car bay to the east: asphalt, bay lines, three patrol cars nose-out.
    const bay = frame(397, ROW_Z.north - 1, 0, 1, T.h);
    ch.box(bay, 30, 0.04, 30, 0, 0.06, -15, C.carpark);
    for (let x = -12; x <= 12; x += 6) ch.box(bay, 0.12, 0.02, 6, x, 0.1, -9, C.line);
    for (const [k, x] of [-9, -3, 3].entries()) staticCar(ch, 397 + x, ROW_Z.north - 9 + (k === 1 ? 0.3 : 0), 0, k === 1 ? 'suv' : 'sedan', '#f1f1ec', patrolExtras, 'police');
    out.spawns.police = { x: 358, z: T.Z[1] - T.hw - T.kerb - 2.3, yaw: 0 };
    out.places.push({ kind: 'police', x: 358, z: ROW_Z.north - 10, label: 'Police Station' });
    // Flats on the ring road behind.
    building(ch, frame(356, T.Z[0] + T.front, 0, -1, T.h), { w: 34, d: 16, floors: 3, wall: C.shopWalls[2] });
    building(ch, frame(396, T.Z[0] + T.front, 0, -1, T.h), { w: 30, d: 16, floors: 4, wall: C.office[1] });
  }

  // ---- Offices behind the north shops ----------------------------------------------------------
  {
    const ch = chunk('b10');
    building(ch, frame(470, T.Z[0] + T.front, 0, -1, T.h), { w: 70, d: 18, floors: 4, wall: C.office[0] });
    // Rear service yard paving.
    ch.box(frame(470, -150, 0, 1, T.h), 82, 0.05, 56, 0, 0.04, 28, C.concrete);
  }

  // ---- Terrace Central (exterior shell built by townInteriors) + car park -----------------------
  {
    const ch = chunk('b20');
    const cp = frame(564, T.Z[0] + T.front + 1, 0, -1, T.h); // car park, front = ring road
    ch.box(cp, 72, 0.04, 70, 0, 0.06, -35, C.carpark);
    for (let row = 0; row < 3; row++) {
      const zc = -9 - row * 22;
      for (let x = -32; x <= 32; x += 3.2) ch.box(cp, 0.12, 0.02, 5.2, x, 0.1, zc, C.line);
      for (let x = -30.4; x <= 30.4; x += 3.2) if (rng.chance(0.55)) out.carpark.push({ ...cp.toW(x, zc), yaw: row % 2 ? 0 : Math.PI });
    }
    atlas.sign(cp, atlas.row('P  CUSTOMER PARKING', '#2f6fc0', '#ffffff'), 6, 0.9, -38, 3.0, 0.2, { u0: 0.1, u1: 0.9 });
    ch.box(cp, 0.12, 3.5, 0.12, -40.5, 0, 0.2, '#2b2b2e'); ch.box(cp, 0.12, 3.5, 0.12, -35.5, 0, 0.2, '#2b2b2e');
    building(ch, frame(591, ROW_Z.north, 0, 1, T.h), { w: 18, d: 16, floors: 2, wall: C.office[3] });
  }

  // ---- Petrol station (canopy + pumps + price pylon) -------------------------------------------
  {
    const ch = chunk('b01');
    const F = frame(358, -62, 0, -1, T.h);
    ch.box(F, 44, 0.05, 34, 0, 0.05, 0, C.concrete);   // forecourt
    ch.box(F, 24, 0.9, 15, 0, 5, 0, C.canopy);
    ch.box(F, 24.2, 0.35, 15.2, 0, 5.3, 0, C.fuelRed);
    for (const [x, z] of [[-10, -6], [10, -6], [-10, 6], [10, 6]]) ch.block(F, 0.45, 5, 0.45, x, 0, z, '#d9d4c8');
    for (const x of [-5, 5]) {
      ch.block(F, 1.2, 0.25, 7, x, 0, 0, C.concrete);
      for (const z of [-2, 2]) { ch.box(F, 0.8, 1.6, 0.6, x, 0.25, z, '#e9e4d8'); ch.box(F, 0.82, 0.3, 0.62, x, 1.85, z, C.fuelRed); }
    }
    const pyl = frame(339, -77.5, 0, -1, T.h);
    ch.block(pyl, 2.2, 6, 0.5, 0, 0, 0, C.fuelRed);
    atlas.sign(pyl, atlas.row('FUEL  1.89', '#c4473a', '#ffffff'), 2.0, 0.9, 0, 4.7, 0.26, { u0: 0.3, u1: 0.7 });
    atlas.sign(pyl, atlas.row('FUEL  1.89', '#c4473a', '#ffffff'), 2.0, 0.9, 0, 4.7, -0.26, { u0: 0.3, u1: 0.7, back: true });
    out.places.push({ kind: 'shop', x: 358, z: -62, label: 'Petrol' });
    staticCar(ch, 350.4, -62, 0, 'hatch', '#b98a4a');           // filling up at the pumps
    staticCar(ch, 365.6, -61.5, Math.PI, 'ute', '#46566b');
    building(ch, frame(375, T.Z[2] - T.front, 0, 1, T.h), { w: 60, d: 16, floors: 3, wall: C.shopWalls[4] });
  }

  // ---- Hospital (white, big blue H) + ambulance bay --------------------------------------------
  {
    const ch = chunk('b21');
    const F = frame(562, ROW_Z.south, 0, -1, T.h);
    building(ch, F, { w: 56, d: 28, floors: 3, floorH: 3.8, wall: C.hospital, trim: C.hBlue, roof: C.roofFlat });
    ch.box(F, 12, 0.3, 5, 0, 3.2, 2.4, C.hBlue);                 // entry canopy
    for (const x of [-5.6, 5.6]) ch.block(F, 0.3, 3.2, 0.3, x, 0, 4.6, '#d9d4c8');
    ch.box(F, 4.4, 2.6, 0.12, 0, 0, 0.05, '#3c4a55', { glassy: true });
    // Big blue square with a white H above the entrance + on the roof.
    ch.box(F, 4.6, 4.6, 0.25, 0, 7.4, 0.1, C.hBlue);
    ch.box(F, 0.8, 3.4, 0.08, -1.1, 8.0, 0.25, '#ffffff'); ch.box(F, 0.8, 3.4, 0.08, 1.1, 8.0, 0.25, '#ffffff'); ch.box(F, 1.6, 0.7, 0.08, 0, 9.35, 0.25, '#ffffff');
    ch.box(F, 10, 0.12, 10, 14, 12.05, -14, C.hBlue);
    ch.box(F, 1.6, 0.06, 7, 11.4, 12.17, -14, '#ffffff'); ch.box(F, 1.6, 0.06, 7, 16.6, 12.17, -14, '#ffffff'); ch.box(F, 3.6, 0.06, 1.4, 14, 12.17, -14, '#ffffff');
    atlas.sign(F, atlas.row('TERRACE HOSPITAL', C.hospital, C.hBlue), 16, 1.1, -16, 3.9, 0.14);
    atlas.sign(F, atlas.row('EMERGENCY', '#c8322a', '#ffffff'), 6, 0.8, 22, 3.9, 0.14, { u0: 0.2, u1: 0.8 });
    // Ambulance bay (east side) with a parked ambulance.
    const amb = frame(598, -58, 0, -1, T.h);
    ch.box(amb, 9, 0.3, 16, 0, 4.2, 0, C.hBlue);
    for (const [x, z] of [[-4.2, -7.6], [4.2, -7.6], [-4.2, 7.6], [4.2, 7.6]]) ch.block(amb, 0.3, 4.2, 0.3, x, 0, z, '#d9d4c8');
    ch.box(amb, 8, 0.04, 15, 0, 0.06, 0, C.carpark);
    staticCar(ch, 598, -58, Math.PI, 'suv', '#f4f1e8', ambulanceExtras, 'ambulance'); // nose out toward Station St
    out.spawns.hospital = { x: 562, z: T.Z[1] + T.hw + T.kerb + 2.3, yaw: Math.PI };
    out.places.push({ kind: 'hospital', x: 562, z: ROW_Z.south + 12, label: 'Terrace Hospital' });
    building(ch, frame(565, T.Z[2] - T.front, 0, 1, T.h), { w: 60, d: 18, floors: 2, wall: C.office[2] });
  }
  void plan;
  return out;
}
