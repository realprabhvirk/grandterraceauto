// Phase 6.2: braking + chassis stability constants (see docs/BUMPS.md).
// Root cause of the "stoppie": at speed the downforce assist (up to 9 m/s^2) compressed the
// suspension ~75 %, leaving the chassis box ~1 cm above the ground; braking nose-dive pushed its
// front lower edge into the terrain heightfield, which caught it (triangle edges) and stopped the car
// from ~40 m/s in one physics step, flipping the rear up. The centre of mass also sat 0.89 m up (it
// was given in the collider's frame, not the body's).
export const BRAKE = {
  reverseBelow: 1.5,   // m/s: S brakes above this (moving forward), never reverse throttle
  reverseDelay: 0.15,  // s S must stay held once (almost) stopped before reverse engages
  rampIn: 0.15,        // s to ramp the brake input from 0 to full
  maxDecelG: 0.8,       // target decel at full brake (g)
  steerShare: 0.3,     // friction circle: up to this share of the brake budget goes to cornering
  mu: 1.05,            // friction-circle limit per wheel: decel <= mu * g * (grounded wheels / 4)
  bias: 0.6,           // front share of the (small) wheel-brake component
  wheelBrake: 3,       // residual wheel brake (impulse) so the tyres scrub; the rest is applied at the COM
  pitchLimit: 6,       // deg nose-down: corrective torque beyond this while braking
  pitchRateLimit: 45,  // deg/s: grounded pitch rate is clamped to this
  capRate: 5,          // m/s^2: speed above the cap (boost cut) bleeds off at this rate, never one step
  downforceK: 0.012,   // downforce accel = k * v^2 (unchanged: same grip / steering at cornering speeds) ...
  downforceMax: 4.5,   // ... capped at 4.5 m/s^2 (was 9: at speed it squashed the suspension until the hull scraped)
  comY: 0.36,          // centre of mass height above the body origin (ground level), as originally intended
  chassisRound: 0.07,  // m: rounded lower hull edges (roundCuboid) so lips slide instead of catch
  chassisLift: 0.05,   // m: hull bottom raised this much above cfg.clearance
  chassisFriction: 0.2,
};
