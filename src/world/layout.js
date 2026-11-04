// Lot layout: picks the hero site for 62 Grand Terrace, then fills both sides of
// every street (and the cul-de-sac heads) with house lots facing the road.
// Produces flat pads for the terrain, driveway strips and kerb crossovers.
import { ROAD } from './roadNetwork.js';
import { CORRIDOR, naturalHeight } from './terrain.js';
import { VARIANTS } from './houses.js';
import { HERO_LOT } from './heroHouse62.js';
import { makeRng } from '../utils/rng.js';

const MAX_REGULAR = 32;

/** World position of a lot-local point. Lot local +Z faces the road. */
export function lotToWorld(lot, lx, lz) {
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  return { x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c };
}

function makeLot(cx, cz, fx, fz) {
  return { x: cx, z: cz, rot: Math.atan2(fx, fz), fx, fz };
}

function chooseHeroSite(network) {
  const S = network.main.samples;
  const n = S.length, w = Math.round(16 / ROAD.step);
  let best = null;
  for (let i = Math.round(n * 0.18); i < n * 0.82; i += 2) {
    if (network.junctions.some((j) => Math.hypot(S[i].x - j.x, S[i].z - j.z) < 60)) continue;
    const a = S[i - w], b = S[i + w];
    const grade = Math.abs(b.h - a.h) / (2 * w * ROAD.step);
    const turn = Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz));
    for (const side of [-1, 1]) {
      const s = S[i];
      const cx = s.x + s.nx * side * HERO_LOT.setback, cz = s.z + s.nz * side * HERO_LOT.setback;
      if (Math.abs(cx) > 200 || Math.abs(cz) > 200) continue;
      // Other roads must stay clear of the whole hero lot.
      const clash = network.index.nearest(cx, cz, HERO_LOT.setback - 2, (r, os) => r !== network.main || Math.abs(os.s - s.s) > 40);
      if (clash) continue;
      const fill = Math.abs(naturalHeight(cx, cz) - s.h);
      const score = grade * 40 + turn * 6 + fill * 0.35;
      if (!best || score < best.score) best = { i, side, score, grade, turn, fill };
    }
  }
  return best;
}

export function buildLayout(network) {
  const rng = makeRng(6201);
  const { index } = network;
  const lots = [];

  // ---------- Hero lot: 62 Grand Terrace ----------
  const site = chooseHeroSite(network);
  const hs = network.main.samples[site.i];
  const fx = -hs.nx * site.side, fz = -hs.nz * site.side; // facing the road
  const hero = makeLot(hs.x - fx * HERO_LOT.setback, hs.z - fz * HERO_LOT.setback, fx, fz);
  Object.assign(hero, { kind: 'hero', road: network.main, sample: hs, side: site.side, h: hs.h + HERO_LOT.rise, site });
  lots.push(hero);

  // ---------- Regular lots along every street ----------
  const candidates = [];
  const setbackFor = (v) => ROAD.boundary + v.frontYard + v.d / 2;
  // Cul-de-sacs first so they always get houses; Grand Terrace is thinned evenly afterwards.
  for (const road of [...network.roads.filter((r) => !r.main), network.main]) {
    const S = road.samples;
    const spacing = road.main ? 25 : 22;
    for (const side of [-1, 1]) {
      const startS = road.main ? 14 : 16 + (side > 0 ? 3 : 0);
      const endS = road.length - (road.pad ? road.pad.r + 12 : 10);
      for (let sAlong = startS; sAlong < endS; sAlong += spacing) {
        const s = S[Math.min(S.length - 1, Math.round(sAlong / ROAD.step))];
        const variant = rng.int(0, VARIANTS.length - 1);
        const v = VARIANTS[variant];
        const set = setbackFor(v);
        candidates.push({ road, s, side, variant, cx: s.x + s.nx * side * set, cz: s.z + s.nz * side * set, fx: -s.nx * side, fz: -s.nz * side });
      }
    }
    // Cul-de-sac heads: lots fanned around the turning circle.
    if (road.pad) {
      const p = road.pad;
      const base = Math.atan2(-p.inZ, -p.inX); // pointing back toward the incoming road
      for (const off of [-1.95, -1.1, 1.1, 1.95, Math.PI]) {
        const variant = rng.int(0, VARIANTS.length - 1);
        const v = VARIANTS[variant];
        const r = p.r + (ROAD.boundary - ROAD.halfW) + v.frontYard + v.d / 2;
        const ang = base + off;
        const dx = Math.cos(ang), dz = Math.sin(ang);
        candidates.push({ road, s: { x: p.x, z: p.z, h: p.h }, side: 0, variant, cx: p.x + dx * r, cz: p.z + dz * r, fx: -dx, fz: -dz, pad: p });
      }
    }
  }

  const corridorClear = CORRIDOR.flat + 0.8;
  for (const c of candidates) {
    const v = VARIANTS[c.variant];
    const lot = makeLot(c.cx, c.cz, c.fx, c.fz);
    if (Math.abs(lot.x) > 228 || Math.abs(lot.z) > 228) continue;
    const hw = v.w / 2 + 2.5, hd = v.d / 2 + 2.5;
    // Footprint corners + centre must be clear of every road corridor and pad.
    const pts = [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, hd], [0, -hd]].map(([a, b]) => lotToWorld(lot, a, b));
    const roadClash = pts.some((p) => index.nearest(p.x, p.z, corridorClear));
    const padClash = pts.some((p) => network.pads.some((pd) => Math.hypot(p.x - pd.x, p.z - pd.z) < pd.r + (ROAD.pathOut - ROAD.halfW) + 1.2));
    const lotClash = lots.some((o) => Math.hypot(o.x - lot.x, o.z - lot.z) < (o.kind === 'hero' ? 27 : 17.5));
    if (roadClash || padClash || lotClash) continue;
    const frontH = c.s.h;
    const nat = naturalHeight(lot.x, lot.z);
    const rise = Math.max(-0.7, Math.min(1.5, (nat - frontH) * 0.45));
    Object.assign(lot, { kind: 'regular', variant: c.variant, road: c.road, side: c.side, along: c.s.s ?? 0, h: frontH + 0.12 + rise, // flip stays false: mirrored instances would render inside-out (no per-instance winding fix).
      wallColor: rng.int(0, 99), roofColor: rng.int(0, 99), flip: false });
    lots.push(lot);
  }

  // Keep every cul-de-sac lot, spread the remaining budget evenly along Grand Terrace.
  const regular0 = lots.filter((l) => l.kind === 'regular');
  if (regular0.length > MAX_REGULAR) {
    const br = regular0.filter((l) => !l.road.main);
    const gt = regular0.filter((l) => l.road.main).sort((a, b) => a.along - b.along);
    const keepN = Math.max(0, MAX_REGULAR - br.length);
    const keep = new Set(Array.from({ length: keepN }, (_, i) => gt[Math.floor(((i + 0.5) * gt.length) / keepN)]));
    for (let i = lots.length - 1; i >= 0; i--) if (lots[i].kind === 'regular' && lots[i].road.main && !keep.has(lots[i])) lots.splice(i, 1);
  }

  // ---------- Driveways (draped later) + kerb crossovers ----------
  const driveways = [];
  const cuts = [];
  for (const lot of lots) {
    const isHero = lot.kind === 'hero';
    const v = isHero ? null : VARIANTS[lot.variant];
    const gx = isHero ? HERO_LOT.garageX : v.garageX * (lot.flip ? -1 : 1);
    const z0 = isHero ? HERO_LOT.garageFrontZ : v.d / 2;
    const width = isHero ? HERO_LOT.driveW : v.driveW;
    const start = lotToWorld(lot, gx, z0);
    // Walk toward the road until we reach the kerb line.
    let len = 0, end = start;
    for (let t = 0; t < 40; t += 0.25) {
      const p = { x: start.x + lot.fx * t, z: start.z + lot.fz * t };
      const near = index.nearest(p.x, p.z, 30);
      const padNear = network.pads.find((pd) => Math.hypot(p.x - pd.x, p.z - pd.z) < pd.r + ROAD.curbW + 0.05);
      if ((near && near.d < ROAD.halfW + 0.05) || padNear) { len = t; end = p; break; }
    }
    if (!len) continue;
    driveways.push({ lot, start, end, width, fx: lot.fx, fz: lot.fz, len, hero: isHero });
    const kerb = { x: end.x - lot.fx * 0.2, z: end.z - lot.fz * 0.2 };
    cuts.push({ x: kerb.x, z: kerb.z, r: width / 2 + 0.4 });
  }

  // ---------- Yard tree spots ----------
  const treeSpots = [];
  for (const lot of lots) {
    if (lot.kind === 'hero') continue;
    const v = VARIANTS[lot.variant];
    const gxSign = lot.flip ? -1 : 1;
    const opts = [
      [-gxSign * (v.w / 2 + 0.5), v.d / 2 + 4.2],
      [gxSign * (v.w / 2 + 1.2), -v.d / 2 - 2.5],
      [-gxSign * (v.w / 2 - 1), -v.d / 2 - 3.5],
    ];
    if (rng.chance(0.75)) {
      const [lx, lz] = rng.pick(opts);
      const p = lotToWorld(lot, lx, lz);
      if (!index.nearest(p.x, p.z, ROAD.pathOut + 1.5)) treeSpots.push({ x: p.x, z: p.z, lot });
    }
  }

  return { lots, hero, driveways, cuts, treeSpots, regular: lots.filter((l) => l.kind === 'regular') };
}

/** Terrain flatteners for every lot. */
export function lotPads(layout) {
  return layout.lots.map((lot) => {
    if (lot.kind === 'hero') {
      const c = lotToWorld(lot, HERO_LOT.padCenter[0], HERO_LOT.padCenter[1]);
      return { x: c.x, z: c.z, rot: lot.rot, hw: HERO_LOT.padHalf[0], hd: HERO_LOT.padHalf[1], h: lot.h, fall: 7 };
    }
    const v = VARIANTS[lot.variant];
    return { x: lot.x, z: lot.z, rot: lot.rot, hw: v.w / 2 + 2, hd: v.d / 2 + 2, h: lot.h, fall: 6 };
  });
}
