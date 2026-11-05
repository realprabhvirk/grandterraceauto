# Bumps & braking jolts (Phase 6.2)

## Summary
1. BRAKING STOPPIE - root cause found and fixed (Step 1).
2. Reproduced in-game with `__gta.debug.carTrace()`: braking at 30-45 m/s ran at a clean ~1 g for ~0.4 s, then speed went 146 -> -1 km/h in ONE physics step (-251 g), pitch rate 208 deg/s, rear wheels lifted, pitch -33 to -55 deg.
3. Cause: the downforce assist (0.012 v^2, capped at 9 m/s^2 = almost a second gravity) compressed the suspension ~75 %, leaving the chassis box ~1 cm off the ground at speed. The braking nose-dive put its front lower edge into the terrain heightfield; the box caught a triangle edge and stopped dead.
4. The flat-box Node bench never showed it (no internal edges) - only the heightfield does.
5. Aggravating: the brake impulse acted at the tyre contact (pitch torque); S switched straight to reverse engine below 1 m/s; releasing boost at the boosted top speed cut ~4 m/s in one step (hard speed cap via setLinvel).
6. Note: the centre of mass sits ~0.9 m up (it was given in the collider's frame). Kept as-is so handling is unchanged.
7. Fix (src/vehicles/brakeConfig.js + vehicleBody.js): braking applied at the centre of mass, ramped over 0.15 s, 0.8 g target, friction-circle clamp (grounded wheels, less while steering), small residual wheel brake 60/40.
8. More of the fix: S = brake above 1.5 m/s, reverse only after 0.15 s stopped; grounded pitch-rate clamp 45 deg/s and a nose-down soft limit of 6 deg while braking; downforce capped at 4.5 m/s^2 (same curve at cornering speed); rounded, 5 cm higher hull bottom (roundCuboid, friction 0.2); speed cap bleeds off at 5 m/s^2.
9. Result: braketest 57/57 (all cars, 15-70 m/s, noise, tap, corner, S->W, S->reverse, handbrake, motorway crest; pitch < 2.3 deg, no wheel lift, decel 0.8-1.1 g, distance within 20 %); vehicle-sim 0-100 / top speed / steering unchanged.
10. Steps 2-7 NOT done yet (user asked to wrap up) - see "What is left" in PROGRESS.md.

## Evidence
- Before (runway 45 m/s): minPitch -33.6, maxRate 208, maxVy 4.5, peak decel 251 g, wheels lifted 58 steps.
- After: minPitch -0.2, maxRate 0.8, maxVy 0.14, peak decel 1.08 g, lift 0.
- Tools: `scripts/brakebench.mjs` (Node, flat box - can't show the heightfield catch), `scripts/braketest.mjs` (in game).

## Still unexplained
- drivetest "Grand Terrace" (blind autopilot weaving past traffic) failed 2 of 3 runs after the change: tilt 27 and 102 deg, speeds 185 / 601 km/h (a launch, probably on contact with a kinematic traffic car). It passed at baseline and in 3 separate probe runs, so it's intermittent; not yet known whether the new hull shape / pitch clamp makes it more likely.
