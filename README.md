# Grand Terrace Auto

A low-poly, GTA-style open-world shell that runs in the browser: a hilly suburb loosely
inspired by Woodlands Estate, Waterford QLD, built around the hero house
**62 Grand Terrace** (modelled on the photo in `reference/house62/`).

- **Phase 1:** terrain, winding roads + 3 cul-de-sacs, 32 houses, trees, the hero house, lighting, walking.
- **Phase 2:** 8 drivable procedural cars (arcade raycast-vehicle physics), enter/exit, chase cam,
  synthesised car audio, HUD, a proper animated character with crouch + emotes, day/night with street lights.
- **Phase 3:** pedestrians, ambient traffic (keep left), enterable 62 with interior + doors.
- **Phase 4:** camera modes (first person, cabin with working gauges + mirrors, cinematic), health / cash /
  car damage / breakable street furniture, car theft + wanted stars + police + busted, Tab minimap,
  **Terrace Town Centre** (shops, enterable Terrace Central + Quick Stop, police station, hospital,
  petrol station, Central Gardens) east of Grand Terrace, Wattle Park, ~40 role-based pedestrians + cyclists.
  Arcade rules: no guns, no blood, no explosions; people hit by cars fall over and get back up.
- **Phase 5:** first-person viewmodel, clearer cabin view, wheel/pinch zoom (never page zoom), no player damage
  inside cars, burning wrecks, fairer police (soft contact, flanking, officers on foot who pull you out),
  KNOCKED OUT / BUSTED cutscenes, every parked car stealable (incl. police cars + the ambulance, Y = siren),
  **guns** (pistol, SMG, pump shotgun, rifle - hitscan, IK-held, viewmodel, effects, synth sounds, crime heat),
  armed police at 3+ stars, the **Barrel & Bolt** gun shop, four new districts - **Downtown**, **Terrace Beach**,
  **Northgate** (second suburb, school, shopping centre) and an **industrial estate** (the highway was skipped) -
  plus clouds, birds, zone ambience and an optional day/night cycle. Arcade rules: hitscan only, no blood/gore,
  no explosions, adults only (the school has staff only); people who are shot go down and fade out.
- **Phase 6:** road rules + a bigger city. **Speed limits** on every road (suburb 50, cul-de-sacs 30, town 50,
  downtown 40, school zone 40, arterials 60, motorway 100, ramps 80) with a limit sign + street name next to the
  speedometer; **speeding fines** ($200, limit + 10 margin, 20 s cooldown, never stars or a chase, none while wanted or
  with the siren on) from 9 **speed cameras** (flash + shutter, "SPEED CAMERA AHEAD" signs), 5 **radar cops** (parked
  patrol car + officer with a radar gun: 60 m, line of sight, front arc) and 2 cruising **patrol cars**. Crimes need a
  witness; property damage / wrecking cars gives **no stars**. **Terrace Motorway** (north of the ring road, 2+2 lanes,
  median barrier, bridges over Northgate Rd + King St North, on/off ramps, overhead gantries). City-wide **street signs**
  (name blades at every junction, limit signs at road ends, school sign). The full map shows **labels, street names
  and a legend**; waypoint routes are drawn **on the map / minimap only** (the driven part fades out).
  **13 enterable shops** from one interior kit with buy menus (food/drinks heal $8-20 / +10..25, chemist $40 / +50,
  clothes $60 shirt colour, barber hair colour), **traffic lights** at 6 Terrace Pde junctions that the AI obeys
  (stop lines + zebra crossings), **City Hall clock tower** (real time), **Terrace Stadium**, a **TV tower** on the
  southern hill, billboards, ~86 people with new activities (bus-stop waiters, street dancers, stadium fans...),
  a **2-bus loop** with stops, **taxis** and **delivery vans**, crowd murmur and glowing signs at dusk.
- **Phase 6.1:** **speeding is now a pull-over pursuit, then a $200 fine.** A radar cop or cruising patrol car that
  spots you (over limit + 10, within 60 m, line of sight, its front arc) lights up and follows you ~9 m behind (never
  faster than 0.95x your speed, never rams). HUD: flashing **PULL OVER**. Stop and the officer walks to your window
  ("Issuing fine...", 3 s) → -$200; drive off and the chase resumes; lose them (8 s out of sight or > 150 m) and it's
  over, no fine, no stars (EVADE_STARS = 0). Becoming wanted cancels it. **Speed cameras are disabled**
  (`SPEEDING.CAMERAS_ENABLED = false` in src/police/speedingConfig.js - flip it to bring them back).
  **Terrace Airport** north of Northgate (Airport Rd / Terminal Dr / Airport Link, 60 km/h): 1 km runway with
  lights, taxiway, apron + 4 gates, terminal, car park, control tower, hangars, fuel tanks, fence, windsock, apron
  vehicles, ground crew - and **autonomous aircraft** (prop plane, regional jet, airliner) that push back, taxi, hold,
  take off, land from the east, go around if you block the runway, and park at the gates. Planes **can't be boarded
  yet (future feature)**; they're solid only on the ground. Phantom-crash notes for discussion:
  [docs/PHANTOM_CRASHES.md](docs/PHANTOM_CRASHES.md) (fix deferred on purpose).

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
| **1 / 2 / 3 / 4** | weapons: pistol / SMG / shotgun / rifle (owned ones; draws it) |
| **LMB** | fire (hold for the SMG / rifle) |
| **RMB** | aim: over-the-shoulder camera (first person: down the sights), slower walk |
| **R** | reload |
| **Q** | holster / draw |
| **hold G + 1-4** | emotes: wave / dance / sit / point (any movement interrupts) |
| Mouse / arrow keys | orbit camera |
| **Wheel / trackpad pinch** | zoom: camera distance 1.8-8 m (first person: FOV 60-100) |
| **F** | get into your car; **hold F** (1.2 s) to break into any parked car (car parks, petrol pumps, police bay, ambulance); F next to a traffic car = carjack (not cop cars) |
| **E** | interact: doors (62, Terrace Central, Quick Stop, Barrel & Bolt), garage door, snack at the Quick Stop counter ($20, +25 health), **Barrel & Bolt buy menu** (ammo $30-$80, shotgun $600, rifle $1,200) |
| **C** | camera: third person <-> first person |

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
| **C** | camera: chase -> cabin (dash, gauges, mirrors) -> cinematic |
| Wheel / pinch | zoom: chase distance, cabin FOV 65-85 (cinematic ignores it) |
| **Y** | lights + siren (stolen police car / ambulance) |
| E | open/close 62's garage door from the car |
| R | flip upright / reset |
| Mouse | orbit the chase camera (it swings back behind when you drive) |
| **F** | get out (below ~30 km/h; the car brakes to a stop on its own). A destroyed car burns: F gets you out at any speed, or you're thrown out after ~5 s (no damage) |

### Anywhere
| Key | Action |
| --- | --- |
| **Tab** | cycles hidden -> minimap -> **full map** -> hidden (Esc also closes the full map; the game pauses while it's open) |
| Full map: **click** | set a waypoint (click a marker to snap to it): route on the full map + minimap (driven part fades), distance shown above the pin |
| Full map: **right-click** / drag / wheel or pinch | clear the waypoint / pan / zoom |
| **N** | toggle late afternoon <-> dusk/night (windows glow, neon + street lights + headlights on) |
| **Shift + N** | slow automatic day/night cycle on/off (or start with `?cycle`) |
| ? (or H on foot) | show / hide the controls panel |
| M | mute |
| **T** | show/hide the music player (playback continues) |
| **/** | music play/pause (plain slash; Shift+/ still opens help) |
| **, / .** | previous / next music track (previous restarts after 3 seconds) |
| **[ / ]** | rewind / forward 10 seconds |
| **- / =** | lower / raise music volume |
| **\\ / ;** | shuffle / cycle repeat off, all, one |
| F2 | debug free-fly camera (WASD, Space/E up, Ctrl/Q down, Shift fast, 1-7 camera presets) |
| F3 | FPS / draw calls / triangles overlay, plus the last car-damage cause (e.g. `DMG 2.1% building: n=(0,0,1)`) |
| F4 | show physics colliders |

URL options: `?cam=hero-photo` (or `hero-front`, `hero-34`, `hero-porch`, `hero-car`, `street`,
`overview`, `top`, `culdesac`, `junction`, `sign`, `cars`) starts the debug camera at that view;
add `-dusk` (e.g. `?cam=hero-photo-dusk`) for night; `?hud` shows the F3 overlay; `?shot` hides the panel.

### Music

Get into a car with F, click the game to capture the mouse, press T to show the player, then plain / to play.
Music shortcuts work with the mouse captured and no menu open. Release the mouse with Esc to click the
card's transport controls, seek/volume sliders, Car toggle or List. Close Settings if it opens.
The Car toggle defaults on: leaving a car fades out over 0.5 s and pauses; re-entry resumes if you had
requested playback. Turn Car off to listen on foot. M and the Settings master volume affect music too.
Cinematic camera hides the card; full map pauses the game while music continues. Cutscenes duck music.
Reload restores track/settings but starts paused until you request playback with a user gesture.

To add songs, drop audio files into `Car Music/` and run `.\dev.cmd npm run music`.
Generated `public/music/` is ignored. The three existing source songs were committed when the repository
returned 404. On 2026-11-07 GitHub reported it as public; `Car Music/` now ignores additional files.
The full music acceptance test retains its private-repository requirement. To restore that prerequisite,
the owner can use GitHub > Settings > General > Danger Zone > Change visibility before committing more audio.

### Western countryside (Task004 in progress)

The map now extends west to x=-1500. At the motorway's west junction, Stoneleaf Rd leads west to the
planned Stoneleaf Garrison site. Ridge Access Rd and Creek Valley Rd loop back through Meadow Link to
the southern town grid. Gravel roads have earth shoulders: rural connectors80km/h, farm tracks/base roads40.
Three farm clusters now have buildings, planted fields, orchards, dams and windmill pumps: Gumleaf Orchard
Farm, Redbank Fields and Springbank Smallholding. Use their Farm markers on the map. Two farmers at each
cluster walk work routes and tend the crops/orchard; they use the usual civilian reactions and witnesses.
Gumleaf and Redbank have working field tractors; Redbank also has a harvester with a rotating header.
They stop for people/cars, kick up dust and switch their lamps at night. These field machines are not enterable.
Each farm also has a ute using the regular road traffic and carjacking controls.
Cows, sheep and farm dogs wander in the paddocks. They scatter when approached or hearing gunfire;
car encounters knock them down briefly and they get up. Animals show no injury.
Nearby field machines have synthesised engine sounds, and awake cows, sheep and dogs make occasional calls.
These share M mute and the Settings master volume, fade out with distance and while the full map pauses
the farms, and duck during cutscenes. Barn and shed lamps glow at night without adding real lights.
The farm shop, industries and military operations are still being built.
See [the world plan](docs/WORLD_PLAN.md) and [street list](docs/STREETS.md).

## Self-tests (Playwright driving the installed Microsoft Edge - no browser download)

```powershell
.\dev.cmd node scripts/phase2test.mjs    # spawn -> walk to hero car -> F -> drive -> get out -> emotes -> night (16 checks, shots/phase2/)
.\dev.cmd node scripts/walktest.mjs      # walking, porch step, wall collision, jump, F2
.\dev.cmd node scripts/drivetest.mjs     # autopilot the length of Grand Terrace + into each cul-de-sac; checks height/tilt
.\dev.cmd node scripts/shot.mjs          # screenshots of every preset into shots/, fails on console errors
.\dev.cmd node scripts/vehicle-sim.mjs   # headless car tuning bench (0-100, top speed, braking, roll, crest jumps)
.\dev.cmd node scripts/phase4test.mjs    # Phase 4 (sections: garage cameras combat police minimap town npcs) - numeric asserts, no screenshots
.\dev.cmd node scripts/phase5test.mjs    # Phase 5-6 (sections: pov cabin zoom carhp burn stars push arrest ko steal parked guns copguns shop downtown beach northgate industrial vibe damage witness map pois copstars speeding mapnav signs highway pullover shops city life vibe6 airport)
.\dev.cmd node scripts/shots6.mjs        # Phase 6: the 3 screenshots in shots/phase6/ (aerial, street level, full map)
.\dev.cmd node scripts/shots61.mjs       # Phase 6.1: the 2 airport screenshots in shots/phase6_1/
.\dev.cmd node scripts/phantomtest.mjs   # 5.2: full-throttle runs on every route (no phantom damage), ghost-collider scan, top speed, real-crash regression
.\dev.cmd node scripts/shaketest.mjs    # 5.3: camera jitter in every camera mode (walk/run/jump/POV/drive), shake only on real crashes
.\dev.cmd node scripts/weaponsUnit.mjs   # gun logic in plain Node: damage, hit zones, falloff, ammo/reload, spread, save
.\dev.cmd node scripts/perfscenes.mjs    # fps / draw calls / triangles (districts, countryside + gunfire)
.\dev.cmd node scripts/worldtest.mjs roads  # rural directed connectivity, signs, full-width ground and ghost scan
.\dev.cmd node scripts/worldtest.mjs walking # rural shoulder junctions, civilian links and original resident areas
.\dev.cmd node scripts/worldtest.mjs farmstatic # actual farm content/solids/maps, day/night views and pause/culling
.\dev.cmd node scripts/worldtest.mjs farmers # working/moving adults, clear paths, pause/sleep, reactions/get-up/witnesses
.\dev.cmd node scripts/worldtest.mjs machinery # solid field routes, full real-time circuits, stops, dust/wheels, pause/night/perf
.\dev.cmd node scripts/worldtest.mjs farmtraffic # stock farm utes, wheels, pause/night, actual F theft and signal stops
.\dev.cmd node scripts/worldtest.mjs animals # seeded livestock/dogs, native clearance, safe hits/recovery, gunfire/pause/night/perf
.\dev.cmd node scripts/worldtest.mjs farmambience # shared synth waveforms/lifecycle, master/mute/pause and mounted night lamps
.\dev.cmd node scripts/worldtest.mjs drive  # every rural road, both directions, live traffic/parked cars retained
.\dev.cmd node scripts/terrainExpansiontest.mjs # declared grading only; developed ground, chunks, physics and maps
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
  camera/                  cabinView.js (dash, gauges, wheel), cinematic.js, mirrors.js, cutscene.js (KO / BUSTED)
  combat/                  combat.js (health, impacts, KO), carDamage.js, breakables.js, particles.js, wallet.js
  police/                  wanted.js (heat -> stars), policeCar.js (flanking chase), policeManager.js (spawn, soft contact,
                           arrests), copsOnFoot.js (officers), copGuns.js (armed police), theft.js
  weapons/                 weaponStats.js (all gun numbers), arsenal.js (ammo/fire logic), gunModels.js, ik.js (2-bone arm IK),
                           hitscan.js (hit zones), gunFx.js (flash/tracers/casings/impacts/decals), viewmodel.js, playerWeapons.js
  districts/               downtown.js, beach.js, northgate.js, industrial.js (streets/lanes come from the town grid in townPlan.js)
  town/                    Terrace Town Centre: townPlan.js (grid + link road), townLanes.js, townRoads.js,
                           townKit.js (building kit + sign atlas), townBuildings.js, townInteriors.js,
                           townProps.js (breakable trees/lights/bins/signs, bus stops), parks.js, roadworks.js
  npc/                     pedestrians.js (roles), footpaths.js, outfits.js, dog.js, cyclists.js
  audio/                   carAudio.js (engine, horn, screech, thud, siren, gunshots), ambience.js (zone loops), farmAudio.js (pooled synth)
  ui/                      hud.js (speed + tacho), statusHud.js (health/cash/stars), minimap.js, prompt.js, controlsPanel.js,
                           weaponHud.js (ammo, crosshair, hit marker), gunShopMenu.js
  utils/                   seeded RNG, noise, geometry helpers, F3 overlay, debugApi.js
scripts/                   Playwright tests + tuning bench
```

## Matching the real 62 Grand Terrace

Open `src/world/heroHouse62.js`: the `COL` and `DIM` blocks at the top drive the whole
model (wall blocks, roof pitches, window positions, door, garage, beds, fences, letterbox,
gums). Colours live in `PALETTE.hero` in `src/art/palette.js`.

## Performance

Phase 6.1: 116-357 draw calls across 19 scenes incl. the airport (budget 600), 60 fps headless except the cabin cam with live mirrors (46). Phase 5: 72-168 draw calls in the new districts (budget 500), 450-750k triangles, 54-60 fps in the headless Edge test on
this Ryzen 5 7530U (scripts/perfscenes.mjs; the cabin cam with live mirrors is the heaviest view).
The town is split into per-block chunks hidden beyond ~260 m; shop interiors only render within ~25 m;
pedestrians further than 120 m and cyclists further than 150 m sleep. Pixel ratio capped at 1.5, one 2048 shadow map
that follows the player, instanced houses/trees/wheels/street lights, merged static
geometry, shared materials, no post-processing.
