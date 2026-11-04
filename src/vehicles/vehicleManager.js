// Owns every car: spawning, per-step physics (only the driven car gets input; the rest
// sit parked on the handbrake), per-frame visual sync and road/grass grip lookup.
import { Car } from './car.js';
import { buildSpawns } from './spawns.js';
import { createWheelInstances } from './wheels.js';
import { ROAD } from '../world/roadNetwork.js';

export function createVehicles({ physics, scene, world }) {
  const spawns = buildSpawns(world);
  const regular = spawns.filter((s) => !s.hero).length;
  const SPARE = 8; // room for carjacked cars (traffic -> drivable)
  const wheels = createWheelInstances((regular + SPARE) * 4);
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
  wheels.mesh.count = next * 4; // unused spare slots stay hidden
  const added = [];

  let active = null; // the car being driven
  let input = null;

  return {
    cars,
    get active() { return active; },
    setActive(car) { active = car; if (!car) input = null; },
    setInput(i) { input = i; },
    /** Fixed-step physics for every car (call after the controls set this step's input). */
    fixedUpdate(dt) { for (const car of cars) if (!car.impounded) car.body.update(dt, car === active ? input : null); },
    sync() { for (const car of cars) if (!car.impounded) car.sync(); },
    /** Add a drivable car (e.g. a carjacked traffic car). Returns it, or null if no slots left. */
    spawn(spec) {
      if (next >= regular + SPARE) return null;
      const car = new Car(physics, scene, { ...spec, y: spec.y ?? world.terrain.getHeight(spec.x, spec.z) }, { mesh: wheels.mesh, offset: (next++) * 4 }, { surfaceAt });
      wheels.mesh.count = next * 4;
      cars.push(car);
      added.forEach((f) => f(car));
      return car;
    },
    onAdded(f) { added.push(f); },
    /** Impound (busted): the car disappears from the world. */
    impound(car) {
      car.impounded = true; car.group.visible = false;
      car.body.colliders.forEach((k) => k.setEnabled(false));
      car.body.teleport(car.position.x, -300, car.position.z, 0);
      car.body.body.setEnabled(false);
      if (active === car) { active = null; input = null; }
    },
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
