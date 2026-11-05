// Crimes only count if somebody SAW them. Every crime (car theft, carjack, hitting people,
// breaking street furniture, gunfire, shooting people, ramming cops...) goes through report().
//   Witness = any conscious NPC: pedestrians (incl. cops / paramedics / workers on foot), police
//   officers and patrol-car drivers, traffic drivers, shop staff. A civilian needs to be within
//   30 m, have line of sight from their head to the crime (walls block it) AND have the crime
//   inside their ~140 deg facing cone; within 5 m the facing doesn't matter. Cops: same, 60 m.
//   A witnessed crime is reported after a 1.5 s reaction (the witness looks startled); if every
//   witness is knocked out / killed during that delay, the report is cancelled.
import { groups, GROUP } from '../physics/physicsWorld.js';

export const WITNESS = { civRange: 30, copRange: 60, near: 5, cone: 140, delay: 1.5, eye: 1.6, target: 1.0 };
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);

export function createCrimeWitness({ physics, world, peds, police, traffic, wanted }) {
  const pending = [];
  const st = { reported: 0, cancelled: 0, unwitnessed: 0, forceWitness: false, last: null };
  const cosHalf = Math.cos((WITNESS.cone / 2) * Math.PI / 180);

  function los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
    if (d < 0.5) return true;
    const hit = physics.world.castRay(new physics.RAPIER.Ray(a, { x: dx / d, y: dy / d, z: dz / d }), d, true, undefined, STATIC_ONLY);
    return !hit || hit.timeOfImpact > d - 0.6;
  }

  /** Everyone who could be a witness: { kind, ref, x, y (eye), z, yaw, cop, alive() }. */
  function candidates() {
    const out = [];
    for (const p of peds.peds) {
      if (p.gone) continue;
      out.push({ kind: 'ped', ref: p, x: p.pos.x, y: p.pos.y + WITNESS.eye * (p.scale || 1), z: p.pos.z, yaw: p.yaw, cop: p.role === 'cop', alive: () => p.state !== 'down' && p.state !== 'dead' && !p.gone });
    }
    for (const o of police.foot.officers) {
      if (o.cutscene) continue;
      out.push({ kind: 'officer', ref: o, x: o.pos.x, y: o.pos.y + WITNESS.eye, z: o.pos.z, yaw: o.yaw, cop: true, alive: () => o.state !== 'dead' });
    }
    for (const c of police.cars) out.push({ kind: 'copcar', ref: c, x: c.pos.x, y: c.pos.y + 1.25, z: c.pos.z, yaw: Math.atan2(c.fwd.x, c.fwd.z), cop: true, alive: () => !c.dead && c.group.visible });
    for (const t of traffic.cars) out.push({ kind: 'driver', ref: t, x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z, yaw: Math.atan2(t.fwd.x, t.fwd.z), cop: false, alive: () => !t.dead && traffic.cars.includes(t) });
    for (const s of world.town?.interiors?.people || []) {
      const r = s.ch.root, wp = r.getWorldPosition ? r.position : null;
      if (!wp || !r.visible) continue;
      out.push({ kind: 'staff', ref: s, x: wp.x, y: wp.y + WITNESS.eye, z: wp.z, yaw: r.rotation.y, cop: false, alive: () => true });
    }
    return out;
  }

  /** Who sees a crime at pos (target height ~1 m above it, e.g. the player or the car). */
  function getWitnesses(pos, { targetY = WITNESS.target, exclude = null } = {}) {
    const target = { x: pos.x, y: (pos.y ?? 0) + targetY, z: pos.z };
    const out = [];
    for (const w of candidates()) {
      if (w.ref === exclude || !w.alive()) continue;
      const dx = target.x - w.x, dz = target.z - w.z, d = Math.hypot(dx, dz);
      if (d > (w.cop ? WITNESS.copRange : WITNESS.civRange)) continue;
      if (d > WITNESS.near) {
        const f = (dx * Math.sin(w.yaw) + dz * Math.cos(w.yaw)) / (d || 1);
        if (f < cosHalf) continue; // outside the facing cone
      }
      if (!los({ x: w.x, y: w.y, z: w.z }, target)) continue;
      out.push({ kind: w.kind, cop: w.cop, ref: w.ref, dist: +d.toFixed(1), alive: w.alive });
    }
    return out;
  }

  function startle(ws) {
    for (const w of ws) {
      if (w.kind === 'ped') { w.ref.startled = WITNESS.delay; w.ref.action = null; }
      else if (w.kind === 'officer') w.ref.startledT = WITNESS.delay;
    }
  }

  /**
   * Report a crime. opts: { amount, targetY, victim: { ref, alive } who always witnesses (carjack
   * victim, a cop you rammed, a person you shot who survived), exclude, alwaysKnown + minStars
   * (bypass the witness system: hitting a police officer = 5 stars at once) }.
   * Returns the number of witnesses (0 = nobody saw it: no heat, no report).
   */
  function report(kind, pos, opts = {}) {
    // Flagged exceptions (shooting a police officer): known at once - no witness, no delay.
    if (opts.alwaysKnown) {
      st.last = { kind, witnesses: 'always' }; st.reported++;
      wanted.add(kind, opts.amount);
      if (opts.minStars) wanted.raiseTo(opts.minStars, kind);
      return Infinity;
    }
    let ws = getWitnesses(pos, opts);
    if (opts.victim && opts.victim.alive()) ws.push({ kind: 'victim', ref: opts.victim.ref, alive: opts.victim.alive });
    if (st.forceWitness && !ws.length) ws = [{ kind: 'test', alive: () => true }];
    st.last = { kind, witnesses: ws.length };
    if (!ws.length) { st.unwitnessed++; return 0; }
    startle(ws);
    pending.push({ kind, amount: opts.amount, t: WITNESS.delay, ws });
    return ws.length;
  }

  return {
    st, pending, getWitnesses, report,
    /** Quick yes/no (anyone at all sees pos right now). */
    isWitnessed: (pos, opts) => getWitnesses(pos, opts).length > 0,
    update(dt) {
      for (const p of [...pending]) {
        p.ws = p.ws.filter((w) => w.alive());
        if (!p.ws.length) { pending.splice(pending.indexOf(p), 1); st.cancelled++; continue; }
        p.t -= dt;
        if (p.t <= 0) { pending.splice(pending.indexOf(p), 1); st.reported++; wanted.add(p.kind, p.amount); }
      }
    },
    /** Death / bust: forget anything still pending. */
    clear() { pending.length = 0; },
  };
}
