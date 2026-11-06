# Task 004 - expanded, populated rural world

## Owner priority and intent

The latest owner instruction explicitly advances 004 ahead of the old queue. Verify the claimed bump fix first; record failures as deferred blockers and proceed with world fill anyway. Give open Task010 shake work one investigation pass, then mark it BLOCKED if unresolved. This overrides the old requirement to complete 010/002/003/001/L1-L3 first. Preserve those tasks and their evidence.

Build a moderately expanded outer region, while filling existing empty land, with working fictional military facilities, 2-3 farms and an enterable shop, industries, rural settlements/parks/water and a busier civilian population. Keep existing reactions, safe military defaults, left-hand traffic, cohesive palette, 45 fps and roughly 600 draw calls. Verify each phase before advancing; no claim of finished world content until acceptance evidence exists.

## Read before changes

Read AGENTS.md and MASTER_PLAN (including task004 and execution rules), BUMPS.md, bump-related git history, phantomtest, braketest, shaketest and physicsWorld. The current branch is codex-work with clean handoff state at 01a9519; isolated Vite5180 is already listening (PID26632). Owner servers untouched. Most recent vehicle-body change is e074296 braking work; older291fb2a contact-damage filtering and9eb2682 render interpolation/shake work also exist. No later completed phantom-bump implementation was found; BUMPS.md explicitly says later bump investigation/fixes were not done. Tests determine current behavior.

## Numbered plan

1. **Pre-check, no world changes:** run phantomtest runs, scan, speed and regress separately on5180; braketest; shaketest. Independently measure wall health loss and final velocity (existing phantom assertion does not check stop). Record commands/output and coverage limitations below. One music/shake investigation pass only; if unresolved mark010 BLOCKED. Commit/push evidence and append deferred failures at the end of the queue; continue004 as authorized.
2. **A - measure and spatial plan:** read complete terrain/build/road/chunk/district/airport/population/map/sign modules and tests before writing implementation plans. Add25m coverage classifier and reproducible heat-map artifact, baseline empty regions/slope and tests; write WORLD_PLAN with existing-space uses, outer-zone dimensions and explicit extension cost model. Commit/push.
3. **B - extension and roads:** expand terrain/heightfield/boundary/maps/fog/water, grade destinations, add connected rural dirt/gravel roads without kerbs, unique signs/speed limits. Add connectivity/ground agreement/driving tests; measure cost and budget. Commit/push each separable verified change.
4. **C - farms:** add2-3 varied clusters, farm shop via existing kit, safe reactive animals, fields/orchards and working farmer/machinery loops. Test content, movement, shop health, collision/reactions, routes and perf. Commit/push sub-tasks.
5. **D - industry:** power, wind, solar, quarry, fuel, sawmill, recycling, factory, water treatment in that order; skip only if space genuinely prevents one and document it. Each requires jobs, vehicles, ambient sound, night treatment, signs/icons and safe geometry. Test/commit/push one at a time.
6. **E - military:** fictional config/default flags and campus, then guards/routines, ground vehicles/blanks, airport-derived aircraft/helicopters/formation loops, convoys and audio. Incremental movement/safety/lifecycle/connectivity/perf tests; commit/push each verified sub-task. No real insignia, injury or explosions.
7. **F - remaining land:** reserves, forests, hills/water, golf/camping/caravans, homesteads/hamlet and services. Re-measure genuine coverage, never label empty land used without content; stop below15% unused. Commit/push by zone.
8. **G - busier world:** about200 registered adults/50 awake and60 traffic/25 simulated, sleeping/culling, role/activity/trip variety and boats. Preserve reactions. Test caps, activity, traffic rules, performance. Commit/push.
9. **H/I - complete:** worldtest sections, serial required regressions (including bumptest if present), expansion costs, STREETS/WORLD_PLAN/README/DECISIONS/PROGRESS, acceptance report. At most8 screenshots total,1280x720 in ignored shots/world; inspect each and make one correction round. Commit/push before marking complete.

## Pre-check

Fresh tests completed on5180, sequential headless Edge browsers, each closed before the next. All node commands used `.\dev.cmd node`, with `$env:GTA_URL='http://127.0.0.1:5180/'`. No game-source changes, builds or screenshots. Added one independent stop assertion to phantomtest; existing damage/pole/car assertions unchanged.

| Command after `.\dev.cmd node` | Result | Evidence |
| --- | --- | --- |
| scripts/phantomtest.mjs runs | Exit0,14/14 reported |13 driven routes, zero damage events and zero ignored velocity jumps>4m/s. Fourteenth check is hard-coded motorway/ramp n/a; NOT actual driving evidence. |
| scripts/phantomtest.mjs scan | Exit0,1/1 |7737 samples, zero flagged static colliders. Lane-centre scan only; not a complete road-width continuity scan. |
| scripts/phantomtest.mjs speed | Exit0,1/1 |172km/h versus166 expected, zero damage, within existing5% tolerance. |
| scripts/phantomtest.mjs regress | Exit1,3/4 |Wall25m/s lost11.16% health (PASS8-12%); final speed1.2616747m/s after1.8s fails explicit <1m/s stop check. Pole breaks; parked collision costs0.2%. |
| scripts/braketest.mjs | Exit0,57/57 |Four types and existing scenarios/bench pass. Requested60/70m/s capped near actual top speed; noise only15/45; wheel lift Boolean, notcm. Crest maxVy~2.59 allowed by that scenario's existing assertions. |
| scripts/shaketest.mjs | Exit1,19/21 |Straight chase spike.1958m (frame239,steps0,dt.0166); downtown/Northgate spikes.197/.288m (frames288/370,steps1,dt.0187). RMS.0162/.0207 below.060 but no-spikes assertion fails. Non-crash shake0; real crash shake1. |

Logs: ignored codex-004-phantom-{runs,scan,speed,regress}.log, codex-004-brake.log and codex-004-shake.log. Do not describe these mixed results as a fully fixed bump problem. R1 defers wall-stop/coverage work to the queue end; R2 defers shake. **New004 roads still require independent clean full-throttle driving and ghost/ground scans.**

### One-pass music/shake investigation

Read current chaseCamera, jitterMonitor, physicsWorld and prior010 evidence. Chase pose uses collision-ray pull-in and dt-based smoothing; the metric differentiates frame velocity using dt and includes zero-step render frames. Prior disposed-music baseline also failed (.241/.179m spikes), so occurrence does not require the new music player. Fresh pre-check reproduced straight/downtown failures. This pass did not establish a cause or a verified fix; no threshold changed and no camera/physics patch guessed. Per owner's explicit time box,010 is BLOCKED and R2 is deferred; continue004. Further probes belong at the end, not another investigation pass now.

## Status and exact next step

Pre-check complete with documented blockers, authorized continuation to004. Next: read full map-building modules/tests, implement mapcoverage baseline/heat map and WORLD_PLAN before any terrain or content edits. World screenshot budget0/8 used. Map expansion, farms, military, industry and population changes have NOT been implemented yet.

PhaseA reading checkpoint: terrain.js, world.js, roadNetwork.js, laneGraph.js and STREETS.md read in full. Terrain currently spans1360x1100m (-300..1060,-800..300),544x440 cells at2.5m,478720 terrain triangles and240345 height samples; one terrain mesh, no chunks.js. Build order stamps roads/lots before structures and aggregates static collider/trunk metadata. Airport/pedestrian/traffic/district reads started but combined output truncated: finish airportOps middle/update paths and trafficManager, pedestrians, industrial, then town/townKit, town plan/lanes/footpaths, remaining districts, maps/icons/signs/speedLimits and relevant tests before committing the detailed PhaseA coverage/extension plan. No coverage percentage has been measured yet. Do not infer unused-land percentage from these dimensions.

### A1 coverage implementation plan

Additional reads: town.js/townKit.js build/cull metadata, trafficManager.js, footpaths.js, fullMap.js/minimap.js/mapIcons.js and speedLimits.js fully; population creation/sleep behavior, airport movement/state/culling and district content inspected. Detailed model/state-machine reads continue before their implementation phases. No extra agents or dependencies.

1. Pure coverage analysis module, not imported by normal gameplay:25m cells, nine sub-samples per cell and area-weighted totals (including clipped edge cells). Classes road, building, district, water, dense trees/park, EMPTY. Do not count entire civilian grids as occupied: only actual solid footprints, bounded house yards, built parks and the operational airport airside count. Three or more trees within25m establish dense groves. Water must intersect the actual sea footprint, not every low ground point.
2. Standalone mapcoverage.mjs runs a single headless Edge on5180, samples the real built world, reports largest4-neighbor empty regions with area/bounds/height/slope, terrain geometry/heightfield counts and current perf/population. Save JSON and a code-generated SVG heat map under docs (analytical artifact, no browser screenshot). Preserve a baseline file separately from later measurements.
3. Pure Node fixture tests verify empty/water/road/building/park/dense-grove classification, rotated footprints, partial-edge areas and disconnected empty regions. Real run asserts area conservation and finite terrain data. Review/test/commit/push. Use measured regions to write WORLD_PLAN and expansion cost proposals in A2 before touching terrain. This is the next concrete implementation sub-task; no coverage target is claimed yet.

### A1 results (2026-11-06 15:21 IST)

Implemented src/utils/mapCoverage.js (offline only), scripts/mapcoverage.mjs and scripts/mapcoverage-unit.mjs. Baseline artifacts: docs/coverage-baseline.json and .svg; regenerable current artifacts ignored. No normal-game imports or scene changes. `.\dev.cmd node scripts/mapcoverage-unit.mjs`:10/10, exit0. Two serial live runs on5180 (baseline then current): exit0, area conservation and no page errors; exact equality of counts, regions and flat-empty rectangle on repeat. First fixture run used strict floating-point equality (99.99999999999993 versus100); corrected numeric comparison to1e-9 tolerance. Initial live adapter used water.geometry instead of the existing water.mesh wrapper; corrected after reading beach water implementation. Neither failure was hidden.

Measured2,420 cells with9 samples each over1,496,000m². Water82,236.11m²; land1,413,763.89m²; EMPTY904,527.78m²: **63.980116% unused land**. Road188,750m², solid footprints69,166.67m², bounded yards/operational airport213,958.33m², dense trees/parks37,361.11m². Largest connected empty component756,361.11m² winds around existing development (its whole-map bounding box is NOT a free building site). Largest >=90%-empty, <=8° sampled-slope rectangle:500x75m,37,500m², x[-200,300],z[-575,-500]. This does not fit a900x700m base. Baseline scene:60fps,145calls,833,518 rendered triangles; terrain478,720triangles/240,345heights;36roads/870static colliders/153trunks/92pedestrians/23traffic.

Metric limitations:25m cells with3x3 sub-samples approximate narrow features; clipped map-edge cells are area-weighted. Grove threshold is explicitly3 trunks within25m, not an exact canopy union. Unregistered paved courtyards may be conservatively marked EMPTY; inspect real content before assigning infill. Airport operational grass inside its built perimeter counts as district; arbitrary unbuilt civilian district bounding boxes do not. Keep baseline fixed after content work; CLI rejects accidental replacement. No gameplay regression required for an analysis-only module; repeated live scene remains60fps/145calls. Next A2 WORLD_PLAN and extension costs, then B.
