# Task 000 - Handoff triage

1. Triage completed without changing game source, damage rules or test assertions.
2. Work is on codex-work, created from e074296; main has not been changed.
3. Snapshot e1b9553 contains only the three original MP3 files, untouched.
4. Unauthenticated GitHub API returned 404 after a sandbox network failure; audio is permitted by the owner's rule.
5. Verbatim AGENTS.md and MASTER_PLAN.md were committed as 1ba99c3 and pushed.
6. Claude's brake suite passes 57/57, but true 60/70 m/s and several acceptance measurements remain missing.
7. Walking 7/7, Phase 2 16/16 and drive physics pass; two cul-de-sac routes stall despite reporting PASS.
8. Phantom wall-crash regression fails twice (0 damage); the instrumented probe records 11.16 damage.
9. Motorway 9/9, life 9/9, downtown 8/8, Northgate 8/8, pursuit 14/14, airport 11/11 and shake 21/21 pass singly.
10. Leftovers are queued under 010/002/003/001 and L1-L3 before 004; no screenshots or build were taken/run.

## Read before planning

Read git status/branches/log (including last 15 with stats), stash list (empty), diff stat (empty after setup), README, PROGRESS STATUS and Phase 6.1 summary onward, DECISIONS tail, all existing docs (BUMPS, PHANTOM_CRASHES, STREETS), baseline scripts and brake tests/config. Inventory: new undocumented Phase 6.2 files are brakeConfig.js, brakebench.mjs and braketest.mjs plus carTrace in vehicleBody/debugApi. Read vehicleBody for the implementation evidence; remaining investigation occurs before final classification.

## Numbered sub-tasks

1. Finish isolated server setup on port 5180, using vite.config.codex.mjs and its own dependency cache. Add GTA_URL overrides only in scripts needed for triage; default remains 5173. Verify server response and run walktest singly. Commit setup/test harness changes with evidence.
2. Run phase2test, drivetest and phantomtest singly (SHOTS unset); read complete logs. Re-run any reported failure singly to distinguish intermittent failure from a repeatable one. Do not weaken assertions or fix game code in this read-only task. Record root-cause evidence where available and explicitly distinguish hypotheses.
3. Read remaining relevant modules/tests; run targeted checks for unfinished work singly. Record intended behavior, current implementation, gaps, risks and test evidence. Fold brake/bump/music/boost leftovers into their queue tasks; list independent leftovers immediately before world fill. Future suggestions are distinguished from unfinished authorized work.
4. Replace the pending summary with ten evidence-based lines, complete the item table and test report, update MASTER_PLAN and PROGRESS CODEX LOG, review diffs, commit and push. Then start task 010 Phase A.

## Snapshot contents

| File | Bytes |
| --- | ---: |
| Car Music/Bexley .Road - Baggh-E SMG.mp3 | 6816914 |
| Car Music/GTA Mohali - Sultaan.mp3 | 9401991 |
| Car Music/Kaali Hoodie - Sidhu Moose Wala.mp3 | 6701975 |

No source changes were uncommitted at handoff. Snapshot was made before creating either instruction file. The API visibility check was brought forward to avoid committing audio before checking the owner's condition.

## Findings and results

Sub-task 1 complete: isolated Vite 8.3.5 server ready on 5180 (launcher PID 24296, node PID 26632), separate cache. Initial Vite and Edge launches failed with sandbox spawn EPERM; retried successfully with approval. GTA_URL overrides added to baseline and targeted tests, defaults unchanged. No game source changed. All four triage sub-tasks are complete. Full command output is kept in ignored local *.log files; committed summaries record failures as well as successes.

### Baseline results (sub-task 2)

All commands use `.\dev.cmd node scripts/<name>.mjs`, GTA_URL=http://127.0.0.1:5180/, SHOTS unset, headless Edge 960x540; browsers ran singly and closed.

| Command | Result | Evidence and limits |
| --- | --- | --- |
| walktest | PASS 7/7, exit 0 | Porch, wall, jump, fly toggle. codex-walktest.log. |
| phase2test | PASS 16/16, exit 0 | Driving and night 60 fps; 212/235 calls. codex-phase2test.log. |
| drivetest | PASS 4 physics route checks, exit 0 | Grand Terrace complete, 54 km/h max, 6.5 deg tilt; Wattle complete. Hillcrest stuck 12/32 and Banksia stuck 9/31 but their physics-only assertions pass. Do NOT claim all routes completed. codex-drivetest.log. |
| phantomtest | FAIL 1/19, exit 1 | 13 routes: zero damage and zero ignored jumps >4 m/s; scan 7737 samples clean; boost 172 vs 166 km/h. Wall 0 damage instead of 8-12; pole broke, parked hit 0.2 damage. One reported pass is only the hard-coded motorway n/a. codex-phantomtest.log. |
| phantomtest regress | FAIL 1/3, exit 1 | Fresh browser reproduced wall=0, pole=true, parkedLoss=0.2. codex-phantom-regress.log. |
| handoffCrashProbe | Diagnostic completed, exit 0 | Same wall coordinates/25 m/s, with step/contact sampling: 11.16 damage, dv 26.41, door:tcDoor normal (0,0,-1), health 88.84. No ignored event. codex-crash-probe.log. |

The wall regression is not explained by suite state alone (also fails singly), and the probe's success means it is not a universally broken wall fixture. Additional per-step sampling changes timing; contact-window/frame scheduling is a hypothesis, not an established root cause. Preserve this failure for task 003's real-crash acceptance. No damage threshold, collision rule or assertion was changed. Prior intermittent traffic launches and night-fps 49 did not reproduce in these single baseline runs; this does not close them.

### Leftover implementation audit (sub-task 3)

| Item | State | Evidence | Risk | Action |
| --- | --- | --- | --- | --- |
| Braking stoppie | Implemented, acceptance incomplete | e074296: brakeConfig, COM braking, reverse delay, rounded/lifted hull, speed-cap smoothing, carTrace, brakebench/braketest. Current braketest 57/57. | Test caps 60/70 m/s to 45-52 m/s; noise only at 15/45 requests; lift is Boolean, not 5 cm; stopping-distance expectation derives from measured stopping time. Trace allocates objects/arrays and shifts each step; trace.brake omits COM impulse. | Reuse in 002; extend instrumentation and independent acceptance measurements, do not redo blindly. |
| Traffic launches / phantom bumps | Unresolved | Handoff reports 2/3 Grand Terrace launches. Current single drive passes. VehicleBody round hull and global grounded pitch-rate clamp exist; traffic kinematic target updates follow physics once per rendered frame in main.js. | No causal proof against hull or clamp; catch-up steps and kinematic contact remain candidates. | 003 recorder/investigation before fixes. |
| Real wall damage | Intermittently failing | phantomtest all and regress: 0 damage; sampled probe: 11.16 damage against door:tcDoor. | Damage regression must not be hidden by a limiter or weakened assertion. | 003, retain raw logs and test-only probe; frame/contact-window hypothesis unproven. |
| Bump tooling | Not implemented | No bumpRecorder.js, bumpLimiter.js or bumptest.mjs in file inventory; debug exposes carTrace, damageEvents, ignoredImpacts only. | Current logs miss physical bumps below damage window threshold and wheel hit/tag data. | 003 A-F. |
| Motorway/ramp tests | Coverage incomplete / previously failing | phantomtest hard-coded n/a; phase5 highway uses bang-bang autopilot and joined right-angle points; debug.drivePoints uses terrain.getHeight rather than driveHeight for initial placement. | Reported pass can mean no highway test; ramp failure may mix fixture and physics. | 003 real motorway routes + separate test-vs-physics diagnosis. |
| Cul-de-sac completion | Unfinished test coverage | drivetest current Hillcrest stuck 12/32, Banksia 9/31; simple branches assert physics only and intentionally ignore res.ok. | Incomplete routes reported as driven cleanly. | L1: improve route fixture/autopilot and assert completion, preserve physics assertions. |
| Bus dwell, district traffic, run-camera flaky checks | Open historical failures | Phase 6.1 wrap-up; life samples only 35 s, districts inspect population at one instant, shaketest uses walking-derived RMS threshold. | Passing once does not identify flake source. | L1: rerun singly, isolate deterministic fixtures without weakening requirements. |
| Pursuit wall avoidance / return | Rough, incomplete polish | pullOver.drive follows breadcrumbs with turn cap but no obstacle sweep; leaving calls reset after leaveTime and catcher.restore immediately restores its post. | Can cross solids on tight turns and visibly pop back to duty. | L2, after 001 and before 004; preserve fine/escape/no-star behavior. |
| Airport pushback / apron vehicles | Rough, incomplete polish | airportOps has reverse pushback path but no attached pushback tug; apron baggage tugs exist separately with visual-only loops. | Invisible towing and walk-through support vehicles. | L3: visible pushback tug + safe apron collision/avoidance; preserve aircraft lifecycle. |
| Music | Source files only | Three readable MP3s in snapshot; no music player/index/UI modules or tests. Bexley filename differs from canonical title; Kaali filename omits feat. Bohemia. | Filename parsing and committing licensed audio require explicit mapping/visibility rule. | 010, visibility 404 checked before snapshot. |
| Boost | Mechanics only, no queued rocket work | Existing Shift multiplier in vehicleBody and BOOST text in hud; no boosttest or rocket modules. | Must not alter mechanics in a visual task. | 001; record current bench before effects. |
| Old eight house variants / laneways | Deferred content | Historical PROGRESS/DECISIONS; current house variants remain four. Later highway, lighting and ambience deferrals were already superseded. | Stale notes could trigger duplicate work. | Fold suitable infill/laneway variety into 004 planning. |

Explicit future suggestions (civilian boarding/flying, multiplayer, missions, drive-bys) are not unfinished implementations: README deliberately says no boarding and airport code explicitly excludes it. No partial code exists for them. They remain future scope rather than being silently turned into additional feature requirements. Curved motorway slips belong to 003; the current queue's military aircraft remain non-boardable as specified.

### Brake evidence and limits

`.\dev.cmd node scripts/braketest.mjs`: 57/57, exit 0, codex-braketest.log, including its sequential vehicle-sim child. Straight braking: no flips or lift, maximum nose-down about 0.75 deg, max |vy| 0.28 m/s, peak decel up to 1.06 g. S+handbrake reaches 1.50-1.67 g but that scenario does not assert the 1.1 g ceiling. Crest world vertical speed reaches 2.53-2.60 m/s on the inclined road (the crest test asserts grounding, not |vy| <1). These are limits of current acceptance, not evidence for changing constants now.

Bench (0-100 s / 12-second speed km/h / steering degrees): hatch 5.8/126/119, sedan 5.2/139/134, ute 5.8/128/156, SUV 7.7/116/153. All within the existing 5% baseline tolerances; "unchanged" here means within those tolerances, not numerically identical.

### Remaining targeted tests

Same wrapper, GTA_URL, viewport and no-screenshot conditions as above. Every command below completed with exit 0; no rerun was needed.

| Command suffix after `.\dev.cmd node scripts/` | Result | Evidence |
| --- | --- | --- |
| phase5test.mjs highway | 9/9 | East/west 174/173 km/h, tilt 7.6/5.8 deg. Ramp health 99.56/99.24: the test filters breakable damage, so this is NOT zero total damage. Deck y 0.69 vs 0.8; traffic 90 km/h. codex-phase5-highway.log. |
| phase5test.mjs life | 9/9 | 92 peds, 6 stop waiters, buses made 2/1 stops, 32 dwell samples; 60 fps/127 calls. codex-phase5-life.log. |
| phase5test.mjs downtown | 8/8 | Route complete 458 m, tilt 1.5 deg; 6 traffic, 14 visible peds; 60 fps/129 calls. codex-phase5-downtown.log. |
| phase5test.mjs northgate | 8/8 | Route complete 234 m, tilt 1.4 deg; 1 traffic, 5 peds; 60 fps/250 calls. codex-phase5-northgate.log. |
| phase5test.mjs pullover | 14/14 | $200 fine once, 0 stars, min gap 6.3 m, escape/cooldown/siren rules pass. Does not test wall avoidance or visible post pop. codex-phase5-pullover.log. |
| phase5test.mjs airport | 11/11 | 420 s simulation: 4 departures/3 arrivals parked, no stuck/NaN/double booking; blocking causes holds/go-arounds; airport road route complete 407 m, 0 damage, 60 fps/100 calls. Does not test a pushback tug or apron vehicle solidity. codex-phase5-airport.log. |
| shaketest.mjs | 21/21 | Third-person run RMS 0.0135, zero non-crash shake; real crash shakeMax 1. Cinematic cuts remain explicitly exempt from spike count (existing assertion). codex-shaketest.log. |

## Completion report and hand checks

Changed: isolated vite.config.codex.mjs; GTA_URL overrides in walktest, phase2test, drivetest, phantomtest, braketest, phase5test and shaketest; test-only handoffCrashProbe; this report, MASTER_PLAN and PROGRESS. Initial setup added the two verbatim instruction files and untouched source songs. No dependencies changed. main still points to e074296; stash list empty; audio unchanged from e1b9553.

Not verified: root cause of intermittent wall damage or historic traffic launches; true 60/70 m/s braking; hearing audio; visual appearance (zero screenshots); pursuit wall avoidance/return visibility; pushback-tug appearance/apron collision; repeated batch flake reliability. These are explicitly retained in the queue, not marked fixed. Triage acceptance means the audit/tests/report are complete; it does not mean all game tests are green.

By hand: (1) drive with traffic and note any launch with carTrace/damageEvents/ignoredImpacts, (2) brake from boost in each car, (3) observe pursuit around tight corners and return-to-post, (4) watch airport pushback/apron vehicles. These checks supplement, rather than replace, the pending automated acceptance work. Next: task 010 Phase A, read inputs/audio/HUD and measure protected rectangles at all three sizes before implementation.
