// Owns every car: spawning, per-step physics (only the driven car gets input; the rest
// sit parked on the handbrake), per-frame visual sync and road/grass grip lookup.
import { Car } from './car.js';
import { buildSpawns } from './spawns.js';
import { createWheelInstances } from './wheels.js';
import { ROAD } from '../world/roadNetwork.js';

export function createVehicles({ physics, scene, world }) {
  const spawns = buildSpawns(world);
  const regular = spawns.filter((s) => !s.hero).length;
  const wheels = createWheelInstances(regular * 4);
  scene.add(wheels.mesh, wheels.hero);

  // Grip: asphalt (roads, turning circles) = 1, everything else (grass) = 0.78.
  const { index, pads } = world.network;
  const surfaceAt = (x, z) => {
    if (index.nearest(x, z, ROAD.halfW + 0.6)) return 1;
    if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.6)) return 1;
    return 0.78;
  };

  let next = 0;
  const cars = spawns.map((s) => new Car(physics, scene, s,
    s.hero ? { mesh: wheels.hero, offset: 0 } : { mesh: wheels.mesh, offset: (next++) * 4 },
    { surfaceAt }));

  let active = null; // the car being driven
  let input = null;
  physics.onStep((dt) => {
    for (const car of cars) car.body.update(dt, car === active ? input : null);
  });

  return {
    cars,
    get active() { return active; },
    setActive(car) { active = car; if (!car) input = null; },
    setInput(i) { input = i; },
    sync() { for (const car of cars) car.sync(); },
    nearest(p, maxD) {
      let best = null, bd = maxD;
      for (const c of cars) {
        const q = c.position;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
  };
}
