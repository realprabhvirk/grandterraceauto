// Speed camera + radar-post placements (data only, used by world.js for the "SPEED CAMERA AHEAD"
// signs and by police/speedCameras.js + police/trafficCops.js at runtime).
//   road: street name, t: 0..1 along the road's samples, dir: +1 watches traffic travelling along
//   +t (samples order), -1 the other way. Cameras / radar cops stand on that traffic's kerb side.
export const CAMERA_SPOTS = [
  { id: 'cam-hwy-1', road: 'Terrace Motorway', t: 0.18, dir: 1 },
  { id: 'cam-hwy-2', road: 'Terrace Motorway', t: 0.42, dir: -1 },
  { id: 'cam-hwy-3', road: 'Terrace Motorway', t: 0.66, dir: 1 },
  { id: 'cam-hwy-4', road: 'Terrace Motorway', t: 0.86, dir: -1 },
  { id: 'cam-gt', road: 'Grand Terrace', t: 0.55, dir: 1 },
  { id: 'cam-ring-n', road: 'Ring Rd North', t: 0.3, dir: -1 },
  { id: 'cam-ring-e', road: 'Ring Rd East', t: 0.5, dir: 1 },
  { id: 'cam-pde-dt', road: 'Terrace Pde', t: 0.82, dir: 1 },
  { id: 'cam-king', road: 'King St', t: 0.5, dir: -1 },
];
export const RADAR_SPOTS = [
  { id: 'radar-hwy', road: 'Terrace Motorway', t: 0.3, dir: 1 },
  { id: 'radar-ring-s', road: 'The Esplanade', t: 0.25, dir: -1 },
  { id: 'radar-gt', road: 'Grand Terrace', t: 0.3, dir: -1 },
  { id: 'radar-dt', road: 'Queen St', t: 0.35, dir: 1 },
  { id: 'radar-ng', road: 'Northgate Rd', t: 0.4, dir: -1 },
];

/** Resolve a spot on the road network: { x, z, yaw (facing the traffic it watches), road, tx, tz, side }. */
export function resolveSpot(roads, spot, kerb = 1.6) {
  const r = roads.find((q) => q.street === spot.road);
  if (!r) return null;
  const S = r.samples, i = Math.max(1, Math.min(S.length - 2, Math.round(spot.t * (S.length - 1)))), s = S[i];
  // Kerb on the left of the watched traffic: travel dir d = dir * t; left = -n * dir (normals point right).
  const off = (r.halfW || 3.6) + kerb;
  const x = s.x - s.nx * spot.dir * off, z = s.z - s.nz * spot.dir * off;
  // Faces the oncoming traffic: -dir * t.
  const yaw = Math.atan2(-s.tx * spot.dir, -s.tz * spot.dir);
  return { ...spot, x, z, yaw, road: r, i, tx: s.tx * spot.dir, tz: s.tz * spot.dir };
}

/** "SPEED CAMERA AHEAD" sign spots ~100 m before each camera (same kerb). */
export function cameraAheadSigns(roads) {
  const out = [];
  for (const c of CAMERA_SPOTS) {
    const r = roads.find((q) => q.street === c.road);
    if (!r) continue;
    const S = r.samples, step = Math.max(0.5, (S[1]?.s ?? 2) - (S[0]?.s ?? 0));
    const i0 = Math.round(c.t * (S.length - 1)), i = Math.max(1, Math.min(S.length - 2, i0 - c.dir * Math.round(100 / step)));
    const s = S[i], off = (r.halfW || 3.6) + 1.3;
    out.push({ x: s.x - s.nx * c.dir * off, z: s.z - s.nz * c.dir * off, yaw: Math.atan2(-s.tx * c.dir, -s.tz * c.dir), id: c.id });
  }
  return out;
}
