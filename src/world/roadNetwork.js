// Road network data + sampling. Grand Terrace is one centripetal Catmull-Rom spline
// through 10 control points (= 9 smooth segments). Each cul-de-sac is defined in the
// local frame of its junction (along/across Grand Terrace) so it always leaves at a
// right angle, then ends in a circular turning pad.
import * as THREE from 'three';
import { naturalHeight } from './terrain.js';

// Cross-section, measured outward from the centreline (metres).
export const ROAD = {
  halfW: 3.6,     // asphalt half width (7.2 m narrow suburban street)
  curbW: 0.3,     // white kerb
  curbH: 0.16,
  vergeW: 1.4,    // grass verge between kerb and footpath
  pathW: 1.5,     // concrete footpath
  boundary: 7.3,  // front property line
  padR: 11,       // cul-de-sac turning circle radius (asphalt)
  step: 1.25,     // sample spacing along roads
  maxGrade: 0.075,
};
ROAD.curbOut = ROAD.halfW + ROAD.curbW;
ROAD.pathIn = ROAD.curbOut + ROAD.vergeW;
ROAD.pathOut = ROAD.pathIn + ROAD.pathW;

const GRAND_TERRACE = [
  [-232, 118], [-176, 72], [-118, 88], [-60, 46], [-4, 18],
  [52, 34], [104, -6], [138, -62], [186, -96], [238, -84],
];

const CULS = [
  { name: 'Hillcrest Ct', sign: 'HILLCREST CT', u: 0.27, side: -1, pts: [[0, 0], [0, 30], [-12, 62], [-6, 92]] },
  { name: 'Banksia Cl', sign: 'BANKSIA CL', u: 0.53, side: 1, pts: [[0, 0], [0, 28], [14, 58], [8, 88]] },
  { name: 'Wattle Rise', sign: 'WATTLE RISE', u: 0.79, side: -1, pts: [[0, 0], [0, 26], [18, 52], [34, 78]] },
];

function boxBlur(arr, radius) {
  const n = arr.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) { s += arr[j]; c++; }
    out[i] = s / c;
  }
  return out;
}

export function sampleCurve(curve) {
  const len = curve.getLength();
  const count = Math.max(2, Math.ceil(len / ROAD.step));
  const pts = curve.getSpacedPoints(count);
  const samples = pts.map((p, i) => {
    const t = curve.getTangentAt(i / count);
    const tl = Math.hypot(t.x, t.z) || 1;
    const tx = t.x / tl, tz = t.z / tl;
    // Normal in the XZ plane. NOTE: (-tz, tx) points to the RIGHT of travel (three.js is
    // right-handed with Y up); 'side +1' lots/footpaths are on the right of +t.
    return { x: p.x, z: p.z, h: 0, tx, tz, nx: -tz, nz: tx, s: (i / count) * len };
  });
  return { samples, length: len };
}

/** Smooth the natural ground along the road into a drivable vertical profile. */
function buildProfile(samples, { startH = null, endFlat = 0 } = {}) {
  let h = Float32Array.from(samples, (s) => naturalHeight(s.x, s.z));
  const r = Math.round(32 / ROAD.step);
  h = boxBlur(boxBlur(h, r), r);
  if (startH !== null) {
    const hold = 9 / ROAD.step, ease = 34 / ROAD.step;
    for (let i = 0; i < h.length; i++) {
      const t = Math.min(1, Math.max(0, (i - hold) / ease));
      const w = 1 - t * t * (3 - 2 * t);
      h[i] = h[i] * (1 - w) + startH * w;
    }
  }
  // Grade limit (forward then backward) keeps hills walkable and drivable later.
  const dmax = ROAD.maxGrade * ROAD.step;
  for (let i = 1; i < h.length; i++) h[i] = Math.min(h[i - 1] + dmax, Math.max(h[i - 1] - dmax, h[i]));
  if (startH === null) for (let i = h.length - 2; i >= 0; i--) h[i] = Math.min(h[i + 1] + dmax, Math.max(h[i + 1] - dmax, h[i]));
  if (endFlat > 0) {
    const n = h.length, endH = h[n - 1];
    const flat = endFlat / ROAD.step, ease = 18 / ROAD.step;
    for (let i = 0; i < n; i++) {
      const fromEnd = n - 1 - i;
      const t = Math.min(1, Math.max(0, (fromEnd - flat) / ease));
      const w = 1 - t * t * (3 - 2 * t);
      h[i] = h[i] * (1 - w) + endH * w;
    }
  }
  samples.forEach((s, i) => (s.h = h[i]));
}

export function buildRoadNetwork() {
  const roads = [];
  const gtCurve = new THREE.CatmullRomCurve3(
    GRAND_TERRACE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal',
  );
  const gt = { name: 'Grand Terrace', sign: 'GRAND TCE', curve: gtCurve, main: true, halfW: ROAD.halfW, ...sampleCurve(gtCurve) };
  buildProfile(gt.samples);
  roads.push(gt);

  const pads = [];
  const junctions = [];
  for (const def of CULS) {
    const i = Math.round(def.u * (gt.samples.length - 1));
    const j = gt.samples[i];
    const ax = j.tx, az = j.tz; // along
    const cx = j.nx * def.side, cz = j.nz * def.side; // across, toward the cul-de-sac
    const world = def.pts.map(([along, across]) => new THREE.Vector3(j.x + ax * along + cx * across, 0, j.z + az * along + cz * across));
    const curve = new THREE.CatmullRomCurve3(world, false, 'centripetal');
    const road = { name: def.name, sign: def.sign, curve, main: false, halfW: ROAD.halfW, junction: { i, side: def.side }, ...sampleCurve(curve) };
    buildProfile(road.samples, { startH: j.h, endFlat: ROAD.padR });
    const end = road.samples[road.samples.length - 1];
    const pre = road.samples[Math.max(0, road.samples.length - 1 - Math.round(14 / ROAD.step))];
    const inLen = Math.hypot(end.x - pre.x, end.z - pre.z) || 1;
    const pad = { x: end.x, z: end.z, r: ROAD.padR, h: end.h, inX: (end.x - pre.x) / inLen, inZ: (end.z - pre.z) / inLen, road };
    road.pad = pad;
    pads.push(pad);
    junctions.push({ main: gt, mainIndex: i, branch: road, side: def.side, x: j.x, z: j.z });
    roads.push(road);
  }

  const index = new RoadIndex(roads);
  return { roads, pads, junctions, index, main: gt };
}

/** Spatial hash over road samples for fast nearest-centreline queries. */
export class RoadIndex {
  constructor(roads, cell = 12) {
    this.cell = cell;
    this.map = new Map();
    roads.forEach((road, ri) => road.samples.forEach((s, si) => {
      const key = this._key(Math.floor(s.x / cell), Math.floor(s.z / cell));
      if (!this.map.has(key)) this.map.set(key, []);
      this.map.get(key).push(ri, si);
    }));
    this.roads = roads;
  }
  _key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
  /**
   * Nearest centreline sample within maxR. filter(road, sample) may reject samples.
   * Returns { road, sample, d } or null.
   */
  nearest(x, z, maxR = 40, filter = null) {
    const c = this.cell, r = Math.ceil(maxR / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best = null, bd = maxR;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const list = this.map.get(this._key(cx + dx, cz + dz));
      if (!list) continue;
      for (let k = 0; k < list.length; k += 2) {
        const road = this.roads[list[k]], s = road.samples[list[k + 1]];
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bd && (!filter || filter(road, s))) { bd = d; best = { road, sample: s, d }; }
      }
    }
    return best;
  }
}
