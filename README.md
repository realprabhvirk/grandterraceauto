# Grand Terrace Auto

A low-poly, GTA-style open-world shell that runs in the browser. Phase 1: a hilly
suburb loosely inspired by Woodlands Estate, Waterford QLD, with the hero house
**62 Grand Terrace**, third-person walking and a debug fly camera.

Three.js r187 + Rapier 0.21 (WASM physics) + Vite 8, vanilla JS modules.

## Start it

Everything runs from a portable Node inside this folder (no admin, no global installs).
Always go through `dev.cmd`, which puts `.tools\node` on PATH for that one command:

```powershell
.\dev.cmd npm install     # first time only (or after pulling new dependencies)
.\dev.cmd npm run dev     # then open http://127.0.0.1:5173/
```

If `.tools\node` is missing (fresh clone), re-download the portable Node zip from
nodejs.org into `.tools\node` (see PROGRESS.md / DECISIONS.md for the exact version).

## Controls

| Key | Walk mode (default) | Debug fly mode |
| --- | --- | --- |
| Click | capture mouse (pointer lock) | capture mouse |
| Mouse / arrow keys | orbit camera | look |
| W A S D | walk (camera-relative) | fly |
| Shift | run | fly fast |
| Space | jump | up (also E) |
| Ctrl / Q | - | down |
| Mouse wheel | zoom camera | - |
| 1-5 | - | jump to presets: hero front, hero 3/4, street, overview, top-down |
| **C** | switch to debug fly | back to walking |
| **T** | toggle afternoon / dusk (window glow, wall lights) | same |
| **F3** | FPS / draw calls / triangles overlay | same |

URL options: `?cam=hero-front` (or `hero-34`, `hero-porch`, `street`, `overview`, `top`,
`culdesac`) starts the debug camera at that view; add `-dusk` (e.g. `?cam=hero-34-dusk`)
for dusk lighting; `?hud` shows the F3 overlay on load.

## Self-tests

```powershell
.\dev.cmd node scripts/shot.mjs              # screenshots of every preset into shots/, fails on console errors
.\dev.cmd node scripts/shot.mjs hero-34-dusk # just one view
.\dev.cmd node scripts/walktest.mjs          # drives the player in real Edge: path, porch, wall collision, jump, C toggle
```

Both use Playwright with the installed Microsoft Edge (`channel: 'msedge'`), so no browser download.

## Folder structure

```
dev.cmd                 portable-Node wrapper (session-only PATH)
index.html, vite.config.js
src/
  main.js               renderer, loop, wiring
  art/palette.js        THE colour palette - every colour in the game comes from here
  art/materials.js      shared flat-shaded Lambert materials, dusk glow
  world/
    world.js            builds everything in order, spawn point, bushland groves
    terrain.js          seeded hills, flattening under roads + lots, triangle-exact getHeight
    roadNetwork.js      Grand Terrace spline (9 segments) + 3 cul-de-sacs, vertical profiles
    roads.js            asphalt / kerbs / footpaths / turning circles + fillets (1 draw call)
    layout.js           hero site selection, house lots, driveways, kerb crossovers, yard trees
    houses.js           4 instanced house variants
    houseParts.js       windows, doors, garage doors, hip + gable roofs (shared with the hero)
    heroHouse62.js      62 Grand Terrace - tweakable constants at the top of the file
    driveways.js, signs.js, trees.js, lighting.js, physics.js
  player/
    controls.js         walk <-> fly mode manager, hints
    thirdPerson.js      Rapier character controller + orbit camera
    flyCam.js, input.js, character.js, presets.js
  utils/                seeded RNG, noise, geometry helpers, F3 overlay
scripts/                shot.mjs (screenshots), walktest.mjs (movement test)
reference/house62/      drop photos of the real house here
```

## Matching the real 62 Grand Terrace

No reference photos were supplied, so 62 is an original modern Queensland two-storey.
Open `src/world/heroHouse62.js`: the `COL` (colours) and `DIM` (dimensions, window and
door positions, porch, garage, hedge, fences, solar panels) blocks at the top drive the
whole model. Colours live in `PALETTE.hero` in `src/art/palette.js`.

## Performance (Phase 1)

~58 draw calls including shadow pass, ~220k triangles. Pixel ratio capped at 1.5,
one 2048 shadow map that follows the player, instanced houses and trees, merged static
geometry, shared materials, no post-processing.
