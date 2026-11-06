# Task 004 - expanded, populated rural world

## Owner priority and intent

The latest owner instruction explicitly advances 004 ahead of the old queue. Verify the claimed bump fix first; record failures as deferred blockers and proceed with world fill anyway. Give open Task010 shake work one investigation pass, then mark it BLOCKED if unresolved. This overrides the old requirement to complete 010/002/003/001/L1-L3 first. Preserve those tasks and their evidence.

Build a moderately expanded outer region, while filling existing empty land, with working fictional military facilities, 2-3 farms and an enterable shop, industries, rural settlements/parks/water and a busier civilian population. Keep existing reactions, safe military defaults, left-hand traffic, cohesive palette, 45 fps and roughly 600 draw calls. Verify each phase before advancing; no claim of finished world content until acceptance evidence exists.

## Read before changes

Read AGENTS.md and MASTER_PLAN (including task004 and execution rules), BUMPS.md, bump-related git history, phantomtest, braketest, shaketest and physicsWorld. The current branch is codex-work with clean handoff state at 01a9519; isolated Vite5180 is already listening (PID26632). Owner servers untouched. The only bump-related implementation commit found is e074296 braking work; BUMPS.md explicitly says later bump investigation/fixes were not done. Tests must determine actual current behavior.

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

Pending fresh tests. No bump fix is verified yet. Current phantomtest still contains a hard-coded motorway/ramp n/a PASS; this is a coverage gap, not evidence of clean motorway driving. Existing brake test caps requested60/70m/s runs near each vehicle's actual top speed and has narrower noise/measurement coverage than the original queue requires.

## Status and exact next step

Plan only. Run pre-check serially with GTA_URL=http://127.0.0.1:5180/. No world/source change, build or screenshot yet. World screenshot budget0/8 used. Full map-module reading and phaseA implementation still pending.
