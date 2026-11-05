// Car damage tuning (health 0-100). Tweak here.
//   A head-on crash into something solid at REF_SPEED costs REF_DAMAGE; damage scales with
//   impact speed squared, nothing below MIN_SPEED, never more than MAX_HIT from one impact.
//   One damage event per collision: the peak impact speed over a short contact window, then a
//   cooldown. Smoke (<50) / fire (<20) thresholds live in carDamage.js and are unchanged.
export const DAMAGE = {
  refSpeed: 25,        // m/s (90 km/h)
  refDamage: 10,       // health points at refSpeed
  minSpeed: 5,         // m/s - softer bumps do nothing
  maxHit: 25,          // cap for any single impact
  window: 0.12,        // s - collect the peak impact speed over this contact window
  cooldown: 0.5,       // s - after a damage event, further impacts on that car are ignored
  carVsCar: 0.5,       // multiplier when the other thing is a car (uses relative speed)
  carNear: 6.5,        // m - another car this close at impact = car-vs-car
  policeContact: 2,    // per soft-contact hit from a police car
  prop: { speed: 15, damage: 3, ref: 20 }, // a set with carDamage 20 (pole) hit at 15 m/s costs 3
};

/** Damage for an impact at speed v (m/s), times a factor. */
export function impactDamage(v, factor = 1) {
  if (v < DAMAGE.minSpeed) return 0;
  return Math.min(DAMAGE.maxHit, DAMAGE.refDamage * (v / DAMAGE.refSpeed) ** 2 * factor);
}

/** Damage for ploughing through a breakable prop (keeps each set's relative toughness). */
export function propDamage(set, v) {
  const P = DAMAGE.prop;
  return Math.min(DAMAGE.maxHit, P.damage * (Math.abs(v) / P.speed) ** 2 * ((set.carDamage ?? P.ref) / P.ref));
}
