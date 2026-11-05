# Task 000 - Handoff triage

1. Preserve Claude's work and establish an honest baseline without changing game code.
2. Work is on codex-work, created from e074296; main has not been changed.
3. Snapshot e1b9553 contains only the three original MP3 files, untouched.
4. Unauthenticated GitHub API returned 404 after a sandbox network failure; audio is permitted by the owner's rule.
5. Verbatim AGENTS.md and MASTER_PLAN.md were committed as 1ba99c3 and pushed.
6. Claude's braking implementation, trace and tests already exist and must be reused.
7. Bump recorder, limiter and comprehensive bump tests do not exist yet.
8. Existing phantomtest still hard-codes motorway coverage as not applicable.
9. Baseline tests and leftover classification are pending; this is the pre-execution plan.
10. No screenshots, production build or game-source edits are permitted during this triage.

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

Sub-task 1 complete: isolated Vite 8.3.5 server ready on 5180 (launcher PID 24296), separate cache. Initial Vite and Edge launches failed with sandbox spawn EPERM; retried successfully with approval. GTA_URL override added to the four baseline tests, defaults unchanged. With GTA_URL=http://127.0.0.1:5180/ and SHOTS unset, `.\dev.cmd node scripts/walktest.mjs` passed 7/7, exit 0 (codex-walktest.log). No game source changed. Sub-tasks 2-3 pending. Full command output is kept in ignored local *.log files; committed summaries record failures as well as successes.

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
