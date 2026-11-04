// Wanted level: heat points -> 0-5 stars (thresholds 20/60/120/200/300).
// Escape: once no cop has had line of sight for 20 s (30 s at 4-5 stars) or the nearest cop
// is >200 m away, stars flash ("searching"); 10 s later the level clears.
const THRESH = [20, 60, 120, 200, 300];
export const HEAT = { theft: 25, carjack: 40, pedHit: 30, pedHitRepeat: 15, prop: 10, policeDamage: 50, ramCop: 60, footpathScare: 10 };

export function createWanted(hud) {
  const st = { heat: 0, stars: 0, unseen: 0, searching: false, searchT: 0, lastPedHit: -99, t: 0 };
  const listeners = [];
  const starsFor = (h) => THRESH.filter((x) => h >= x).length;
  return {
    get stars() { return st.stars; },
    get heat() { return st.heat; },
    get searching() { return st.searching; },
    get state() { return st; },
    onChange(f) { listeners.push(f); },
    /** Add heat for a crime. */
    add(kind, amount = HEAT[kind] || 0) {
      if (kind === 'pedHit') { amount = st.t - st.lastPedHit < 10 ? HEAT.pedHitRepeat : HEAT.pedHit; st.lastPedHit = st.t; }
      const before = st.stars;
      st.heat += amount;
      st.stars = Math.max(st.stars, starsFor(st.heat));
      st.unseen = 0; st.searching = false; st.searchT = 0;
      if (st.stars !== before) listeners.forEach((f) => f(st.stars, before, kind));
    },
    clear(silent = false) {
      const before = st.stars;
      Object.assign(st, { heat: 0, stars: 0, unseen: 0, searching: false, searchT: 0 });
      if (before && !silent) hud.message('WANTED LEVEL CLEARED', 2.5, '#9fd18b');
      listeners.forEach((f) => f(0, before, 'clear'));
    },
    /** seen: any cop has line of sight to the player; nearest: distance to the nearest cop. */
    update(dt, { seen, nearest }) {
      st.t += dt;
      if (!st.stars) return;
      const limit = st.stars >= 4 ? 30 : 20;
      if (seen && nearest < 200) { st.unseen = 0; st.searching = false; st.searchT = 0; return; }
      st.unseen += dt;
      if (st.unseen > limit || nearest > 200) {
        st.searching = true;
        st.searchT += dt;
        if (st.searchT > 10) this.clear();
      }
    },
    /** Test helper: fast-forward the escape timers. */
    fastForward(sec) { st.unseen += sec; },
  };
}
