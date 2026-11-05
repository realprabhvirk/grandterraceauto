// NORTHGATE (second suburb) on the small grid north of the ring road (townPlan.js NORTH):
// houses from the suburb's instanced variants along every residential block, Northgate State
// School (buildings + running oval, staff only - no children), Northgate Plaza shopping centre
// with a big car park of stealable cars, a water tower landmark, and NPC spots.
import * as THREE from 'three';
import { frame, makeChunk } from '../town/townKit.js';
import { T, NORTH } from '../town/townPlan.js';
import { staticCar } from '../town/townBuildings.js';
import { tower } from './downtown.js';
import { buildHouses, VARIANTS } from '../world/houses.js';
import { cylinder, paint } from '../utils/geom.js';
import { PALETTE } from '../art/palette.js';

export const NG = { school: { i: 1, j: 0 }, plaza: { i: 2, j: 1 } };

export function buildNorthgate({ parent, atlas, rng }) {
  const out = { chunks: [], colliders: [], places: [], npcSpots: [], updaters: [], propChunks: [], landmarks: [], lots: [], houses: null };
  const { X, Z } = NORTH, y = T.h, front = T.front;
  const chunks = new Map();
  const chunk = (name) => { if (!chunks.has(name)) chunks.set(name, makeChunk(name)); return chunks.get(name); };

  // ---- Houses round every residential block ---------------------------------------------------
  const lots = [];
  for (let j = 0; j + 1 < Z.length; j++) for (let i = 0; i + 1 < X.length; i++) {
    if ((i === NG.school.i && j === NG.school.j) || (i === NG.plaza.i && j === NG.plaza.j)) continue;
    const x0 = X[i] + front, x1 = X[i + 1] - front, z0 = Z[j] + front, z1 = Z[j + 1] - front;
    // [start, end, fixed coordinate, axis, facing (fx, fz)]
    const sides = [[x0, x1, z0, 'x', 0, -1], [x0, x1, z1, 'x', 0, 1], [z0, z1, x0, 'z', -1, 0], [z0, z1, x1, 'z', 1, 0]];
    for (const [a, b, at, ax, fx, fz] of sides) {
      const len = b - a, n = Math.floor((len - 40) / 19);
      for (let k = 0; k <= n; k++) {
        const t = a + 20 + k * ((len - 40) / Math.max(1, n)); // 20 m clear of the corners
        const vi = rng.int(0, VARIANTS.length - 1), v = VARIANTS[vi];
        const inset = 4 + v.d / 2; // front yard + half depth from the building line
        const x = ax === 'x' ? t : at - fx * inset, z = ax === 'x' ? at - fz * inset : t;
        lots.push({ x, z, h: y + 0.06, rot: Math.atan2(fx, fz), variant: vi, wallColor: rng.int(0, 7), roofColor: rng.int(0, 6), flip: false });
      }
    }
  }
  const houses = buildHouses(lots);
  houses.group.name = 'northgate-houses';
  const hg = new THREE.Group(); hg.add(houses.group); parent.add(hg);
  out.chunks.push({ group: hg, x: (X[0] + X[X.length - 1]) / 2, z: (Z[0] + Z[Z.length - 1]) / 2, r: 200 });
  out.colliders.push(...houses.colliders);
  out.lots = lots;

  // ---- Northgate State School + oval (staff only) ------------------------------------------------
  {
    const { i, j } = NG.school, ch = chunk('ng-school');
    const x0 = X[i] + front, x1 = X[i + 1] - front, z0 = Z[j] + front, z1 = Z[j + 1] - front, cx = (x0 + x1) / 2;
    const F = frame(cx, z1, 0, 1, y);                  // front on School Rd (south side)
    tower(ch, F, { w: 54, d: 14, floors: 2, floorH: 3.6, wall: '#d8c2a2', glass: '#4d6577' });
    tower(ch, frame(x0 + 7, z1 - 14, -1, 0, y), { w: 22, d: 12, floors: 1, floorH: 4.2, wall: '#cfb48e', glass: '#4d6577', lobby: false }); // hall wing
    ch.box(F, 14, 0.3, 4, 0, 3.4, 2, '#2f6b5a');       // entry canopy
    for (const s of [-1, 1]) ch.block(F, 0.3, 3.4, 0.3, s * 6.6, 0, 3.8, '#e8e4d8');
    atlas.sign(F, atlas.row('NORTHGATE STATE SCHOOL', '#2f6b5a', '#f4f1e8'), 18, 1.0, 0, 6.2, 0.15);
    // Fence along the street (gap at the gate).
    for (let x = x0; x < x1; x += 3) { if (Math.abs(x + 1.5 - cx) < 4) continue; ch.box(F0(ch), 3, 1.4, 0.06, x + 1.5, 0, z1 + 0.8, '#3a4a3e'); ch.collide(F0(ch), 3, 1.4, 0.1, x + 1.5, 0, z1 + 0.8); }
    // Oval: grass field + red running track + goalposts.
    const oz = (z0 + z1) / 2 - 14, ox = cx;
    const track = new THREE.RingGeometry(1, 1.12, 40, 1).rotateX(-Math.PI / 2);
    track.scale(30, 1, 20); track.translate(ox, y + 0.08, oz);
    ch.solid.push(paint(track, '#b9553e', 0.04));
    const field = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2); field.scale(29.8, 1, 19.8); field.translate(ox, y + 0.07, oz);
    ch.solid.push(paint(field, '#6f9a4a', 0.05));
    for (const s of [-1, 1]) {
      const gx = ox + s * 24;
      ch.box(F0(ch), 0.12, 3.0, 0.12, gx, 0, oz - 2.6, '#f4f1e8'); ch.box(F0(ch), 0.12, 3.0, 0.12, gx, 0, oz + 2.6, '#f4f1e8');
      ch.box(F0(ch), 0.12, 0.12, 5.3, gx, 2.4, oz, '#f4f1e8');
    }
    const t1 = F.toW(-4, 2.5), t2 = F.toW(5, 3.2), gk = { x: ox - 10, z: oz + 8 };
    out.npcSpots.push({ role: 'teacher', x: t1.x, y, z: t1.z, yaw: 0.4, action: 'phone' }, { role: 'teacher', x: t2.x, y, z: t2.z, yaw: -0.5, action: 'look' }, { role: 'worker', x: gk.x, y, z: gk.z, yaw: 1.2, action: 'look' });
    out.places.push({ kind: 'school', x: cx, z: oz, label: 'Northgate State School' });
    out.landmarks.push({ name: 'Northgate State School', x: cx, z: oz });
  }

  // ---- Northgate Plaza shopping centre + car park --------------------------------------------
  {
    const { i, j } = NG.plaza, ch = chunk('ng-plaza');
    const x0 = X[i] + front, x1 = X[i + 1] - front, z0 = Z[j] + front, z1 = Z[j + 1] - front, cx = (x0 + x1) / 2;
    const F = frame(cx, z1, 0, 1, y);                  // facing Plaza Rd (south)
    tower(ch, F, { w: 74, d: 30, floors: 2, floorH: 4.6, wall: '#e6dccb', glass: '#3f5a6e' });
    ch.box(F, 18, 0.35, 5, 0, 4.4, 2.5, '#c4473a');
    for (const s of [-1, 1]) ch.block(F, 0.35, 4.4, 0.35, s * 8.6, 0, 4.6, '#e8e4d8');
    atlas.sign(F, atlas.row('NORTHGATE PLAZA', '#c4473a', '#ffffff'), 22, 1.6, 0, 7.4, 0.2);
    atlas.sign(F, atlas.row('FOOD COURT  CINEMA  SUPERMARKET', '#26282c', '#e2c25a'), 26, 0.9, 0, 5.4, 0.2);
    // Car park behind (north), entered from School Rd: 2 rows of stealable cars.
    const lot = frame(cx, z0, 0, -1, y);
    ch.box(lot, x1 - x0, 0.05, 40, 0, 0.04, -20, '#5c5d60');
    const types = ['sedan', 'hatch', 'suv', 'ute'], paints = ['#8a4f3a', '#46566b', '#d8d2c4', '#2f4f6b', '#9aa37a', '#5c5f66', '#b98a4a', '#7c2f2f'];
    let n = 0;
    for (const lz of [-9, -27]) {
      for (let lx = -(x1 - x0) / 2 + 5; lx <= (x1 - x0) / 2 - 5; lx += 3.2) {
        ch.box(lot, 0.12, 0.02, 5.2, lx - 1.6, 0.09, lz, '#e8e4d8');
        if (rng.next() < 0.45) { const p = lot.toW(lx, lz); staticCar(ch, p.x, p.z, lz < -15 ? Math.PI : 0, types[n % 4], paints[(n * 3) % paints.length]); n++; }
      }
    }
    out.carparkCars = n;
    const sh = F.toW(-12, 4.5), sh2 = F.toW(14, 5.5);
    out.npcSpots.push({ role: 'shopper', x: sh.x, y, z: sh.z, yaw: 0.3, action: 'phone' }, { role: 'shopper', x: sh2.x, y, z: sh2.z, yaw: -0.6, action: 'look' });
    out.places.push({ kind: 'shop', x: cx, z: z1 - 15, label: 'Northgate Plaza' });
    out.landmarks.push({ name: 'Northgate Plaza', x: cx, z: z1 - 15 });
  }

  // ---- Water tower landmark (north-west corner) --------------------------------------------------
  {
    const ch = chunk('ng-tower'), wx = X[0] - 22, wz = Z[0] + 30;
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) ch.solid.push(cylinder(0.25, 0.3, 18, 6, wx + dx, y, wz + dz, '#9aa0a6'));
    ch.solid.push(cylinder(5.5, 5.5, 6, 16, wx, y + 18, wz, '#cfd3d6'));
    ch.solid.push(paint(new THREE.ConeGeometry(5.8, 2.2, 16).translate(wx, y + 25.1, wz), '#8d969c', 0.03));
    ch.colliders.push({ x: wx, y: y + 9, z: wz, hx: 3.4, hy: 9, hz: 3.4, rot: 0 });
    atlas.sign(frame(wx, wz + 5.6, 0, 1, y), atlas.row('NORTHGATE', '#cfd3d6', '#2f4f6b'), 8, 1.4, 0, 21, 0);
    out.landmarks.push({ name: 'Water tower', x: wx, z: wz });
    out.places.push({ kind: 'landmark', x: wx, z: wz, label: 'Water Tower' });
  }

  for (const ch of chunks.values()) {
    const c = ch.finish(parent);
    out.chunks.push(c);
    out.colliders.push(...ch.colliders);
    if (ch.props.length) out.propChunks.push(ch);
  }
  void PALETTE;
  return out;
}

/** World-aligned frame at town height for absolute-coordinate boxes. */
const _F0 = frame(0, 0, 0, 1, T.h);
function F0() { return _F0; }
