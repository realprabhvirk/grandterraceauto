// Speed limits (km/h), one config. Each road definition gets road.speedLimit at world build;
// limitAt(x, z) gives the limit + street where you are (downtown overrides on shared grid streets).
export const SPEED_LIMITS = {
  suburb: 50, culdesac: 30, town: 50, downtown: 40, school: 40, arterial: 60, highway: 100, ramp: 80, airport: 60,
};
/** Downtown part of the town grid (east of Bridge St, between the north and south ring roads). */
export const DOWNTOWN_AREA = { x0: 612, x1: 968, z0: -213, z1: 43 };
/** School zone (School Rd in Northgate, next to the school). */
export const SCHOOL_ROADS = new Set(['School Rd']);

/** Category for a road definition. */
export function roadKind(road) {
  if (road.highway) return road.ramp ? 'ramp' : 'highway';
  if (road.airport) return 'airport';
  if (SCHOOL_ROADS.has(road.street)) return 'school';
  if (road.arterial || road.linkRoad) return 'arterial';
  if (road.town) return 'town';
  if (road.pad || road.junction) return 'culdesac';
  return 'suburb';
}

/** Attach speedLimit (and kind) to every road. */
export function assignSpeedLimits(roads) {
  for (const r of roads) { r.kind = roadKind(r); r.speedLimit = SPEED_LIMITS[r.kind]; }
}

/** { limit, street, road } at a world position (null if off-road). */
export function limitAt(index, x, z, maxR = 9) {
  const hit = index.nearest(x, z, maxR);
  if (!hit) return null;
  const r = hit.road;
  let limit = r.speedLimit ?? SPEED_LIMITS.suburb;
  if (r.town && !r.arterial && !r.extra && x > DOWNTOWN_AREA.x0 && x < DOWNTOWN_AREA.x1 && z > DOWNTOWN_AREA.z0 && z < DOWNTOWN_AREA.z1) limit = SPEED_LIMITS.downtown;
  if (r.town && r.arterial && r.street === 'Terrace Pde' && x > DOWNTOWN_AREA.x0) limit = SPEED_LIMITS.downtown;
  return { limit, street: r.street || r.name, road: r };
}
