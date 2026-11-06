// Town lanes (keep left): one lane per direction per grid edge, plus curved connectors
// through every intersection (left, straight, right - no U-turns). Straight on Terrace Pde
// and the ring road has priority; everything else gives way at the intersection.
// The Terrace Link joins Grand Terrace's lanes at its east end.
import { T } from './townPlan.js';

const STEP = 1.5, STOP = T.hw + 2.6, LINK_LANE = 1.8;

function line(ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / STEP)), pts = [];
  for (let k = 0; k <= n; k++) pts.push({ x: ax + ((bx - ax) * k) / n, z: az + ((bz - az) * k) / n });
  return pts;
}
function bezier(p0, p1, p2) {
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z);
  const n = Math.max(4, Math.ceil(len / STEP)), pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t;
    pts.push({ x: a * p0.x + b * p1.x + c * p2.x, z: a * p0.z + b * p1.z + c * p2.z });
  }
  return pts;
}
const dirOf = (L, end) => {
  const P = L.pts, a = end ? P[P.length - 2] : P[0], b = end ? P[P.length - 1] : P[1];
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
};

/**
 * @param plan  buildTownPlan() result
 * @param g     { add, fwd, bwd, lanePt, S } from buildLaneGraph
 */
export function buildTownLanes(plan, { add, fwd, bwd, lanePt, S }) {
  const into = new Map(), outOf = new Map(); // node id -> [lane]
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const streetOf = (a, b) => plan.roads.find((r) => (a.x === b.x ? r.samples[0].x === a.x && r.samples[0].tx === 0 : r.samples[0].z === a.z && r.samples[0].tz === 0));

  for (const { a, b, road: explicitRoad } of plan.edges) {
    for (const [p, q] of [[a, b], [b, a]]) {
      const dx = Math.sign(q.x - p.x), dz = Math.sign(q.z - p.z);
      // Right of travel is (-dz, dx); keep left = minus that.
      const road = explicitRoad || streetOf(p, q), offset = road?.rural ? Math.min(1.8, road.halfW / 2) : T.lane;
      const ox = dz * offset, oz = -dx * offset;
      const pts = line(p.x + dx * STOP + ox, p.z + dz * STOP + oz, q.x - dx * STOP + ox, q.z - dz * STOP + oz);
      const lane = add({ name: `${road?.name || 'town'} ${p.id}->${q.id}`, pts, road, town: true, from: p, to: q });
      push(into, q.id, lane); push(outOf, p.id, lane);
    }
  }

  // Terrace Link both ways (Grand Terrace end <-> the ring road at Terrace Pde).
  const link = plan.link, LS = link.samples, entry = plan.entry;
  const lp = (s, dir) => ({ x: s.x - s.nx * LINK_LANE * dir, z: s.z - s.nz * LINK_LANE * dir });
  const stopX = entry.x - STOP;
  const east = [lanePt(S[S.length - 4], 1)], west = [];
  for (let i = 3; i < LS.length; i++) { const p = lp(LS[i], 1); if (p.x > stopX) break; east.push(p); }
  for (let i = LS.length - 1; i >= 0; i--) { const p = lp(LS[i], -1); if (p.x > stopX) continue; west.push(p); }
  west.push(lanePt(S[S.length - 4], -1));
  const linkE = add({ name: 'Terrace Link east', pts: east, road: link, town: true });
  const linkW = add({ name: 'Terrace Link west', pts: west, road: link, town: true, exits: [{ lane: bwd.id, s: 0, prob: 1 }] });
  push(into, entry.id, linkE); push(outOf, entry.id, linkW);
  // Grand Terrace now continues into town instead of U-turning at its end.
  fwd.exits = [{ lane: linkE.id, s: 0, prob: 1 }];

  // Intersection connectors.
  const isMain = (L) => L === linkE || L === linkW || (L.road?.arterial && !L.road?.extra);
  for (const n of plan.nodes) {
    const ins = into.get(n.id) || [], outs = outOf.get(n.id) || [];
    for (const inL of ins) {
      const di = dirOf(inL, true), A = inL.pts[inL.pts.length - 1];
      const choices = [];
      for (const outL of outs) {
        const dO = dirOf(outL, false), B = outL.pts[0];
        const dot = di.x * dO.x + di.z * dO.z;
        if (dot < -0.5) continue; // no U-turns
        const straight = dot > 0.5;
        let C;
        if (straight) C = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
        else {
          // Intersection of the incoming and outgoing lane lines.
          const det = di.x * -dO.z - di.z * -dO.x;
          const t = ((B.x - A.x) * -dO.z - (B.z - A.z) * -dO.x) / det;
          C = { x: A.x + di.x * t, z: A.z + di.z * t };
        }
        const corner = n.links.length === 2 && !(n === entry);
        const priority = corner || (straight && isMain(inL) && isMain(outL));
        const con = add({ name: `x${n.id} ${straight ? 'straight' : 'turn'}`, pts: bezier(A, C, B), exits: [{ lane: outL.id, s: 0, prob: 1 }], slow: !straight, town: true, giveWay: priority ? null : { x: n.x, z: n.z } });
        choices.push({ con, w: straight ? 2 : 1 });
      }
      const sum = choices.reduce((a, c) => a + c.w, 0);
      inL.exits = choices.map((c) => ({ lane: c.con.id, s: 0, prob: c.w / sum }));
    }
  }
  return { linkE, linkW, into, outOf };
}
