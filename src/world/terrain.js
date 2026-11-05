// Terrain: gentle hills from seeded noise, then flattened under roads (exactly road
// height across the whole road corridor) and under house lots. The same height grid
// drives the render mesh, getHeight() (triangle-exact) and the Rapier heightfield.
import * as THREE from 'three';
import { fbm } from '../utils/noise.js';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';

// Rectangular grid: the suburb (+-300) plus Terrace Town Centre to the east.
export const MAP = { x0: -300, z0: -560, cell: 2.5, nx: 544, nz: 344 }; // Phase 5: x to 1060 (downtown), z from -560 (Northgate)
MAP.x1 = MAP.x0 + MAP.nx * MAP.cell; MAP.z1 = MAP.z0 + MAP.nz * MAP.cell;
MAP.cx = (MAP.x0 + MAP.x1) / 2; MAP.cz = (MAP.z0 + MAP.z1) / 2;

// Terrace Town Centre: a flat graded district east of the end of Grand Terrace.
export const TOWN = { h: -4.4, x0: 300, x1: 1000, z0: -245, z1: 75, margin: 34 };
export const NORTHGATE = { x0: 305, x1: 1000, z0: -505, z1: -240 }; // Northgate + Industrial, graded flat at TOWN.h
const LINK = { x0: 200, x1: 320, z0: -125, z1: -45 }; // valley between the suburb and town
/** Terrace Beach (south of downtown): promenade at town level, a 1.2 m sea wall, sand at 1:20
 *  down to the water (WATER_Y) and on under it. Blends into the hills over 30 m at x0 / x1. */
export const BEACH = { x0: 625, x1: 1000, prom: 66, wall: 68.5, slope: 1 / 20, floor: -11.5, blend: 30 };
export const WATER_Y = -8.0;
export function beachHeight(z) {
  if (z <= BEACH.prom) return TOWN.h;
  if (z <= BEACH.wall) return TOWN.h - 1.2 * smoothstep(BEACH.prom, BEACH.wall, z);
  return Math.max(BEACH.floor, TOWN.h - 1.2 - (z - BEACH.wall) * BEACH.slope);
}

// Corridor flat half-width measured from a road centreline (asphalt + curb + verge +
// footpath + a little). Beyond it the terrain eases back to natural over BLEND metres.
export const CORRIDOR = { flat: 8.2, blend: 18 };

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Natural (pre-flattening) ground height. */
export function naturalHeight(x, z) {
  let h = 13 * fbm(x / 240 + 3.1, z / 240 - 1.7, 4, 3);
  h += 2.2 * fbm(x / 60, z / 60, 3, 11);
  h += 0.018 * (z - x); // slight fall toward the north-west: views over the valley
  // Rise at the edge of the playable area (suburb, link valley, town) so the world reads
  // as a valley, not a cliff. Inside the suburb this is exactly the original +-220 rule.
  const out = (b, m) => Math.max(b.x0 - m - x, x - b.x1 - m, b.z0 - m - z, z - b.z1 - m);
  const d = Math.min(Math.max(Math.abs(x), Math.abs(z)) - 220, out(LINK, 0), out(TOWN, 20), out({ x0: BEACH.x0 - 10, x1: BEACH.x1 + 10, z0: 40, z1: 400 }, 0), out(NORTHGATE, 20));
  if (d > 0) h += (d / 80) ** 2 * 28;
  // The town itself is graded flat.
  const dx = Math.max(TOWN.x0 - x, 0, x - TOWN.x1), dz = Math.max(TOWN.z0 - z, 0, z - TOWN.z1);
  const w = 1 - smoothstep(0, TOWN.margin, Math.hypot(dx, dz));
  if (w > 0) h = h * (1 - w) + TOWN.h * w;
  {
    const nx = Math.max(NORTHGATE.x0 - x, 0, x - NORTHGATE.x1), nz = Math.max(NORTHGATE.z0 - z, 0, z - NORTHGATE.z1);
    const wn = 1 - smoothstep(0, TOWN.margin, Math.hypot(nx, nz));
    if (wn > 0) h = h * (1 - wn) + TOWN.h * wn;
  }
  // The beach wins south of the ring road.
  if (z > 50) {
    const ox = Math.max(BEACH.x0 - x, 0, x - BEACH.x1);
    const wb = 1 - smoothstep(0, BEACH.blend, ox);
    if (wb > 0) h = h * (1 - wb) + beachHeight(z) * wb;
  }
  return h;
}

export class Terrain {
  /**
   * @param {object} opts
   * @param {Array} opts.roads   [{ samples:[{x,z,h}], halfW }]
   * @param {Array} opts.pads    [{ x, z, r, h }]  circular flat areas (cul-de-sac ends)
   * @param {Array} opts.lots    [{ x, z, rot, hw, hd, h, fall }] oriented flat house pads
   */
  constructor({ roads = [], pads = [], lots = [] } = {}) {
    const { nx, nz, cell, x0, z0 } = MAP;
    const vn = nx + 1, vz = nz + 1, N = vn * vz;
    this.vn = vn; this.vz = vz;
    const H = (this.heights = new Float32Array(N));
    const roadDist = (this.roadDist = new Float32Array(N).fill(1e9));
    const roadH = new Float32Array(N);
    const lotMask = (this.lotMask = new Float32Array(N));

    for (let iz = 0; iz < vz; iz++) {
      for (let ix = 0; ix < vn; ix++) {
        H[iz * vn + ix] = naturalHeight(x0 + ix * cell, z0 + iz * cell);
      }
    }

    // --- Stamp road centreline distance + height into the grid -------------------
    const R = CORRIDOR.flat + CORRIDOR.blend;
    const stamp = (px, pz, ph, offset, radius) => {
      const r = radius + R;
      const ix0 = Math.max(0, Math.floor((px - r - x0) / cell));
      const ix1 = Math.min(nx, Math.ceil((px + r - x0) / cell));
      const iz0 = Math.max(0, Math.floor((pz - r - z0) / cell));
      const iz1 = Math.min(nz, Math.ceil((pz + r - z0) / cell));
      for (let iz = iz0; iz <= iz1; iz++) {
        const z = z0 + iz * cell;
        for (let ix = ix0; ix <= ix1; ix++) {
          const x = x0 + ix * cell;
          const d = Math.hypot(x - px, z - pz) - offset;
          const k = iz * vn + ix;
          if (d < roadDist[k]) {
            roadDist[k] = d;
            roadH[k] = ph;
          }
        }
      }
    };
    for (const road of roads) for (const s of road.samples) stamp(s.x, s.z, s.h, 0, 0);
    // Pads: treat as a road whose "centreline" is a disc of radius r - halfW.
    for (const p of pads) stamp(p.x, p.z, p.h, Math.max(0, p.r - 3.6), p.r);

    // --- Roads: exact road height inside the corridor, eased outside ---------------
    for (let k = 0; k < N; k++) {
      const d = roadDist[k];
      if (d > R) continue;
      const w = 1 - smoothstep(CORRIDOR.flat, R, d);
      H[k] = H[k] * (1 - w) + roadH[k] * w;
    }

    // --- Lot pads win over the road blend (house footprints stay perfectly flat),
    //     but never inside the road corridor itself. -------------------------------
    for (const lot of lots) {
      const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
      const fall = lot.fall ?? 6;
      const ext = Math.hypot(lot.hw, lot.hd) + fall;
      const ix0 = Math.max(0, Math.floor((lot.x - ext - x0) / cell));
      const ix1 = Math.min(nx, Math.ceil((lot.x + ext - x0) / cell));
      const iz0 = Math.max(0, Math.floor((lot.z - ext - z0) / cell));
      const iz1 = Math.min(nz, Math.ceil((lot.z + ext - z0) / cell));
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const dx = x0 + ix * cell - lot.x, dz = z0 + iz * cell - lot.z;
          // Into lot-local space (lot faces +Z local).
          const lx = dx * c - dz * s, lz = dx * s + dz * c;
          const ox = Math.max(0, Math.abs(lx) - lot.hw);
          const oz = Math.max(0, Math.abs(lz) - lot.hd);
          const k = iz * vn + ix;
          const core = smoothstep(CORRIDOR.flat, CORRIDOR.flat + 1.5, roadDist[k]);
          const w = (1 - smoothstep(0, fall, Math.hypot(ox, oz))) * core;
          if (w > lotMask[k]) {
            lotMask[k] = w;
            H[k] = H[k] * (1 - w) + lot.h * w; // lots never overlap meaningfully
          }
        }
      }
    }

    this.mesh = this._buildMesh();
  }

  /** Height for a vehicle near y: the bridge deck if (x, z) is on one and we're up there, else the ground. */
  driveHeight(x, z, nearY = -1e9) {
    const g = this.getHeight(x, z);
    for (const b of this.bridges || []) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && nearY > b.y - 2.5) return b.y;
    return g;
  }

  /** Height exactly matching the rendered triangles. */
  getHeight(x, z) {
    const { nx, nz, cell, x0, z0 } = MAP;
    const vn = this.vn;
    let fx = (x - x0) / cell, fz = (z - z0) / cell;
    fx = Math.min(nx - 1e-4, Math.max(0, fx));
    fz = Math.min(nz - 1e-4, Math.max(0, fz));
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const H = this.heights;
    const a = H[iz * vn + ix], b = H[iz * vn + ix + 1];
    const c = H[(iz + 1) * vn + ix + 1], d = H[(iz + 1) * vn + ix];
    // Same split as Rapier's heightfield (anti-diagonal b-d), verified by ray-cast probe.
    return tx + tz <= 1 ? a + (b - a) * tx + (d - a) * tz : c + (d - c) * (1 - tx) + (b - c) * (1 - tz);
  }

  /** Heights in Rapier's layout: index = ix * (nz + 1) + iz. */
  rapierHeights() {
    const vn = this.vn, vz = this.vz;
    const out = new Float32Array(vn * vz);
    for (let ix = 0; ix < vn; ix++) for (let iz = 0; iz < vz; iz++) out[ix * vz + iz] = this.heights[iz * vn + ix];
    return out;
  }

  _buildMesh() {
    const { nx, nz, cell, x0, z0 } = MAP;
    const vn = this.vn;
    const H = this.heights;
    const pos = new Float32Array(nx * nz * 18);
    const col = new Float32Array(nx * nz * 18);
    const P = PALETTE.ground;
    const cGrass = new THREE.Color(P.grass), cDry = new THREE.Color(P.grassDry);
    const cDark = new THREE.Color(P.grassDark), cLawn = new THREE.Color(P.lawn);
    const cVerge = new THREE.Color(P.verge), cBank = new THREE.Color(P.bank);
    const cSand = new THREE.Color('#e6d3a3'), cWet = new THREE.Color('#bfa877'), cSeabed = new THREE.Color('#7f9a8c');
    const tmp = new THREE.Color();
    let p = 0;
    const put = (ix, iz) => {
      pos[p++] = x0 + ix * cell;
      pos[p++] = H[iz * vn + ix];
      pos[p++] = z0 + iz * cell;
    };
    let c = 0;
    const colour = (i0, i1, i2, x, z, slope) => {
      const dryness = fbm(x / 90 + 7, z / 90, 3, 5) * 0.5 + 0.5;
      const dark = fbm(x / 25, z / 25 + 4, 2, 8) * 0.5 + 0.5;
      tmp.copy(cGrass).lerp(cDry, smoothstep(0.45, 0.85, dryness)).lerp(cDark, smoothstep(0.6, 0.9, dark) * 0.6);
      const lot = (this.lotMask[i0] + this.lotMask[i1] + this.lotMask[i2]) / 3;
      tmp.lerp(cLawn, smoothstep(0.3, 0.9, lot));
      const rd = Math.min(this.roadDist[i0], this.roadDist[i1], this.roadDist[i2]);
      if (rd < CORRIDOR.flat + 0.5) tmp.lerp(cVerge, 0.85);
      tmp.lerp(cBank, smoothstep(0.22, 0.5, slope) * 0.8);
      // Terrace Beach: dry sand -> wet sand at the waterline -> sea bed under the water.
      if (z > BEACH.prom + 1.5 && x > BEACH.x0 - BEACH.blend && x < BEACH.x1 + BEACH.blend) {
        const hh = (H[i0] + H[i1] + H[i2]) / 3;
        const edge = 1 - smoothstep(0, BEACH.blend, Math.max(BEACH.x0 - x, 0, x - BEACH.x1));
        tmp.lerp(cSand, edge);
        if (hh < WATER_Y + 0.6) tmp.lerp(cWet, smoothstep(WATER_Y + 0.6, WATER_Y - 0.2, hh) * edge);
        if (hh < WATER_Y - 0.5) tmp.lerp(cSeabed, smoothstep(WATER_Y - 0.5, WATER_Y - 2.5, hh) * edge);
      }
      // Per-face jitter for the hand-painted look.
      const j = 1 + (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1) * 0.05;
      for (let v = 0; v < 3; v++) {
        col[c++] = tmp.r * j;
        col[c++] = tmp.g * j;
        col[c++] = tmp.b * j;
      }
    };
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const a = iz * vn + ix, b = a + 1, cc = a + vn + 1, d = a + vn;
        const x = x0 + (ix + 0.5) * cell, z = z0 + (iz + 0.5) * cell;
        const slope1 = Math.max(Math.abs(H[b] - H[a]), Math.abs(H[d] - H[a])) / cell;
        const slope2 = Math.max(Math.abs(H[cc] - H[b]), Math.abs(H[cc] - H[d])) / cell;
        // Split along the b-d anti-diagonal to match Rapier's heightfield exactly.
        // Triangles (a, d, b) then (b, d, c): counter-clockwise from above.
        put(ix, iz); put(ix, iz + 1); put(ix + 1, iz);
        colour(a, d, b, x - 0.4, z - 0.4, slope1);
        put(ix + 1, iz); put(ix, iz + 1); put(ix + 1, iz + 1);
        colour(b, d, cc, x + 0.4, z + 0.4, slope2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, MAT.solid);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}
