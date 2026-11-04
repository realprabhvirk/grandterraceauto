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
