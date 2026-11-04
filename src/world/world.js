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
import { lotToWorld } from './layout.js';

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

  const trees = buildTrees(layout.treeSpots, terrain);
  scene.add(trees.group);

  const hero = buildHeroHouse(layout.hero, terrain, layout);
  if (hero) scene.add(hero.group);

  const colliders = [...houses.colliders, ...(hero ? hero.colliders : [])];
  const trunks = trees.trunks;
  console.log(`[gta] world built in ${(performance.now() - t0).toFixed(0)} ms: ${layout.regular.length} houses, ${trunks.length} trees, hero at (${layout.hero.x.toFixed(1)}, ${layout.hero.z.toFixed(1)})`);
  return { network, layout, terrain, colliders, trunks, hero };
}

/** Footpath spawn point outside 62, facing the house. */
export function heroSpawn(world) {
  const { hero } = world.layout;
  // Footpath centre is 6.05 m from the road centreline; in lot space that's setback - 6.05.
  const { x, z } = lotToWorld(hero, HERO_PATH_X, HERO_LOT.setback - 6.05);
  return { position: new THREE.Vector3(x, world.terrain.getHeight(x, z), z), yaw: Math.atan2(-hero.fx, -hero.fz) };
}
