// Terrace Town Centre street plan: a flat grid east of the end of Grand Terrace.
//   N-S streets at X (Ring Rd west, Market St, Station St, Ring Rd east),
//   E-W streets at Z (Ring Rd north, Terrace Pde = main shopping street, Ring Rd south).
// The outer lines form the ring road; Terrace Pde continues west as the Terrace Link back
// to Grand Terrace, so traffic can loop suburb -> town -> suburb.
import * as THREE from 'three';
import { ROAD, sampleCurve } from '../world/roadNetwork.js';
import { TOWN } from '../world/terrain.js';

export const T = {
  X: [330, 420, 520, 610],
  Z: [-215, -85, 45],
  hw: 4.5,      // asphalt half width (two 4.5 m lanes)
  kerb: 0.3,
  path: 4.5,    // paved footpath from kerb to building line
  lane: 2.2,    // lane centre offset (keep left)
  h: TOWN.h,
};
T.front = T.hw + T.kerb + T.path; // street centre -> building line

const NAMES = { x: ['RING RD', 'MARKET ST', 'STATION ST', 'RING RD'], z: ['RING RD', 'TERRACE PDE', 'RING RD'] };

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
  return { roads, link, nodes, node, edges, blocks, entry: node(0, 1), bounds: { x0: TOWN.x0, x1: TOWN.x1, z0: TOWN.z0, z1: TOWN.z1 } };
}
