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
