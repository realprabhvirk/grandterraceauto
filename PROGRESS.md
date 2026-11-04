# Progress

Timestamped log of the autonomous Phase 1 build.

## 2026-11-04

- 18:53 Setup verified: `.\dev.cmd node -v` = v26.13.0, npm 11.20.0, three 0.187, rapier3d-compat 0.21, Vite 8. Added vite.config.js, shots/ to .gitignore.
- 19:10 Step 1 done: terrain, palette, lighting, fog, F3 overlay (commit 520e71e).
- 19:40 Steps 2-4 done together: road network (Grand Terrace 9 segments + Hillcrest Ct, Banksia Cl, Wattle Rise), kerbs, verges, footpaths, turning circles with kerb rings, street signs (1 atlas draw call), lot layout, 32 instanced houses (4 variants), driveways with kerb crossovers, 22 instanced yard trees. 43 draw calls total.
  - Fixed: asphalt rendered near-black (light units + tone-mapper toe); THREE.Clock -> Timer; PCFSoftShadowMap removed in r187 -> PCFShadowMap.
- 20:15 Step 5 done: 62 Grand Terrace hero house (src/world/heroHouse62.js) with all checklist items, dusk window glow + lamps. 48 draw calls total. Rough: faint dotted PCF shadow edge under eaves; frangipani crown a bit mushroom-like.
- 20:45 Step 6 done: Rapier heightfield + house/hero/trunk colliders, third-person walk, free-fly debug cam (C), spawn outside 62. scripts/walktest.mjs (real Edge, simulated keys) passes all 7 checks: path walk, porch autostep, wall stop, back-pedal, jump, C toggle.
- 21:20 Step 7 polish: soft shadows, palette pass, bushland groves, hero lawn stripes/driveway joints/frangipani, cul-de-sac fillets, brighter dusk. Floating check: worst house-corner gap 2.3 cm across 32 houses. Production build OK.
- 21:25 Step 8: README.md written.
- 21:40 Perf probe on THIS machine (AMD Ryzen 5 7530U, Radeon iGPU via ANGLE D3D11): uncapped loop ~2.0 ms/frame CPU-side (~500 fps); shadows off / half-res / no terrain barely change it. The ~43 fps the F3 overlay shows in headless screenshots is headless frame pacing, not a GPU limit. Headless can't time the GPU itself, so confirm with F3 in a real window.
- 21:40 Verified street signs render (BANKSIA CL / GRAND TCE) and the F3 overlay (58 draw calls, 221k tris).

---

## FINAL SUMMARY (2026-11-04, ~21:50)

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
