// One real (non-shadow) SpotLight that follows whichever car has its headlights on and
// is closest to the action (the driven car first). It always exists - intensity goes to
// 0 when unused - so the light count never changes and no shader ever recompiles.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';

export function createHeadlightRig(scene) {
  const spot = new THREE.SpotLight(PALETTE.cars.headGlow, 0, 48, 0.52, 0.65, 1.3);
  spot.castShadow = false;
  scene.add(spot, spot.target);
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  let level = 0;
  return {
    spot,
    /** car = car to light (or null), night = 0..1 (beams are brighter at night). */
    update(dt, car, night) {
      const want = car && car.lights ? 55 + 60 * night : 0;
      level += (want - level) * Math.min(1, dt * 8);
      spot.intensity = level;
      if (!car) return;
      const a = car.anchors;
      car.model.updateMatrixWorld(true);
      p.set(0, a.headY + 0.05, a.headZ + 0.1).applyMatrix4(car.model.matrixWorld);
      t.set(0, -0.6, a.headZ + 14).applyMatrix4(car.model.matrixWorld);
      spot.position.copy(p);
      spot.target.position.copy(t);
      spot.target.updateMatrixWorld();
    },
  };
}
