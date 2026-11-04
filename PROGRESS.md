# Progress

Timestamped log of the autonomous Phase 1 build.

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
