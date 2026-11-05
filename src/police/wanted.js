// Wanted level: heat points -> 0-5 stars. Phases (numbers in wantedConfig.js):
//   'solid'    after any new witnessed crime; at least `grace` s (police are dispatched now).
//   'flashing' once the grace is over AND (no cop LOS for `hidden` s and nearest cop >= nearMin,
//              or nearest cop >= farAny). Any cop LOS / a cop inside nearMin / a new crime puts the
//              stars back to solid and resets the timers. `flash` s of flashing clears the level.
//   'none'     no wanted level. Death / busted clear it at once.
import { WANTED_CFG as W } from './wantedConfig.js';

export const HEAT = { theftPolice: 60, theftAmbulance: 30, shotsFired: 10, shootCiv: 50, killCiv: 80, shootCop: 100, killCop: 150, theft: 25, carjack: 40, pedHit: 30, pedHitRepeat: 15, prop: 10, policeDamage: 50, ramCop: 60, footpathScare: 10 };

export function createWanted(hud) {
  const st = { heat: 0, stars: 0, phase: 'none', grace: 0, hidden: 0, flashT: 0, nearest: Infinity, lastPedHit: -99, t: 0 };
  const listeners = [];
  const starsFor = (h) => W.thresholds.filter((x) => h >= x).length;
  return {
    get stars() { return st.stars; },
    get heat() { return st.heat; },
    /** Flashing = police searching (no reinforcements, HUD blinks). */
    get searching() { return st.phase === 'flashing'; },
    get phase() { return st.phase; },
    get state() { return st; },
    onChange(f) { listeners.push(f); },
    /** Add heat for a (witnessed) crime: stars solid, grace restarts. */
    add(kind, amount = HEAT[kind] || 0) {
      if (kind === 'pedHit') { amount = st.t - st.lastPedHit < 10 ? HEAT.pedHitRepeat : HEAT.pedHit; st.lastPedHit = st.t; }
      const before = st.stars;
      st.heat += amount;
      st.stars = Math.max(st.stars, starsFor(st.heat));
      if (st.stars) { st.phase = 'solid'; st.grace = W.grace; st.hidden = 0; st.flashT = 0; }
      if (st.stars !== before) listeners.forEach((f) => f(st.stars, before, kind));
    },
    /** Raise straight to at least n stars (heat up to that threshold), solid + full grace. */
    raiseTo(n, kind = 'raise') {
      const need = W.thresholds[Math.min(n, W.thresholds.length) - 1];
      this.add(kind, Math.max(0, need - st.heat));
    },
    clear(silent = false) {
      const before = st.stars;
      Object.assign(st, { heat: 0, stars: 0, phase: 'none', grace: 0, hidden: 0, flashT: 0 });
      if (before && !silent) hud.message('WANTED LEVEL CLEARED', 2.5, '#9fd18b');
      listeners.forEach((f) => f(0, before, 'clear'));
    },
    /** seen: any cop has line of sight to the player; nearest: distance to the nearest cop. */
    update(dt, { seen, nearest }) {
      st.t += dt;
      st.nearest = nearest;
      if (!st.stars) { st.phase = 'none'; return; }
      st.grace = Math.max(0, st.grace - dt);
      st.hidden = seen ? 0 : st.hidden + dt;
      if (st.phase === 'solid') {
        if (st.grace <= 0 && ((st.hidden >= W.hidden && nearest >= W.nearMin) || nearest >= W.farAny)) { st.phase = 'flashing'; st.flashT = W.flash; }
      } else if (st.phase === 'flashing') {
        if (seen || nearest < W.nearMin) { st.phase = 'solid'; st.hidden = 0; st.flashT = 0; return; }
        st.flashT -= dt;
        if (st.flashT <= 0) this.clear();
      }
    },
    /** Test helper: fast-forward the hidden timer. */
    fastForward(sec) { st.hidden += sec; st.grace = Math.max(0, st.grace - sec); },
  };
}
