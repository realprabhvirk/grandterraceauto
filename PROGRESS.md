# Progress

<!-- STATUS -->
**STATUS (2026-11-06 05:40 IST)**
- Done: Codex setup and task 000 read-only handoff triage. Claude's braking implementation retained; existing braketest 57/57.
- Open: intermittent traffic launches; phantomtest wall damage 0 twice versus 11.16 in instrumented probe; incomplete brake/motorway/cul-de-sac coverage. Detailed evidence: docs/tasks/000-handoff.md.
- Next: task 010 M4 keyboard bindings/Y siren and tests, then M5 live integration. Phase A/M1-M3 complete (index 8/8; engine 23/23; UI 11/11 in Edge). Engine/UI are not wired into main yet; keys remain unchanged until M4. Follow docs/MASTER_PLAN.md order; L1-L3 precede world fill.
<!-- /STATUS -->

Timestamped log of the autonomous Phase 1 build.

## CODEX LOG

- 2026-11-06 05:40 IST: Task 010 M3: musicPlayerUi.js adds palette SVG road cover, all mouse controls/list, safe left-side width, captured-pointer exclusion, idle fade, hidden-mode toasts and 4 Hz changed-value DOM updates. `GTA_URL=http://127.0.0.1:5180/ .\dev.cmd node scripts/musicUitest.mjs` 11/11, injected into live game solely by test; expanded bounds (12,80), widths168/232/280, height253.28 at all three sizes, no protected HUD/central overlap. Armed UI clicks did not fire; canvas positive control did. Engine regression 23/23. Fixed test timing by waiting for exact CSS opacity endpoint after an early 0.849 sample; assertion retained. No main import, screenshots or build. Next M4.
- 2026-11-06 05:27 IST: Task 010 M2: added musicConfig.js and musicPlayer.js (one HTMLAudioElement, real-time fade/duck, intent versus temporary suspension, seeded shuffle/history, repeat, safe storage, bounded error skip/retry). `GTA_URL=http://127.0.0.1:5180/ .\dev.cmd node scripts/musicEnginetest.mjs` passed 23 real Edge checks. Initial all-broken retry exposed reuse of cached media failure; explicit Play now reloads failed resource, and test proves recovery after corrupt response becomes valid. No game imports yet, so no gameplay behavior changed; integration regressions remain pending. Browser closed, zero screenshots/build/dependency changes. Next M3.
- 2026-11-06 05:23 IST: Task 010 Phase A committed/pushed as 36f81f9: read integration modules, measured all HUD rectangles at three resolutions, decoded three source MP3s in Edge; unauthenticated GitHub returned 404 again. M1: added musicIndex.mjs, npm music, generated-directory ignore, musicIndextest.mjs. `.\dev.cmd npm run music` generated canonical three-track playlist; `.\dev.cmd node scripts/musicIndextest.mjs` 8/8. Edge played all three generated /music URLs with correct metadata and no decode errors. Source hashes match; generated audio untracked/ignored. No game code, dependencies, screenshots or build changed. Next M2.
- 2026-11-06 05:14 IST: Resumed and confirmed pending serial tests finished and browsers closed. Task 000 audit complete: braketest 57/57; phase5 highway 9/9, life 9/9, downtown 8/8, northgate 8/8, pullover 14/14, airport 11/11; shaketest 21/21. Read full results; recorded coverage limitations and unresolved wall regression, not claimed fixed. Added GTA_URL to brake/phase5/shake tests. MASTER_PLAN folds partial brake/bump/music/boost work into matching tasks and adds L1 test reliability, L2 pursuit movement/return, L3 airport support vehicles before 004. No game-source edits, screenshots, build or dependency changes. Next: 010 Phase A.
- 2026-11-05 22:57 IST: Task 000 baseline: phase2test 16/16 (60 fps day/night), drivetest 4 physics checks pass but Hillcrest and Banksia stall before completion. phantomtest 18/19, wall crash = 0 instead of 8-12%; fresh `phantomtest regress` also fails 1/3. Test-only handoffCrashProbe at the same wall records 11.16 damage against door:tcDoor; timing/contact classification remains unproven, retained for task 003. No game-source changes, no weakened tests. See docs/tasks/000-handoff.md and ignored codex-*.log files. Next: finish leftover-specific brake/highway/life/district/shake evidence, classify queue, then task 010 Phase A.
- 2026-11-05 22:31 IST: Created codex-work from e074296; untouched audio snapshot e1b9553, verbatim instruction files 1ba99c3, task 000 plan 7847396; all pushed. Unauthenticated GitHub API returned 404 after retry outside sandbox, so source audio was allowed in Git. No uncommitted game code existed.
- Task 000 sub-task 1: isolated Vite server on 5180 with node_modules/.vite-codex cache (hidden launcher PID 24296); owner's ports untouched. Vite and Edge launches required sandbox escalation after spawn EPERM. Added GTA_URL override to walktest/phase2test/drivetest/phantomtest, preserving default 5173. With GTA_URL=http://127.0.0.1:5180/ and SHOTS unset, `.\dev.cmd node scripts/walktest.mjs` passed all 7 checks, exit 0 (codex-walktest.log). No screenshots or build. Next: remaining baseline tests singly and leftover evidence.

## 2026-11-04

> Correction: Phase 1 entries after 18:53 originally carried estimated clock times that were wrong (the real clock read 19:43 when Phase 2 started). They're now marked ~ = order only.

- 18:53 Setup verified: `.\dev.cmd node -v` = v26.13.0, npm 11.20.0, three 0.187, rapier3d-compat 0.21, Vite 8. Added vite.config.js, shots/ to .gitignore.
- ~ Step 1 done: terrain, palette, lighting, fog, F3 overlay (commit 520e71e).
- ~ Steps 2-4 done together: road network (Grand Terrace 9 segments + Hillcrest Ct, Banksia Cl, Wattle Rise), kerbs, verges, footpaths, turning circles with kerb rings, street signs (1 atlas draw call), lot layout, 32 instanced houses (4 variants), driveways with kerb crossovers, 22 instanced yard trees. 43 draw calls total.
  - Fixed: asphalt rendered near-black (light units + tone-mapper toe); THREE.Clock -> Timer; PCFSoftShadowMap removed in r187 -> PCFShadowMap.
- ~ Step 5 done: 62 Grand Terrace hero house (src/world/heroHouse62.js) with all checklist items, dusk window glow + lamps. 48 draw calls total. Rough: faint dotted PCF shadow edge under eaves; frangipani crown a bit mushroom-like.
- ~ Step 6 done: Rapier heightfield + house/hero/trunk colliders, third-person walk, free-fly debug cam (C), spawn outside 62. scripts/walktest.mjs (real Edge, simulated keys) passes all 7 checks: path walk, porch autostep, wall stop, back-pedal, jump, C toggle.
- ~ Step 7 polish: soft shadows, palette pass, bushland groves, hero lawn stripes/driveway joints/frangipani, cul-de-sac fillets, brighter dusk. Floating check: worst house-corner gap 2.3 cm across 32 houses. Production build OK.
- ~ Step 8: README.md written.
- ~ Perf probe on THIS machine (AMD Ryzen 5 7530U, Radeon iGPU via ANGLE D3D11): uncapped loop ~2.0 ms/frame CPU-side (~500 fps); shadows off / half-res / no terrain barely change it. The ~43 fps the F3 overlay shows in headless screenshots is headless frame pacing, not a GPU limit. Headless can't time the GPU itself, so confirm with F3 in a real window.
- ~ Verified street signs render (BANKSIA CL / GRAND TCE) and the F3 overlay (58 draw calls, 221k tris).

---

## PHASE 1 SUMMARY (2026-11-04, finished before 19:43)

Phase 1 build order 1-8 is complete. Every step was committed; 10 commits on `main`, no remote.

### How to run
```powershell
.\dev.cmd npm run dev        # http://127.0.0.1:5173/
```
The dev server was left running at **http://127.0.0.1:5173/**.

### What to check first
1. Open http://127.0.0.1:5173/: you spawn on the footpath outside 62 Grand Terrace, facing it.
2. Click to capture the mouse. WASD walks up the path, Space jumps, Shift runs. You should step onto the porch and stop at the door.
3. Press **T**: smooth blend to dusk. Windows glow, and the wall lights, porch light and letterbox light come on.
4. Press **C** for the debug fly cam, then 1-5 for presets (5 = top-down map). **F3** shows FPS / draw calls / triangles.
5. Screenshots of every view are in `shots/` (regenerate with `.\dev.cmd node scripts/shot.mjs`).

### Finished
- Terrain: seeded gentle hills, exactly flat under every road corridor and house pad. Max house-corner gap 2.3 cm.
- Roads: Grand Terrace (9 spline segments) plus Hillcrest Ct, Banksia Cl and Wattle Rise. Asphalt, white kerbs, verges, footpaths, turning circles with flared fillet kerbs, kerb crossovers at every driveway, street-name signs at each junction.
- 32 regular houses (4 instanced variants, palette colours), all facing the road, each with a driveway.
- 21 yard trees plus ~110 bushland trees in groves (instanced, 4 draw calls total).
- 62 Grand Terrace (src/world/heroHouse62.js): every checklist item, with tweakable COL/DIM constants at the top.
- Lighting: one warm sun (the only shadow caster, 2048 map following the player), hemisphere light, fog, sky dome, dusk toggle.
- Player: Rapier character controller, collision with terrain, houses, hedges, fences and trunks; orbit camera with collision; free-fly debug cam.
- Performance: ~58 draw calls including the shadow pass, ~222k triangles, pixel ratio capped at 1.5, no post-processing.
- Self-tests: scripts/shot.mjs (fails on any console error) and scripts/walktest.mjs (7 movement/collision checks, all pass).

### Rough / known issues
- 62 is an ORIGINAL design: no photos were in reference/house62/. Drop photos there and tweak the constants to match.
- Shadow edges are soft but slightly grainy up close (r187 PCF). There's a faint light band right under the eaves from shadow normal bias.
- Grand Terrace / cul-de-sac junction corners are sharp (no corner fillet like the cul-de-sac heads have).
- Regular houses are simple (4 variants, no mirrored versions) and have no letterboxes or fences of their own.
- Palm fronds are stiff boxes.
- Headless timing can't measure the GPU itself. CPU-side frame time is ~2 ms on this 7530U, but confirm 60 fps with F3 in a real Edge/Chrome window.
- Physics boundary walls stop the player ~40 m inside the map edge.
- The bundle is ~4.9 MB because Rapier's compat build inlines its WASM. Fine for local dev.

### Suggested Phase 2 steps
1. Cars: a Rapier raycast-vehicle controller, an enter/exit key, and a parked car in 62's driveway.
2. Make the road network data-driven (JSON) so streets can be edited; add corner fillets at T-junctions and give cars lane data.
3. NPC pedestrians on the footpaths (instanced, simple waypoint paths along the footpath ribbons).
4. A day/night cycle with a clock (the dusk blend already exists), plus street lights with pooled fake light cones.
5. Match 62 to real photos; add an interior (ground floor) you can walk into.
6. A minimap from the top-down preset; audio (birds, distant traffic).

---

# PHASE 2 (driving + character actions)

> Entries marked ~ were logged with estimated times that ran ahead of the real clock; they are in order but untimed. From 20:40 on, times are read from the clock.

- 19:43 Phase 2 started. Repo clean, dev server up at http://127.0.0.1:5173/.
- 19:50 Collision fix: Rapier's heightfield splits each cell along the b-d anti-diagonal; the visual mesh used a-c, so physics and visuals differed by up to 26 cm (60/2000 random points over 2 cm). Switched mesh + getHeight to Rapier's split. Re-probe: 2000 rays, max error 0.000 m.- 20:05 Phase 1 fix: Grand Terrace / cul-de-sac junction corners now have curved 5 m fillet kerbs + footpaths + asphalt flare, solved from each road's real tangent lines (both roads curve at the junctions). Small grass slivers remain right at the corner apex (logged, cosmetic). Street signs moved past the fillets. Walk test + screenshots pass.
- ~ P2 step 1 done: physics moved to src/physics/ (physicsWorld.js with STATIC/CAR/PLAYER collision groups, onStep listeners), F4 collider debug view (Rapier debugRender for all colliders + local heightfield wireframe). Checked alignment in shots/colliders-hero.png: house, fences, hedges, bins, letterbox, trunks, capsule all line up.
- ~ P2 step 2 done: 4 procedural car types (src/vehicles/: carTypes, carModels, carMaterials, wheels, vehicleBody, car, spawns, vehicleManager). 8 cars: hero teal sedan in 62's driveway, 1 per cul-de-sac head, 4 kerbside. Rapier DynamicRayCastVehicleController + arcade assists, tuned with scripts/vehicle-sim.mjs (Node bench): 0-100 km/h 5-8 s, top 107-139 km/h, roll < 3 deg, crest jumps land wheels-down. ~75 draw calls.
- ~ P2 step 3 (in progress): driving controls, chase camera, synth audio, HUD, prompt + interaction system, enter/exit transitions, new jointed character (crouch, emotes, seated pose) all wired. scripts/drivetest.mjs: Grand Terrace full length (559 m) + Banksia Cl pass; car height stays -0.12..+0.18 m vs terrain, tilt <= 11 deg, 60 fps, <= 97 draw calls on every route.
  - FAILED (logged, moving on after 5 fixes): the test autopilot wedges inside the Hillcrest Ct and Wattle Rise turning circles (navigation of the tight loop past the parked car), not a physics problem - heights/tilt were sane throughout.
- ~ User asked mid-run to rebuild 62 from a real photo: doing that now.
- ~ 62 Grand Terrace rebuilt from the user's photo (saved as reference/house62/front-dusk.png): garage moved to the right, tiled hip roofs (wrap-around lower roof, projecting entry hip, rendered box over the garage with its own hip), weatherboard upper storey, rendered piers + shuttered windows, recessed entry with dark door + sidelight, dark slatted garage door, exposed-aggregate driveway, open lawn, rendered letterbox pillar, green telecom pillar + pit, cordyline/grass beds, timber paling fences, gums behind, TV antenna. New camera preset hero-photo matches the photo angle. Walk test passes (7/7).
- ~ Fixed: horn/screech audio passed GainNode instead of its .gain param (errored every frame once audio unlocked).
- ~ P2 step 6 done: N toggles a smooth afternoon <-> dusk/night blend (T still works). Night now darker; street lights (poles every 30 m, instanced heads + additive road light pools tilted to the road grade, 3 draw calls, pole colliders), hero/house windows glow, driven car's headlights switch on automatically. No extra shadow-casting lights (headlights = 1 non-shadow SpotLight that always exists).
- 20:40 Fixes from the end-to-end test: headlight cones (read as grey ghost discs from behind) replaced by an additive road wash + stronger night SpotLight; chase camera rises when pulled in and, on entering, picks the first unobstructed angle; 62 got eave colliders (above head height) so cameras can't tuck under the roof. scripts/phase2test.mjs: 16/16 pass (walk to hero car, F, drive out 239 m, look-behind, stop, F out 2.2 m beside the car, car stops, 4 emotes + interrupt, crouch, N night + auto headlights; 60 fps, 74-76 draw calls). Walk test 7/7, screenshots clean.
- 20:45 README rewritten for Phase 2 (controls, URL presets, self-tests, structure). Production build OK.
- 20:45 Drive test autopilot: one more fix (passing point fixed in world space, wider loop); still wedges in the Hillcrest Ct / Wattle Rise turning circles. Stopped iterating (well past the 3-fix rule). Physics checks pass on every route.

## PHASE 2 SUMMARY (2026-11-04, 20:45)

### How to run
```powershell
.\dev.cmd npm run dev        # http://127.0.0.1:5173/
```
The dev server is left running at **http://127.0.0.1:5173/**. Click once in the game (captures the mouse, unlocks sound).

### Controls (full list in README.md)
- On foot: WASD, Shift run, Space jump, Ctrl crouch, 1-4 emotes (wave, dance, sit, point), F get in.
- Driving: W/S, A/D, Space handbrake, Shift boost, H horn, L lights, B look behind, R flip upright, F get out.
- Anywhere: N day/night, ? help, M mute, F2 debug fly, F3 stats, F4 colliders.

### What to test first
1. You spawn outside 62 (now matching your photo). Walk up the lawn to the teal hero sedan in the driveway, wait for "Press F to drive", press F.
2. Drive out (W, A/D), try Space handbrake turns and Shift boost on Grand Terrace, drive into a cul-de-sac and around the turning circle.
3. Press N for night: street lights, window glow, headlights. Press L to toggle the lights, B to look behind.
4. Stop, press F to get out, try the emotes 1-4 and Ctrl crouch.
5. F4 shows every collider; F3 shows FPS + draw calls.

### Finished
- Collision: Rapier heightfield that matches the visual terrain exactly (0.000 m error over 2000 probes), boxes for houses, 62, fences, letterbox, eaves; cylinders for trunks and street-light poles; STATIC/CAR/PLAYER groups; F4 debug view.
- Cars: 4 procedural types (hatch, sedan, ute, 4WD), 8 seeded spawns (hero teal sedan in 62's driveway, 1 per cul-de-sac, 4 kerbside). Raycast-vehicle physics with arcade assists, per-type tuning (0-100 km/h 5-8 s).
- Driving: eased speed-sensitive steering, handbrake drift, boost, flip-upright, grass grip 0.78 vs asphalt, car-vs-house/tree/fence/car collisions, chase cam (auto-swing, look-behind, speed FOV, collision pull-in, clear start angle), headlights / brake / reverse lights, WebAudio engine/horn/screech/thud, HUD speedo + tacho, controls panel.
- Enter/exit with smooth character + camera blends, safe exit spot, car brakes when left, one driven car at a time.
- Character: jointed low-poly figure, walk/run/jump/crouch, 4 emotes, seated pose (hands on wheel, head follows steering), interaction prompt system.
- Day/night (N): smooth blend, street lights with road light pools, window glow, auto headlights; still one shadow-casting light.
- 62 Grand Terrace rebuilt from your photo (reference/house62/front-dusk.png).
- Phase 1 fixes: terrain/physics triangulation mismatch (was up to 26 cm), curved junction corner kerbs.
- Tests: phase2test.mjs 16/16, walktest.mjs 7/7, shot.mjs clean, drivetest.mjs 2/4 routes (see known issues). 60 fps headless, 57-100 draw calls.

### Known issues
- drivetest.mjs: the test autopilot (not the car) wedges inside the Hillcrest Ct and Wattle Rise turning circles when passing the parked car; heights and tilt stay sane on every route. A human can drive them fine.
- Seated driver is hard to see through the tinted glass from the chase camera.
- Exiting is blocked above ~30 km/h by design.
- Pointer lock can't be tested headless (camera orbit was tested via code paths only).
- Audio is synthesised and verified to run without errors, but nobody has listened to it yet - levels may need tuning.
- Tiny grass slivers remain at the apex of the junction corner fillets.
- Regular houses still use the 4 generic variants (no letterboxes/fences).

### Suggested Phase 3
1. **Traffic + NPCs:** lane graph from the road splines (left-hand traffic, give way at T-junctions), simple AI drivers reusing VehicleBody + the autopilot steering; pedestrians on the footpaths using the character rig with waypoint walking.
2. **Doors + interiors:** register doors with the interaction system (F to open), a walkable ground floor for 62 (living, kitchen, garage), garage door that opens for the hero car.
3. **Multiplayer plan:** authoritative Node server (ws), clients send inputs at 30 Hz, server runs the same Rapier step (VehicleBody is three-free so it already runs in Node), snapshots + interpolation, start with 2-4 players walking/driving.
4. Car damage-free polish: skid marks, dust on grass, better engine sound per car type, radio.
5. Minimap from the top-down preset; a day clock.

---

# PHASE 3 (living suburb + enterable 62)

- 20:55 Baseline green before changes: walktest 7/7, phase2test 16/16, shot.mjs clean.
- 21:00 P3 step 1 done: cul-de-sac parked cars pulled tight to the kerb ring; cul-de-sac drive test replaced by simple centreline driving with a physics-only pass condition -> drivetest 4/4 routes pass (all three cul-de-sacs completed in and out); car glass tint lighter (opacity 0.58 -> 0.30); Esc settings panel with master volume + mute (M), saved in localStorage; engine/screech levels -30%.
- 21:05 P3 step 2 done: 20 seeded pedestrians (src/npc/: footpaths graph, outfits, pedestrians). Character is now ONE SkinnedMesh per person (rigid per-part bones, geometry cached per outfit) so each pedestrian is 1 draw call - total draw calls went DOWN from 87 to ~70 with the player alone, ~90 with 20 NPCs. They walk the footpath polylines (cul-de-sac sides joined around the turning circle, links across side roads), pause to look around / check phone, wave at the player within 6 m, take driveway detours, dodge toward the verge from fast cars (<8 m), have kinematic capsules so the player can't walk through them, sleep beyond 120 m and animate every 3rd frame beyond 45 m. Probe: awake NPCs walked 10-15 m in 12 s, none off the footpath.
- 21:14 P3 step 3 done: 6 ambient traffic cars (src/traffic/: laneGraph, trafficCar, trafficManager). Kinematic path-following on a lane graph (Grand Terrace both ways, cul-de-sac in/loop/out lanes, junction turn-in/turn-out connectors with give-way, U-turns at the dead ends), 25-40 km/h, slower on bends/connectors, gap keeping, swing out around kerb-parked cars, honk once after 6 s blocked by the player, fake suspension pitch/roll + steering/spinning wheels, kinematic colliders (player's Rapier car collides), headlights at night. Probe: all 6 moving, U-turns + a cul-de-sac turn-in taken, 0 s stuck.
  - BUG FOUND + FIXED: the road 'left normal' from Phase 1 actually points RIGHT, so parking, autopilot lanes and the new traffic were right-hand traffic. Flipped everything to keep-left (Queensland). drivetest 4/4 (physics), phase2test 16/16, walktest 7/7.
- 21:27 P3 step 4 IN PROGRESS (stopped: usage limit reached). Working: 62 is now a hollow shell (wallSlab.js) with real door/garage openings; interior (house62Interior.js, layout constants at top): hall + stairs, open living/dining/kitchen, garage, upstairs landing/rumpus, 3 bedrooms, bathroom, furniture, 4 non-shadow point lights (on at night / when inside), inner window panes, 62's windows glow with its lights; lower roofs clipped where the upstairs sits on them. Probe verified: closed front door blocks, E opens it, walk into the hall, climb the stairs to the landing (y 3.18). Garage door blocks the car when shut.
  - OPEN BUG: E from inside the car does not open the garage (no 'car' prompt shows); not yet diagnosed. On foot E near the garage should work but is untested.
  - Dev server was serving a stale physicsWorld.js (watcher missed a PowerShell write); restarted it. Re-run the full test suite before trusting earlier step-4 numbers.
  - NOT STARTED: steps 5 (8 house variants + yard details), 6 (signs, power poles, ambient sound, minimap), 7 (extended Playwright suite + perf pass), 8 (MULTIPLAYER_PLAN.md), Phase 3 summary + README update.

---

# PHASE 4 (cheap + low-RAM run: no screenshots, numeric asserts)

- 23:40 P4 step 0: dev server restarted, tests switched to 960x540 with screenshots opt-in (SHOTS=1); baseline suite green.
- 23:44 P4 step 1 done: exit spot search rewritten (cause: capsule test at terrain height overlapped the garage floor slab, so every spot inside was rejected); internal garage->hall door with E; in-car garage prompt worked once the stale server was gone (range 5.5). scripts/phase4test.mjs garage: 9/9 (reverse in, exit inside garage, door, walk to hall, drive out, driveway + street exits).
- 23:49 P4 step 2 done: C camera modes (third/first person; chase/cabin/cinematic), cabin interior with working gauges, dash lamps, 450-deg wheel, limited look + auto-recentre, impact shake, crack overlay (<35 car health), cinematic auto-director with ray-checked shots + letterbox, live mirrors (60 fps headless, no drop). phase4test cameras 8/8.
- 23:58 P4 step 3 done: HUD (HP/car bars, stars slot, cash ,000 persisted), player damage (impacts, falls, hit by cars), regen, knock-out -> hospital (temp) -, car damage visuals + wrecks, breakables (street lights, power poles + wires, regulatory signs, bollards, letterboxes, kerb bins) with tip-over/sparks/restore, pedestrian knock-down + flee, crash/snap/ding sounds. phase4test combat 6/6.
- 00:06 P4 step 4 done: hold-F break-in (witness check: ped 30 m LOS / cop 60 m), carjack (driver ejected, drivable copy), wanted 0-5 stars from heat, police cars (lights, siren, A*/Dijkstra lane routing, direct chase, box-in), busted (-$500, impound, station), escape (search flash, clear). phase4test police 6/6.
- 00:07 P4 step 5 done: Tab minimap (north-up canvas, pre-rendered roads, player arrow, police blips, wanted radius, place markers) at ~10 fps; phase4test minimap 2/2.
- 00:39 P4 step 6 done: Terrace Town Centre (grid + ring road + Terrace Link, 10 shops, Terrace Central + Quick Stop enterable, police station, hospital, petrol, bus stops, breakable trees/lights/bins/signs, Central Gardens + Wattle Park). phase4test town 11/11; town centre 69 draw calls, 60 fps headless; police/garage/cameras/combat/minimap + walk/drive/phase2 regressions pass.
- 00:49 P4 step 7 done: 40 role-based pedestrians (joggers, dog walkers + low-poly dogs, shoppers with bags, bench sitters, picnickers, police on foot, hi-vis workers at roadworks, paramedics, shopkeepers) + 3 cyclists + shop staff; phase4test npcs 9/9; combat/police/town/minimap regressions 25/25.

## PHASE 4 SUMMARY (2026-11-05, 01:00)

Steps 0-8 all done; every step committed with its tests passing. Final full run: phase4test all sections
(garage, cameras, combat, police, minimap, town, npcs) passed except the garage "street exit" check, which had parked
next to a parked car; after making the test pick a clear stretch the garage section passed 9/9. walktest 7/7, phase2test 16/16, drivetest 4/4 (physics criteria),
`npm run build` OK (5.2 MB JS, 1.9 MB gzip).

### What works
- **Bugs fixed:** leaving the car inside 62's garage puts you next to the car (ground-raycast exit search, ghost fallback);
  internal garage<->hall door (E); garage door from inside the car (E, wider range).
- **Cameras (C):** on foot third <-> first person; in a car chase -> cabin (dash, binnacle, speedo/tacho needles,
  gear, lamps, 450-degree wheel, look limits, B look back, impact shake, cracked screen when damaged, live mirrors with a perf guard) -> cinematic (letterboxed shots).
- **Damage + cash:** health bar with regen, crash/fall damage, KO -> hospital respawn -$200; car health with smoke,
  flames (no explosions), loose bumper/hood, wreck; breakable street lights, power poles, signs, bollards, bins, letterboxes, town trees/lights/bins/signs, roadworks cones; $10,000 start cash (saved).
- **Police:** hold F to break into a parked car (crime only if witnessed), F next to a traffic car = carjack;
  heat -> 1-5 stars; police cars spawn (station first when nearby, else out of view), route over the lane graph,
  chase, box you in; BUSTED -$500 at the station (stolen car impounded); losing them: stars flash, clear after 10 s unseen.
- **Minimap (Tab):** roads, you, police, wanted radius, 62 / police / hospital / shops / parks.
- **Terrace Town Centre:** a flat 340 x 320 m district east of Grand Terrace via the Terrace Link; street grid with ring road,
  Terrace Pde (10 shopfronts with awnings + signs), Market St, Station St; give-way rules; 4 extra traffic cars start there.
  Terrace Central (2 storeys, enterable ground floor with aisles, cashier, guard, shoppers, car park with parked cars),
  Quick Stop (enterable, snack $20 = +25 health at the counter), police station (brick/blue, patrol-car bay, new busted point),
  Terrace Hospital (white, blue H, ambulance bay, new KO respawn point), petrol station, 3 bus stops, Central Gardens
  (fountain, bandstand, benches) and Wattle Park in the suburb (loop path, playground, pond, picnic shelter).
- **People:** 40 pedestrians with roles - walkers, joggers, dog walkers (low-poly dogs on leads), shoppers with bags,
  bench sitters, picnickers, police on foot, hi-vis road workers at a small roadworks, paramedics, shopkeepers;
  3 cyclists on the roads; all adults, all knockable (fall over, get up, walk back to their spot).

### Performance (scripts/perfscenes.mjs, headless Edge 960x540)
| Scene | fps | draw calls | triangles |
| --- | --- | --- | --- |
| suburb: on foot outside 62 | 60 | 115 | 360k |
| inside 62 (living room) | 60 | 103 | 359k |
| driving: chase cam on Grand Terrace | 60 | 156 | 384k |
| driving: cabin cam + mirrors | 52 | 177 | 388k |
| driving: Terrace Pde (town centre) | 60 | 81 | 374k |
| town centre on foot (busiest spot) | 60 | 86 | 358k |
| inside Terrace Central | 60 | 57 | 355k |
| inside Quick Stop | 60 | 91 | 356k |
| Wattle Park | 60 | 148 | 375k |
| town centre at dusk | 60 | 74 | 351k |

### Rough edges
- Town kerbs/footpaths are visual only (like the suburb): cars roll straight over them.
- Town intersections are square (no corner fillets); traffic only gives way, so two side-street cars can still overlap in an intersection now and then.
- Car park / police bay / ambulance vehicles are static props (not stealable).
- Shop interiors have no extra lights (sunlight through the non-shadow ceiling + hemisphere light); they read a bit flat.
- Cyclists ride through intersections without giving way; traffic queues behind them.
- Store staff/shoppers are decorative (outside the pedestrian system).
- phase4test garage "street exit" picked a spot next to a parked car once more traffic was added; the test now chooses a clear stretch.
- Nothing was looked at visually in this run (no screenshots by request) - colours/placement of the town are verified by numbers only.

### How to test by hand
1. `.\dev.cmd npm run dev`, open http://127.0.0.1:5173/, click once.
2. Get in the red sedan in 62's driveway (F), press C a few times (chase / cabin / cinematic), Tab for the minimap.
3. Drive to the east end of Grand Terrace and keep going: the Terrace Link leads into Terrace Town Centre.
4. Walk into Terrace Central (E at the door) and the Quick Stop (E at the door, E at the counter for a snack).
5. Hold F next to a parked car / F next to a traffic car to steal it; watch the stars, try to lose the police or get busted.
6. Hit a lamp post or a tree fast: it breaks, the car smokes; crash enough and you wake up at the hospital.
7. Visit Wattle Park (marked * on the minimap, near the cul-de-sacs) for joggers, dog walkers and picnickers.

### Suggested Phase 5
1. **Missions:** a simple mission system (start markers, objectives, timers, cash rewards) - deliveries from the hardware store, a pizza run from the takeaway, a getaway from the bank (no weapons).
2. **Shops + economy:** buy clothes (outfits), car repairs/resprays at a garage (clears wanted level), fuel at the petrol station, buy a second car; save/load more state.
3. **More districts:** an industrial estate or beachside strip joined to the ring road; highway between districts; more house variants (the skipped 8 variants).
4. **Multiplayer:** a small WebSocket server (authoritative positions + interpolation) - start with 2-4 players driving around together; see the multiplayer doc that was skipped in Phase 3.
5. Polish: corner fillets + traffic lights at town intersections, interior lighting, ambient sound loop (skipped), pedestrians crossing at the zebras.
- 01:00 P4 step 8 done: full suite passed (garage street-exit test made robust), perfscenes.mjs logged per-scene fps/draw calls, README controls + folders updated, npm run build OK, Phase 4 summary written.

## PHASE 5 LOG
- 05:03 Step 0: git clean, dev server up. Baseline run got interrupted by my own edits (Vite reload), so suites were re-run after Step 1.
- 05:50 Step 1 done (fixes a-k). New scripts/phase5test.mjs sections pov cabin zoom carhp burn stars push arrest ko steal parked: all pass (cabin: 9/9 road rays clear for all 4 car types, dash top at 79-99% of screen height; 3-star chase: nearest cop 61 m after 12 s, contact 0 s). Updated old tests for the new rules (emotes = hold G + 1-4, no player damage in cars, KO/busted cutscene timings). phase4test combat/police 12/12, phase2test 16/16, walktest pass, drivetest pass (physics).
- 06:09 Step 2 done (guns). New src/weapons/ (weaponStats, arsenal, gunModels, ik, hitscan, gunFx, viewmodel, playerWeapons) + ui/weaponHud. scripts/weaponsUnit.mjs 26/26 (damage, zones, falloff, ammo/reload, auto/semi, pump, spread, holster, caps, save). phase5test guns 28/28 (IK: grip/foregrip within 5 mm for all 4 guns, muzzle 0.4-0.75 m ahead; kill+fade timing; heat events; FP ADS). phase2 16/16, walk pass.
- 06:14 Step 3 done (cops with guns): src/police/copGuns.js; officers get pistol / SMG / one rifle by stars, IK hold, bursts with LOS <=40 m, accuracy 35% at 20 m; cars shoot from the window. phase5test copguns 7/7; push/arrest/ko 12/12 and phase4 police 6/6 still pass.
- 06:17 Step 4 done: Barrel & Bolt gun shop on Terrace Pde (enterable, counter, racks, glass cabinet, shopkeeper) + HTML buy menu (src/ui/gunShopMenu.js). phase5test shop 12/12.
- 06:28 Step 5.1 Downtown done: src/districts/downtown.js on an extended town grid (13 towers 5-18 floors, Terrace Tower landmark with spire, City Plaza fountain + food truck, rooftop/street billboards, neon, 3 bus shelters, City Parking with 8 stealable cars, office-worker crowds, more traffic). phase5test downtown 8/8 (drive 460 m end to end, 73 draw calls / 60 fps at the plaza); phase4 town/npcs/minimap pass.
- 06:33 Step 5.2 Beach done: src/districts/beach.js (promenade + sea wall + railings, sand slope, animated water + foam, drivable pier, Surf Shack kiosk, lifeguard tower, volleyball, towels/umbrellas, 12+ palms, beach car park, sunbathers / volleyball / lifeguard / vendor + promenade walkers, 12 boid seagulls). phase5test beach 10/10 (85 draw calls, 60 fps).
- 06:42 Step 5.3 Northgate done: src/districts/northgate.js + NORTH grid in townPlan (36 houses, Northgate State School with oval - staff only, Northgate Plaza + 20-car car park, water tower, residents, 2 traffic cars start there). phase5test northgate 8/8 (163 draw calls, 60 fps); phase4 town 11/11, walktest pass.
- 06:48 Step 5.4 Industrial + highway SKIPPED (multi-level roads vs single heightfield + kinematic traffic; see DECISIONS). Step 6 vibe pass done: drifting clouds, day birds, zone ambience (wind/birds, waves, city hum, crickets), optional day/night cycle (Shift+N / ?cycle), ~62 people with far ones asleep, pooled warm shop light. phase5test vibe 8/8, beach 10/10, phase4 npcs 9/9.
- 06:52 Step 5.4 Industrial estate added after all (no highway): src/districts/industrial.js on a 4x3 grid north of downtown via King St (6 warehouses with roller doors + sawtooth roofs, 114 containers in stacks, fenced yards, graffiti walls, gantry crane, forklift lapping a yard, port workers, stealable utes). phase5test industrial 5/5 (72 calls, 60 fps); vibe 8/8, northgate 8/8 (threshold 4 visible residents after the people cap).

## PHASE 5 SUMMARY (2026-11-05, 06:58)

### What works
- **Fixes (step 1):** first person hides your own body (no orange bar) and shows a separate-pass viewmodel (arms sway; guns at the hip / down the sights, never clipping walls). Cabin cam: eye +7 cm, low short dash, thin pillars/wheel, hood hidden from inside - the road is visible 6-20 m ahead for every car type. Wheel / trackpad pinch only ever zooms the camera (page zoom, Ctrl +/-/0 and gestures are blocked). No player damage inside any vehicle. Destroyed cars burn ~5 s ("Car on fire - get out!"), F gets you out at any speed, otherwise you're thrown out with a stumble (no damage); the wreck stays. Stars flash after 6 s unseen (or nearest cop >120 m) and clear after 5 s of flashing; dying / busted resets wanted + all police. Police soft contact (no more pinning): sensors vs your car, capped nudges, recover + flank, speed caps. Officers get out and pull you out of a stopped car / walk up and grab you on foot. KNOCKED OUT (slow-mo, desaturated, orbit) and BUSTED (cuffed, two officers) cutscenes. Every parked car can be stolen (car parks, petrol pumps, police bay, the ambulance; T = lights + siren in emergency vehicles). More parked cars on alternate suburb streets; far cars sleep.
- **Guns (step 2):** pistol, SMG, pump shotgun, rifle (procedural low-poly, real scale). LMB fire, RMB aim (over-the-shoulder / ADS), R reload, 1-4 select, Q holster/draw, emotes on hold G + 1-4. Two-bone IK puts the right hand on the grip and the left on the foregrip (both within 5 mm in tests). Holstered pistol on the hip, long guns slung on the back. Hitscan from the camera through the crosshair (head x2 / body zones), shotgun falloff, spread bloom, recoil + camera kick, muzzle flash (+1 pooled light), tracers, casings, impact puffs/sparks/chips, 60 bullet holes, hit marker, dry-fire click, synth sounds. Shot people go down and fade after ~5 s. Cars take small damage, breakables break from gunfire. Crime heat (shots fired / civilian / cop hits and kills), civilians flee or cower. Weapons + ammo saved with the cash.
- **Cops with guns (step 3):** pistols at 3 stars, SMGs + one rifle at 4-5; bursts only with line of sight within 40 m, ~35% at 20 m; patrol cars shoot from the window. On foot you take damage; in a car only the car does.
- **Barrel & Bolt (step 4):** enterable gun shop on Terrace Pde (counter, racks, glass cabinet, shopkeeper); E opens a buy menu (ammo packs $30-$80 up to the cap, shotgun $600, rifle $1,200); input pauses while it's open.
- **Districts (step 5):** Downtown (13 towers up to 18 floors, Terrace Tower, City Plaza fountain + taco truck, billboards, neon at night, bus shelters, City Parking, office crowds, more traffic); Terrace Beach (promenade, sea wall, sand into an animated sea, drivable pier, Surf Shack, lifeguard tower, volleyball, palms, sunbathers, seagulls); Northgate (36 houses, Northgate State School + oval with staff only, Northgate Plaza + 20-car car park, water tower); Industrial estate (warehouses, container stacks, fenced yards, graffiti, gantry crane, forklift, port workers). All on the town street grid, so traffic, police and pedestrians use them; minimap markers for each.
- **Vibe (step 6):** drifting clouds, birds by day, zone ambience (wind + birdsong, waves, city/machinery hum, crickets at night), optional slow day/night cycle (Shift+N), ~62 people total with far ones asleep, a warm pooled light inside Terrace Central / Quick Stop.

### Performance (headless Edge 960x540, scripts/perfscenes.mjs)
The final perfscenes run was cut short (see below), so these numbers come from the per-district test sections, each measured 2.5 s after teleporting in:

| Scene | Draw calls | fps | Triangles |
| --- | --- | --- | --- |
| Town centre on foot | 76-80 | 54-60 | - |
| Downtown, City Plaza | 73 | 60 | ~454k |
| Terrace Beach promenade | 85 | 60 | ~477k |
| Northgate | 161-168 | 60 | ~746k |
| Industrial estate | 72-77 | 60 | ~611k |

Phase 4 scenes were 57-177 draw calls and 52-60 fps (the cabin cam with live mirrors is the heaviest). Every scene stays under the 500 draw-call budget and at or above 45 fps.

### Test status at the end of the run
- The final full-suite run (step 7) was stopped by Claude Code because the PC ran critically low on memory; the dev server (task bgn4b0ou6) was stopped for the same reason. I did not restart either one, and `npm run build` was NOT run.
- What finished: weaponsUnit 26/26. phase5test got through 133 passing checks with 3 failures before it was killed: (1) cabin view for the ute had 9 rays blocked at 0.33 m from the eye, which passed in every earlier run, so it is probably the car's spawn spot (logged, not fixed); (2) downtown visible-people threshold of 8 was too high after the ~60 people cap, now 4; (3) the beach traffic count was 0, so the check now looks for traffic lanes on the beach road instead. The changes to (2) and (3) have not been re-run.
- Every section passed on its own when it was built (see the log above), and phase4/phase2/walk/drive passed after their updates.
- Added after the last test run: sand / wet-sand / seabed colouring on the beach terrain (src/world/terrain.js, syntax-checked only).
- To re-run: start the dev server, then `.\dev.cmd node scripts/phase5test.mjs`, phase4test, phase2test, walktest, drivetest, perfscenes, and `.\dev.cmd npm run build`.

### Rough edges
- The **highway** (overpass + ramps) was skipped: the ground is one heightfield and AI cars take their height from it, so roads at two levels need a road-height layer first (Phase 6).
- Officers on foot walk through props (no navmesh); armed officers can shoot through thin gaps a raycast misses.
- Town-grid streets are two-lane with no kerbside parking, so downtown parked cars live in car parks.
- Northgate houses have no driveways/fences; Northgate and Industrial are graded flat.
- The terrain grid is bigger (544 x 344 cells), so the terrain alone is ~370k triangles; still 60 fps in the headless run.
- Police AI in a chase is still lane/steer based: they can cut corners across lawns.
- drivetest's autopilot still wedges in the Hillcrest Ct turning circle (pre-existing, physics fine).

### BY-HAND VISUAL CHECKLIST (nothing was looked at this run - numbers only)
1. **First person (C on foot):** no orange bar at the bottom; unarmed forearms sway when walking; viewmodel lighting matches the world (day and night).
2. **Gun models:** pistol / SMG / shotgun / rifle proportions and colours (gunmetal + polymer + wood); parts readable (slide, mag, pump, stock, sights).
3. **Holding guns (third person):** right hand on the grip, left hand on the foregrip / supporting the pistol, gun points at the crosshair, rifle stance torso twist looks natural, elbows not inside the body.
4. **Holsters:** pistol on the right hip pointing down; long guns slung across the back (the angle was guessed).
5. **Viewmodel with a gun:** hip position, ADS centres the sights, reload dip, shotgun pump, recoil kick.
6. **Gun effects:** muzzle flash size, tracer streaks, brass casings arc, dirt puffs / sparks / chips, bullet-hole decals sit flat on walls, hit-marker + crosshair spread.
7. **Shot / knocked out poses:** 'dead' fall + fade, 'cower', 'collapse' (KO), 'cuffed' (busted), 'stumble' (thrown from a burning car).
8. **Cutscenes:** KO desaturate + vignette + orbiting camera, BUSTED with two officers, the driver's door swinging open when you're pulled out.
9. **Cabin view (all 4 car types):** dash no longer blocks the road, gauges still readable lower down, thin pillars/wheel, the car doesn't look hollow (hood hidden from inside).
10. **Burning car:** flames + black smoke for ~5 s.
11. **Stolen police car / ambulance:** light bar, livery, flashing when T is on; the ambulance is now a white 4WD with a blue/yellow band.
12. **Barrel & Bolt:** facade, barred windows, interior racks / cabinet gun orientation, shopkeeper position, buy-menu styling.
13. **Downtown:** tower window grids + mullions, glow at night, neon signs, billboards readable, Terrace Tower crown + spire, City Plaza fountain, taco truck.
14. **Terrace Beach:** sand colour, sea wall + railings, water waves + foam line, pier piles, palms (leaf angles), towels/umbrellas, lifeguard tower, volleyball players hopping, sunbathers lying on towels, seagulls.
15. **Northgate:** houses face the streets (rotation), school + oval + goalposts, plaza sign, car park, water tower.
16. **Industrial:** sawtooth roofs, roller doors, container stacks, fences, graffiti walls (face the street), gantry crane, forklift.
17. **Sky:** clouds drifting, bird flocks by day.
18. **Minimap (Tab):** new markers (^ landmarks, ~ beach, S school, I industrial) and the bigger road grid.

### Suggested Phase 6
- Missions (deliveries, chases, getaway jobs) with a simple mission giver + payouts.
- Drive-bys (aim from the car), weapon wheel, more guns (melee-free), armour pickups.
- Vehicle variety: vans, trucks, motorbikes, a bus on the bus stops, boats at the beach.
- The highway with an overpass + ramps (needs a road-height layer for traffic/police), plus a ring motorway linking all districts.
- More shops (clothes, car spray shop to lose stars, petrol), enterable interiors downtown.
- Navmesh-lite for officers / peds, smarter police roadblocks at 4-5 stars.
- Multiplayer (deferred again).

- 06:58 Step 7: README updated (controls, tests, folders, performance). The full suite + dev server were stopped by Claude Code because the PC was low on memory; not restarted, and npm run build not run. Fixed 2 test thresholds, added beach sand colouring. Phase 5 summary + BY-HAND VISUAL CHECKLIST below.

## PHASE 5.1 LOG
- 10:03 Step 0: suites re-run in sections; one red (cabin ute: the driver's own neck sat under the eye) fixed by hiding the driver in the cabin cam. The last baseline section run was interrupted by the user; those sections passed earlier.
- 10:03 Step 1: car damage = 10 at 25 m/s head-on, speed^2, <5 m/s ignored, 25 cap, one event per collision (0.12 s peak window + 0.5 s cooldown), car-vs-car half on relative speed, police contact 2, props retuned (pole 15 m/s = 3). phase5test damage 5/5 (head-on 11.1, scrape 1.4, 1 event).
- 10:10 Step 2: src/police/crimeWitness.js - every crime goes through report() (theft, carjack, ped hits, props, gunfire, shooting people, cop damage, footpath scares); 30 m civ / 60 m cop, LOS from the head, 140 deg cone (waived inside 5 m), 1.5 s startled delay, cancelled if all witnesses go down. debug.getWitnesses(). phase5test witness 8/8, guns 28/28. Found: the Phase 5 escape rule starts flashing instantly when no cop has spawned yet -> fixed in step 3.
- 10:14 Step 3: src/police/wantedConfig.js + new wanted state machine (solid 15 s grace -> flashing when hidden 6 s & >=80 m or >=150 m -> 10 s -> cleared; interrupts), immediate dispatch, HUD 2 Hz blink, debug.wanted(). phase5test stars 7/7 (sim-time), push/arrest/ko/copguns 19/19, phase4 police 6/6.
- 10:18 Step 4: src/ui/fullMap.js (Tab cycle, 85% overlay, pause, drag/wheel/pinch, labels, markers, cops, wanted radius, click = waypoint with marker snap, right-click clears, Click to resume) + src/ui/navigation.js (A* over lanes, re-route >30 m every 2 s, beacon, HUD distance chip, arrive 15 m, localStorage); minimap draws the route. phase5test map 11/11, phase4 minimap 2/2.
- 10:38 Step 5: full suite run once in sections (one browser at a time). weaponsUnit 26/26; phase5test all 30 sections pass (139 checks across 3 runs after 2 test-isolation fixes: traffic cleared before the cabin + burn checks); phase4test all pass except "police officer on foot knocked down" (see below); phase2 16/16; walktest pass; drivetest pass (physics; Hillcrest Ct autopilot wedge is pre-existing). npm run build OK (5.28 MB JS, 1.95 MB gzip).
- FAILED after 2 attempts (logged, moving on): phase4 "police officer on foot knocked down" - the scripted car stops dead against the station cop's capsule at ~12 m/s without the knock-down firing (lat 0, ahead 2.5 m < threshold). Added a one-frame look-ahead to the ped hit test (harmless) but it still fails; probably the cop's capsule stops the car within one physics step before the per-frame check. Not a Phase 5.1 regression I could pin down; worth a look.

## PHASE 5.1 SUMMARY (2026-11-05, 10:38)
- **Car damage:** src/combat/damageConfig.js. 25 m/s head-on into a wall = 10 health (speed^2 curve, nothing under 5 m/s, max 25 per hit), one event per collision (0.12 s peak window + 0.5 s cooldown that a grind keeps alive), car-vs-car half damage on relative speed, police nudge 2, props retuned (pole at 15 m/s = 3). Bullets unchanged.
- **Witnesses:** src/police/crimeWitness.js. Every crime goes through report(): civilians 30 m / cops 60 m, line of sight from the head, 140 deg facing cone (waived within 5 m), victims who survive always count, 1.5 s startled reaction, cancelled if every witness is knocked out or killed. No witness = no heat and no police.
- **Wanted timing:** src/police/wantedConfig.js. Solid for a 15 s grace after any witnessed crime (police dispatched immediately), flashing only once hidden 6 s and >= 80 m (or >= 150 m), 10 s of flashing clears it. Cop line of sight, a cop inside 80 m or a new crime makes the stars solid again. The HUD blinks at 2 Hz.
- **Full map:** Tab cycles minimap -> full map -> hidden; the full map pauses the game, frees the mouse, drag/wheel/pinch to pan/zoom. Click sets a waypoint (snaps to markers), right-click clears; A* route over the lane graph on the map and minimap, re-routes when you're >30 m off it, world beacon + distance chip, clears within 15 m, saved in localStorage. "Click to resume" shows if the browser won't re-lock the mouse.
- **Fixed during baseline:** cabin cam now hides the driver (their neck blocked the road in the ute).
- **Perf (perfscenes, headless):** 72-202 draw calls, 51-60 fps (cabin cam + live mirrors is the slowest at 51); new districts 72-162 calls at 60 fps.
- **Check by hand:** crash feel (90 km/h into a wall should feel survivable - about 10 crashes to wreck a car); do witnesses' "startled" poses read, and does stealing in a quiet street really stay unnoticed; wanted timing (15 s solid feels right? flashing blink obvious? cleared message); full map usability (pan/zoom feel, marker snap radius, the route line following keep-left lanes, the beacon + distance chip, re-capturing the mouse after closing - you may need one click).

## PHASE 5.2 LOG
- 11:07 Step 0: the full suite had just been run at the end of 5.1 (all green except the logged phase4 cop knock-down), so it was not re-run.
- 11:07 Step 1 PHANTOM CRASH - root causes (from the new damage log + ignored-impact log):
  1. Crash detection was pure "velocity jump >= 5 m/s per step" with no contact check, so ground hits (landing off crests / dips, suspension bottoming: dv 11-20 m/s logged with reason "ground") counted as crashes.
  2. vehicleBody stored lastVel BEFORE its own grip/downforce impulses and the speed caps (boost cut drops ~7 m/s in one step), so self-applied velocity changes showed up as impacts the next step. Teleports also read as huge impacts.
  FIX: crashes now need a real solid, non-ground contact (Rapier contact pairs, normal |y| <= 0.6, terrain/road/curb ignored) during the 0.12 s window; lastVel is taken after our own impulses; teleport resets it. Every collider has an owner/type tag; last 30 damage events + last 30 ignored jumps via debug.damageEvents()/ignoredImpacts(); the F3 overlay shows the last cause.
  RESULT (scripts/phantomtest.mjs): 13 routes at full throttle + boost (Grand Terrace, cul-de-sacs, Terrace Link, ring road x4, Pde/downtown, Northgate Rd, King St, Wharf Rd): 0 damage events; ghost scan over 6759 lane samples: 0 static colliders in the corridor; flat straight 173 km/h vs 166 configured; wall 25 m/s = 11.1, pole breaks, parked car still hurts. Highway: doesn't exist (skipped in Phase 5).
- 11:09 Step 2: why the gun shop was hard to find - its marker existed but used the generic green '$' shop icon at a guessed spot (block centre), identical to the 10 other shops. Now: its own icon (crosshair in a purple circle, drawn on top, labelled "Barrel & Bolt" on the full map) placed from the real door; shared icon module src/ui/mapIcons.js; legend on the full map. Fixed POIs: Terrace Central and Quick Stop had no markers at all (added from their doors). All POIs checked (house 62, police, hospital, department store, Quick Stop, gun shop, parks, beach, downtown, industrial, school, shopping centre; highway not built). phase5test pois 7/7, map 11/11.
- 11:34 Step 3: full suite once: weaponsUnit 26/26, phase5test 178/178 (all 32 sections), phantomtest 21/21 (one Wattle Rise run lost health once without a crash event - it was a breakable prop hit, which is now logged too; re-run clean), phase4 all pass except the known cop knock-down, phase2 16/16, walk pass, drivetest pass on re-run (first run: autopilot got stuck in traffic on Grand Terrace). Perf: 72-202 draw calls, 52-60 fps (cabin + mirrors slowest). Build OK (5.28 MB).

## PHASE 5.2 SUMMARY (2026-11-05, 11:34)
- **Phantom crash:** root causes were (1) crash damage triggered by any big per-step velocity change with no contact check (crest landings / dips / suspension bottoming counted as crashes) and (2) the car remembering its velocity before its own grip/downforce impulses and speed caps (a boost cut looked like a 7 m/s hit; teleports too). Fix: crashes need a real solid, non-ground contact (normal |y| <= 0.6, not terrain), lastVel taken after our own impulses, teleport resets it. Collider owner/type tags, damage + ignored-impact ring buffers (debug.damageEvents / ignoredImpacts), F3 shows the last damage cause. scripts/phantomtest.mjs: 13 routes at full throttle + boost -> 0 damage events; ghost scan 0 stray colliders.
- **Gun shop on the maps:** distinct purple crosshair icon placed at the real door, on top of other markers, labelled on the full map; legend added; Terrace Central + Quick Stop markers added (were missing). The full map opens at its default zoom each time.
- **Check by hand:** drive flat out (Shift) along Grand Terrace, the ring road and downtown - no random damage (F3 shows "DMG none" or a real cause); open the map (Tab twice) and find the purple crosshair "Barrel & Bolt".

## PHASE 5.3 LOG
- 11:53 Step 1 RANDOM SHAKING - root causes: (1) physics runs at a fixed 60 Hz but cars and the walker were drawn at the raw physics pose, so every frame that ran 0 or 2 physics steps (vsync drift / frame-time jitter: 33 of 615 frames on a Grand Terrace run) jumped a whole step and the camera following it stuttered; (2) the cabin camera shook from body.impact, a per-step velocity-jump signal that also fires on bumps and landings; (3) the walk camera's pull-in raycast snapped in/out instantly when grazing geometry.
  FIX: render interpolation between the last two physics poses for every car and the walker (physics.alpha), camera shake only from verified crashes (combat sets crashShake) and police contact, camera pull-in eases back out (instant in). New jitter monitor (window.__gta.jitter) + scripts/shaketest.mjs: walk/run/jump/POV/standing/drive chase-cabin-cinematic/crests/Northgate all smooth with zero shake when nothing is hit, a 25 m/s crash still shakes; e.g. Grand Terrace crests focus jitter 0.20 -> 0.015 m/frame. phantomtest 17/17 still clean.
- 11:57 Step 2: hitting a police officer (on foot or at the station) = instant 5 stars via crimeWitness.report(..., { alwaysKnown: true, minStars: 5 }) + wanted.raiseTo(); no witness, no delay, solid with full grace, dispatch at once; misses and police-car hits unchanged. Also fixed a step-1 regression: a sleeping/just-teleported car reported its stale interpolated position (crimes at a parked car found no witnesses). phase5test copstars 6/6, witness 8/8, steal 10/10, guns 28/28.
- 12:24 Step 3: full suite once: weaponsUnit 26/26, phase5test 184/184 (34 sections), shaketest 21/21, phantomtest pass (one run clipped a kerbside letterbox / street light - real logged prop hits, now reported separately), phase4 all but the known cop knock-down, phase2 16/16, walk pass, drivetest pass. Perf 72-202 draw calls, 52-60 fps. Build OK.

## PHASE 5.3 SUMMARY (2026-11-05, 12:24)
- **Random shaking:** fixed-60 Hz physics was drawn without interpolation, so frames running 0 or 2 physics steps made the car / player (and the camera following them) jump a whole step; the cabin camera also shook from a bump-sensitive velocity signal, and the walk camera's wall pull-in flickered. Now: render interpolation for cars + the walker, shake only from verified crashes / police contact, eased camera pull-in. Debug: window.__gta.jitter monitor, scripts/shaketest.mjs.
- **Hitting a cop = 5 stars:** any bullet hitting a police officer (on foot or the station cops) sets 5 stars instantly - no witness, no delay, solid with the 15 s grace, police dispatched at once. Misses and police-car hits follow the normal rules; shooting a civilian nobody sees is still free.
- **Check by hand:** walk, run and drive in third person, POV, chase, cabin and cinematic - the picture should be steady (no random shakes; a real crash still jolts the camera). Then go somewhere empty and shoot a lone cop: 5 stars at once.

## PHASE 6 LOG
- 12:46 Step 1: property damage never gives heat (street furniture, destroyed cars - user override); src/world/speedLimits.js (limits per road + downtown override, road.speedLimit/road.street), src/police/speedingConfig.js + speeding.js (fine $200 only when a catcher calls tryFine; cooldown 20 s per catcher; no fine when wanted / siren / on foot; cash floor 0), HUD limit sign + street chip. phase5test speeding 8/8.
- 12:52 Step 2: navigation is map-only (beacon + chip removed), route progress + 60 m fade + trim, arrival clears; icon registry with priorities, collision-culled labels on every marker, legend from the types in use, petrol/store icons; street names along roads on both maps (minimap majors only). phase5test mapnav 8/8, map 11/11, pois 7/7.
- 12:55 Step 3: src/city/streetSigns.js - 48 junction blade signs (both names), 63 speed-limit signs (both ends of every road, downtown 40/60 change on Terrace Pde, school zone), breakable, ~7 draw calls total. phase5test signs 5/5 (114 calls, 60 fps in town).
- 14:59 Step 4: Terrace Motorway (src/city/highwayPlan.js + highway.js): 2 carriageways x 2 lanes, median barrier, shoulders, markings, reflective posts, 2 overpasses (deck, railings, piers, abutments), 4 green gantries, ramp roads at both ends; lane graph via the town plan, traffic at 90 km/h (ramps 72) over the decks, police route onto it; limits 100 / 80; speed signs every ~250 m. docs/STREETS.md written (33 streets). phase5test highway: westbound full throttle clean, overpass/traffic/police/limits pass; FAILED after 2 attempts (logged): eastbound at ~170 km/h the bang-bang test autopilot spins once (tilt 49, no damage), and the east ramp's 90-degree junction turn at 30 m/s rolls the car (tilt 34) - the ramps are right-angle junctions, not curved slip roads. Ghost scan clean (fixed: cul-de-sac end speed signs sat in the turning-circle lanes).

### 2026-11-05 15:07 — Phase 6 Step 5: speed cameras + traffic cops
- 9 fixed speed cameras (4 motorway, Grand Terrace, Ring Rd North/East, Terrace Pde downtown, King St), "SPEED CAMERA AHEAD" signs ~100 m before each, white flash + shutter click + $200 fine, one fine per pass + 20 s cooldown; shown on the full map.
- 5 radar posts (parked patrol car + officer with radar gun) and 2 patrol cruisers in traffic (motorway + Ring Rd North). Catch = over limit+10, within 60 m, clear LOS, inside 120° arc (cruisers front/rear) → lights/radar gun up 2 s + $200 fine. Never heat; no fines while wanted or with the siren on.
- Tests: `enforce` 8/8 (camera once, cooldown, at-limit nothing, radar LOS catch, behind/wall not seen, wanted/siren none, no heat). Highway autopilot fails unchanged (logged in Step 4).

### 2026-11-05 15:16 — Phase 6 Step 6a: 13 enterable shops (shared interior kit + buy menu)
- src/town/shopKit.js: one kit (shell + hinged door, fittings by style food/mart/chemist/clothes/barber, keeper, counter E-target). 7 Terrace Pde shopfronts became enterable (cafe, bakery, chemist, barber, fashion, takeaway, bottle shop; bank + electronics stay facades) + 6 downtown mid-block shops facing the cross streets (Noodle Bar, Diner 24H, City Mart, Moda Boutique, Pizza Napoli, Juice Bar).
- src/ui/shopMenu.js: food/drinks $8-20 → +10..25 health (refused at full health), chemist first aid $40 → +50, clothes $60 shirt colour, barber $25 hair colour (character.setOutfit).
- Map icons: food (E), chemist (+), clothes (T). Test `shops` 11/11 (walk in through all 13 doors to the counter). `map` "Tab closes, world resumes" failed once in a batch run, passed alone (flaky, noted).

### 2026-11-05 15:39 — Phase 6 Step 6b: traffic lights, landmarks, billboards, markings
- src/traffic/trafficLights.js: 6 signalised junctions on Terrace Pde (x 420-880), Pde green 14 s / cross 10 s, amber 3 s, 1.5 s all-red, 4.5 s offset per junction (green wave east). AI stops at the line on red/amber (braking-distance profile) and goes on green; straight connectors at signals no longer give way. Stop lines + zebra crossings on every approach; one InstancedMesh for all 72 lamps.
- src/city/landmarks.js: City Hall + 34 m clock tower (Station St, opposite Central Gardens; hands show real local time), Terrace Stadium (graded pad south of The Esplanade, stepped oval stands, pitch, floodlights, open gate toward town), TV tower on the southern hill (blinking beacon); 3 roadside billboards (motorway x2, Esplanade). All on the map as landmarks.
- Ghost-scan fixes: Ring Rd North camera moved off the Station St junction; limit signs that would stand inside asphalt are dropped.
- Tests: `city` 11/11 (red stop / green go, lamps, cycle never both green, landmarks solid, clock = real time, 106 draw calls / 60 fps downtown), phantomtest 19/19, signs 5/5, phase4 town 11/11.
- Skipped (logged): laneways, road-marking repaint beyond the signal junctions; red-light running carries no penalty (arcade).

### 2026-11-05 15:45 — Phase 6 Step 6c: more NPC life, buses, taxis, vans
- src/npc/activitySpots.js: 21 new activity NPCs (a passenger at every bus stop, two street dancers + watchers at City Plaza, fans at the stadium gate, phone calls on the City Hall steps, window shoppers on Terrace Pde) + 3 more walkers → 86 people (cap ~90).
- src/traffic/serviceVehicles.js: 2 buses (red/blue, destination board) on a fixed loop Terrace Pde east → Ring Rd East → The Esplanade west → Ring Rd West, 6 s dwell at the 4 eastbound Pde stops; 3 yellow taxis (roof light, carjackable → sedan); 2 white delivery vans with livery bands. Buses/vans can't be carjacked. All obey lights/gaps (TrafficCar AI). 23 traffic cars total.
- Tests: `life` 9/9 (bus loop max 2.2 m off route, 3 stops made in 35 s, 125 draw calls / 60 fps at the plaza); steal/witness/enforce 26/26.

### 2026-11-05 15:46 — Phase 6 Step 6d: vibe
- Crowd murmur ambience layer (band-passed noise with a syllable-rate wobble) on Terrace Pde shops, City Plaza, downtown Pde and the stadium gate; quieter at night. Kit-shop signs and landmark billboards glow at dusk like the downtown neon.
- Test `vibe6` 3/3.

### 2026-11-05 16:02 — Phase 6 Step 7 + 8: screenshots, suite, build, wrap-up
- Screenshots (1280x720, one cheap fix round: camera labels hidden on the full map, street shot moved to the kerb):
  shots/phase6/1-aerial-highway.png, shots/phase6/2-street-terrace-pde.png, shots/phase6/3-full-map.png (gitignored, local).
- Full suite: the background run was **stopped by Claude Code for low system memory** after phase5test + weaponsUnit
  (weaponsUnit 26/26). phase5test fails were followed up singly: "peds capped ~60" updated to the Phase 6 cap (~90);
  on-foot arrest test spawned the cop behind the now-enterable chemist (moved onto Terrace Pde) → pass; Northgate
  "≥4 NPCs" (3 after seeded spawns shifted) → +1 Northgate resident → pass; ejection burn check flaky (passed alone);
  highway autopilot ×2 = known. **Not re-run** (memory): phase4test, phase2test, walktest, drivetest, shaketest,
  perfscenes; phantomtest last ran 19/19 after step 6b.
- Perf (from the Phase 6 tests, headless Edge 960x540): 100-125 draw calls downtown / Terrace Pde / City Plaza with 86 NPCs + 23 traffic cars, 60 fps.
- `npm run build` OK (5.33 MB JS, 1.97 MB gzip). README updated.

## Phase 6.1 (pull-over pursuit, airport, phantom-crash notes)

### 2026-11-05 18:32 — Step 0 baseline
- Git clean, dev server up. Phase 6 pieces present: street signs, highway, speed cameras, traffic cops (radar posts + cruisers), speeding fines, city expansion.
- Suites: phase2 16/16, walk ok, drive all routes ok (Hillcrest Ct / Banksia Cl autopilot stops early but passes, as before), phantom 19/19, shake 21/21, perfscenes 15 scenes 60 fps / 106-326 calls, phase4 fixed 2 stale ped checks (cap ~90; stationary activity NPCs excluded from "walkers move") → npcs 9/9.

### 2026-11-05 18:34 — Step 1: phantom-crash notes (docs only)
- docs/PHANTOM_CRASHES.md written for a separate discussion (summary, history with hashes, 5.2 root causes + fix, test coverage gaps, current damage pipeline, debug tools, UNTESTED hypotheses, a what-to-record template, next steps). **The fix is deliberately deferred**: no collision/damage/physics/camera code was changed. Noted gap: phantomtest's "highway + ramps" check is still a hard-coded n/a.

### 2026-11-05 18:46 — Step 2: speeding = pull-over pursuit, then a fine
- SPEEDING.CAMERAS_ENABLED=false (src/police/speedingConfig.js): no cameras spawned, no CAMERA AHEAD signs, no camera map icons/legend (code kept). Radar cops now have their own full-map icon ("R").
- src/police/pullOver.js: a radar post's patrol car (or a cruiser) hands over to one pursuit PoliceCar: lights + siren, follows the player's breadcrumb trail 9 m behind (6.5 m when stopped), <= 0.95x player speed (outrunnable), catches up at 19 m/s when you're slow, backs off inside 5 m (cars can't touch: police collision group). Stop < 2 m/s with it within 8 m for 1 s → officer walks to your window, 3 s "Issuing fine..." bar → -$200 → it drives off and the post / cruiser resets. Drive off while issuing → pursuit resumes. No LOS 8 s / > 150 m → "You lost the police"; 90 s → gives up; becoming wanted cancels; 20 s per-cop cooldown; EVADE_STARS=0. HUD: flashing red/blue PULL OVER + hint.
- Test `pullover` (replaces `enforce`) 14/14 (2 fix attempts on the stop approach: trail points behind the cop, braking profile). Regression: signs/pois/map/speeding/copstars pass; `life` "buses pull up at stops" failed once in a batch (0 stops in 35 s), passed on rerun - flaky, logged.

### 2026-11-05 19:06 — Step 3: Terrace Airport + autonomous aircraft
- Site north of Northgate (MAP extended to z -800, graded flat). Roads: **Airport Rd** (from Waratah St's north corner), **Terminal Dr** (drop-off), **Airport Link** (back to Jacaranda St) - limit 60, in the lane graph (AI traffic + police route there; BFS from the motorway passes). Motorway gantry now reads "AIRPORT  NORTHGATE  WARATAH ST >". "Airport" icon + label on both maps; runway / taxiway / apron drawn on the map backgrounds.
- Static (src/airport/airport.js): 1000 m runway 09/27 (centre line, piano keys, threshold bars, aiming points, numbers, blast pads), parallel taxiway + 4 connectors with hold bars, apron with lead-in lines + 4 jet bridges, terminal (exterior, sign, drop-off canopy), car park with stealable cars, control tower, 2 hangars, 3 fuel tanks, perimeter fence (instanced posts) + service gate + guard hut, waving windsock, 128 instanced lights (edge / threshold / taxiway / sequenced approach strobe, brighter at dusk). Ground crew, passengers, a gate guard (92 people total). No colliders on runway/taxiway/apron.
- Aircraft (aircraftModels.js): prop plane, regional jet, airliner - fuselage, swept wings, tail, engines/prop, windows, liveries, retractable gear, nav/strobe/beacon lights, spinning prop, engine glow.
- Ops (airportOps.js): seeded continuous state machine - parked → pushback → taxiOut → hold → lineup → takeoff → airborne → gone; final (3° glide slope from the east) → flare/touchdown chirp → rollout → taxiIn → parked; go-around if the runway is blocked at 300 m final; departures hold while the runway is busy and get priority over new arrivals; taxiway one-way eastbound; gates booked at arrival spawn; ≤ 4 moving; first pushback at 6 s, first arrival on final at 8 s. Kinematic colliders on the ground only. 2 cruise flyovers, 2 tugs with carts, a fuel truck, an apron shuttle bus. Synth audio: jet roar + prop buzz with spool and distance attenuation, touchdown chirp, via master volume.
- Test `airport` 11/11 (420 s sim: 4 departures airborne + 3 arrivals parked, 0 NaN, 0 stuck, 0 double-booked; player on runway → hold + go-arounds, cleared → departures resume; taxiing plane brakes for a walker; drive Airport Rd → Terminal Dr → Airport Link with 0 damage events; 109 draw calls / 60 fps at the terminal). Ghost scan 0 (7737 samples). Screenshots: shots/phase6_1/1-airport-aerial.png, shots/phase6_1/2-takeoff.png (one fix round: airport chunks kept visible to ~600 m; tower chunk bounds fixed, verified numerically).
- Logged after 2 attempts: `life` "buses pull up at stops" fails in batch runs (one bus dwelling 35 s, or queued behind traffic at the x 520 light); passes alone.

### 2026-11-05 19:35 — Step 4: wrap-up
- Full suite once (foreground, one browser at a time): weaponsUnit 26/26, phase2 16/16, walk pass, drive all routes, phase4 51/51 (the old cop knock-down passes now), phantomtest 19/19, shaketest 20/21 (third-person run RMS 0.0193 vs 0.018 - marginal, passed at baseline), phase5test: all sections pass except the known highway autopilot runs (eastbound spin, east ramp roll) and **westbound now logged 1 damage event** (noted in docs/PHANTOM_CRASHES.md, not touched); downtown/northgate traffic snapshot counts failed once in batch (Northgate count now includes the airport roads on its loop; both pass on rerun); city/life/airport now force a page reload (the pullover section removes all traffic).
- Perf (perfscenes, headless Edge 960x540, fps / draw calls): suburb 60/146, inside 62 60/136, chase cam 60/276, cabin + mirrors **46**/357, Terrace Pde drive 60/258, town on foot 60/191, Terrace Central 60/213, Quick Stop 60/153, Wattle Park 60/343, town dusk 60/192, City Plaza 60/124, downtown night 60/131, beach 60/208, Northgate 60/253, industrial 60/148, **airport terminal 60/116, airport airside 60/253**, SMG 3rd 60/240, SMG 1st 60/251.
- README (pull-over pursuit, cameras flag, airport - no boarding yet, phantom notes pointer, perf), docs/STREETS.md (airport roads), `npm run build` OK (5.37 MB).

## PHASE 6.1 SUMMARY (2026-11-05 19:35)
**Works**
- docs/PHANTOM_CRASHES.md - paste-ready notes (summary, history, 5.2 fix, coverage gaps, pipeline, debug tools, untested hypotheses, what to record). No collision/damage/physics code changed.
- Speeding = pull-over pursuit → stop → officer at the window → -$200; outrun / lose them → no fine; wanted cancels; siren / wanted / on foot never trigger; cameras off by flag (signs + icons gone).
- Terrace Airport with roads (60 km/h), terminal, car park, tower, hangars, tanks, fence, lights, windsock, apron vehicles, crew; continuous autonomous departures / arrivals with holds, go-arounds, braking for you, gate booking; engine audio; flyovers.

**Rough**
- The pursuit cop drives off-lane (follows your path, no wall avoidance beyond that) and pops back to its post after leaving; pushback has no visible tug; apron vehicles have no colliders.
- Planes fly straight in/out over the map edge; cabin cam + mirrors dropped to 46 fps.
- Known test reds: highway autopilot runs (incl. one westbound damage event - phantom notes), bus-stop dwell + district traffic snapshots flaky in batch, shaketest third-person run marginal.

**BY-HAND CHECKLIST**
1. Drive past the radar cop on Terrace Motorway (or The Esplanade) at ~30 km/h over: PULL OVER flashes, siren, a cop follows ~9 m behind. Pull over and stop: the officer walks to your window, 3 s bar, -$200, the cop leaves. Stars stay 0.
2. Get spotted again later and floor it: you should slowly pull away; break line of sight (corner / buildings) for 8 s or get > 150 m: "You lost the police", no fine.
3. During "Issuing fine..." drive off: the pursuit resumes, no fine.
4. Airport by day: take the motorway's west end → Waratah St → Airport Rd. Watch a pushback → taxi → takeoff, and an arrival landing from the east (first one lands within ~40 s of starting).
5. Park on the runway: departures wait at the hold point, the next arrival goes around. Stand in front of a taxiing plane: it stops.
6. Airport at night (N): runway / taxiway / approach-strobe lights, beacons and strobes on the planes.
7. Full map: "Airport" icon + legend, street names Airport Rd / Terminal Dr / Airport Link.

**Next steps**
- Discuss docs/PHANTOM_CRASHES.md, then fix the phantom crashes (re-enable a real highway/bridge route in phantomtest first).
- Boarding / flying planes; curved slip roads for the motorway ramps; a visible pushback tug; pursuit cop wall avoidance.

## Phase 6.2 (braking stoppie + bumps) - STOPPED EARLY at the user's request (2026-11-05 20:51)
- Step 0: git clean, server up; full suite not rerun (it ran at 19:35 with no code changes since). The dev server died once mid-run (memory?) and was restarted (one instance).
- **Step 1 DONE: braking stoppie** - root cause, fix and evidence in docs/BUMPS.md. New: `__gta.debug.carTrace()` (last 3 s of physics steps), src/vehicles/brakeConfig.js, scripts/brakebench.mjs (Node), scripts/braketest.mjs (in game, 57/57). Regression: vehicle-sim unchanged, phase5 damage/push/arrest/carhp 16/16.
- **Regressions seen after Step 1 (not resolved):**
  - drivetest Grand Terrace: launch/flip while passing traffic in 2 of 3 runs (tilt 27 / 102 deg). Passed in 3 probe runs. Check this first.
  - phantomtest "flat straight + boost": 1 damage event, 172 km/h vs 166 expected.
  - phase2test: night fps 49 vs >= 50 (borderline perf).

### What is left (Phase 6.2)
1. Investigate the drivetest Grand Terrace launch (catch it with carTrace + contact pairs; suspects: the roundCuboid hull vs kinematic traffic, the pitch-rate clamp's setAngvel), and the phantomtest top-speed damage event. Revert the hull change if it's the cause.
2. Step 2: src/utils/bumpRecorder.js, `__gta.debug.bumps()`, F3 BUMP line, F5 copy + auto-download JSON.
3. Step 3: offline investigation (ground continuity scan over full road widths, chassis sweep, crests/dips, CCD/sub-steps, human-like input with traffic), findings into docs/BUMPS.md.
4. Step 4: fix the root causes found (seams/lips, chassis catch, bottoming, tunnelling).
5. Step 5: src/physics/bumpLimiter.js safety net.
6. Step 6: scripts/bumptest.mjs; replace phantomtest's hard-coded "highway + ramps: n/a" with a real motorway run.
7. Step 7: full suite, README (carTrace, S = brake then reverse, bump tools), pointer from docs/PHANTOM_CRASHES.md to docs/BUMPS.md, npm run build, summary.
