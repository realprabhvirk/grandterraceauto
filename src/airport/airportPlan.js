// Terrace Airport (Phase 6.1): layout constants shared by the terrain grading, the town plan
// (Airport Rd / Terminal Dr / Airport Link), the static build (airport.js), the aircraft paths
// (aircraft.js) and the maps. North of Northgate, graded flat at town level. Runway 09/27 runs
// east-west; operations use runway 27 (departures roll west, arrivals come in from the east).
// The taxiway is one-way eastbound: arrivals exit at the west connector and taxi east to the gates,
// departures taxi east to the holding point at the east end.
export const AP = {
  h: -4.4,
  site: { x0: -200, x1: 1015, z0: -760, z1: -505 },          // graded flat
  rwy: { z: -705, x0: -40, x1: 960, halfW: 22.5 },            // 1000 m x 45 m
  twy: { z: -645, x0: -10, x1: 945, halfW: 11.5 },
  connectors: [0, 300, 640, 935],                             // taxiway <-> runway links (x)
  holdShort: { x: 935, z: -668 },                             // departures wait here
  exitX: 300,                                                 // arrivals leave the runway here
  apron: { x0: 380, x1: 725, z0: -633, z1: -572 },
  terminal: { x0: 430, x1: 630, z0: -572, z1: -548 },          // front (landside) at z1
  gates: [455, 505, 555, 605],                                // gate x; nose-in, nose at z = gateNoseZ
  gateNoseZ: -584,
  carpark: { x0: 340, x1: 420, z0: -572, z1: -548 },
  tower: { x: 700, z: -556 },
  hangars: [{ x: 775, z: -604 }, { x: 860, z: -604 }],         // 60 x 40, doors face north (taxiway)
  tanks: [{ x: 250, z: -600 }, { x: 272, z: -600 }, { x: 294, z: -600 }],
  fence: { z: -578, x0: -195, x1: 1010, north: -752, gate: { x: 665, w: 9 } }, // landside south of z
  roadZ: -540,                                                // Terminal Dr
  roadX0: 330, roadX1: 620,                                   // Airport Rd (x0) / Airport Link (x1)
};
AP.rwy.len = AP.rwy.x1 - AP.rwy.x0;

/** Map rectangles (minimap + full map backgrounds). */
export function airportAreas() {
  const r = AP.rwy, t = AP.twy, a = AP.apron;
  const out = [
    { x0: AP.fence.x0, x1: AP.fence.x1, z0: AP.fence.north, z1: AP.fence.z, color: '#6b8650' }, // airside grass
    { x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1, color: '#77757a' },
    { x0: t.x0, x1: t.x1, z0: t.z - t.halfW, z1: t.z + t.halfW, color: '#4a484e' },
    { x0: r.x0, x1: r.x1, z0: r.z - r.halfW, z1: r.z + r.halfW, color: '#2f2e33' },
    { x0: AP.terminal.x0, x1: AP.terminal.x1, z0: AP.terminal.z0, z1: AP.terminal.z1, color: '#c9c4b8' },
    { x0: AP.carpark.x0, x1: AP.carpark.x1, z0: AP.carpark.z0, z1: AP.carpark.z1, color: '#5c5d60' },
  ];
  for (const x of AP.connectors) out.push({ x0: x - 9, x1: x + 9, z0: r.z + r.halfW - 1, z1: t.z - t.halfW + 1, color: '#4a484e' });
  return out;
}

/** Is (x, z) on the runway (with a small margin)? */
export const onRunway = (x, z, m = 2) => x > AP.rwy.x0 - m && x < AP.rwy.x1 + m && Math.abs(z - AP.rwy.z) < AP.rwy.halfW + m;
