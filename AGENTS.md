# AGENTS.md - Grand Terrace Auto (read ALL of this before touching anything)

## What this is
A low-poly, GTA-style open-world game that runs in the browser: Three.js r187 + Rapier 0.21 (WASM physics)
+ Vite 8, vanilla JS modules. Hobby project for the owner (Mr Virk) and four friends. Built so far by Claude
Code; you (Codex) are taking over. Repo: https://github.com/realprabhvirk/grandterraceauto.
Hero house: 62 Grand Terrace (src/world/heroHouse62.js); the player spawns outside it.
Art direction: stylized, flat-shaded low-poly, cohesive palette. It must NOT look like generic AI output.

## Environment (hard constraints)
- Windows work PC, NO admin/UAC. AMD Ryzen 5 7530U integrated graphics, 16 GB RAM. It has run out of memory
  before and killed the dev server.
- Node is portable inside the project (.tools\node). ALWAYS run node/npm/npx through .\dev.cmd
  (e.g. `.\dev.cmd npm run build`). Never install anything globally, never touch system settings, PATH or
  the registry.
- PowerShell. Be careful with quoting. Check the real clock with `Get-Date` before writing timestamps.
- LOW RAM: one browser instance at a time (tests drive the installed Microsoft Edge through Playwright,
  headless 960x540), close it after each test, never run suites in parallel, don't run `npm run build`
  unless asked.

## Dev servers (IMPORTANT)
- The owner's dev server runs on http://127.0.0.1:5173/ (maybe a backup on 5174). NEVER stop, restart or
  kill those. Never run taskkill on node.exe or msedge.exe broadly.
- Start YOUR OWN server on port 5180. If vite.config.codex.mjs doesn't exist, create it: import the existing
  vite.config.js and merge server {port: 5180, strictPort: true} and cacheDir 'node_modules/.vite-codex'
  (so the two servers don't share a dependency cache). Check the port is free first, then run it in the
  background: `.\dev.cmd npx vite --config vite.config.codex.mjs`.
- Don't edit vite.config.js or package.json dependencies unless a task truly needs it (Vite restarts the
  owner's server when vite.config.js changes). Adding npm scripts is fine.
- scripts/*.mjs default to port 5173. If the URL is hard-coded, add an env override (GTA_URL, default
  unchanged) so you can test against 5180. Log the change.
- Both servers serve this same folder, so the owner's open tab reloads when you save files. That's expected.

## Git rules
- Branch `codex-work` only. Commit after every finished sub-task with a clear message, then
  `git push origin codex-work`. If a push fails (auth/network), don't try to fix credentials: log it once in
  PROGRESS.md and keep committing locally. Never force-push. Never rewrite history.

## Where things are
README.md (controls, test commands, folder structure), PROGRESS.md (full history; add your entries under a
"## CODEX LOG" heading), DECISIONS.md (judgement calls, one line each), docs/PHANTOM_CRASHES.md,
docs/STREETS.md, docs/MASTER_PLAN.md (your task queue + status), docs/tasks/<id>.md (per-task plans/reports).
Source layout: src/world, vehicles, physics, player, camera, combat, police, weapons, districts, town, city,
traffic, npc, airport, audio, ui, utils. Tests: scripts/*.mjs (README lists them).

## Conventions (don't break these)
- Exactly ONE shadow-casting light. All colours come from src/art/palette.js, shared materials from
  src/art/materials.js. Seeded RNG everywhere (no Math.random for world content).
- Performance: instance or merge repeated geometry, pooled objects, no per-frame allocations, pixel ratio cap
  1.5, draw-call budget < ~500 (raised to ~600 by the world-fill task), fps >= 45 in the headless run.
- Physics is a fixed 60 Hz Rapier step with render interpolation (physics.alpha). Colliders are tagged
  {type, owner} (src/physics/physicsWorld.js).
- Gameplay numbers live in config files (damageConfig, wantedConfig, speedingConfig, speedLimits,
  weaponStats, and any new config you add). Don't hard-code numbers elsewhere.
- Crimes go through src/police/crimeWitness.js report(). Traffic keeps LEFT (Queensland).
- Debug tools: F2 fly cam, F3 overlay (fps/draw calls/last damage), F4 colliders, window.__gta.debug
  (damageEvents(), ignoredImpacts(), wanted(), teleportLocal(), etc).
- Content rules: arcade GTA-style, hitscan guns only, no blood/gore, no explosions, adults only (no child NPCs).
- Military content is fictional: invented names, palette colours, NO real-world insignia, flags or unit
  markings. Tanks/soldiers only fire blanks (flash, dust, sound) at targets. Nothing military can hurt the
  player or NPCs unless a config flag says so (default off). Animals never show injury: if hit they are
  knocked down and get up (like people) or scatter.

## Current state (end of Phase 6.1)
Done: suburb with 62 Grand Terrace (interior), cars (4 types, raycast vehicle), cameras (third/first person,
chase/cabin/cinematic), health/cash/damage, car theft, wanted stars + police (soft contact, arrests, cutscenes),
guns + gun shop, Terrace Town Centre + Downtown + Beach + Northgate + Industrial districts, 13+ enterable shops,
Terrace Motorway (overpasses), traffic lights, buses/taxis/vans, ~90 NPCs with roles, street signs, full map
with waypoint routing, speeding = pull-over pursuit then a $200 fine (cameras disabled by flag), Terrace
Airport with autonomous planes (no boarding yet).
KEYS CHANGING in this queue: T becomes the music player; emergency lights/siren move to Y.

## Known issues (don't "fix" unless a task says so)
- Pressing S at speed can nose-dive the car and lift the rear (a stoppie), and there are random violent bumps
  at speed. Both are queued tasks.
- Motorway ramps are right-angle junctions; the highway autopilot test runs spin/roll (test + ramp problem).
- Flaky in batch runs: bus-stop dwell test, district traffic snapshot counts, shaketest third-person run.
- Cabin camera with live mirrors is the heaviest view (~46 fps headless).

## HOW YOU MUST WORK (this matters more than speed)
You tend to optimise for speed. On this project that is the wrong trade-off. The owner wants correct,
verified results and has said to take as long as needed.
1. Read before you write. For every task read the existing code involved (grep names, read whole relevant
   modules and how they're tested) BEFORE planning. Never assume how something works.
2. Restate the task in your own words, break it into numbered sub-tasks, and write the plan to
   docs/tasks/<task-id>.md before touching code. Commit the plan.
3. Do ONE sub-task at a time, in order. For each: smallest change that does it properly, write or extend a test,
   run that test AND the regression tests that could be affected, read the output, then commit and move on.
4. Never claim something works unless you ran it and saw it. "Should work" is not allowed. If you can't verify
   something, say so plainly in the report.
5. If a test fails, find the root cause. Never weaken, delete or skip a test to get green. If a test is
   genuinely wrong or flaky, say why and fix it explicitly. Known-flaky tests: re-run singly first.
6. No drive-by refactors, renames or reformatting. Small diffs in the existing style. No new dependencies
   without a very good reason (say so).
7. Re-read your own diff before every commit. Check edge cases (night/day, every car type, all camera modes,
   first frame, teleports, game paused, the car being destroyed).
8. Don't stop at the first thing that looks done: finish the acceptance checklist item by item with evidence.
9. Final report per task: what changed (files), what you tested (commands + results), what you could NOT
   verify, anything surprising, what the owner should check by hand.
