// Builds the whole static world in dependency order and returns handles the game needs.
import * as THREE from 'three';
import { buildRoadNetwork } from './roadNetwork.js';
import { buildLayout, lotPads } from './layout.js';
import { Terrain } from './terrain.js';
import { buildRoads } from './roads.js';
import { buildDriveways } from './driveways.js';
import { buildSigns } from './signs.js';
import { buildHouses } from './houses.js';
import { buildTrees } from './trees.js';
import { buildHeroHouse, HERO_LOT, HERO_PATH_X } from './heroHouse62.js';
import { buildStreetLights } from './streetLights.js';
import { lotToWorld } from './layout.js';
import { makeRng } from '../utils/rng.js';
import { fbm } from '../utils/noise.js';

export function buildWorld(scene) {
  const t0 = performance.now();
  const network = buildRoadNetwork();
  const layout = buildLayout(network);
  const terrain = new Terrain({ roads: network.roads, pads: network.pads, lots: lotPads(layout) });
  scene.add(terrain.mesh);
  scene.add(buildRoads(network, layout.cuts));
  scene.add(buildDriveways(layout.driveways, terrain));
  scene.add(buildSigns(network));

  const houses = buildHouses(layout.regular);
  scene.add(houses.group);

  const trees = buildTrees([...layout.treeSpots, ...bushSpots(network, layout)], terrain);
  scene.add(trees.group);

  const hero = buildHeroHouse(layout.hero, terrain);
  if (hero) scene.add(hero.group);

  const lights = buildStreetLights(network, layout);
  scene.add(lights.group);

  const colliders = [...houses.colliders, ...(hero ? hero.colliders : [])];
  const trunks = trees.trunks;
  console.log(`[gta] world built in ${(performance.now() - t0).toFixed(0)} ms: ${layout.regular.length} houses, ${trunks.length} trees, hero at (${layout.hero.x.toFixed(1)}, ${layout.hero.z.toFixed(1)})`);
  return { network, layout, terrain, colliders, trunks, hero, poles: lights.poles };
}

/**
 * Scattered bushland groves on the hills around the suburb (same instanced meshes as the
 * yard trees, so they cost no extra draw calls). Kept clear of roads and lots.
 */
function bushSpots(network, layout) {
  const rng = makeRng(7788);
  const out = [];
  for (let tries = 0; tries < 4000 && out.length < 110; tries++) {
    const x = rng.range(-245, 245), z = rng.range(-245, 245);
    if (fbm(x / 70 + 9, z / 70 - 3, 3, 21) < 0.08) continue; // groves, not a uniform carpet
    if (network.index.nearest(x, z, 15)) continue;
    if (network.pads.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 16)) continue;
    if (layout.lots.some((l) => Math.hypot(x - l.x, z - l.z) < (l.kind === 'hero' ? 34 : 17))) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 5)) continue;
    out.push({ x, z, bush: true });
  }
  return out;
}

/** Footpath spawn point outside 62, facing the house. */
export function heroSpawn(world) {
  const { hero } = world.layout;
  // Footpath centre is 6.05 m from the road centreline; in lot space that's setback - 6.05.
  const { x, z } = lotToWorld(hero, HERO_PATH_X, HERO_LOT.setback - 6.05);
  return { position: new THREE.Vector3(x, world.terrain.getHeight(x, z), z), yaw: Math.atan2(-hero.fx, -hero.fz) };
}
