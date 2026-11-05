# Phantom crashes - notes for discussion (no code changed)

## SUMMARY FOR CLAUDE CHAT
1. Symptom: at speed, with nothing visibly in front, the player's car sometimes takes crash damage; seen at other speeds/places too, still happening after the Phase 5.2 fix.
2. Phase 5.2 (commit 291fb2a) found two causes: damage fired on any big per-step velocity jump with no contact check, and `lastVel` was stored before the car's own grip/downforce impulses and speed caps.
3. Fix: a crash now needs a real solid, non-ground contact (Rapier contact pair, |normal.y| <= 0.6, not terrain/road/curb) inside a 0.12 s window; `lastVel` is taken after our own impulses; teleports reset it.
4. Damage today: velocity jump >= 5 m/s opens a 0.12 s window -> any solid side contact in that window -> damage = 10 * (v/25)^2 (cap 25), 0.5 s cooldown (src/combat/combat.js, src/combat/damageConfig.js).
5. Phase 5.3 (9eb2682) fixed random camera shaking (render interpolation; shake only on verified crashes), which appeared after 5.2.
6. Tests: scripts/phantomtest.mjs drives 13+ routes blind at full throttle with traffic and parked cars removed; its "highway + ramps" check is a hard-coded n/a. Real play, traffic, police, bridges/ramps at speed and frame hitches are not covered.
7. Every damage event is logged with the other collider's tag, contact normal, speed and position: `__gta.debug.damageEvents()`, and the F3 overlay shows the last one.
8. Main UNTESTED hypotheses: an incidental contact (kerb-height box edge, bridge deck end, traffic car brush, barrier) is "found" during a window opened by a non-crash velocity jump; car-vs-car scaling with a nearby car; bridge/deck box edges since Phase 6.
9. The single most useful thing: the `damageEvents()` entry (tag + normal + pos + kmh) captured right after a phantom hit.
10. Nothing in this doc is implemented; the fix is deliberately deferred until after this discussion.

## 1. Symptom (as reported)
- Driving fast with nothing in front, the car sometimes takes damage from a "crash" with no visible cause.
- It also happens at other speeds and in other places.
- It is still happening after the Phase 5.2 phantom-crash fix.
- Context: random camera shaking appeared after the 5.2 fix; Phase 5.3 addressed the shaking (render interpolation, crash-only shake). Whether the shaking and the phantom damage share a cause is unverified.

## 2. History (commits touching damage / physics / collisions)
| Commit | Phase | What changed |
| --- | --- | --- |
| f15fcdd | 1 step 6 | Physics module (Rapier), third-person walk. |
| 6cc2768 | 2 step 1 | Physics module, collision groups, F4 collider view. |
| 41b6d9a | 2 step 2 | Procedural cars + raycast-vehicle physics (src/vehicles/vehicleBody.js). |
| 2b07432 | 4 step 3 | Health, cash, car damage, breakables, knockdowns (first damage model: velocity-jump based). |
| eb72ff7 | 5 step 1 | Car damage rules, burning wrecks, police soft contact. |
| 978798c | 5.1 step 1 | Damage retune: src/combat/damageConfig.js; speed^2 curve, 25 m/s head-on = 10, <5 m/s ignored, cap 25, one event per collision (0.12 s peak window + 0.5 s cooldown), car-vs-car half damage on relative speed, police contact 2, props retuned. |
| 291fb2a | 5.2 step 1 | Phantom-crash fix: contact-verified crash damage, post-impulse `lastVel`, teleport resets it, collider owner/type tags (src/physics/physicsWorld.js), damage + ignored-impact ring buffers, F3 damage line, scripts/phantomtest.mjs. Files: combat.js, vehicleBody.js, physicsWorld.js, breakables.js, policeCar.js, trafficCar.js, pedestrians.js, debugApi.js, main.js. |
| af6f46b | 5.2 step 3 | Breakable prop hits written to the damage log too. |
| 9eb2682 | 5.3 step 1 | Shaking fix: render interpolation (physics.alpha; car.js, thirdPerson.js, vehicleManager.js), camera shake only from verified crashes (`crashShake`) and police contact, eased camera pull-in, jitter monitor (src/utils/jitterMonitor.js), scripts/shaketest.mjs. |
| 920ae4e | 5.3 step 2 | Sleeping/just-teleported cars report the raw body position (stale interpolated position fix). |
| 8508894 | 6 step 4 | Terrace Motorway: new static colliders (median barrier 'barrier', bridge decks 'bridge' extended 3 m into the embankments, railings, abutments tucked under the decks, piers); `terrain.driveHeight()` for AI. |
| cb1a553, afe9977, 37ab857, 9bd5a26 | 6 steps 3, 5, 6a, 6b | New static colliders near roads: street-sign / limit-sign breakables, speed-camera poles ('camera'), radar-post patrol cars ('traffic cop'), shop shells, traffic-light poles ('traffic light'), landmarks ('landmark'). Ghost scans run after each (phantomtest scan, phase5test signs). |

## 3. The 5.2 root causes as logged, the fix, and test coverage
Logged root causes (PROGRESS.md, Phase 5.2, from the damage log + ignored-impact log):
1. Crash damage fired on any big per-step velocity change with no contact check, so crest landings, dips and suspension bottoming counted as crashes.
2. vehicleBody stored `lastVel` before its own grip/downforce impulses and the speed caps. A boost cut drops ~7 m/s in one step, so self-applied velocity changes showed up as impacts the next step. Teleports also read as huge impacts.

What the fix changed:
- src/vehicles/vehicleBody.js: `lastVel` is taken from `body.linvel()` after our own impulses and the hard speed cap. `impactDv` keeps the peak dv since combat last read it. Teleport zeroes `lastVel` and `impactDv`.
- src/combat/combat.js: `solidContact(c)` walks Rapier `contactPairsWith` for every car collider:
  - Contacts tagged terrain/road/curb are ignored (reason "ground").
  - Contacts with |normal.y| > 0.6 are ignored (reason "upward normal").
  - The first remaining contact is taken as the crash.
  - A window with no such contact is logged to `ignoredLog`, not damaged.
- src/physics/physicsWorld.js: every collider gets `{type, owner}` via `tag()` / `tagOf()`.
- Constants (src/combat/damageConfig.js, unchanged since 5.1): minSpeed 5 m/s, window 0.12 s, cooldown 0.5 s, refSpeed 25 / refDamage 10, maxHit 25, carVsCar 0.5, carNear 6.5 m, policeContact 2.

What scripts/phantomtest.mjs asserts:
- `runs`: blind autopilot at full throttle + boost on Grand Terrace (22 m/s), the 3 cul-de-sacs inbound (24 m/s), Terrace Link, the ring road ×4, Terrace Pde + Downtown, Northgate Rd, King St, Wharf Rd (70 m/s target). Asserts zero damage events except logged breakable-prop hits. Parked cars are moved away and traffic removed first (DECISIONS P5.2).
- `scan`: a car-sized box swept along every lane centreline finds no static collider in the driving corridor.
- `speed`: the flat-straight top speed is within 5% of the configured top speed.
- `regress`: a 25 m/s wall costs 8-12, a pole breaks, and parked cars and traffic still hurt.
- `highway + ramps`: hard-coded pass ("n/a - the highway was skipped in Phase 5"). It was never updated after the Phase 6 motorway was built. The motorway is only driven by `phase5test highway`, where the autopilot spins at ~170 km/h and rolls on the east ramp (no damage logged; see PROGRESS Phase 6 step 4).

NOT covered by any test:
- Real human input (steering corrections, handbrake, kerb-riding, weaving).
- Rare events (one-in-minutes).
- Driving with traffic, parked cars, police or pedestrians present.
- Beach / promenade roads, the Grand Terrace suburb streets at highway speed, bridge decks and their ends at full speed in both directions, ramps at speed.
- Chunk visibility changes. Colliders are not streamed; only meshes hide (unverified for every module).
- Frame hitches: physics catches up up to 5 steps per frame (`acc` capped at 5/60 s); the tests run at a steady 60 fps headless.
- Different car types (the tests use the sedan), all camera modes during real crashes, and boost toggling mid-corner.

## 4. Current damage pipeline (today)
1. **Physics step** (fixed 1/60 s, src/physics/physicsWorld.js `step`): up to 5 catch-up steps per frame.
2. **Velocity jump** (src/vehicles/vehicleBody.js ~L220): after its own impulses, the car computes dv = |v − lastVel|, keeps the peak in `impactDv`, and sets `impact` (sound) for dv > 2.2.
3. **Open a window** (src/combat/combat.js ~L118-160, per car, per frame): the frame reads and clears `impactDv`. If dv >= 5 m/s, no window is open and the cooldown has expired, a window opens:
   - It looks for another car within 6.5 m. If one is found, the event is car-vs-car, using relative pre-impact velocity clamped to <= 2× the measured jump, at 0.5× damage.
4. **During the 0.12 s window**: the peak dv is tracked, and `solidContact()` is polled until it returns a contact.
5. **Close the window**:
   - No contact → `ignoredLog` entry (reason string), no damage.
   - Contact → damage = `impactDamage(speed)` = min(25, 10·(v/25)²) (×0.5 car-vs-car) via `damageCar()` (src/combat/carDamage.js). It is logged to `damageLog`, triggers crash audio, and sets `crashShake` (cabin cam) and chase-cam shake. A 0.5 s cooldown follows, and grinding (dv >= 2.5) keeps extending it.
6. **Breakables** (same file): props hit by a moving car (hitTest) cost `propDamage()`, are logged with tag `breakable:<set>`, and slow the car to 82%.
7. **Police** soft contact: src/police/policeManager.js applies `policeContact` damage (2) and its own `crashShake`.
8. **Static collider tags** in use: building (default), terrain, road, curb, barrier, bridge, breakable, camera, traffic cop, traffic light, landmark, car, traffic, ped, plus police cars. Only terrain/road/curb are treated as ground.

## 5. Debug tools that already exist
- **F3 overlay**: last line shows `combat.lastDamageText()` → `DMG <hp>% <type:owner> n=(nx,ny,nz) at <km/h> km/h` (or `DMG none`). `?hud` in the URL turns the overlay on at start.
- **Debug API** (browser console):
  - `__gta.debug.damageEvents()`: last 30 damage events: `{ t, car, player, dmg, speed, dv, kmh, normal:[x,y,z], tag:'type:owner', pos:[x,y,z] }`.
  - `__gta.debug.ignoredImpacts()`: last 30 velocity jumps that were not crashes: `{ t, car, dv, kmh, reason, pos }`.
  - `__gta.combat.damageLog` / `.ignoredLog`: the same arrays, live.
  - `__gta.jitter`: camera jitter monitor (Phase 5.3).
  - F4: show physics colliders.
- **Tests**:
  - `.\dev.cmd node scripts/phantomtest.mjs` (all) or `... phantomtest.mjs runs | scan | speed | regress`.
  - `.\dev.cmd node scripts/shaketest.mjs`.
  - `.\dev.cmd node scripts/phase5test.mjs damage highway`.

## 6. Hypotheses (ALL UNTESTED, nothing implemented)
| # | Hypothesis | Confirms it | Rules it out |
| --- | --- | --- | --- |
| H1 | A non-crash velocity jump (crest, bump, landing, boost on/off, suspension) opens the window, and an incidental contact elsewhere (low box edge, kerb-height static, sign base) is found within 0.12 s and taken as the cause. | Phantom `damageEvents()` entries whose `tag` is a static object beside the road, with a small or odd normal and `dv` barely over 5. | Phantom events always tagged with something genuinely hit. |
| H2 | Bridge deck boxes ('bridge', extended 3 m into the embankment) present a side/end face at the deck ends, and a contact there has |ny| <= 0.6. | Events tagged `bridge:deck ...` near x≈420 / 790, z≈-252. | No events near the bridges. |
| H3 | Car-vs-car mis-attribution: a traffic or parked car within 6.5 m at the moment of a non-crash jump makes the event car-vs-car, using relative speed (up to 2× the jump). | Events with tag `car:` / `traffic:` while nothing touched; relative-speed sized damage. | No car tags in phantom events. |
| H4 | Frame hitch: several physics steps in one frame (catch-up) produce a large dv against kinematic traffic/police colliders that teleport-step (kinematic next-position). | Phantoms correlated with stutters / `physics.lastSteps` > 1, or near traffic. | Phantoms at steady frame rate with no traffic nearby. |
| H5 | A collider exists where nothing is drawn (an invisible/hidden collider, or a mesh hidden by chunk culling while its collider stays). | `tag` points at an object that is not visible at `pos`; F4 shows a box there. | Every tagged object is visible at the logged position. |
| H6 | Breakable props hit at speed (signs, poles, bins) feel like "nothing in front" because they snap away instantly. | Events tagged `breakable:*`. | No breakable tags. |
| H7 | Police soft-contact damage (2 per hit) from a car behind/beside the player that the player doesn't see. | Damage while wanted with no damageLog entry (unverified whether police damage is logged); police car close behind. | Phantoms at 0 stars. |

## 7. What to write down when it happens (template)
```
When:        (time, how long into the session)
Where:       street / district (HUD street chip), approx position if F3 on
Speed:       km/h (and limit), accelerating / braking / coasting
Car:         type (sedan, hatch, ute, 4WD, police, taxi...)
Camera:      chase / cabin / first person / cinematic
Boost:       on / off / just released
F3 line:     DMG ...% <tag> n=(...) at ... km/h        <- copy exactly
Console:     __gta.debug.damageEvents().slice(-3)       <- paste the JSON
             __gta.debug.ignoredImpacts().slice(-3)
Nearby:      parked cars / traffic / police / pedestrians / signs / bridge / ramp / kerb
Wanted:      stars (0-5), police close?
Timing:      just after entering a district, a hill crest, a bridge, a stutter/hitch?
Repeatable:  does it happen again at the same spot and speed?
```

## 8. Open questions and candidate next steps (NOT implemented)
Open questions:
- Do the phantom events carry a tag at all, and which one? This is the key fact the existing logs already capture.
- Is the damage from `damageLog` (the crash path), from `breakable:*`, or from police contact (whether police contact damage reaches `damageLog` is unverified)?
- Does it happen with traffic disabled? Only in some cars? Only with boost?

Candidate next steps:
1. Ask for 3-5 real `damageEvents()` dumps from play sessions.
2. Re-enable a real highway/bridge/ramp route in phantomtest (replace the hard-coded n/a) and add runs with traffic and parked cars present.
3. Require the contact normal to oppose the car's velocity (a real frontal/side hit) and/or a minimum contact depth.
4. Measure dv per physics step rather than per frame, so catch-up steps don't merge.
5. Log police contact damage into `damageLog` too, so all damage sources are visible.
6. Replace the bridge deck boxes with sloped/ramped colliders or tag them as ground.
7. Add a "phantom replay" recorder: the last 3 s of car state for each damage event.

## Observations logged after this note was written (no code changed)
- 2026-11-05, Phase 6.1 wrap-up suite: `phase5test highway` westbound full-throttle run logged **1 damage event** (health 100 -> 93.8, max tilt 27.5) where earlier runs were clean. The test output doesn't print the event's tag/normal, so the cause is **unverified** - a candidate for `__gta.debug.damageEvents()` capture next time (bridge deck ends / barrier? see H1/H2).

See also docs/BUMPS.md (Phase 6.2): the braking stoppie root cause - the hull scraping the terrain heightfield at speed - is a likely contributor to the 'bumps from nowhere' too.
