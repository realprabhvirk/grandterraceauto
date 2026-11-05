// Terrace Town Centre street plan: a flat grid east of the end of Grand Terrace.
//   N-S streets at X (Ring Rd west, Market St, Station St, Ring Rd east),
//   E-W streets at Z (Ring Rd north, Terrace Pde = main shopping street, Ring Rd south).
// The outer lines form the ring road; Terrace Pde continues west as the Terrace Link back
// to Grand Terrace, so traffic can loop suburb -> town -> suburb.
import * as THREE from 'three';
import { ROAD, sampleCurve } from '../world/roadNetwork.js';
import { TOWN } from '../world/terrain.js';

export const T = {
  X: [330, 420, 520, 610, 700, 790, 880, 970], // Phase 5: x 610-970 = Downtown (districts/downtown.js)
  Z: [-215, -85, 45],
  hw: 4.5,      // asphalt half width (two 4.5 m lanes)
  kerb: 0.3,
  path: 4.5,    // paved footpath from kerb to building line
  lane: 2.2,    // lane centre offset (keep left)
  h: TOWN.h,
};
T.front = T.hw + T.kerb + T.path; // street centre -> building line

/** Northgate (Phase 5 district 3): a small street grid north of the ring road, joined by
 *  Northgate Rd (Market St's line, x 420). Its nodes/edges/roads/blocks join the town plan. */
export const NORTH = { X: [340, 420, 520, 620], Z: [-470, -380, -290], join: 1, joinMain: 1, names: { x: ['WARATAH ST', 'NORTHGATE RD', 'BANKSIA AVE', 'JACARANDA ST'], z: ['GUM TREE RD', 'SCHOOL RD', 'PLAZA RD'] } };

/** Industrial estate (Phase 5 district 4, no highway): north of downtown, joined by King St (x 790). */
export const INDUSTRY = { X: [700, 790, 880, 970], Z: [-470, -380, -290], join: 1, joinMain: 5, names: { x: ['FOUNDRY RD', 'KING ST', 'DOCK ST', 'CRANE ST'], z: ['WHARF RD', 'DEPOT RD', 'MILL RD'] } };
export const EXTRA_GRIDS = [NORTH, INDUSTRY];

const NAMES = { x: ['RING RD', 'MARKET ST', 'STATION ST', 'BRIDGE ST', 'KING ST', 'QUEEN ST', 'HARBOUR ST', 'RING RD'], z: ['RING RD', 'TERRACE PDE', 'RING RD'] };

function straight(name, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / ROAD.step);
  const tx = (bx - ax) / len, tz = (bz - az) / len;
  const samples = [];
  for (let i = 0; i <= n; i++) samples.push({ x: ax + (bx - ax) * (i / n), z: az + (bz - az) * (i / n), h: T.h, tx, tz, nx: -tz, nz: tx, s: (i / n) * len });
  return { name, sign: name, town: true, halfW: T.hw, samples, length: len };
}

/** Builds the town street network attached to the end of Grand Terrace. */
export function buildTownPlan(network) {
  const { X, Z, hw } = T;
  const roads = [];
  for (let i = 0; i < X.length; i++) roads.push(straight(NAMES.x[i], X[i], Z[0], X[i], Z[Z.length - 1]));
  for (let j = 0; j < Z.length; j++) roads.push(straight(NAMES.z[j], X[0], Z[j], X[X.length - 1], Z[j]));

  // Terrace Link: continues Grand Terrace (same tangent) and straightens onto Terrace Pde.
  const S = network.main.samples, e = S[S.length - 1];
  const zMain = Z[1], xEnd = X[0] - hw - 0.2;
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(e.x, 0, e.z), new THREE.Vector3(e.x + e.tx * 26, 0, e.z + e.tz * 26),
    new THREE.Vector3(xEnd - 34, 0, zMain), new THREE.Vector3(xEnd, 0, zMain),
  );
  const link = { name: 'Terrace Link', sign: 'TERRACE PDE', main: true, linkRoad: true, halfW: ROAD.halfW, curve, ...sampleCurve(curve) };
  const L = link.samples.length;
  link.samples.forEach((s, i) => { const t = i / (L - 1), k = t * t * (3 - 2 * t); s.h = e.h + (T.h - e.h) * k; });

  // Grid nodes / edges for the lane graph and the minimap.
  const nodes = [];
  for (let j = 0; j < Z.length; j++) for (let i = 0; i < X.length; i++) nodes.push({ id: nodes.length, i, j, x: X[i], z: Z[j], links: [] });
  const node = (i, j) => nodes[j * X.length + i];
  const edges = [];
  const connect = (a, b) => { const ed = { a, b }; edges.push(ed); a.links.push(b); b.links.push(a); };
  for (let j = 0; j < Z.length; j++) for (let i = 0; i + 1 < X.length; i++) connect(node(i, j), node(i + 1, j));
  for (let i = 0; i < X.length; i++) for (let j = 0; j + 1 < Z.length; j++) connect(node(i, j), node(i, j + 1));

  // City blocks (kerb faces).
  const blocks = [];
  for (let j = 0; j + 1 < Z.length; j++) for (let i = 0; i + 1 < X.length; i++) {
    blocks.push({ i, j, x0: X[i] + hw, x1: X[i + 1] - hw, z0: Z[j] + hw, z1: Z[j + 1] - hw });
  }
  // Extra grids north of the ring road (Northgate, Industrial), each joined by one street.
  for (const G of EXTRA_GRIDS) {
    const NX = G.X, NZ = G.Z, base = nodes.length;
    for (let j = 0; j < NZ.length; j++) for (let i = 0; i < NX.length; i++) nodes.push({ id: nodes.length, i, j, x: NX[i], z: NZ[j], links: [], north: true, grid: G });
    const nn = (i, j) => nodes[base + j * NX.length + i];
    for (let j = 0; j < NZ.length; j++) for (let i = 0; i + 1 < NX.length; i++) connect(nn(i, j), nn(i + 1, j));
    for (let i = 0; i < NX.length; i++) for (let j = 0; j + 1 < NZ.length; j++) connect(nn(i, j), nn(i, j + 1));
    connect(nn(G.join, NZ.length - 1), node(G.joinMain, 0));
    for (let i = 0; i < NX.length; i++) roads.push({ ...straight(G.names.x[i], NX[i], NZ[0], NX[i], i === G.join ? Z[0] : NZ[NZ.length - 1]), extra: true, north: true });
    for (let j = 0; j < NZ.length; j++) roads.push({ ...straight(G.names.z[j], NX[0], NZ[j], NX[NX.length - 1], NZ[j]), extra: true, north: true });
    for (let j = 0; j + 1 < NZ.length; j++) for (let i = 0; i + 1 < NX.length; i++) {
      blocks.push({ i, j, north: true, grid: G, x0: NX[i] + hw, x1: NX[i + 1] - hw, z0: NZ[j] + hw, z1: NZ[j + 1] - hw });
    }
  }
  return { roads, link, nodes, node, edges, blocks, entry: node(0, 1), bounds: { x0: TOWN.x0, x1: TOWN.x1, z0: TOWN.z0, z1: TOWN.z1 } };
}
