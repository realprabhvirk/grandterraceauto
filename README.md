# Grand Terrace Auto

A low-poly, GTA-style open-world shell that runs in the browser: a hilly suburb loosely
inspired by Woodlands Estate, Waterford QLD, built around the hero house
**62 Grand Terrace** (modelled on the photo in `reference/house62/`).

- **Phase 1:** terrain, winding roads + 3 cul-de-sacs, 32 houses, trees, the hero house, lighting, walking.
- **Phase 2:** 8 drivable procedural cars (arcade raycast-vehicle physics), enter/exit, chase cam,
  synthesised car audio, HUD, a proper animated character with crouch + emotes, day/night with street lights.

Three.js r187 + Rapier 0.21 (WASM physics) + Vite 8, vanilla JS modules.

## Start it

Everything runs from a portable Node inside this folder (no admin, no global installs).
Always go through `dev.cmd`, which puts `.tools\node` on PATH for that one command:

```powershell
.\dev.cmd npm install     # first time only (or after pulling new dependencies)
.\dev.cmd npm run dev     # then open http://127.0.0.1:5173/
```

If `.tools\node` is missing (fresh clone), re-download the portable Node zip from
nodejs.org into `.tools\node` (see DECISIONS.md for the exact version).

Click the game once: that captures the mouse (Esc releases it) and unlocks the audio
(browsers only allow sound after a click).

## Controls

### On foot
| Key | Action |
| --- | --- |
| W A S D | walk (camera-relative, smooth acceleration) |
| Shift | run |
| Space | jump |
| Ctrl | crouch |
| 1 / 2 / 3 / 4 | emotes: wave / dance / sit / point (any movement interrupts) |
| Mouse / arrow keys, wheel | orbit camera, zoom |
| **F** | get into a car (when "Press F to drive" shows) |

### Driving
| Key | Action |
| --- | --- |
| W | accelerate |
| S | brake, then reverse |
| A / D | steer (eased, less lock at speed) |
| Space | handbrake (rear slides) |
| Shift | boost |
| H | horn |
| L | headlights |
| B | look behind |
| R | flip upright / reset |
| Mouse, wheel | orbit the chase camera (it swings back behind when you drive), zoom |
| **F** | get out (below ~30 km/h; the car brakes to a stop on its own) |

### Anywhere
| Key | Action |
| --- | --- |
| N (or T) | toggle late afternoon <-> dusk/night (windows glow, street lights + headlights on) |
| ? (or H on foot) | show / hide the controls panel |
| M | mute |
| F2 | debug free-fly camera (WASD, Space/E up, Ctrl/Q down, Shift fast, 1-7 camera presets) |
| F3 | FPS / draw calls / triangles overlay |
| F4 | show physics colliders |

URL options: `?cam=hero-photo` (or `hero-front`, `hero-34`, `hero-porch`, `hero-car`, `street`,
`overview`, `top`, `culdesac`, `junction`, `sign`, `cars`) starts the debug camera at that view;
add `-dusk` (e.g. `?cam=hero-photo-dusk`) for night; `?hud` shows the F3 overlay; `?shot` hides the panel.

## Self-tests (Playwright driving the installed Microsoft Edge - no browser download)

```powershell
.\dev.cmd node scripts/phase2test.mjs    # spawn -> walk to hero car -> F -> drive -> get out -> emotes -> night (16 checks, shots/phase2/)
.\dev.cmd node scripts/walktest.mjs      # walking, porch step, wall collision, jump, F2
.\dev.cmd node scripts/drivetest.mjs     # autopilot the length of Grand Terrace + into each cul-de-sac; checks height/tilt
.\dev.cmd node scripts/shot.mjs          # screenshots of every preset into shots/, fails on console errors
.\dev.cmd node scripts/vehicle-sim.mjs   # headless car tuning bench (0-100, top speed, braking, roll, crest jumps)
```

## Folder structure

```
dev.cmd                    portable-Node wrapper (session-only PATH)
reference/house62/         the photo 62 Grand Terrace is matched to
src/
  main.js                  renderer, loop, wiring
  art/                     palette.js (every colour), materials.js (shared materials, night glow)
  world/
    world.js               builds everything in order, spawn, bushland groves
    terrain.js             seeded hills, flat under roads + lots, Rapier-identical triangulation
    roadNetwork.js, roads.js   splines + asphalt/kerbs/footpaths/turning circles/fillets
    layout.js              hero site, lots, driveways, kerb crossovers
    houses.js, houseParts.js   4 instanced house variants + shared building parts (hip roofs with caps)
    heroHouse62.js         62 Grand Terrace - all dimensions/colours are constants at the top
    streetLights.js, signs.js, trees.js, driveways.js, lighting.js
  physics/
    physicsWorld.js        Rapier world, collision groups, fixed 60 Hz step
    debugDraw.js           F4 collider view
  vehicles/
    carTypes.js            hatch / sedan / ute / 4WD proportions + physics tuning
    carModels.js           procedural car geometry      carMaterials.js  shared light states
    vehicleBody.js         raycast vehicle + arcade assists (three-free, testable in Node)
    car.js, wheels.js      visuals (instanced wheels)   vehicleManager.js  all cars, grip lookup
    spawns.js              seeded spawn list            chaseCamera.js, headlightRig.js
    exitSpot.js            safe place to stand when leaving a car
    autopilot.js           debug autopilot used by the tests
  player/
    controls.js            walk / drive / fly modes, enter/exit transitions
    thirdPerson.js         character controller + walk camera
    character.js           jointed low-poly character, procedural poses
    interact.js            interaction prompt system (cars now, doors later)
    input.js, flyCam.js, presets.js
  audio/carAudio.js        WebAudio engine, horn, screech, thud (no audio files)
  ui/                      hud.js (speed + tacho), prompt.js, controlsPanel.js, uiStyle.js
  utils/                   seeded RNG, noise, geometry helpers, F3 overlay, debugApi.js
scripts/                   Playwright tests + tuning bench
```

## Matching the real 62 Grand Terrace

Open `src/world/heroHouse62.js`: the `COL` and `DIM` blocks at the top drive the whole
model (wall blocks, roof pitches, window positions, door, garage, beds, fences, letterbox,
gums). Colours live in `PALETTE.hero` in `src/art/palette.js`.

## Performance

~60-100 draw calls including the shadow pass (budget 350), ~240k triangles, 60 fps in the
headless Edge test on this Ryzen 5 7530U. Pixel ratio capped at 1.5, one 2048 shadow map
that follows the player, instanced houses/trees/wheels/street lights, merged static
geometry, shared materials, no post-processing.
