# Decisions

One line per judgment call made during the autonomous build.

- Setup: Plan A (portable Node v26.13.0 LTS in .tools/node, SHA256-verified); no Plan B needed.
- Setup: Vite scaffolded via create-vite into a temp folder and moved in, so dev.cmd/.gitignore were never overwritten.
- Setup: git identity set repo-local only (not global) because none was configured.
- Setup: dev.cmd also points npm's cache at .tools/npm-cache so nothing is written to the user profile.
- Hero house: reference/house62/ is empty, so 62 is an original modern Queensland two-storey design (light render, charcoal hip roof, double garage, porch); every dimension/colour is a constant at the top of heroHouse62.js.
