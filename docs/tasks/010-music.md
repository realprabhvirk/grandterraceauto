# Task 010 - music player

## Intent and state
Add a persistent, gesture-started music player that remains usable while driving without covering the road or existing HUD. Move emergency lights/siren from T to Y. Preserve physics and the existing game audio mix. Phase A and M1 complete; M2-M8 pending.

## Phase A evidence (2026-11-06, clock checked with Get-Date)

`Car Music/` exists at the repository root. No partial player, indexer or UI exists. The untouched source files were saved in snapshot e1b9553.

| Source file | Format | Bytes | Canonical title / artist | Edge duration |
| --- | --- | ---: | --- | ---: |
| Kaali Hoodie - Sidhu Moose Wala.mp3 | MP3 | 6701975 | Kaali Hoodie / Sidhu Moose Wala feat. Bohemia | 167.549 s |
| GTA Mohali - Sultaan.mp3 | MP3 | 9401991 | GTA Mohali / Sultaan | 235.050 s |
| Bexley .Road - Baggh-E SMG.mp3 | MP3 | 6816914 | Bexley. Road / SMG | 170.423 s |

Unauthenticated `Invoke-WebRequest -UseBasicParsing https://api.github.com/repos/realprabhvirk/grandterraceauto` returned **404** again during Phase A (also 404 before the snapshot). This is PRIVATE under the owner's specified rule: source audio may remain tracked. Always ignore generated `public/music/`. No credentials inspected or changed.

Temporary ignored probe `.tools/music-audit.mjs`, run with `.\dev.cmd node .tools/music-audit.mjs`, used one headless installed Edge, then closed it in finally. Log: `codex-music-audit.log`. `canPlayType('audio/mpeg')` returned `probably`; all three loaded metadata and advanced playback without media errors (0.411/0.508/0.657 s after a short wait). Chromium Edge was actually tested; a separate Chrome installation was not. No screenshots. Encode each filename as a URL path segment; preserve the source filenames and canonicalize metadata only. Bexley's misplaced dot/Baggh-E and Kaali's missing featured artist require explicit aliases.

## Code read and integration decisions

- Read input.js, controls.js, main.js: canvas mousedown supplies Mouse0; canvas click captures pointer; wheel bubbles to window and changes camera zoom. Block UI pointer/click/wheel and focused key events from game input, while allowing keyup cleanup. Music shortcut handling must precede input.endFrame. Pointer lock is distinct from input.locked.
- Read playerWeapons.js, weaponHud.js: Mouse0 fires only on foot while armed. Verify real armed clicks do not increment weapons.st.fired. UI must also avoid camera zoom and pointer recapture.
- Read carAudio.js and ambience.js: existing master has volume/muted getters and setVolume/setMuted/toggleMute, initialized by settings. Music uses one HTMLAudioElement, own volume multiplied by game volume (and mute), without another WebAudio context. Existing ambience remains on its current master node.
- Read settingsPanel.js, gunShopMenu.js, shopMenu.js, fullMap.js: shops/map lock input; settings does not. Explicitly gate music shortcuts on every menu and focused form control. Full map pauses world dt, while music must keep real-time progress. Music card will hide during full map and shop/settings menus; playback continues.
- Read cutscene.js and control enter/exit/camera paths: use actual drive mode, live car health/dead state and cameraMode; preserve requested playback separately from temporary car-only suspension. Use real dt for fades/ducking even while game time is paused/slowed. Cinematic/KO/busted hide card; cutscene gain is 0.4. Do not confuse user pause with leaving a car.
- Read all HUD modules: statusHud, hud, speedLimitHud, minimap, weaponHud, prompt, controlsPanel, plus pullOver banner. See measured bounds below.
- Grep src, scripts and README: T siren is controls.js:200, phase5test.mjs:399 (two taps, associated T label), README lines 18/103. Controls panel currently omits siren help; add Y. No existing plain Slash/Comma/Period/bracket music-key conflicts. **Shift+Slash is Help** and must not play/pause. Ctrl/Meta +/- remains browser-zoom suppression. Historical log entries remain historical.
- Placeholder cover will be native inline SVG/CSS using shared palette/UI colours, no image asset or album art. No extra Three.js objects or lights.

## HUD measurements

Rectangles are `[x, y, width, height]` CSS pixels, measured in Edge with getBoundingClientRect at each viewport. Hidden HUDs were cloned temporarily with visible representative content, then removed. Menus were opened/measured/closed using their real APIs. No source was modified by the probe. Widths of text-dependent elements vary with content; final collision tests must include actual states and long labels.

| Element / representative content | 960x540 | 1280x720 | 1920x1080 |
| --- | --- | --- | --- |
| Health including CAR row | 12,12,210,53.9 | 12,12,210,53.9 | 12,12,210,53.9 |
| Wanted + cash | 804,12,144,62 | 1124,12,144,62 | 1764,12,144,62 |
| Minimap | 758,84,190,190 | 1078,84,190,190 | 1718,84,190,190 |
| Speed/tacho/tags | 738,423.8,206,100.2 | 1058,603.8,206,100.2 | 1698,963.8,206,100.2 |
| Limit + Terrace Motorway chip | 583.7,472,170.3,46 | 903.7,652,170.3,46 | 1543.7,1012,170.3,46 |
| Weapon, Pump Shotgun 8/80 | 794,447.1,154,80.9 | 1114,627.1,154,80.9 | 1754,987.1,154,80.9 |
| F drive car prompt | 422,382.6,116,38.6 | 582,523,116,38.6 | 902,803.8,116,38.6 |
| KNOCKED OUT -$200 status message | 303.2,182.2,353.5,46 | 463.2,250.6,353.5,46 | 783.2,387.4,353.5,46 |
| PULL OVER with issuing bar | 380,84,200,71 | 540,84,200,71 | 860,84,200,71 |
| Controls walking | 12,397.4,394.7,130.6 | 12,577.4,394.7,130.6 | 12,937.4,394.7,130.6 |
| Controls driving | 12,397.4,357.5,130.6 | 12,577.4,357.5,130.6 | 12,937.4,357.5,130.6 |
| Controls fly | 12,442.6,296.9,85.4 | 12,622.6,296.9,85.4 | 12,982.6,296.9,85.4 |
| Settings | 332,185.8,296,168.5 | 492,275.8,296,168.5 | 812,455.8,296,168.5 |
| Gun shop (6 rows) | 272,106.4,416,327.2 | 432,196.4,416,327.2 | 752,376.4,416,327.2 |
| Shop (3 representative rows) | 282,156.4,396,227.2 | 442,246.4,396,227.2 | 762,426.4,396,227.2 |
| Full map overlay | 0,0,960,540 | 0,0,1280,720 | 0,0,1920,1080 |
| Protected central view | 192,135,576,270 | 256,180,768,360 | 384,270,1152,540 |

Chosen zone: **left 12px, below health at top 80px**, width capped at 280px and at `20vw - 24px` (168/232/280px). A fixed 280px card is mathematically incompatible with the protected centre at 960px. Use responsive wrapping, accepting extra height on small screens, and bound the expanded track list above controls. The side zone remains identical at all three sizes. A compact now-playing toast occupies this same reserved zone when the card is hidden; do not stack it on another protected HUD. No notifications over KO/busted titles.

## Numbered implementation and verification plan

1. **M1 indexer:** ignore generated directory, add npm music and scripts/musicIndex.mjs. Stable known-track order and aliases, conventional Title - Artist parsing for other files, filename fallback, safe URL encoding, supported audio extensions, missing/empty handling. Add serial filesystem tests with temporary fixtures (source bytes untouched), run real index, verify copied hashes and Edge-served manifest. Review diff, report, commit, push.
2. **M2 audio engine:** musicConfig.js + musicPlayer.js, one audio element, bounded failure recovery, event subscriptions, explicit playback intent and gesture gate, seeded shuffle/repeat, previous/seek/volume limits, storage validation/failure tolerance, car fade/resume, master mute and duck. Test real audio plus empty/error playlists, gesture and reload behavior in one Edge instance. Modules remain unconnected to main until UI/integration. Review, report, commit, push.
3. **M3 UI:** responsive card/cover/control/list, accessible names, seek and volume sliders, idle opacity, fixed 4 Hz progress and changed-text updates, pointer isolation, hidden cinematic/cutscene/menu states and track toast. Test layout and pointer/input isolation independently, then commit/push.
4. **M4 keys:** T card/Y siren, all listed shortcuts with Help/modifier/focus exclusions, README/controls and phase5 siren test update. Test captured pointer and real emergency vehicles; preserve game bindings. Commit/push.
5. **M5 integrate:** wire engine/UI in main with real-time updates and debug-visible state. Verify on foot, vehicle entry/exit/switch/death, teleports, every camera, map pause, settings/shop focus, cutscene duck, reload without autoplay. Run appropriate camera/police/vehicle regressions singly. Commit/push.
6. **M6 acceptance test:** finish scripts/musictest.mjs covering actual three-track playback/metadata, generator edge cases, every control, seek/volume bounds, shuffle/repeat, lifecycle/master audio, bounding boxes at all sizes including expanded, armed click isolation, T/Y, private audio decision, and same-scene performance. Run musictest then walktest, phase2test, phase4test cameras + police, phase5test steal pov cabin zoom map copstars, shaketest singly against 5180 (add GTA_URL where missing). Investigate failures without weakening tests. Review/report/commit/push.
7. **M7 visual review:** at most three 1280x720 screenshots in ignored shots/music/: driving visible card, expanded with free cursor, cabin card. View and inspect each; one correction pass if necessary, then numeric bounds recheck. No screenshots outside this budget. Report/commit/push if files changed.
8. **M8 docs and completion:** finish README add-songs/controls, PROGRESS CODEX LOG, DECISIONS, this report with commands/results/limitations/by-hand checklist. Check every acceptance item, update MASTER_PLAN, review/commit/push before task 002.

## Acceptance tracking

- [ ] Three canonical songs play; palette placeholder cover.
- [ ] T toggle; no HUD/road overlap at all three sizes.
- [ ] Keyboard while driving and free-cursor controls, seek/volume/shuffle/repeat.
- [ ] Car-only, ducking, master volume and M mute.
- [ ] Siren Y everywhere; T never toggles siren.
- [x] Source audio visibility decision verified (404); generated copy ignored and untracked.
- [ ] musictest and required regressions pass.
- [ ] Final implementation/docs pushed.

## Limitations / owner checks at completion

Playback decoding is verified in headless Edge, not listening quality or a separate Chrome build. By hand: listen to song starts/transitions and mix levels; drive chase/cabin with captured mouse; release cursor to seek/expand; leave/re-enter and switch cars; verify cinematic/cutscene behavior and read controls at normal monitor scaling. No implementation is claimed complete by this Phase A document.

## M1 result

- Files: scripts/musicIndex.mjs, scripts/musicIndextest.mjs, package.json (script only), .gitignore. Metadata aliases preserve source filenames; known tracks use requested order. Indexer supports MP3/M4A/AAC/OGG/WAV/FLAC/WebM extensions; codec support of future user files still depends on browser. Removes stale generated audio, rejects source/output overlap, ignores directories/non-audio, tolerates missing folder.
- `.\dev.cmd npm run music`: exit 0, three canonical tracks generated.
- `.\dev.cmd node scripts/musicIndextest.mjs`: exit 0, 8/8 including missing/empty, aliases/order, URL encoding, fallback, byte copies, stale cleanup, path separation and actual SHA-256 source/copy equality.
- One further headless Edge run fetched `/music/playlist.json` and played each `/music/<encoded file>`: Kaali 0.439 s, GTA Mohali 0.668 s, Bexley 0.654 s advanced; expected durations as above, no media errors. Browser closed. `git check-ignore` confirms generated manifest ignored; `git ls-files` lists only the three source MP3s, no generated audio.
- Regression scope: no runtime module imports or gameplay behavior changed, so exercised index generation and served playback; gameplay regressions reserved for integration. No screenshots/build/dependencies. Next: M2.
