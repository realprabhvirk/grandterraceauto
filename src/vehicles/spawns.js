// Seeded car spawn list: the hero car in 62's driveway, one car in each cul-de-sac head,
// the rest parked along the kerb (left-side parking, facing the direction of travel).
import { CAR_TYPES } from './carTypes.js';
import { PALETTE } from '../art/palette.js';
import { ROAD } from '../world/roadNetwork.js';
import { HERO_LOT } from '../world/heroHouse62.js';
import { lotToWorld } from '../world/layout.js';
import { makeRng } from '../utils/rng.js';

const KERB_SPOTS = [
  // [road index, fraction along, side]
  [0, 0.14, 1], [0, 0.4, -1], [0, 0.7, 1], [2, 0.42, -1],
];

export function buildSpawns(world) {
  const rng = makeRng(8808);
  const { network, layout, terrain } = world;
  const cuts = layout.cuts;
  const spots = [];
  const clearOfCuts = (x, z, r) => !cuts.some((c) => Math.hypot(c.x - x, c.z - z) < r + c.r);
  const clearOfCars = (x, z) => !spots.some((s) => Math.hypot(s.x - x, s.z - z) < 7);

  // Hero car: nose out in 62's driveway, a car length in front of the garage door.
  const hero = layout.hero;
  const hp = lotToWorld(hero, HERO_LOT.garageX, HERO_LOT.garageFrontZ + 3.2);
  spots.push({ type: 'sedan', paint: PALETTE.cars.hero, hero: true, x: hp.x, z: hp.z, yaw: Math.atan2(hero.fx, hero.fz) });

  // One per cul-de-sac head, parked against the kerb ring away from the mouth.
  for (const pad of network.pads) {
    const back = Math.atan2(-pad.inZ, -pad.inX); // direction toward the incoming road
    for (const off of [Math.PI, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.55, Math.PI * 1.45]) {
      const a = back + off, r = pad.r - 1.05; // tight to the kerb ring so the loop stays clear
      const x = pad.x + Math.cos(a) * r, z = pad.z + Math.sin(a) * r;
      if (!clearOfCuts(x, z, 3.2) || !clearOfCars(x, z)) continue;
      // Tangent to the ring (counter-clockwise travel keeps the kerb on the left).
      const tx = -Math.sin(a), tz = Math.cos(a);
      spots.push({ x, z, yaw: Math.atan2(tx, tz) });
      break;
    }
  }

  // Kerbside along the streets.
  for (const [ri, frac, side] of KERB_SPOTS) {
    const road = network.roads[ri];
    for (let tryF = frac; tryF < frac + 0.2; tryF += 0.02) {
      const s = road.samples[Math.floor(tryF * (road.samples.length - 1))];
      const lat = side * (ROAD.halfW - 1.05);
      const x = s.x + s.nx * lat, z = s.z + s.nz * lat;
      const nearJunction = network.junctions.some((j) => Math.hypot(j.x - x, j.z - z) < 24);
      const nearHero = Math.hypot(hero.sample.x - x, hero.sample.z - z) < 20;
      const nearPad = network.pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 8);
      if (nearJunction || nearHero || nearPad || !clearOfCuts(x, z, 4.2) || !clearOfCars(x, z)) continue;
      // Sample normals point to the RIGHT of +t, so a car on side +1 parks on its left kerb
      // facing -t (keep left), and one on side -1 faces +t.
      const dir = side > 0 ? -1 : 1;
      spots.push({ x, z, yaw: Math.atan2(s.tx * dir, s.tz * dir) });
      break;
    }
  }

  // Phase 5: 1-2 more parked cars on every 2nd street (>=12 m from driveways, clear of the
  // cul-de-sac pads and junctions, >=8 m apart).
  const extra = [];
  network.roads.forEach((road, ri) => {
    if (ri % 2 === 0) return;
    const want = 1 + (rng.next() < 0.5 ? 1 : 0);
    let got = 0;
    const S = road.samples;
    for (let f = 0.08 + rng.next() * 0.06; f < 0.94 && got < want; f += 0.02) for (const side of (got + ri) % 2 ? [1, -1] : [-1, 1]) {
      if (got >= want) break;
      const s = S[Math.floor(f * (S.length - 1))];
      const lat = side * (ROAD.halfW - 1.05);
      const x = s.x + s.nx * lat, z = s.z + s.nz * lat;
      if (cuts.some((c) => Math.hypot(c.x - x, c.z - z) < 12)) continue;
      if (network.pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 32)) continue; // keep the cul-de-sac approach clear
      if (network.junctions.some((j) => Math.hypot(j.x - x, j.z - z) < 24)) continue;
      if (Math.hypot(hero.sample.x - x, hero.sample.z - z) < 20) continue;
      if (spots.some((o) => Math.hypot(o.x - x, o.z - z) < 8)) continue;
      const dir = side > 0 ? -1 : 1;
      spots.push({ x, z, yaw: Math.atan2(s.tx * dir, s.tz * dir), extra: true });
      got++; f += 0.1;
    }
    extra.push(got);
  });

  // Types + paints: every type appears at least once, colours never repeat.
  const types = ['hatch', 'ute', 'suv', 'sedan', 'hatch', 'suv', 'ute'];
  const paints = [...PALETTE.cars.paints];
  for (let i = paints.length - 1; i > 0; i--) { const j = rng.int(0, i); [paints[i], paints[j]] = [paints[j], paints[i]]; }
  spots.forEach((s, i) => {
    if (!s.type) { s.type = types[(i - 1) % types.length]; s.paint = paints[(i - 1) % paints.length]; }
    s.cfg = CAR_TYPES[s.type];
    s.y = terrain.getHeight(s.x, s.z);
  });
  return spots;
}
