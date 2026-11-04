// Lane graph for ambient traffic (left-hand traffic - Queensland).
// Lanes are polylines of lane-centre points with cumulative distance `s`:
//   - Grand Terrace forward and backward lanes (1.8 m left of the centreline),
//   - one lane per cul-de-sac: inbound, clockwise around the turning circle, outbound,
//   - curved connectors at each junction (turn in / turn out) and U-turns at the dead ends.
// Each lane has `exits` (taken at its end) and `branches` (optional turn-offs part way).
import { ROAD } from '../world/roadNetwork.js';
import { buildTownLanes } from '../town/townLanes.js';

const LANE = 1.8, STEP = 1.5;

function finish(lane) {
  let s = 0;
  lane.pts.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p.x - lane.pts[i - 1].x, p.z - lane.pts[i - 1].z);
    p.s = s;
  });
  lane.len = s;
  return lane;
}

function bezier(p0, p1, p2) {
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z);
  const n = Math.max(4, Math.ceil(len / STEP));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t;
    pts.push({ x: a * p0.x + b * p1.x + c * p2.x, z: a * p0.z + b * p1.z + c * p2.z });
  }
  return pts;
}

export function buildLaneGraph(network) {
  const lanes = [];
  const add = (lane) => { lane.id = lanes.length; lane.exits = lane.exits || []; lane.branches = lane.branches || []; lanes.push(finish(lane)); return lane; };
  const gt = network.main, S = gt.samples;
  // Road sample normals (nx, nz) point to the RIGHT of travel, so the left-hand lane for
  // travel along +t is at -n (Queensland: keep left).
  const lanePt = (s, dir) => ({ x: s.x - s.nx * LANE * dir, z: s.z - s.nz * LANE * dir });
  const idxAt = (road, s) => Math.max(0, Math.min(road.samples.length - 1, Math.round(s / ROAD.step)));

  // Grand Terrace both ways.
  const fwdPts = [], bwdPts = [];
  for (let i = 3; i < S.length - 3; i += 1) fwdPts.push(lanePt(S[i], 1));
  for (let i = S.length - 4; i >= 3; i -= 1) bwdPts.push(lanePt(S[i], -1));
  const fwd = add({ name: 'GT forward', pts: fwdPts, road: gt, dir: 1 });
  const bwd = add({ name: 'GT backward', pts: bwdPts, road: gt, dir: -1 });
  // Map a Grand Terrace arc length to an s on each lane.
  const sOnFwd = (sRoad) => Math.max(0, sRoad - S[3].s);
  const sOnBwd = (sRoad) => Math.max(0, S[S.length - 4].s - sRoad);

  // U-turns at the dead ends.
  const uturn = (from, to, centre) => {
    const a = from.pts[from.pts.length - 1], b = to.pts[0];
    const p1 = { x: centre.x + (centre.tx || 0) * 4, z: centre.z + (centre.tz || 0) * 4 };
    return add({ name: 'U-turn', pts: bezier(a, p1, b), exits: [{ lane: to.id, s: 0, prob: 1 }], slow: true });
  };
  const uEnd = uturn(fwd, bwd, { x: S[S.length - 4].x, z: S[S.length - 4].z, tx: S[S.length - 4].tx, tz: S[S.length - 4].tz });
  const uStart = uturn(bwd, fwd, { x: S[3].x, z: S[3].z, tx: -S[3].tx, tz: -S[3].tz });
  fwd.exits.push({ lane: uEnd.id, s: 0, prob: 1 });
  bwd.exits.push({ lane: uStart.id, s: 0, prob: 1 });

  // Cul-de-sacs.
  for (const j of network.junctions) {
    const br = j.branch, B = br.samples, pad = br.pad;
    const sj = S[j.mainIndex].s;
    const inStart = 7, endS = br.length - pad.r - 2;
    const inPts = [];
    for (let s = inStart; s <= endS; s += STEP) inPts.push(lanePt(B[idxAt(br, s)], 1));
    // Clockwise loop round the turning circle, starting where we arrive.
    const R = 6.4, A = inPts[inPts.length - 1], hs = B[idxAt(br, endS)];
    const a0 = Math.atan2(A.z - pad.z, A.x - pad.x);
    const fwdTest = (sg) => { const a = a0 + sg * 0.4; return (pad.x + Math.cos(a) * R - A.x) * hs.tx + (pad.z + Math.sin(a) * R - A.z) * hs.tz; };
    const sg = fwdTest(1) > fwdTest(-1) ? 1 : -1;
    const loop = [];
    for (let k = 1; k <= 16; k++) { const a = a0 + sg * (k / 16) * Math.PI * 2 * 0.86; loop.push({ x: pad.x + Math.cos(a) * R, z: pad.z + Math.sin(a) * R }); }
    const outPts = [];
    for (let s = endS; s >= inStart; s -= STEP) outPts.push(lanePt(B[idxAt(br, s)], -1));
    const cul = add({ name: br.name, pts: [...inPts, ...loop, ...outPts], road: br });

    // Junction connectors (quadratic curves through the junction).
    const js = S[j.mainIndex], b0 = B[idxAt(br, 0)];
    const brIn0 = { x: b0.x - b0.nx * LANE, z: b0.z - b0.nz * LANE };   // branch inbound lane at the mouth (keep left)
    const brOut0 = { x: b0.x + b0.nx * LANE, z: b0.z + b0.nz * LANE };  // branch outbound lane at the mouth
    const near = 9;
    // Turn in from either direction.
    const fA = lanePt(S[idxAt(gt, sj - near)], 1);
    const tinF = add({ name: `${br.name} turn-in (fwd)`, pts: bezier(fA, brIn0, inPts[0]), exits: [{ lane: cul.id, s: 0, prob: 1 }], slow: true });
    fwd.branches.push({ atS: sOnFwd(sj - near), lane: tinF.id, prob: 0.35 });
    const bA = lanePt(S[idxAt(gt, sj + near)], -1);
    const tinB = add({ name: `${br.name} turn-in (bwd)`, pts: bezier(bA, brIn0, inPts[0]), exits: [{ lane: cul.id, s: 0, prob: 1 }], slow: true });
    bwd.branches.push({ atS: sOnBwd(sj + near), lane: tinB.id, prob: 0.35 });
    // Turn out (give way first), joining either direction.
    const outEnd = outPts[outPts.length - 1];
    const toF = add({ name: `${br.name} turn-out (fwd)`, pts: bezier(outEnd, brOut0, lanePt(S[idxAt(gt, sj + near)], 1)), exits: [{ lane: fwd.id, s: sOnFwd(sj + near), prob: 1 }], slow: true, giveWay: { x: js.x, z: js.z } });
    const toB = add({ name: `${br.name} turn-out (bwd)`, pts: bezier(outEnd, brOut0, lanePt(S[idxAt(gt, sj - near)], -1)), exits: [{ lane: bwd.id, s: sOnBwd(sj - near), prob: 1 }], slow: true, giveWay: { x: js.x, z: js.z } });
    cul.exits.push({ lane: toF.id, s: 0, prob: 0.5 }, { lane: toB.id, s: 0, prob: 0.5 });
  }
  // Terrace Town Centre (if built): grid lanes + the Terrace Link joining GT's end.
  const town = network.town ? buildTownLanes(network.town, { add, fwd, bwd, lanePt, S }) : null;
  return { lanes, fwd, bwd, town };
}

/** Position + tangent on a lane at distance s (clamped). */
export function sampleLane(lane, s, out = {}) {
  const P = lane.pts;
  s = Math.max(0, Math.min(lane.len, s));
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P[mid].s <= s) lo = mid; else hi = mid; }
  const a = P[lo], b = P[hi], seg = b.s - a.s || 1, t = (s - a.s) / seg;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  const dl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  out.tx = (b.x - a.x) / dl;
  out.tz = (b.z - a.z) / dl;
  return out;
}
