# MASTER PLAN (the owner's full task queue for Codex)

## EXECUTION RULES
- Do the tasks IN ORDER. Don't start a task until the previous one has passed its acceptance checklist with
  evidence, is committed and pushed on codex-work, and its row below is updated.
- Before each task: re-read its section here, write docs/tasks/<id>.md (read, plan, sub-tasks), commit it.
- If a task needs something only the owner can provide (a missing file, a permission), don't stop the whole
  queue: write the blocker in docs/tasks/<id>.md and PROGRESS.md, mark the row BLOCKED, move on, come back at
  the end.
- If you are running low on context or usage: finish the current sub-task, commit, push, and write the exact
  next step in the Status table "notes" column and PROGRESS.md. The owner will tell you to continue and you
  must resume from the table.
- Per-task screenshot limits are given in each task. Outside those limits take no screenshots.
- Claude Code's own unfinished work must be reused, not redone: check git status / PROGRESS.md / docs/ for
  partial work (e.g. brakeConfig.js, bumpRecorder.js, docs/BUMPS.md, boosttest) and build on it.

## STATUS (update after every task)
| Task | Name | State | Notes |
| --- | --- | --- | --- |
| 000 | Handoff triage | DONE | Audit and single-run evidence in docs/tasks/000-handoff.md. Phantom wall regression remains queued in 003; no game fixes claimed. |
| 010 | Music player (T) | IN PROGRESS | Phase A, M1 and M2 complete; next M3 responsive UI and isolated layout/input tests, then M4 keys/M5 integration. See docs/tasks/010-music.md. |
| 002 | Braking stoppie | TODO | |
| 003 | Phantom bumps at speed | TODO | |
| 001 | Boost rockets + cabin boost | TODO | |
| L1 | Test reliability and cul-de-sac completion | TODO | After 001, before 004: stalled routes and bus/district/shake timing evidence; see 000 report. |
| L2 | Pull-over pursuit obstacle avoidance and return | TODO | After L1, before 004: breadcrumb corner cutting and visible return-to-post pop. |
| L3 | Airport pushback tug and apron vehicle solidity | TODO | After L2, before 004: preserve existing operations, add missing support-vehicle polish. |
| 004 | World fill (farms, industries, military base, busier world) | TODO | After L1-L3. Include deferred house/infill variety and assess laneways in WORLD_PLAN. |

---
## TASK 000: HANDOFF TRIAGE (read-only: no game code changes)
Claude Code was stopped mid-run and told to write wrap-up notes of what is unfinished.
1. git status, git log -15 --stat --oneline, git stash list, git diff --stat (after the snapshot commit).
2. Read PROGRESS.md STATUS block and everything after "PHASE 6.1 SUMMARY" (look for IN PROGRESS, TODO,
   "needs to be done", wrap-up notes), DECISIONS.md tail, anything new under docs/, and any scripts/*.mjs or
   src files not described in README.md.
3. For every unfinished item: what was intended, what exists, what's half-done or broken, what's missing
   (evidence from code and from running the relevant test singly).
4. Start your own dev server and run singly: walktest, phase2test, drivetest, phantomtest. Record results.
5. Write docs/tasks/000-handoff.md: a 10-line summary at the top; a table (item | state | evidence | risk |
   action); the snapshot commit's contents; test results.
6. Update this plan: fold each leftover into the matching task (braking -> 002, bumps -> 003, boost -> 001,
   music -> 010) by adding a "Leftover from Claude:" note under that task; add everything else as rows L1, L2...
   (to be executed right before Task 004). Commit and push. Then CONTINUE to Task 010.

---
## TASK 010: MUSIC PLAYER (T key) - do this BEFORE everything else below
Leftover from Claude: no partial player/index/UI/test exists. The three MP3s were the only untracked handoff
files, preserved untouched in e1b9553 after unauthenticated GitHub API returned 404 (private by owner's rule).
Bexley .Road - Baggh-E SMG.mp3 needs canonical Bexley. Road / SMG metadata; Kaali filename omits feat. Bohemia.
GOAL: a small in-game music player. T shows/hides a compact popup at the side of the screen. It stays visible
while driving and never blocks the view; I can skip, rewind, pause/play, seek and change volume (keyboard
shortcuts also work while the mouse is captured while driving). Songs in the folder "Car Music":
  1. Kaali Hoodie - Sidhu Moose Wala feat. Bohemia
  2. GTA Mohali - Sultaan
  3. Bexley. Road - SMG
(Title - Artist; note the dot in "Bexley. Road".) No album art: draw a small generated placeholder cover in the
palette. KEY CHANGE: T currently toggles emergency lights + siren in stolen police cars/ambulances. T becomes
the music player; lights + siren move to Y. Update code, controls panel, README and every test pressing T.

PHASE A (no code changes; write docs/tasks/010-music.md, commit)
- Find "Car Music/" (project root first). If you can't read it, mark BLOCKED (owner moves it into the
  project folder) and continue the queue.
- List the files (names, extensions, sizes), check formats play in Edge/Chrome, note odd filenames (spaces,
  dots) and encode URLs properly.
- REPO VISIBILITY CHECK: the owner says the repo is private and is fine committing the songs. Verify with an
  unauthenticated request, e.g. PowerShell: try { (Invoke-WebRequest -UseBasicParsing
  https://api.github.com/repos/realprabhvirk/grandterraceauto).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }.
  200 means PUBLIC. 404 means private. A network error means unknown. Record the result in the doc.
  PRIVATE -> you may commit "Car Music/" (the source files). PUBLIC or UNKNOWN -> do NOT commit any audio:
  add "Car Music/" to .gitignore, keep working locally, and tell the owner in the report to make the repo
  private (GitHub > repo Settings > General > Danger Zone > Change visibility) before committing them. Either
  way "public/music/" (the generated served copy) is always gitignored.
- Read how input works (src/player/input.js, pointer lock, key bindings, how the gun fires on click, how
  menus/shop/full map capture input), the audio system (carAudio, ambience, master volume, mute M, settings
  panel), vehicle enter/exit events, camera modes, cutscenes, pause behaviour, and the whole HUD layout
  (statusHud, hud speed + limit sign + street chip, minimap, weaponHud, prompt, wanted stars, PULL OVER banner,
  cash, shop menus, toasts, controlsPanel). Record the screen rectangle of each element at 960x540,
  1280x720 and 1920x1080. grep every use of the T key (code, README, controlsPanel, scripts/*.mjs).
PHASE B
M1. scripts/musicIndex.mjs (+ npm script "music"): scans "Car Music/", copies audio to public/music/, writes
    public/music/playlist.json {file,title,artist}. Parse "Title - Artist" from filenames with this fallback
    table: Kaali Hoodie / Sidhu Moose Wala feat. Bohemia; GTA Mohali / Sultaan; Bexley. Road / SMG. Unknown
    files fall back to the filename. Handles an empty/missing folder. Run it. Apply the visibility decision.
M2. src/audio/musicPlayer.js (no UI): one HTMLAudioElement, playlist from /music/playlist.json, play/pause/
    seek/volume, next on ended, shuffle, repeat (off/all/one), previous = restart if >3 s in else previous
    track, rewind/forward = -/+10 s. Starts only after a user gesture. Failed tracks are skipped with a toast.
    Volume = own volume x the game's master volume; M mutes music too. Persist volume, track, shuffle, repeat,
    car-only and visibility in localStorage. src/audio/musicConfig.js: CAR_ONLY (default true: plays while
    driving, fades out ~0.5 s on exit, resumes on re-entry if it was playing), duck -60% during cutscenes.
M3. src/ui/musicPlayerUi.js: compact glass card ~280x90 px in the palette: placeholder cover, title, artist,
    elapsed/total, seek bar, previous, -10 s, play/pause, +10 s, next, volume slider + mute icon, shuffle,
    repeat, "car only" toggle, track n/N, optional expand to the track list. Place it in a free side zone from
    your HUD analysis: no overlap with any protected HUD rectangle, outside the central view (middle 60% of the
    width and 25-75% of the height), the same zone at all 3 resolutions. pointer-events none while the pointer is
    locked, clickable when the cursor is free; clicks on it NEVER fire the gun or any game input. Opacity ~0.85,
    fading to ~0.45 after ~4 s idle while driving. Hidden in the cinematic camera (tiny "now playing" toast only)
    and during KO/busted cutscenes. A "now playing" toast on each track change (~3 s) even when the card is
    hidden. No per-frame DOM work (progress ~4 Hz, text only when it changes).
M4. KEYS: T show/hide the card (music keeps playing). Shortcuts that work while the mouse is captured and no
    menu has focus: / play-pause, , previous, . next, [ rewind 10 s, ] forward 10 s, - and = volume. If any
    conflicts with an existing key pick another and document it. Y = lights + siren. Update controls panel +
    README.
M5. Integration: on foot, every car/camera mode, cinematic, full map open (game pauses, music keeps playing),
    teleports, vehicle switches, destroyed/burning cars, page reload (state restored, no autoplay until a
    gesture), cutscene ducking.
M6. scripts/musictest.mjs (headless Edge, one browser, autoplay allowed by launch flag): playlist has 3
    correct tracks and handles an empty folder; T toggles; each shortcut changes the right state (previous
    rule, +-10 s, volume clamp); shuffle/repeat; car-only pause/resume; master volume + mute; the card never
    overlaps protected HUD rectangles or the central area at the 3 resolutions (bounding boxes); clicks on it
    don't fire the gun; Y toggles the siren and T doesn't; audio-in-git matches the visibility decision; fps and
    draw calls unchanged. Then run singly and read: walktest, phase2test, phase4test cameras + police,
    phase5test steal pov cabin zoom map copstars, shaketest. Fix tests that pressed T for the siren.
M7. SCREENSHOTS (max 3, 1280x720, shots/music/, gitignored): driving with the card visible; expanded card with
    the cursor free; cabin view with the card. If you can view images, check it doesn't block the road or other
    HUD (fix once); if you can't, say so.
M8. README (T + shortcuts, how to add songs: drop files in Car Music/ and run `.\dev.cmd npm run music`,
    siren on Y), PROGRESS.md CODEX LOG, DECISIONS.md lines. Commit + push.
ACCEPTANCE: [ ] 3 songs play with right title/artist, generated cover [ ] T toggles; card never covers the road or
other HUD at 3 resolutions [ ] skip/previous/-10/+10/play-pause/seek/volume/shuffle/repeat work by keyboard
while driving and mouse when the cursor is free [ ] car-only, ducking, M mute, master volume [ ] siren on Y
everywhere [ ] audio-in-git follows the visibility check [ ] musictest + regressions pass [ ] pushed.

---
## TASK 002: BRAKING STOPPIE
Leftover from Claude: e074296 already implements brakeConfig.js, COM braking, delayed reverse, raised rounded
hull, capped downforce, smoothed speed cap and carTrace; brakebench/braketest exist. Triage braketest passes
57/57 with bench within 5%, but caps requested 60/70 m/s to 45-52 m/s, omits noise at some speeds and reports
Boolean lift, not centimetres. S+handbrake reaches 1.50-1.67 g. Trace allocates every step and omits COM brake
force. Reuse and extend this work; see docs/tasks/000-handoff.md for measured numbers and test gaps.
SYMPTOM: at speed, pressing S makes the car jolt, the nose dives and the rear flies up (a stoppie), sometimes
flipping. The most reproducible bug. Arcade handling must stay: hard to flip, no launches. Leftover from Claude:
check for partial work first.
A. Instrument (ring buffer of the last 3 s via debug API `__gta.debug.carTrace()`): pitch, pitch rate, vertical
   velocity, per-wheel suspension compression/lift, longitudinal accel in g, jerk, engine force, brake force,
   handbrake, boost, and how S is interpreted (brake vs reverse throttle).
B. Reproduce headless for EVERY car type: accelerate to 15/30/45/60/70 m/s (also from boost) on a flat straight,
   hold S to a stop; also tap S, S while turning, S then W, S held through the brake->reverse transition, S on
   crests/dips/ramps, S + handbrake, with small input noise. Print max nose-down pitch, pitch rate, wheel lift,
   peak vertical velocity, peak decel.
C. Check in src/vehicles/vehicleBody.js + tuning: (1) S applying brake AND reverse force together, or reverse
   engaging while rolling forward; (2) brake force too high/instant at the tyre contact (below the CoM), not
   limited by tyre load x friction; (3) CoM too high / pitch inertia too low; (4) suspension stiffness/damping/
   travel letting the nose dive, bottom out and rebound-launch; (5) brake bias, no ABS-like limit, rear
   unloading; (6) interaction with the speed cap, downforce and anti-roll impulses; (7) handbrake/boost-cut
   impulses firing while braking.
D. Fix (constants in src/vehicles/brakeConfig.js): S = brake while moving forward faster than ~1.5 m/s, never
   reverse throttle; reverse only once almost stopped (<1.5 m/s) with S still held (~0.15 s delay). Ramp brake
   input in over ~0.15 s. Max braking ~0.9-1.1 g, clamped by a per-wheel friction-circle limit, bias ~60/40.
   Anti-dive/squat (counter pitch torque or apply brake force at CoM height): soft-limit braking pitch to ~6
   degrees nose-down, clamp pitch rate, more damping/bump stops so there's no rebound launch. Smooth the boost
   cut and speed cap over several steps so they never create a single-step jolt. Acceleration, top speed,
   steering and drift feel unchanged.
E. scripts/braketest.mjs, every car type at 15/30/45/60/70 m/s, with and without noise, with traffic and
   parked cars present: holding S to a stop -> peak nose-down pitch <= 6 deg, no wheel lifted > 5 cm for > 3
   steps, peak vertical velocity < 1.0 m/s, peak decel 0.3-1.1 g, jerk under a limit, stopping distance within
   +-20% of v^2/(2a), no flip; smooth brake->reverse; tap-S spam doesn't accumulate; braking in a corner doesn't
   spin the car; grounded on crests/dips/ramps; regression: vehicle-sim bench (0-100, top speed, steering)
   unchanged.
F. Log root cause(s) + fix in docs/BUMPS.md (create or extend) and DECISIONS.md. Commit + push.
ACCEPTANCE: [ ] no stoppie in any test, all car types [ ] bench numbers unchanged [ ] braketest passes
[ ] phantomtest, shaketest, phase2test still pass [ ] pushed.

---
## TASK 003: PHANTOM BUMPS AT SPEED
Leftover from Claude: docs/BUMPS.md exists, but bumpRecorder, bumpLimiter and bumptest do not. Keep the
reported traffic launches open despite one clean triage run. phantomtest still hard-codes motorway n/a;
phase5 highway filters breakable damage (triage ramp health <100 despite its PASS). Triage also found wall
damage 0 in both phantomtest all and regress, while handoffCrashProbe recorded 11.16 against door:tcDoor.
Investigate the intermittent real-crash failure without changing damage rules; preserve the probe and logs.
CONTEXT: read docs/PHANTOM_CRASHES.md. Since the contact-verified damage filter (5.2) fast driving no longer
causes damage, but the car still gets a huge physical bump with nothing in front. The filter only hides the
symptom: the physics delivers a bad impulse that gets classified 'ground'/'upward normal' (see
__gta.debug.ignoredImpacts()). Don't change the damage rules (25 m/s head-on into a wall = 8-12%, poles break,
etc.). Leftover from Claude: check for partial work (bumpRecorder.js, docs/BUMPS.md) first. Do it AFTER task
002 (braking may explain some bumps; re-measure).
A. src/utils/bumpRecorder.js, always on, cheap: record a bump on any physics step where the velocity change
   not explained by our own impulses is >= 3 m/s, OR vertical velocity spikes >= 3 m/s, OR angular velocity
   spikes. For each: time, car type, position, km/h, delta-v, driver inputs, ALL contact pairs (tag/type/
   owner, normal, depth), per-wheel ray hit distance + collider tag + compression, chassis clearance, airborne
   in the last 0.5 s, physics vs visual ground height, slope, colliders within 5 m (tag, has visible mesh),
   the last 3 s of car state at 20 Hz. Keep the last 20. `__gta.debug.bumps()`; F3 shows the last bump line;
   F5 copies the latest bump JSON to the clipboard and auto-downloads bump-<time>.json (max 1 per 20 s, 10 per
   session). Also write the entry into the damage/ignored logs.
B. Offline investigation, findings in docs/BUMPS.md (commit + push BEFORE fixing):
   (1) ground continuity scan against the PHYSICS world across the FULL road width incl. shoulders and kerb
   edges (every 0.5 m across, 1 m along) on every road (suburb, cul-de-sacs, town grid, ring road, downtown,
   beach, Northgate, industrial, motorway + ramps + overpass, airport roads, junction fillets, turning
   circles): flag steps > 2 cm, slope change > 4 deg within 2 m, missing ground, physics-vs-visual height
   disagreement > 2 cm; report the worst 30 spots; (2) chassis sweep at lateral offsets -2,-1,0,+1,+2 m at 20/
   40/60 m/s on flat ground, flag any chassis contact with static colliders incl. 'ground'-tagged ones;
   (3) crest/dip/bottoming: the 10 sharpest on the map per car type at 30/45/60/75 m/s; log max compression,
   chassis-ground contact, airborne time, max delta-v Y, pitch/roll; (4) tunnelling/CCD: check Rapier
   settings (step rate, solver iterations, CCD on the car body, sub-steps); test clipping into thin colliders
   at 60-75 m/s; try CCD and 2 sub-steps and measure cost; (5) human-like input noise (weaving, brake taps,
   handbrake taps, kerb-riding, boost on/off mid-corner), all car types, WITH traffic and parked cars;
   (6) categorise every bump: seam/lip, chassis catch, bottoming, tunnelling, braking pitch, kinematic car
   contact, other.
C. Fix root causes: flush/overlapping road, junction, bridge and ramp colliders (physics ground within 1 cm of
   visual); chamfered bridge deck ends/ramps; merged seams at district/chunk boundaries; rounded/chamfered
   chassis lower edges and chamfered kerb colliders (kerbs only block from the side); more suspension travel/
   damping or bump stops; CCD/sub-steps if needed.
D. Safety net (src/physics/bumpLimiter.js, on/off switch): for contacts classified NOT a real crash (ground-
   tagged, upward normal, kinematic cars) limit the post-step velocity change from that contact to <= 3 m/s
   per step and limit sudden angular velocity change so a lip can't launch or flip the car. Real crashes are NOT
   limited. Log each activation (limited:true). If it triggers often on a route, note that route in BUMPS.md.
E. scripts/bumptest.mjs: all routes (every district, motorway + ramps + overpass, airport roads) at 45/60/70
   m/s, all car types, with noise and with traffic + parked cars: max non-crash delta-v < 3.5 m/s, no chassis
   contact with ground-tagged colliders on flat ground, tilt <= 30 deg, zero damage events, no flips. Ground
   scan clean (or explained in BUMPS.md). Regression: a 25 m/s wall crash still costs 8-12% and stops the car;
   poles break; parked/traffic collisions hurt; police contact works; braketest passes. Replace the hard-coded
   "highway + ramps: n/a" in phantomtest.mjs with a real motorway run and fix the autopilot instability on the
   ramps if it's a test problem (log it if physics).
F. README (F5 report, F3 line, debug calls), link docs/BUMPS.md from docs/PHANTOM_CRASHES.md. Commit + push.
ACCEPTANCE: [ ] every bump found is categorised with evidence [ ] root causes fixed or honestly listed
[ ] bumptest + phantomtest + braketest + shaketest pass [ ] real crashes still hurt and shake [ ] pushed.

---
## TASK 001: BOOST ROCKETS + CABIN BOOST
Leftover from Claude: no partial rocket effects or boosttest exist. Shift mechanics and plain HUD BOOST
text exist; reuse them. Triage bench numbers are recorded in docs/tasks/000-handoff.md.
GOAL: boosting (Shift, current mechanics) looks and feels like a rocket boost. Do NOT change boost power,
duration, cooldown, top speed or handling; this is a visual/audio/feel task. If physics must change, stop and
report instead. Leftover from Claude: check first.
A. Understand (docs/tasks/001-boost.md): the boost input path, whether boost is limited or unlimited, existing
   boost effects (FOV, shake, audio, HUD), rear geometry of every car model (hatch, sedan, ute, 4WD, police,
   taxi, ambulance, van), how car visuals update (render interpolation), pooled particles, how mirrors render
   (layers), interactions (destroyed/burning, sleeping, stolen), covering tests.
B1. State: one source of truth per car {active, intensity 0..1} easing up ~0.15 s / down ~0.3 s. Only the
    player-driven car (stolen/police/ambulance/taxi included). Reads the existing boost state only.
B2. Hardware: two thruster nozzles per car type (mount, radius, angle in the car config): bell-shaped (short
    cone + rim), dark gunmetal with a subtle heat tint, small when idle, emissive when boosting; inside the
    rear silhouette, symmetric, clear of wheels/bumper/exhaust, pointing back (slightly down), follow body
    motion. Shared geometry/materials. Test numerically for every car type.
B3. Flames: per nozzle a two-layer additive flame (white-yellow core, orange-red outer), tapering, flickering
    (no per-frame allocation), length scaling with intensity (0 = hidden/not drawn, 1 = ~2-2.5 m), pooled
    spark + smoke emitter (<= ~60 particles), soft additive road glow at dusk/night. NO extra real lights,
    NO extra shadow casters. Visible in chase, cinematic and mirrors; hidden when destroyed/burning.
    Draw-call cost <= +6.
B4. Audio: synthesised rocket sound (filtered noise + rumble), ignition "whump", cut-off tail; pitch/volume
    follow intensity and speed; muffled in cabin, brighter outside; respects master volume and mute; nodes
    created once, stopped cleanly.
B5. Cabin (cabin camera only): FOV +6-10 deg eased, a small continuous rumble clearly separate from crash
    shake (never sets crashShake or damage/crack logic), light edge speed-lines/vignette, a dashboard BOOST lamp
    + gauge/bar, flames visible in the mirrors. Road-visibility rules still pass.
B6. HUD: small flame icon + bar in all views. Show real remaining/cooldown only if boost is limited; else an
    active indicator. Don't add a limit.
B7. Perf + night: measure with boost on, day and dusk, chase and cabin, in the town centre; fix regressions.
B8. scripts/boosttest.mjs (state, mounts, flames, wiring, audio, cabin, hud, perf), then singly: vehicle-sim
    bench (unchanged), phase2test, phase4test cameras, phase5test cabin pov zoom burn, phantomtest/bumptest
    (zero damage with boost on), shaketest (boost rumble must not count as crash shake), perfscenes.
B9. SCREENSHOTS (max 6, 1280x720, shots/boost/): rear idle, rear boosting by day, at night, 3/4 rear boosting,
    cabin boosting, cabin mirror with flames. Look if you can; fix once.
B10. README, PROGRESS.md CODEX LOG, DECISIONS.md. Commit + push.
ACCEPTANCE: [ ] mechanics/bench unchanged [ ] nozzles on every car type, no clipping [ ] flames only while boosting,
eased, hidden at 0 [ ] pooled effects, no extra lights [ ] visible in chase/cinematic/mirrors [ ] audio [ ]
cabin FOV/rumble/speed lines/lamp/gauge, road visible [ ] HUD [ ] perf within budget [ ] boosttest + regressions
[ ] pushed.

---
## TASK L1: TEST RELIABILITY AND CUL-DE-SAC COMPLETION (after 001, before 004)
Read docs/tasks/000-handoff.md and the affected tests/modules; plan and commit docs/tasks/L1-tests.md first.
1. Reproduce bus dwell, downtown/Northgate population snapshots and third-person run jitter singly before
   changing anything. Identify fixture timing/state leakage versus actual gameplay bugs. Preserve assertions;
   prefer deterministic setup and simulation-time evidence to single wall-clock population snapshots.
2. Make Hillcrest Ct and Banksia Cl route fixtures/autopilot complete their turning circles and return legs
   with traffic/parked cars present where intended. Assert route completion as well as existing physics limits;
   do not hide stalls behind the current simple-route physics-only PASS. Report real obstacles separately.
3. Run affected sections singly, plus walktest/phase2test/drivetest/shaketest and relevant driving regressions.
ACCEPTANCE: [ ] flaky sources explained with evidence [ ] route completion verified [ ] no weakened tests
[ ] affected regressions pass [ ] report, status, commit and push. No screenshots.

## TASK L2: PULL-OVER PURSUIT OBSTACLES AND RETURN (after L1, before 004)
Plan docs/tasks/L2-pursuit.md after reading pullOver, trafficCops, police movement and tests.
1. Reproduce tight breadcrumb turns near walls; implement obstacle-aware following that retains the configured
   speed/gap cap, no ramming, fines and escape rules. Add a targeted solid-obstacle test.
2. Replace the visible return-to-post pop with a verified return route or an out-of-view handoff; retain the
   catcher's availability and cooldown. Test both radar posts and cruising patrols.
ACCEPTANCE: [ ] no wall crossing on tested routes [ ] no visible pop on return [ ] pullover/police regressions
pass [ ] no changed fine/star rules [ ] report, status, commit and push. No screenshots.

## TASK L3: AIRPORT SUPPORT VEHICLES (after L2, before 004)
Plan docs/tasks/L3-airport.md after reading the airport models, operations, pooling and tests.
1. Reuse the existing tug geometry style for a visible pushback tug that attaches, tows, disengages and clears
   the taxi path in sync with existing departure states. Preserve gate/runway scheduling.
2. Give apron vehicles safe solid collision/avoidance behavior instead of walk-through visuals; keep them
   from launching cars or blocking aircraft indefinitely. Test player/vehicle encounters and aircraft cycles.
ACCEPTANCE: [ ] pushback has a synchronized tug [ ] apron contacts are safe and solid [ ] airport + bump/
phantom regressions pass [ ] budgets preserved [ ] report, status, commit and push. No screenshots.

---
## TASK 004: WORLD FILL (farms, industries, a working military base, fill the empty land, busier world)
Do this LAST. It is big: work phase by phase, test and commit after each; if low on room, stop at a phase
boundary and write the exact state in the Status notes. Keep the look (palette, flat-shaded low-poly, not
generic AI output: organic layouts, no copy-paste clusters). Budgets for this task: draw calls < ~600, fps >=
45 in the busiest headless scene, no per-frame allocations, RAM safe.
A. MEASURE + PLAN (docs + a script, commit): read how the map is built (terrain size/heightfield/chunking,
   build order, roads + lane graph + footpaths, chunk visibility, src/districts/* pattern, the airport module
   as the pattern for autonomous vehicles/aircraft, pedestrian + traffic managers (caps, sleeping), full map/
   minimap bounds + icon registry, street signs, speedLimits, docs/STREETS.md). Write scripts/mapcoverage.mjs:
   classify every ~25 m cell (road, building, district, water, dense trees/park, EMPTY), print the empty %,
   the largest empty regions (centre, size, slope), save a heat map in docs/; record the baseline. Write
   docs/WORLD_PLAN.md assigning each large empty region a use. Military base needs ~900x700 m of fairly flat
   land + a ~1000 m airstrip, away from the civilian airport and suburbs but reachable from the motorway;
   farms on gentle flat land; quarry in hills; wind farm on ridges; power station near water. Fill existing
   space first; only if it truly doesn't fit, extend the map moderately and state the cost (terrain
   triangles, heightfield, physics walls, map bounds, fog/sky). Target at the end: < 15% unused land
   (dense bushland, reserves, parks count as used).
B. TERRAIN + RURAL ROADS: grade pads/pits (base, farms, quarry with ramps), a gravel/dirt road type (no
   kerbs), rural roads joined to the motorway/arterials, in the lane graph and footpaths where relevant,
   unique street names, blade signs, speed limits (rural 80, tracks 40, base 40). Per-chunk culling if the
   terrain is one mesh. Physics ground within 1 cm of visual; colliders on everything solid. Tests: BFS
   connectivity from 62 to every zone; every new road driven at full throttle with zero damage events + ghost
   scan.
C. FARMS (2-3 clusters): farmhouse, barn, silo, machinery shed, water tank, windmill pump, fences, paddocks
   with instanced wandering cows/sheep, crop fields (instanced rows, varied crops), orchard, hay bales, dam,
   scarecrows, dirt tracks, farm dogs, an enterable farm shop (food, +health). Working: tractors and a
   harvester drive field rows with dust, farmers work, utes on tracks. Animals scatter when approached, get up
   if hit. Map icon "Farm".
D. INDUSTRIES (in this order; skip any that don't fit, log it): power station (cooling towers + steam), wind
   farm (rotating turbines), solar farm, quarry (terraced pit, crusher, stockpiles, haul trucks + excavator
   loops), fuel depot (tanks, pipes, flare-stack flame, NO explosions), sawmill + timber yard, recycling/
   wrecking yard (stealable wrecks), factory district, water treatment. Optional last: a rail line with a
   freight train + level crossings. Each has workers doing jobs, working vehicles on fixed paths, ambient
   sound, night lighting, map icons + labels + legend, street names.
E. MILITARY BASE (fictional name; config in src/military/militaryConfig.js; flags default false: hostile,
   stealable, boarding): STATIC: perimeter fence + watchtowers, main gate with barrier arm and guard house,
   parade ground + flagpole (fictional flag), HQ, barracks, mess hall, motor pool, maintenance hangars, fuel
   depot, earth-covered bunkers, radar dome, helipads, a military airfield (runway ~1000 m, taxiway, hardened
   shelters, tower) separate from the civilian airport, a firing range with pop-up targets, a tank training
   course, an obstacle course, restricted-area signs. WORKING (seeded state machines): gate guards (barrier
   opens for allowed vehicles), sentries + shift changes, fence patrols, squads marching/jogging in formation
   with a drill sergeant, PT, soldiers firing blanks at targets, mess queue, mechanics, officers walking.
   VEHICLES: procedural low-poly tanks (animated treads, rotating turret, recoil) running the course and
   firing blanks (flash + dust + sound, no explosion/damage), APCs, jeeps, trucks, occasional convoys leaving
   and returning via the motorway obeying lights. AIRCRAFT: 2-3 fighter types, a transport, helicopters with
   spinning rotors; reuse the airport state machine for the base airfield (taxi, takeoff, circuits, landing,
   park in shelters); helicopters flying patrol loops from pads; occasional formation flybys over town. Not
   enterable. Trespassing = a toast + guards walk toward you, no stars by default. Synth sounds (marching, tank
   rumble, jet roar, rotor chop). Map icons: base, gate, airfield.
F. FILL REMAINING LAND: re-run mapcoverage and fill the rest with variety: forests and bushland groves
   (instanced), rocky hills, creeks and ponds, a nature reserve with tracks and lookout, suburb infill (reuse
   house generators), a golf course (golfers), a caravan park, a camping ground, rural homesteads, a hamlet
   with a pub and store, a highway service station and rest areas, billboards, a lake with boats and fishing.
   Stop when the coverage target is met.
G. BUSIER NPCs (adults only): pedestrians ~200 registered with at most ~50 awake near the player (far ones
   sleep); new playing/activity roles: basketball, tennis, football kickabouts, cricket nets, frisbee, chess/
   cards at park tables, skateboarders at a skate park, fishing, kites, BBQs, outdoor gym, dog park, yoga, golf,
   farmers, workers, cyclists on rural roads. Traffic ~60 registered with at most ~25 fully simulated near the
   player (distance-based simulation / off-screen spawn-despawn for the rest); more variety: trucks, tow trucks,
   garbage trucks, delivery vans stopping at shops, tractors on rural roads, taxis picking up/dropping off, a
   slow learner car, cars parking/unparking, trips between districts (not only fixed loops), military convoys.
   Boats on the sea/lake. All existing reactions stay (flee from gunfire, knockdowns, witnesses, police).
H. MAPS, SIGNS, DOCS, TESTS, PERF: icons, labels, legend, unique street names, blade + speed signs; update
   docs/STREETS.md, docs/WORLD_PLAN.md, README. scripts/worldtest.mjs: coverage, connectivity, per-zone content
   counts, farm/industry workers moving, military (gate, patrols, tank route, jet cycle, no explosion
   objects), population caps + perf, icons/legend, unique street names, signs. Regression singly: phantomtest/
   bumptest (zero damage on all new roads), phase5test (map pois signs highway), shaketest, perfscenes with
   new scenes. If a budget breaks, add culling/LOD/instancing/lower caps and log it.
I. SCREENSHOTS (max 8, 1280x720, shots/world/): full-map aerial, a farm, the base from above, the base airfield
   with a jet, the power station or wind farm, the quarry, a busy town/park, the full-map overlay with legend.
   Look if you can; fix once.
ACCEPTANCE: [ ] unused land < 15% (before/after numbers) [ ] every zone reachable; new roads drive clean [ ]
farms, industries and the base work as described [ ] no explosions, military flags default off, no real-
world insignia [ ] caps + perf in budget, reactions intact [ ] icons/labels/legend/street names/signs [ ]
worldtest + regressions pass [ ] pushed.

---
## FINAL REPORT (after the last task, or when blocked/out of room)
For each task: state, what changed (files), commands run + results, what you could NOT verify, anything
surprising, and a BY-HAND CHECKLIST for the owner.
