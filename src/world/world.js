// Builds the whole static world in dependency order and returns handles the game needs.
import * as THREE from 'three';
import { buildRoadNetwork, RoadIndex } from './roadNetwork.js';
import { buildTownPlan } from '../town/townPlan.js';
import { buildTown } from '../town/town.js';
import { findWattleSite } from '../town/parks.js';
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
import { assignSpeedLimits } from './speedLimits.js';
import { buildStreetSigns } from '../city/streetSigns.js';
import { HWY, BRIDGES } from '../city/highwayPlan.js';
import { buildHighway } from '../city/highway.js';
import { landmarkLots } from '../city/landmarks.js';
import { airportAreas } from '../airport/airportPlan.js';
import { cameraAheadSigns } from '../city/cameraPlan.js';
import { SPEEDING } from '../police/speedingConfig.js';
import { fbm } from '../utils/noise.js';
import { buildRuralPlan, attachRuralGraph } from '../rural/ruralPlan.js';
import { buildRuralRoads } from '../rural/ruralRoads.js';
import { buildFarms } from '../rural/farms.js';
import { farmPonds, farmTracks } from '../rural/farmConfig.js';
import { TOWN } from './terrain.js';

export function buildWorld(scene) {
  const t0 = performance.now();
  const network = buildRoadNetwork();
  const layout = buildLayout(network);
  // Terrace Town Centre street plan (after the suburb layout, so lots are unaffected).
  const plan = (network.town = buildTownPlan(network));
  const rural = buildRuralPlan();
  // The motorway grades the terrain as three parallel sample lines (20 m wide), but leaves the
  // street corridors under its bridges to the streets that pass underneath.
  const hwRoad = plan.roads.find((r) => r.highway && !r.ramp);
  const hwGrade = [-6, 0, 6].map((dz) => ({ halfW: 4, samples: hwRoad.samples.filter((s) => !HWY.crossings.some((c) => Math.abs(s.x - c) < HWY.deckHalf)).map((s) => ({ ...s, z: s.z + dz })) }));
  const terrain = new Terrain({ roads: [...network.roads, plan.link, ...plan.roads.filter((r) => r !== hwRoad), ...hwGrade, ...rural.roads, ...farmTracks(TOWN.h)], pads: network.pads, lots: [...lotPads(layout), ...landmarkLots(), ...rural.sites], depressions: farmPonds(TOWN.h) });
  terrain.bridges = BRIDGES;
  scene.add(terrain.mesh);
  scene.add(buildRoads(network, layout.cuts));
  scene.add(buildRoads({ roads: [plan.link], junctions: [], pads: [], index: network.index }, []));
  scene.add(buildDriveways(layout.driveways, terrain));
  scene.add(buildSigns(network));

  const houses = buildHouses(layout.regular);
  scene.add(houses.group);

  // Wattle Park (suburb): pick an open flat spot near the cul-de-sacs before the bush goes in.
  const wattleSite = findWattleSite(network, layout, terrain);
  const clearOfPark = (p) => !wattleSite || Math.hypot(p.x - wattleSite.x, p.z - wattleSite.z) > 30;
  const ruralIndex = new RoadIndex(rural.roads);
  const clearOfRural = p => !ruralIndex.nearest(p.x, p.z, 12);
  const trees = buildTrees([...layout.treeSpots, ...bushSpots(network, layout).filter(clearOfPark)].filter(clearOfRural), terrain);
  scene.add(trees.group);

  const hero = buildHeroHouse(layout.hero, terrain);
  if (hero) scene.add(hero.group);

  const lights = buildStreetLights(network, layout);
  scene.add(lights.group);

  // Everything else in town (streets, buildings, props); then the road index covers town too.
  network.allRoads = [...network.roads, plan.link, ...plan.roads];
  const town = buildTown(scene, { network, layout, terrain, plan, wattleSite });
  attachRuralGraph(rural, plan);
  network.allRoads.push(...rural.roads);
  buildRuralRoads(rural, terrain, scene);
  town.pedLines.push(...rural.pedLines);
  town.chunks.push(...rural.chunks);
  network.index = new RoadIndex(network.allRoads);
  // Street names (road.street) + speed limits (road.speedLimit) on every road definition.
  for (const r of network.allRoads) r.street = r.street || r.name;
  assignSpeedLimits(network.allRoads);
  // City-wide signage: street-name blades at every junction, speed-limit signs (breakable, no heat).
  network.cameraAheadSigns = SPEEDING.CAMERAS_ENABLED ? cameraAheadSigns(network.allRoads) : []; // Phase 6.1: cameras off by default
  const citySigns = buildStreetSigns({ network, plan, terrain });
  scene.add(citySigns.group);
  const highway = buildHighway({ scene, terrain });

  const colliders = [...houses.colliders, ...(hero ? hero.colliders : []), ...town.colliders, ...highway.colliders];
  const originalColliders = colliders.slice();
  const farms = buildFarms({ parent: scene, terrain });
  rural.farms = farms.farms; rural.cultivated = farms.cultivated; rural.water = farms.water;
  rural.npcSpots = farms.npcSpots;
  town.chunks.push(...farms.chunks); town.places.push(...farms.places); town.updaters.push(...farms.updaters);
  colliders.push(...farms.colliders);
  const trunks = [...trees.trunks, ...town.trunks];
  trunks.push(...farms.trunks);
  console.log(`[gta] world built in ${(performance.now() - t0).toFixed(0)} ms: ${layout.regular.length} houses, ${trunks.length} trees, hero at (${layout.hero.x.toFixed(1)}, ${layout.hero.z.toFixed(1)})`);
  return { network, layout, terrain, colliders, originalColliders, trunks, hero, town, rural, poles: [...town.poles], streetLights: lights, toggles: [...(hero ? hero.toggles : []), ...town.toggles], citySigns, highway, areas: airportAreas() };
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
