// Footpath waypoint graph for pedestrians: one polyline per footpath (both sides of
// Grand Terrace; each cul-de-sac's two sides joined around its turning-circle footpath),
// with links between polyline ends that are close together (crossing a side road).
// Each point also stores the "outward" direction (away from the road) for dodging cars,
// and nearby driveway detour targets.
import { ROAD } from '../world/roadNetwork.js';

const STEP = 2.5;              // metres between waypoints
const LAT = (ROAD.pathIn + ROAD.pathOut) / 2;

export function buildFootpaths(network, layout, terrain) {
  const lines = [];
  const pt = (x, z, ox, oz) => ({ x, z, y: terrain.getHeight(x, z) + 0.05, ox, oz, detour: null });
  const sideLine = (road, side, sFrom, sTo) => {
    const out = [];
    for (let s = sFrom; s <= sTo; s += STEP) {
      const p = road.samples[Math.min(road.samples.length - 1, Math.round(s / ROAD.step))];
      out.push(pt(p.x + p.nx * side * LAT, p.z + p.nz * side * LAT, p.nx * side, p.nz * side));
    }
    return out;
  };

  for (const road of network.roads) {
    if (road.main) {
      for (const side of [-1, 1]) lines.push(sideLine(road, side, 4, road.length - 4));
      continue;
    }
    // Cul-de-sac: left side in, around the turning circle, right side out.
    const pad = road.pad, ringR = pad.r + (LAT - ROAD.halfW);
    const endS = road.length - pad.r - 3;
    const left = sideLine(road, 1, ROAD.halfW + 8, endS);
    const right = sideLine(road, -1, ROAD.halfW + 8, endS);
    const a1 = Math.atan2(left[left.length - 1].z - pad.z, left[left.length - 1].x - pad.x);
    const a2 = Math.atan2(right[right.length - 1].z - pad.z, right[right.length - 1].x - pad.x);
    // Sweep the long way round (through the far side of the circle).
    const far = Math.atan2(pad.inZ, pad.inX);
    let sweep = a2 - a1;
    sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
    const mid = a1 + sweep / 2;
    if (Math.cos(mid - far) < 0) sweep = sweep > 0 ? sweep - Math.PI * 2 : sweep + Math.PI * 2;
    const n = Math.ceil(Math.abs(sweep * ringR) / STEP);
    const ring = [];
    for (let k = 1; k < n; k++) {
      const a = a1 + (sweep * k) / n;
      ring.push(pt(pad.x + Math.cos(a) * ringR, pad.z + Math.sin(a) * ringR, Math.cos(a), Math.sin(a)));
    }
    lines.push([...left, ...ring, ...right.reverse()]);
  }

  // Driveway detours: walk a few metres into a driveway, then come back.
  for (const dw of layout.driveways) {
    let best = null, bd = 4;
    lines.forEach((line, li) => line.forEach((p, pi) => {
      const d = Math.hypot(p.x - dw.end.x, p.z - dw.end.z) - (LAT - ROAD.halfW);
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = { li, pi }; }
    }));
    if (!best) continue;
    const depth = Math.min(5, dw.len * 0.45);
    const tx = dw.end.x - dw.fx * (LAT - ROAD.halfW + depth), tz = dw.end.z - dw.fz * (LAT - ROAD.halfW + depth);
    lines[best.li][best.pi].detour = { x: tx, z: tz, y: terrain.getHeight(tx, tz) + 0.09 };
  }

  // Links between polyline ends (pedestrians cross the side road there).
  const links = lines.map(() => ({ start: [], end: [] }));
  lines.forEach((line, li) => {
    for (const [endName, p] of [['start', line[0]], ['end', line[line.length - 1]]]) {
      lines.forEach((other, oi) => {
        if (oi === li) return;
        let bi = -1, bd = 11;
        other.forEach((q, qi) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; bi = qi; } });
        if (bi >= 0) links[li][endName].push({ line: oi, index: bi });
      });
    }
  });
  return { lines, links };
}
