# Decisions

One line per judgment call made during the autonomous build.

- Setup: Plan A (portable Node v26.13.0 LTS in .tools/node, SHA256-verified); no Plan B needed.
- Setup: Vite scaffolded via create-vite into a temp folder and moved in, so dev.cmd/.gitignore were never overwritten.
- Setup: git identity set repo-local only (not global) because none was configured.
- Setup: dev.cmd also points npm's cache at .tools/npm-cache so nothing is written to the user profile.
- Hero house: reference/house62/ is empty, so 62 is an original modern Queensland two-storey design (light render, charcoal hip roof, double garage, porch); every dimension/colour is a constant at the top of heroHouse62.js.
- Roads: 7.2 m asphalt, 0.3 m white kerb, 1.4 m grass verge, 1.5 m footpath each side; no centre line markings (typical narrow QLD suburban street).
- Roads: terrain is exactly road height across an 8.2 m corridor and eases back over 18 m, so roads can never float or gap; ribbons sit 5-6 cm above with polygon offset.
- Roads: cul-de-sacs are laid out in the junction's local frame so they always leave Grand Terrace at a right angle; 11 m turning circles.
- Roads: road vertical profile = natural ground smoothed over ~32 m and grade-limited to 7.5%.
- Layout: hero site = Grand Terrace sample with lowest (grade, bend, cut/fill) score, >=60 m from any junction, choosing the side needing the least earthwork.
- Layout: cul-de-sac lots are placed first, Grand Terrace lots thinned evenly to a 32-house budget (spec said ~28; 32 keeps both sides of every street populated).
- Houses: no mirrored instances (negative scale would render inside-out with InstancedMesh); variety comes from 4 variants x palette colours.
- Houses/driveways: every lot gets a concrete driveway to the kerb with a kerb crossover cut.
- Lighting: three.js physical light units divide Lambert by pi, so sun=3.7 / hemi=1.95 to land ~1.0x on the ground; NeutralToneMapping (keeps palette hues; ACES muddied them).
- Look: asphalt is a stylised mid grey (#716e73) - realistic dark asphalt fell into the tone-mapper toe and read as black-purple.
- Time of day: default is warm late afternoon; T toggles a smooth blend to dusk, which turns on window glow and wall lamps.
- Hero house: no chimney (rare on modern QLD homes and the brief said only if the real one has one); added QLD-typical solar panels, Colorbond side fences, wheelie bins and a Hills hoist instead.
- Hero house: modern massing = two-storey hip-roof block + flat-roofed double-garage wing + front ledge; garage wing render is a shade darker for articulation.
- Hero house: 4 draw calls (merged solid, glass, lamps, numerals texture). Hedge/letterbox bases sunk 0.4 m because the front boundary sits right at the road corridor edge.
- Terrain: lot pads now override the road blend (except inside the road corridor) - previously raised lots would have floated at their front edge.
- Exterior lights are emissive geometry only (no extra light sources) to respect the single-shadow-light / iGPU budget.
- Player: Rapier kinematic capsule (1.74 m) + KinematicCharacterController (50 deg max slope, 0.45 m autostep, snap-to-ground); fixed 60 Hz physics.
- Player: spawn is on the footpath centreline in line with 62's front path (not the house centreline) so W walks straight up the path.
- Player: walk 4.2 m/s, Shift run 7.8 m/s, Space jump; orbit camera (mouse/arrow keys, wheel zoom) that ray-casts and pulls in when a wall/hedge blocks it.
- Debug: C toggles free-fly; in fly mode keys 1-5 jump to presets (hero-front, hero-34, street, overview, top).
- Physics: invisible boundary walls 40 m inside the map edge keep the player in the playable area.
- Roads: cul-de-sac mouths use 5 m fillets tangent to both the straight kerb and the turning circle (a plain circle-meets-road gave a hard sideways "tongue").
- Look: shadow PCF radius 3 and a 42 m shadow extent (~4 cm texels) - the default kernel produced sawtooth edges under eaves.
- Look: ~110 bushland trees in noise-driven groves around the suburb so the hills aren't an empty field (spec's ~20 yard trees are separate and unchanged).
- Look: dusk fill raised (hemi 1.6) so roads/lawns stay readable instead of going navy-black.
- Docs: README documents controls, URL presets and self-test scripts; hero tweak points called out.

## Phase 2

- Terrain collider: kept the Rapier heightfield (smoother for wheels than a trimesh) and changed the VISUAL triangulation to Rapier's anti-diagonal, so they match exactly. Road surface = the terrain under the corridor (road ribbons are 5-6 cm visual decals); kerbs are visual only, so cars ride over them.
- Junction corners: fillet circle solved from both roads' local tangent lines (not a straight frame), straight kerbs cut by arc length at the tangent points; capped the Phase 1 fix time, so tiny apex slivers stay.
- F4 debug draw: terrain drawn as a local 36x36-cell wireframe around the focus instead of Rapier's full heightfield (~350k segments); everything else straight from world.debugRender().
- Cars: hero car = sedan in 'Grand Terrace teal' (#1f6e73) with boot spoiler, twin exhausts and lighter rims; other 7 cars cycle hatch/ute/4WD/sedan with non-repeating palette paints.
- Cars: Australian right-hand drive (driver seat on the car's right) and left-side kerb parking facing the direction of travel.
- Cars: physics wheels are 4 cm bigger than the visual tyres so tyres sit on the 5 cm road decal; the visual body is lifted by suspension sag + 4 cm so arches centre on the wheels.
- Cars: per-car materials avoided - light states swap between shared off/on/brake materials (no shader recompiles); all 28 regular wheels are one InstancedMesh (+1 for the hero's rims).
- Cars: ute has a black tonneau cover instead of an open tray (cheaper, reads well); 4WD has roof rails, cladding and a rear spare.
- Vehicle physics: low centre of mass + 1.8x roll inertia + upright torque + roll damping + downforce + 4.5 m/s upward-velocity clamp = hard to flip, no launching off crests.
- 62 from photo: removed solar panels, hedge, palms, frangipani and the front path (not in the photo); the porch now opens onto the lawn/driveway like the real house.
- 62 from photo: roof tiles shown as faceted charcoal planes with ridge/hip capping (no per-tile geometry); shutters are thin white slats just behind the glass so they read by day and glow at dusk.
- 62 from photo: player spawn moved in line with the front door (x = 2.2) since there is no front path any more.
- Debug fly camera moved from C to F2 (C freed up; crouch is Ctrl as specified).
- Night: street-light pools are additive textured discs (no real lights) so the 1-shadow-light rule and the iGPU budget hold; they fade in after sunset (night factor > 0.35).
- Exit: F gets out only below ~30 km/h ("Slow down to get out" otherwise) so you are never dropped beside a fast car; the car then brakes to a stop on its own.
- Exit spot: driver's door (right-hand drive) first, then passenger side, behind, front, further out; each tested with the player capsule against walls and cars; roof as last resort.
- Keys: H is the horn in a car and toggles the help panel on foot (? works everywhere); T kept as an alias for N; M mutes (extra).
- Headlights: switch on automatically when you get in at night or press N while driving; L toggles any time. Parked cars keep their lights off.
- Crouch keeps the standing capsule (camera and speed drop) - simpler and avoids getting stuck when standing up under things.
- Seated driver is visible through semi-transparent car glass (hands on wheel, head follows the steering).
- Drive test autopilot is debug-only (src/vehicles/autopilot.js) and uses the same virtual-key path as the keyboard, so the real driving code is what's tested.

## Phase 3

- Settings: Esc toggles the settings panel (the first Esc only releases pointer lock - browser rule); volume/mute persist in localStorage (per-viewer convenience only).
- Drive test: cul-de-sac routes use centreline waypoints with no avoidance and pass on physics (height band, tilt, NaN); Grand Terrace keeps the lane + overtaking test.
- Characters: switched from 11 meshes per character to one SkinnedMesh with rigid one-bone-per-part skinning (same pose code), so 20 pedestrians cost ~20 draw calls instead of ~220.
- Pedestrians: kinematic capsules in a new NPC collision group (blocks the player and cars, ignored by wheel rays and cameras); no damage or reactions beyond dodging.
- Traffic: kinematic lane-following (no Rapier vehicle per AI car); kinematic colliders so the player's car hits them but they never get knocked off their lane (arcade).
- Traffic: AI cars ignore pedestrians (pedestrians dodge instead), stop for the walking player in their lane, and treat stationary non-driven cars as parked (swing out round them).
- Left-hand traffic fix: road sample normals are the RIGHT of travel; lanes/parking now use -n for keep-left. Kerbside parked cars moved to the correct side as a result.

## Phase 4

- Exit spots: candidates must pass a ground raycast (real floor incl. slabs), a capsule overlap test and a line-of-sight ray from the car centre (keeps you in the same room); seat + 1 s ghosted car as last resort.
- Garage<->hall: hinged internal door added to the existing x=3.9 partition opening (E, same door module).
- Cameras: C cycles third/first person on foot and chase/cabin/cinematic in a car (remembered separately); F2 stays the debug fly cam.
- Cabin: one shared cabin builder sized from CAR_TYPES (dash, binnacle, pillars, lining, door cards, seats); steering wheel = 450 deg lock-to-lock scaled by steer/maxSteer; gauges from a simulated 5-speed gearbox (src/vehicles/drivetrain.js).
- Mirrors: 3x 256x128 render targets updated round-robin (one per frame), shadow map not re-rendered; perf guard compares 1.5 s frozen vs 2 s live and falls back to a static tint if >10 fps lost or <40 fps.
- Damage: car damage = (impact dv - 3 m/s) x 4.5; player damage when dv > 8 = (dv - 8) x 6 (x0.85 in cabin); falls > 4 m = (drop - 4) x 12; hit by a car = speed x 2.2 with knockback.
- Car damage visuals reuse each car's own merged geometry (vertex-colour darkening in bands) plus a loose bumper bar, popped hood, pooled smoke and emissive flame cones - no extra lights.
- Breakables: props break BEFORE their collider stops the car (prediction from speed/heading vs toughness); timber fence sections and the street-name signs stay unbreakable (merged geometry) - logged as rough.
- Respawn points are temporary footpath spots near 62 until the town exists (src/world/spawnPoints.js).
- Police: kinematic PoliceCar extends TrafficCar (cheap); flashing via swapped MeshBasic materials, no real lights; route = Dijkstra over lanes to the lane point nearest the LAST-SEEN position; direct chase within 40 m with line of sight; box in at half a car length + 3 m, ram only if the player keeps moving.
- Escape: no reinforcements spawn while the stars flash; routing to last-seen (not true) position.
- Footpath-scare heat only counts when the player's car is off the road (>4.6 m from any centreline).
- Carjack swaps the kinematic traffic car for a drivable Rapier copy (8 spare wheel slots in the instanced wheel mesh).
- P4 step 6: Terrace Town Centre sits east of Grand Terrace's end (x 300-640, z -245..75), reached by the new Terrace Link; the terrain grid became a rectangle (-300..700 x -300..300) so the suburb heights are unchanged.
- P4 step 6: town is a 4x3 street grid (outer lines = Ring Rd, Terrace Pde = main street, Market St + Station St); square corners, give-way rule for minor approaches; GT's end U-turn now continues into town.
- P4 step 6: town kerbs/footpaths are visual only (flat ground = terrain heightfield), like the suburb.
- P4 step 6: car park / police bay / ambulance cars are static merged meshes with colliders (not stealable) to save draw calls and wheel slots.
- P4 step 6: police cars only launch from the (town) station when it is within 260 m; otherwise they spawn out of view as before.
- P4 step 6: shop interiors have no extra point lights (sunlit through a non-shadow ceiling would need a shadow exception; kept simple: hemisphere-lit, ceiling light panels are just pale boxes).
- P4 step 6: Wattle Park is auto-sited (flattest open spot 42-72 m from a cul-de-sac head, clear of lots/roads); bush trees there are removed.
- P4 step 6: traffic 6 -> 10 cars (4 start in town); 10 extra pedestrians walk the town block loops.
- P4 step 7: 40 pedestrians in one system with roles (walker, jogger, dog walker, shopper with bags, bench sitter, picnicker, police on foot, road worker, paramedic, shopkeeper); stationary roles hold a spot and walk back to it after being knocked down or scared.
- P4 step 7: cyclists (3) are a separate light system on the traffic lanes, ride 1.1 m left of the lane centre; traffic treats them as slow movers; they can be knocked off (counts as hitting a person for the wanted level).
- P4 step 7: roadworks are on Grand Terrace (auto-placed away from junctions, parked cars and 62); cones are breakable.
- P4 step 7: in-store staff (2 cashiers, guard, 3 shoppers) are decorative (not in the ped system) - cars can't reach them.

## Phase 5
- P5 step 0: the baseline run was interrupted by my own edits (Vite reloads the test page); all suites were re-run after Step 1 instead.
- P5 1a: POV hides the whole local skinned mesh (head + body); the viewmodel is a separate scene + camera (FOV 60) rendered after clearDepth, lit by its own hemi + directional light (no shadows, still one shadow light in the world). renderer.info is reset manually so F3/perf counts include both passes.
- P5 1b: in the cabin cam the car's exterior paint mesh (hood + shell) is hidden; the cabin interior (dash, pillars, roof lining, doors) stands in. Eye +7 cm, dash top 4 cm below the belt line, A-pillars 4.5 cm, wheel rim 1.3 cm.
- P5 1c: one wheel event = deltaY/100 notches (pinch: deltaY/25); third-person 1.8-8 m (default 4.6), POV FOV 60-100 (default 75), cabin 65-85 (default 75).
- P5 1d: "in a car" includes getting in/out (modes enter/exit); blocked damage is only counted (combat.state.blocked) for tests.
- P5 1e: a dead car you get into later (already burnt out) ejects you straight away - only possible via the debug API since dead cars can't be entered.
- P5 1f: escape = 6 s unseen OR nearest cop >120 m -> 5 s of flashing -> cleared. Officers on foot count as cops for line of sight.
- P5 1g: police colliders keep membership CAR but filter out CAR (no rigid contact with any car); manager does 2D OBB overlap -> pushes the cop out, impulse on the player capped 0.8-2.5 m/s, 1.2 s cooldown per cop. Chase accel 2.8 m/s2 (never out-accelerates a hero car); flank point 3 m behind + 3 m to the side (cops alternate sides).
- P5 1g: the scripted chase test runs on the town ring road with traffic on that stretch removed ("clear path").
- P5 1h: max 4 officers on foot (5 incl. cutscene extras), 1 per car (2 at 3+ stars) on foot; in-car arrests use one "puller". Officers walk through props (no navmesh) - kept simple.
- P5 1i: cutscene time is real time (KO world runs at 0.3x underneath); the busted cutscene borrows the two nearest officers (or spawns them).
- P5 1j: merged town parked cars stay merged until stolen: vertex ranges are recorded at merge time and collapsed when the prop becomes a real Car (switchable collider disabled). Ambulance is now a white 4WD with livery + light bar (was a box van) so the stolen one matches. T is now only lights+siren (N alone toggles night).
- P5 1k: suburb only (town streets have bus stops/zebras/entrances to dodge); extra cars kept 32 m+ from turning circles. Parked cars >120 m from the focus stop simulating (Rapier body put to sleep).
- P5 step 2: gun spec numbers live in src/weapons/weaponStats.js. Rifle = semi-auto with a 4/s cap that repeats while held (reads as burst fire). Shotgun falloff 10 -> 35 m down to 20%.
- P5 step 2: the shot ray starts level with the player along the camera ray (so nothing between the camera and the player can eat the shot); tracers start at the muzzle.
- P5 step 2: third-person hold = gun placed from hip-space poses (ready / aim), pointed at the crosshair target, then analytic 2-bone IK for both arms; long guns twist the torso -0.45 rad (rifle stance). Character arm reach is only 0.58 m, so foregrips sit 0.17-0.32 m ahead of the grip.
- P5 step 2: emotes moved to hold G + 1-4; 1-4 alone pick weapons (only owned ones). Input edges are now cleared by main.js after the weapons read them.
- P5 step 2: bullet threshold for breakables = toughness x 5 damage (street light: 2 pistol rounds). Cars take 25% of weapon damage. Shot civilians fade after 5 s and come back ~30 s later out of sight; heat for shooting a person counts once per person.
- P5 step 2: shots-fired heat +10 per 2.5 s burst only when theft.witnessed() (peds 30 m with LOS / police car 60 m), capped at +40 until the wanted level clears.
- P5 step 3: patrol cars in a chase "shoot from the driver's window" (a muzzle point beside the driver's door, no officer model leaning out). At 4-5 stars armed officers hold ~9-10 m away and shoot instead of grabbing; at 3 stars they still walk up to arrest (and shoot on the way). Car hits do 60% of the on-foot damage to the car.
- P5 step 3: cop gunshot volume falls off linearly to 0 at 140 m (^1.5); cop muzzle flashes don't use the shared flash light (kept for the player's shots).
