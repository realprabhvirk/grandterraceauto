// Respawn points. Until the town (Phase 4 step 6) exists these are temporary footpath spots
// on Grand Terrace near 62; the town module replaces them via setHospital / setPolice.
import * as THREE from 'three';
import { ROAD } from './roadNetwork.js';

export function createSpawnPoints(world) {
  const S = world.network.main.samples, hero = world.layout.hero;
  const footpath = (offset) => {
    const s = S[Math.max(0, Math.min(S.length - 1, hero.site.i + offset))];
    const lat = ((ROAD.pathIn + ROAD.pathOut) / 2) * hero.side;
    const x = s.x + s.nx * lat, z = s.z + s.nz * lat;
    return { position: new THREE.Vector3(x, world.terrain.getHeight(x, z) + 0.05, z), yaw: Math.atan2(s.tx, s.tz) };
  };
  let hospital = footpath(40), police = footpath(-40);
  return {
    hospital: () => hospital,
    police: () => police,
    setHospital(p) { hospital = p; },
    setPolice(p) { police = p; },
    temporary: true,
  };
}
