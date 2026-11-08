# Task004 D2 - Westbank Ridge Wind Farm

## Intent and reads

D1 is complete and pushed in57ef130 (static b6ad89e). Build a recognisable operating wind farm on
the lower western ridge: three tall turbines, real public access outside the future garrison fence,
walkable turbine approaches, a maintenance yard, reactive adult technicians, a loaded utility cart,
shared synth/night treatment and actual map/sign/coverage integration. Finish both sub-tasks and their
acceptance, then D3solar and the entire remaining queue. No screenshots/build/dependencies/song files.

Read before planning: terrain and grading/protection tests; rural plan, grid-following road meshes,
directed lane returns/shoulders/signs/speed limits; RoadIndex and native boundary; complete D1 builder,
config/ground geometry, exact convex descriptors, machinery/models/audio and tests; farm turbine pumps,
work routes, pedestrian/native walking slope limit50degrees, town chunk culling/update order,
airport kinematic collider pattern, map registry and coverage adapter. Reuse these systems; do not
change vehicle handling, original terrain extents, original roster/RNG, master audio or render quality.

## Measured fit (read-only native5180 surveys,2026-11-08)

Logs: `codex-004-D2-native-survey.log` and `codex-004-D2-west-ridge-survey.log`; one closed Edge each.
Original D1 survey source preserved in ignored `codex-004-D1-survey-probe-source.log`.

| Candidate | Actual evidence and decision |
| --- | --- |
| Inland ridge x~-385,z[-180,100] | Clear sampled columns, natural heights71.5-83.5m, but adjacent roads at-4.4m and sharp intervening grades. Do not put a short flat spur through this ridge or assume road reachability. Preserve this high landscape for later reserve/quarry fit rather than requiring a large access cut/viaduct just for turbines. |
| Western x=-1480/-1460 | Natural heights12-26m; x=-1480 is outside the physical playable wall and x=-1460 intersects it. Reject these foundations, despite empty map cells. Map x0=-1500 does not imply its whole margin is playable. |
| Lower ridge x=-1453,z=-510/-320/-120 | Native3m-halfwidth/15m-halfdepth/70m-high above-ground turbine columns clear; physical wall remains7m west of mast centres. Actual centre heights11.536...,7.391...,9.051...m, above nearby-4.4m developed plain. Preserve raised ridge; use only small foundation pads, no whole-ridge flattening. Face rotors east, keeping blade sweeps in Y/Z so they stay inside the wall. Full visible/native sweep/boundary clearance still required. |
| Public strip x=-1420,z[-580,-65] | Sampled24x24m above-ground columns clear and sampled ground-4.400000095m. This sits20m west of planned garrison fence x=-1400 and40m east of physical boundary. Extend public access south to Creek Valley Rd via a new link; do not require driving through future military gates. |
| Southern connection x[-1420,-1360],z~180 and spine nearz100 | Clear sampled columns, but existing ground nearx=-1420 is23-24m, unlike the flat northern strip. Explicitly grade the new road corridor to-4.4m, with existing terrain blends; record this local cut, never call it already flat. Full corridor/native/old-road checks precede completion. |
| Yard near(-1434,-65) | Sampled clear, western side rises from plain; a small declared maintenance grade is needed. Keep buildings/cart/workers west of the public road and east of turbine foundations; preserve future garrison perimeter. |

These are preliminary sampled fit results, not clearance of every intervening rectangle. Survey rays
use1mm offsets and actual native terrain; full envelopes, native walking and new roads are acceptance
tests. Existing developed geometry/landmarks/roads and original63.980116%coverage baseline stay fixed.
Current actual unused land75.7751002%; don't count a wind-farm bounding rectangle as developed land.

## Numbered implementation and acceptance

1. **D2a native site, public access and static kit (test first, verify, commit/push).**
   - Add `windConfig`/`windFarm` under industry. Three foundations/masts at(-1453,-510),(-1453,-320),
     (-1453,-120),~30m masts and east-facing nacelles. Small8-sided foundation/shaft convex solids use
     the exact visible vertices and tags. Rotor blades/working mechanisms explicitly follow in D2b;
     don't display non-solid temporary blades. Native full envelope stays east of physicalx=-1460
     and outside future garrison x=-1400. Do not change either boundary.
   - Declare small foundation pads (roughly3.2m half-width/depth,2.5m blend, measured11.55/7.4/9.05m)
     and yard near(-1434,-65),~20x48m at-4.4m with4m blend. Add these to existing terrain-lot input,
     preserving original developed ground. A low foundation lip must be walkable, not a floating slab.
   - Add public40km/h gravel `Ridge Link` from(-1360,180) to(-1420,180),60m, and `Turbine Rd` from
     (-1420,180) to(-1420,-580),760m. Both real graph/shoulders/signs/limits; north dead-end uses the
     existing rural-only return. Cut only their declared terrain corridors. Full footprints and native
     player/traffic U-turn must clear wall, turbines, yard and future fence. Map marker/sign at actual
     yard access, icon/label/legend `Wind farm`; unique real street names.
   - Yard hut, electrical cabinets, cable spools/racks, native mounted lamps/shared heads/pools, solid
     practical maintenance detail. Use palette/shared materials, merged static meshes, separate culled
     yard/turbine chunks. Keep public road/shoulders and cart/work corridors clear. Trail approaches
     follow actual ridge ground with bounded switchbacks; verify real native walking to all bases.
   - Extract D1's exact aligned terrain-triangle paving into a small shared industry ground helper for
     yard/trails/apron, preserving power's exact inputs/colors/seed/name. Full grid cells follow actual
     native terrain; count only built surfaces, never empty enclosing site or grade pads. Recheck D1
     paving/towers/gate after extraction. No arbitrary road/terrain error tolerance changes.
   - Extend `worldtest windstatic` first: missing-site red; native whole envelope/shaft surfaces,
     foundations/visible grounding, actual walk paths/platforms, map/sign/support/culling/day-night/
     one-shadow budgets. Extend new-road physical endpoint stress fixture to these two roads while
     retaining all original assertions/traffic; native full-width rays/ghost scan/BFS/return footprints.
   - Serial regressions: terrain8checks, roads/walking/new-road drive both directions with real full
     endpoint crossings/zero damage, powerstatic/powerops/farmstatic/farmtraffic as affected, walk/phase2,
     map/POI/sign/navigation/airport and perfscenes with added wind views. Diagnose any failure rather
     than weakening tests. >=45fps/<600calls. Update reports/status/coverage, review, commit/push D2a.

2. **D2b operating turbines and maintenance (test first, verify, commit/push).**
   - Add three3-blade tapered low-poly rotors with subtle palette tip bands and hubs. Exact convex
     blade solids and native hub attach to per-turbine kinematic bodies; fixed60Hz rotations, render
     interpolation, seeded phases/rates, no per-frame allocations. Visible/native rotations agree
     through full sweep, no boundary/shaft/road contact or extra lights. Pause and distant culling/
     sleep/wake must freeze safely without a first-frame collider/render jump. Night nacelle markers
     may blink with existing shared emissive materials; don't mutate shared intensity per fixture.
   - Append two registered adult technicians after101; reuse normal work/tool/face/flee/cower/shot/
     knockdown/get-up/witness/pause/sleep behavior, actual native-clear jobs at yard control panels.
     Preserve all prior IDs/seed streams. Make intermediate population assertions use original cohort
     plus exact declared additions rather than an obsolete fixed101 total, while retaining old power
     worker IDs/count and every original cohort/reaction assertion.
   - A procedural utility maintenance cart carries a cable reel/tools on a real native-clear yard
     loop with seated adult operator, four rotating/steering wheels, exact load solids, fixed-step/
     interpolated movement, player/people/car stops and safe wake/pause/sleep/night lamps. Reuse the
     configured machinery system; do not copy a second vehicle controller or make it enterable.
   - Reuse configured synth on the existing master/context for turbine hum and cart engine. Bounded
     voices/nodes, actual waveform, distance silence, M/master/settings, pause/.4duck, repeat-visit
     identity and pagehide/bfcache/disposal. Preserve power19nodes and farm46nodes. No song files.
   - Extend `worldtest windops` with actual rotor/native full rotation and wake checks, adult tools/
     movement/reactions, full real cart circuit/stops/native load/wheels/safety, sound/night/culling/
     budgets. Run original full farm machinery circuits and powerops after shared-system changes,
     workers/animals/farmtraffic/audio/shop, roads/walking/static/terrain as affected, NPC/gun/witness,
     maps/signs/airport, material/render checks and every perf scene. No builds/screenshots.
   - Record actual coverage, runtime costs, surprises/limits/hand checks in docs/STREETS/WORLD_PLAN/
     README/DECISIONS/PROGRESS/master and this report. Re-read diff, commit/push, then immediately D3
     solar and all remaining industries/base/fill/population/deferred tasks. Screenshot budget stays0/8.

## Status

Plan only, no D2 production code. Native point/column surveys completed as above, no active browser.
Commit this plan before D2a code. Next write windstatic missing-site acceptance, implement the smallest
native/access/static slice, verify every checklist item, commit/push and continue D2b/full queue.
