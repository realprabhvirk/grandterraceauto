// Owned weapons, ammo and firing state (pure logic, no three.js - testable in Node).
// One weapon in hand at a time (or holstered). Reload, pump-action, fire rate, spread bloom.
import { WEAPONS, ORDER } from './weaponStats.js';

const SAVE_KEY = 'gta-weapons';

export function createArsenal({ storage = globalThis.localStorage, start = ['pistol', 'smg'] } = {}) {
  const st = {
    owned: new Set(), ammo: {}, current: 'pistol', holstered: true,
    cooldown: 0, reloadT: 0, reloading: false, pumpT: 0, bloom: 0, shots: 0, dry: 0, drawT: 0, lastFire: -9, t: 0,
  };
  const give = (id, reserve = WEAPONS[id].startReserve) => {
    st.owned.add(id);
    if (!st.ammo[id]) st.ammo[id] = { mag: WEAPONS[id].mag, reserve: 0 };
    st.ammo[id].reserve = Math.min(WEAPONS[id].reserveCap, st.ammo[id].reserve + reserve);
  };
  let loaded = false;
  try {
    const s = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
    if (s && Array.isArray(s.owned)) {
      for (const id of s.owned) if (WEAPONS[id]) { st.owned.add(id); st.ammo[id] = { mag: Math.min(WEAPONS[id].mag, s.ammo?.[id]?.mag ?? WEAPONS[id].mag), reserve: Math.min(WEAPONS[id].reserveCap, s.ammo?.[id]?.reserve ?? 0) }; }
      if (WEAPONS[s.current] && st.owned.has(s.current)) st.current = s.current;
      loaded = st.owned.size > 0;
    }
  } catch { /* fresh start */ }
  if (!loaded) for (const id of start) give(id);
  const save = () => { try { storage?.setItem(SAVE_KEY, JSON.stringify({ owned: [...st.owned], ammo: st.ammo, current: st.current })); } catch { /* ignore */ } };

  const w = () => WEAPONS[st.current];
  function startReload() {
    const a = st.ammo[st.current], W = w();
    if (st.reloading || a.mag >= W.mag || a.reserve <= 0 || st.holstered) return false;
    st.reloading = true; st.reloadT = 0; st.pumpT = 0;
    return true;
  }

  const api = {
    get state() { return st; },
    get weapon() { return w(); },
    get armed() { return !st.holstered; },
    get ammo() { return st.ammo[st.current]; },
    /** Current spread (cone half-angle) for a movement factor 0..1. */
    spread(move = 0) { const S = w().spread; return Math.min(S.max, S.base + S.move * move + st.bloom); },
    /** 0..1 progress of the current reload (null when not reloading). */
    get reloadProgress() { if (!st.reloading) return null; const W = w(); return W.perShell ? (st.reloadT % W.reload) / W.reload : Math.min(1, st.reloadT / W.reload); },
    get pumpProgress() { return st.pumpT > 0 ? 1 - st.pumpT / w().pump : null; },
    owns: (id) => st.owned.has(id),
    give(id, reserve) { give(id, reserve); save(); },
    /** Add ammo up to the cap; returns how many rounds were actually added. */
    addAmmo(id, n) { if (!st.owned.has(id)) return 0; const a = st.ammo[id], cap = WEAPONS[id].reserveCap; const add = Math.max(0, Math.min(n, cap - a.reserve)); a.reserve += add; save(); return add; },
    roomFor: (id) => (st.owned.has(id) ? WEAPONS[id].reserveCap - st.ammo[id].reserve : 0),
    /** Select by id (or slot number 1-4). Draws it if holstered. */
    select(id) {
      if (typeof id === 'number') id = ORDER[id - 1];
      if (!WEAPONS[id] || !st.owned.has(id)) return false;
      if (id !== st.current) { st.current = id; st.reloading = false; st.pumpT = 0; st.cooldown = 0.35; st.drawT = 0.35; save(); }
      if (st.holstered) { st.holstered = false; st.drawT = 0.35; st.cooldown = 0.35; }
      return true;
    },
    toggleHolster() { st.holstered = !st.holstered; st.reloading = false; st.drawT = st.holstered ? 0 : 0.35; st.cooldown = 0.35; return !st.holstered; },
    holster() { st.holstered = true; st.reloading = false; },
    reload: startReload,
    /**
     * Advance timers; returns { fired: n pellets/rays | 0, dry, reloaded, pumped }.
     * input = { trigger (held), triggerPressed (edge), reload (edge), move 0..1 }
     */
    update(dt, input) {
      st.t += dt;
      const W = w(), a = st.ammo[st.current], out = { fired: 0, dry: false, reloaded: false, pumped: false, shellIn: false };
      st.cooldown = Math.max(0, st.cooldown - dt);
      st.drawT = Math.max(0, st.drawT - dt);
      if (st.t - st.lastFire > 0.12) st.bloom = Math.max(0, st.bloom - W.spread.recover * dt); // recovers once you stop firing
      if (st.pumpT > 0) { st.pumpT -= dt; if (st.pumpT <= 0) { st.pumpT = 0; out.pumped = true; } }
      if (st.holstered) return out;
      if (input.reload) startReload();
      if (st.reloading) {
        st.reloadT += dt;
        if (W.perShell) {
          // Shell by shell; firing interrupts once at least one shell is in.
          while (st.reloadT >= W.reload && a.mag < W.mag && a.reserve > 0) { st.reloadT -= W.reload; a.mag++; a.reserve--; out.shellIn = true; }
          if (a.mag >= W.mag || a.reserve <= 0) { st.reloading = false; out.reloaded = true; st.pumpT = W.pump; save(); }
          else if (input.triggerPressed && a.mag > 0) { st.reloading = false; st.pumpT = W.pump; }
          else return out;
        } else {
          if (st.reloadT < W.reload) return out;
          const n = Math.min(W.mag - a.mag, a.reserve);
          a.mag += n; a.reserve -= n; st.reloading = false; out.reloaded = true; save();
          return out;
        }
      }
      const want = W.auto ? input.trigger : input.triggerPressed;
      if (!want || st.cooldown > 0 || st.pumpT > 0 || st.drawT > 0) return out;
      if (a.mag <= 0) {
        if (input.triggerPressed) { out.dry = true; st.dry++; st.cooldown = 0.25; }
        if (a.reserve > 0 && input.triggerPressed) startReload();
        return out;
      }
      a.mag--; st.shots++; st.lastFire = st.t;
      st.cooldown = 1 / W.rate;
      st.bloom = Math.min(W.spread.max, st.bloom + W.spread.shot);
      if (W.pump) st.pumpT = W.pump;
      out.fired = W.pellets || 1;
      if (a.mag === 0 && a.reserve > 0 && !W.perShell) { /* auto-reload on the next update after a short beat */ st.autoReload = 0.25; }
      return out;
    },
    tickAutoReload(dt) { if (st.autoReload > 0) { st.autoReload -= dt; if (st.autoReload <= 0) startReload(); } },
    save,
  };
  return api;
}
