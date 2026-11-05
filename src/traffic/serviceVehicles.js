// Phase 6: service traffic on the lane graph (TrafficCar AI: lights, gaps, give-way all apply).
//  - 2 buses on a fixed loop: Terrace Pde eastbound -> Ring Rd East -> The Esplanade westbound
//    -> Ring Rd West -> back onto the Pde; they pull up at the four eastbound Pde stops (6 s).
//  - 3 yellow taxis (roof sign) and 2 white delivery vans wandering the town grid.
// Not carjackable (like the patrol cruisers); they're kept out of CAR_TYPES so parked-car
// spawns never pick them.
import * as THREE from 'three';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { TrafficCar } from './trafficCar.js';
import { T } from '../town/townPlan.js';

export const SERVICE_TYPES = {
  bus: { ...CAR_TYPES.sedan, label: 'Bus', L: 11, W: 2.5, wheelBase: 6.2, track: 2.1, wheelR: 0.5, wheelW: 0.3, frontOverhang: 2.2, clearance: 0.3, belt: 1.25, roof: 3.1, cabin: [-5.25, 5.35], roofSpan: [-5.3, 5.25] },
  van: { ...CAR_TYPES.sedan, label: 'Van', L: 5.3, W: 2.0, wheelBase: 3.3, track: 1.72, wheelR: 0.36, wheelW: 0.24, frontOverhang: 0.9, clearance: 0.2, belt: 1.0, roof: 2.35, cabin: [-2.55, 1.45], roofSpan: [-2.55, 0.95] },
};
export const SERVICE = { buses: 2, taxis: 3, vans: 2, dwell: 6, busCruise: 38 / 3.6 };
export const SERVICE_COUNT = SERVICE.buses + SERVICE.taxis + SERVICE.vans;
const PDE = T.Z[1], ESP = T.Z[2], XW = T.X[0], XE = T.X[T.X.length - 1];
/** Eastbound Terrace Pde stops (north kerb, keep left). */
export const BUS_STOPS = [372, 462, 655, 925].map((x) => ({ x, z: PDE - T.lane }));

/** Heading the bus loop wants when leaving junction node n (unit x/z). */
function loopHeading(n) {
  if (!n) return null;
  if (n.z === PDE && n.x < XE) return [1, 0];
  if (n.x === XE && n.z < ESP) return [0, 1];
  if (n.z === ESP && n.x > XW) return [-1, 0];
  if (n.x === XW && n.z > PDE) return [0, -1];
  return null;
}

export function addServiceVehicles({ cars, graph, physics, scene, wheels, world, rng, startIndex }) {
  const lanes = graph.lanes, out = { buses: [], taxis: [], vans: [] };
  let i = startIndex;
  const make = (id, type, cfg, paint, lane, s, cruise) => {
    const t = new TrafficCar({ id, type, cfg, paint, lane, s, cruise, physics, scene, wheels, wheelOffset: i * 4, terrain: world.terrain, rng: rng.fork(i + 300) });
    t.service = type; t.noJack = type !== 'sedan'; i++; // taxis can be carjacked (they become a sedan); buses / vans can't
    cars.push(t);
    return t;
  };
  // Buses: start on Pde eastbound lanes (one west, one downtown).
  const pdeEast = lanes.filter((l) => l.town && l.from && l.to && l.from.z === PDE && l.to.z === PDE && l.to.x > l.from.x).sort((a, b) => a.from.x - b.from.x);
  [pdeEast[0], pdeEast[Math.floor(pdeEast.length / 2) + 1]].forEach((lane, k) => {
    if (!lane) return;
    const b = make(`bus-${k}`, 'bus', SERVICE_TYPES.bus, k ? '#2f6fc0' : '#c8322a', lane, lane.len * 0.2, SERVICE.busCruise);
    b.dwell = 0; b.lastStop = -1; b.stops = 0;
    b.pickExit = (exits) => {
      const want = loopHeading(b.lane.to);
      if (!want || exits.length < 2) return null;
      let best = null, bd = -2;
      for (const e of exits) {
        const con = lanes[e.lane], nxt = lanes[con.exits?.[0]?.lane] || con, P = nxt.pts, a = P[0], c = P[Math.min(P.length - 1, 3)];
        const l = Math.hypot(c.x - a.x, c.z - a.z) || 1, d = ((c.x - a.x) * want[0] + (c.z - a.z) * want[1]) / l;
        if (d > bd) { bd = d; best = e; }
      }
      return best;
    };
    b.extraTarget = (dt, P) => {
      if (b.dwell > 0) { b.dwell -= dt; if (b.dwell <= 0) b.lastStopT = 0; return 0; }
      b.lastStopT = (b.lastStopT || 0) + dt;
      for (let s = 0; s < BUS_STOPS.length; s++) {
        const st = BUS_STOPS[s], ahead = (st.x - P.x) * P.tx + (st.z - P.z) * P.tz, lat = Math.abs((st.x - P.x) * P.tz - (st.z - P.z) * P.tx);
        if (lat > 2.5 || ahead < -0.5 || ahead > 30 || s === b.lastStop) continue;
        if (ahead < 0.6) { b.dwell = SERVICE.dwell; b.lastStop = s; b.stops++; return 0; }
        return Math.sqrt(2 * 2.5 * Math.max(0, ahead - 0.3));
      }
      return Infinity;
    };
    b.model.add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 0.05).translate(0, SERVICE_TYPES.bus.roof - 0.35, SERVICE_TYPES.bus.L / 2 - SERVICE_TYPES.bus.frontOverhang + 2.21), new THREE.MeshBasicMaterial({ color: '#ffb11f', toneMapped: false }))); // destination board
    out.buses.push(b);
  });
  // Taxis + vans: spread over the town grid lanes.
  const town = lanes.filter((l) => l.town && l.from && l.len > 40 && l.pts[0].z > -230);
  for (let k = 0; k < SERVICE.taxis; k++) {
    const lane = town[(k * 11 + 3) % town.length];
    const t = make(`taxi-${k}`, 'sedan', CAR_TYPES.sedan, '#f2c41a', lane, lane.len * 0.5, rng.range(32, 42) / 3.6);
    t.model.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.28).translate(0, CAR_TYPES.sedan.roof + 0.11, -0.2), new THREE.MeshLambertMaterial({ color: '#fff4c8', emissive: '#ffe08a', emissiveIntensity: 0.4 })));
    out.taxis.push(t);
  }
  for (let k = 0; k < SERVICE.vans; k++) {
    const lane = town[(k * 17 + 8) % town.length];
    const v = make(`van-${k}`, 'van', SERVICE_TYPES.van, '#eeeeea', lane, lane.len * 0.6, rng.range(30, 38) / 3.6);
    v.model.add(new THREE.Mesh(new THREE.BoxGeometry(SERVICE_TYPES.van.W + 0.02, 0.32, 2.6).translate(0, 1.45, -1.0), new THREE.MeshLambertMaterial({ color: k ? '#c8322a' : '#2f6b5a' }))); // livery band
    out.vans.push(v);
  }
  return out;
}
