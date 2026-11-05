// Weapon tuning (all hitscan). Spread values are cone half-angles in radians.
//   rate      max shots per second (auto = hold to fire)
//   spread    { base, move (extra at full run), shot (bloom per shot), max, recover (rad/s) }
//   reload    seconds (shotgun: per shell); reserveCap = most spare ammo you can carry
export const WEAPONS = {
  pistol: {
    id: 'pistol', slot: 1, name: 'Pistol', dmg: 25, mag: 12, reserveCap: 96, startReserve: 48,
    rate: 6, auto: false, reload: 1.35, range: 150, kick: 0.022, gunKick: 0.6,
    spread: { base: 0.004, move: 0.022, shot: 0.012, max: 0.05, recover: 0.09 },
    long: false, sound: { pitch: 1.0, body: 0.7, tail: 0.25 }, price: { ammo: 30, pack: 24 },
  },
  smg: {
    id: 'smg', slot: 2, name: 'SMG', dmg: 14, mag: 30, reserveCap: 240, startReserve: 120,
    rate: 11, auto: true, reload: 1.9, range: 150, kick: 0.011, gunKick: 0.35,
    spread: { base: 0.01, move: 0.025, shot: 0.0045, max: 0.06, recover: 0.12 },
    long: true, sound: { pitch: 1.25, body: 0.5, tail: 0.2 }, price: { ammo: 50, pack: 60 },
  },
  shotgun: {
    id: 'shotgun', slot: 3, name: 'Pump Shotgun', dmg: 8, pellets: 8, mag: 6, reserveCap: 48, startReserve: 18,
    rate: 1.4, auto: false, pump: 0.55, reload: 0.45, perShell: true, range: 60, kick: 0.05, gunKick: 1.0,
    falloff: { start: 10, end: 35, min: 0.2 },
    spread: { base: 0.055, move: 0.02, shot: 0.01, max: 0.08, recover: 0.1 },
    long: true, sound: { pitch: 0.7, body: 1.0, tail: 0.4 }, price: { ammo: 60, pack: 12, gun: 600 },
  },
  rifle: {
    id: 'rifle', slot: 4, name: 'Rifle', dmg: 35, mag: 20, reserveCap: 120, startReserve: 60,
    rate: 4, auto: true, reload: 2.2, range: 150, kick: 0.028, gunKick: 0.7,
    spread: { base: 0.002, move: 0.03, shot: 0.01, max: 0.045, recover: 0.08 },
    long: true, sound: { pitch: 0.9, body: 0.85, tail: 0.35 }, price: { ammo: 80, pack: 40, gun: 1200 },
  },
};
export const ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];
export const HEADSHOT = 2;
/** Damage cops deal to an on-foot player per hit (Step 3). */
export const COP_DMG = { pistol: 8, smg: 5, rifle: 10 };
export const NPC_HP = 100, COP_HP = 150;
/** Car damage per bullet = weapon damage x this. */
export const CAR_DMG = 0.25;

/** Shotgun pellet damage multiplier at distance d. */
export function falloff(w, d) {
  if (!w.falloff || d <= w.falloff.start) return 1;
  const k = (d - w.falloff.start) / (w.falloff.end - w.falloff.start);
  return Math.max(w.falloff.min, 1 - k * (1 - w.falloff.min));
}

/** Damage for one hit: weapon, zone ('head' | 'body'), distance. */
export function hitDamage(w, zone, d) {
  return w.dmg * (zone === 'head' ? HEADSHOT : 1) * falloff(w, d);
}
