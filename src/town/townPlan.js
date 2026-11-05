// Terrace Town Centre street plan: a flat grid east of the end of Grand Terrace.
//   N-S streets at X (Ring Rd west, Market St, Station St, Ring Rd east),
//   E-W streets at Z (Ring Rd north, Terrace Pde = main shopping street, Ring Rd south).
// The outer lines form the ring road; Terrace Pde continues west as the Terrace Link back
// to Grand Terrace, so traffic can loop suburb -> town -> suburb.
import * as THREE from 'three';
import { ROAD, sampleCurve } from '../world/roadNetwork.js';
import { TOWN } from '../world/terrain.js';
import { HWY, highwayY } from '../city/highwayPlan.js';
import { AP } from '../airport/airportPlan.js';

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
export const NORTH = { X: [330, 420, 520, 620], Z: [-470, -380, -290], join: 1, joinMain: 1, names: { x: ['Waratah St', 'Northgate Rd', 'Banksia Ave', 'Jacaranda St'], z: ['Gum Tree Rd', 'School Rd', 'Plaza Rd'] } };

/** Industrial estate (Phase 5 district 4, no highway): north of downtown, joined by King St (x 790). */
export const INDUSTRY = { X: [700, 790, 880, 970], Z: [-470, -380, -290], join: 1, joinMain: 5, names: { x: ['Foundry Rd', 'King St North', 'Dock St', 'Crane St'], z: ['Wharf Rd', 'Depot Rd', 'Mill Rd'] } };
export const EXTRA_GRIDS = [NORTH, INDUSTRY];

// Unique street names (single source of truth: road.street; map, signs, HUD chip and routes use it).
const NAMES = { x: ['Ring Rd West', 'Market St', 'Station St', 'Bridge St', 'King St', 'Queen St', 'Harbour St', 'Ring Rd East'], z: ['Ring Rd North', 'Terrace Pde', 'The Esplanade'] };

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
  for (let i = 0; i < X.length; i++) roads.push({ ...straight(NAMES.x[i], X[i], Z[0], X[i], Z[Z.length - 1]), arterial: i === 0 || i === X.length - 1 });
  for (let j = 0; j < Z.length; j++) roads.push({ ...straight(NAMES.z[j], X[0], Z[j], X[X.length - 1], Z[j]), arterial: true }); // ring + Terrace Pde

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
  // (Highway nodes / roads are added after the extra grids, below.)
  // Extra grids north of the ring road (Northgate, Industrial), each joined by one street.
  for (const G of EXTRA_GRIDS) {
    const NX = G.X, NZ = G.Z, base = nodes.length;
    for (let j = 0; j < NZ.length; j++) for (let i = 0; i < NX.length; i++) nodes.push({ id: nodes.length, i, j, x: NX[i], z: NZ[j], links: [], north: true, grid: G });
    const nn = (i, j) => nodes[base + j * NX.length + i];
    for (let j = 0; j < NZ.length; j++) for (let i = 0; i + 1 < NX.length; i++) connect(nn(i, j), nn(i + 1, j));
    for (let i = 0; i < NX.length; i++) for (let j = 0; j + 1 < NZ.length; j++) connect(nn(i, j), nn(i, j + 1));
    connect(nn(G.join, NZ.length - 1), node(G.joinMain, 0));
    for (let i = 0; i < NX.length; i++) roads.push({ ...straight(G.names.x[i], NX[i], NZ[0], NX[i], i === G.join ? Z[0] : NZ[NZ.length - 1]), extra: true, north: true, arterial: i === G.join });
    for (let j = 0; j < NZ.length; j++) roads.push({ ...straight(G.names.z[j], NX[0], NZ[j], NX[NX.length - 1], NZ[j]), extra: true, north: true });
    for (let j = 0; j + 1 < NZ.length; j++) for (let i = 0; i + 1 < NX.length; i++) {
      blocks.push({ i, j, north: true, grid: G, x0: NX[i] + hw, x1: NX[i + 1] - hw, z0: NZ[j] + hw, z1: NZ[j + 1] - hw });
    }
  }
  // Terrace Motorway between the ring road and the northern grids, with a ramp road at each end
  // (ring corner <-> motorway junction <-> Northgate / industrial). See city/highwayPlan.js.
  const gridNode = (G, i, j) => nodes.find((n) => n.grid === G && n.i === i && n.j === j);
  const HWn = { id: nodes.length, i: -1, j: -1, x: HWY.x0, z: HWY.z, links: [], north: true, highway: true }; nodes.push(HWn);
  const HEn = { id: nodes.length, i: -1, j: -1, x: HWY.x1, z: HWY.z, links: [], north: true, highway: true }; nodes.push(HEn);
  connect(node(0, 0), HWn); connect(HWn, gridNode(NORTH, 0, NORTH.Z.length - 1));
  connect(node(X.length - 1, 0), HEn); connect(HEn, gridNode(INDUSTRY, INDUSTRY.X.length - 1, INDUSTRY.Z.length - 1));
  connect(HWn, HEn);
  const mway = { ...straight('Terrace Motorway', HWY.x0, HWY.z, HWY.x1, HWY.z), extra: true, north: true, highway: true, halfW: HWY.halfW };
  for (const s of mway.samples) s.h = highwayY(s.x);
  roads.push(mway);
  roads.push({ ...straight('Motorway West Ramp', HWY.x0, NORTH.Z[NORTH.Z.length - 1], HWY.x0, Z[0]), extra: true, north: true, highway: true, ramp: true });
  roads.push({ ...straight('Motorway East Ramp', HWY.x1, INDUSTRY.Z[INDUSTRY.Z.length - 1], HWY.x1, Z[0]), extra: true, north: true, highway: true, ramp: true });
  // Terrace Airport access (Phase 6.1): Airport Rd north from Waratah St's top corner, Terminal Dr
  // past the terminal, Airport Link back down to Jacaranda St (a loop, both ends on Northgate).
  const A1 = { id: nodes.length, i: -2, j: -2, x: AP.roadX0, z: AP.roadZ, links: [], north: true, airport: true }; nodes.push(A1);
  const A2 = { id: nodes.length, i: -2, j: -2, x: AP.roadX1, z: AP.roadZ, links: [], north: true, airport: true }; nodes.push(A2);
  connect(gridNode(NORTH, 0, 0), A1); connect(A1, A2); connect(A2, gridNode(NORTH, NORTH.X.length - 1, 0));
  roads.push({ ...straight('Airport Rd', AP.roadX0, NORTH.Z[0], AP.roadX0, AP.roadZ), extra: true, north: true, airport: true });
  roads.push({ ...straight('Terminal Dr', AP.roadX0, AP.roadZ, AP.roadX1, AP.roadZ), extra: true, north: true, airport: true });
  roads.push({ ...straight('Airport Link', AP.roadX1, AP.roadZ, AP.roadX1, NORTH.Z[0]), extra: true, north: true, airport: true });
  return { roads, link, nodes, node, edges, blocks, entry: node(0, 1), bounds: { x0: TOWN.x0, x1: TOWN.x1, z0: TOWN.z0, z1: TOWN.z1 } };
}
