// Speeding: a FINE when something catches you. Phase 6.1: traffic cops start a pull-over pursuit
// (pullOver.js) and fine you via applyFine() once you stop; speed cameras are off by default
// (SPEEDING.CAMERAS_ENABLED). No heat, no stars. No fines while wanted,
// on foot, or in an emergency vehicle with the siren on. Cash never goes below 0 (wallet clamps).
import { SPEEDING } from './speedingConfig.js';
import { limitAt } from '../world/speedLimits.js';

export function createSpeeding({ world, controls, wallet, hud, audio }) {
  const cool = new Map();
  const st = { fines: 0, total: 0, last: null, t: 0 };
  /** Current driving state: { speedKmh, limit, street, over } or null when not driving. */
  function status() {
    const car = controls.mode === 'drive' ? controls.car : null;
    if (!car) return null;
    const p = car.position, L = limitAt(world.network.index, p.x, p.z);
    const kmh = Math.abs(car.body.state.speed) * 3.6;
    return { speedKmh: kmh, limit: L?.limit ?? null, street: L?.street ?? null, over: !!L && kmh > L.limit + SPEEDING.margin, car };
  }
  /** Why a catcher can't fine right now ('' = it can). */
  function blocked(s, id) {
    if (!s) return 'on foot';
    if ((world.wanted?.stars || 0) > 0) return 'wanted';
    if (s.car.emergency?.on) return 'siren';
    if (!s.over) return 'not speeding';
    if ((cool.get(id) ?? -1e9) > st.t) return 'cooldown';
    return '';
  }
  return {
    st, status, blocked,
    update(dt) { st.t += dt; },
    /** Start a catcher's cooldown (lost pursuit). */
    cooldown(id) { cool.set(id, st.t + SPEEDING.cooldown); },
    /** Seconds left on a catcher's cooldown (0 = ready). */
    cooling(id) { return Math.max(0, (cool.get(id) ?? -1e9) - st.t); },
    /** Pull-over completed: fine now (the player has stopped, so 'over' no longer applies). */
    applyFine(id, kind = 'pull over') {
      if ((world.wanted?.stars || 0) > 0) return false;
      cool.set(id, st.t + SPEEDING.cooldown);
      wallet.add(-SPEEDING.fine);
      st.fines++; st.total += SPEEDING.fine;
      st.last = { id, kind };
      hud.message(`SPEEDING FINE  -$${SPEEDING.fine}`, 2.5, '#ffcf4a');
      audio.ding?.(520); setTimeout(() => audio.ding?.(390), 160);
      return true;
    },
    /** A camera / traffic cop caught the player: fine if all the rules allow. Returns true if fined. */
    tryFine(id, kind = 'camera') {
      const s = status(), why = blocked(s, id);
      if (why) return false;
      cool.set(id, st.t + SPEEDING.cooldown);
      if (kind === 'camera' && !SPEEDING.CAMERAS_FINE) return false;
      wallet.add(-SPEEDING.fine);
      st.fines++; st.total += SPEEDING.fine;
      st.last = { id, kind, kmh: Math.round(s.speedKmh), limit: s.limit, street: s.street };
      hud.message(`SPEEDING FINE  -$${SPEEDING.fine}`, 2.5, '#ffcf4a');
      audio.ding?.(520); setTimeout(() => audio.ding?.(390), 160);
      return true;
    },
  };
}
