// window.__gta.debug - helpers for the Playwright scripts (and for poking at things
// from the browser console). Nothing here is used by normal play.
import { buildRoutes, runAutopilot } from '../vehicles/autopilot.js';

export function createDebugApi({ world, vehicles, controls, camera }) {
  const hero = () => vehicles.cars.find((c) => c.hero);
  return {
    /** Park one car of each type in a row on Grand Terrace near 62, for a group photo. */
    lineup() {
      const S = world.network.main.samples, i0 = world.layout.hero.site.i + 30;
      const seen = new Set(), out = [];
      for (const car of vehicles.cars) { if (!seen.has(car.type)) { seen.add(car.type); out.push(car); } }
      out.forEach((car, k) => {
        const s = S[i0 + k * 6], x = s.x - s.nx * 1.6, z = s.z - s.nz * 1.6;
        car.body.teleport(x, world.terrain.getHeight(x, z), z, Math.atan2(s.tx, s.tz));
      });
      const a = S[i0 + 9];
      camera.position.set(a.x + a.nx * 8 + a.tx * 9, a.h + 2.4, a.z + a.nz * 8 + a.tz * 9);
      camera.lookAt(a.x, a.h + 0.6, a.z);
      controls.syncFly();
      return out.map((c) => c.type);
    },
    routes: () => buildRoutes(world).map((r) => ({ name: r.name, n: r.points.length })),
    /** Get straight into a car (default: the hero car). */
    enter(i = null) { const c = i === null ? hero() : vehicles.cars[i]; controls.debugEnter(c); return c.type; },
    exit() { controls.debugExit(); },
    /** Teleport the driven car to the start of route `idx` and autopilot it to the end. */
    async drive(idx, opts = {}) {
      const car = controls.car;
      if (!car) throw new Error('not driving');
      const route = buildRoutes(world)[idx];
      const [a, b] = route.points;
      car.body.teleport(a.x, world.terrain.getHeight(a.x, a.z), a.z, Math.atan2(b.x - a.x, b.z - a.z));
      controls.chase.reset(car);
      await new Promise((r) => setTimeout(r, 400));
      const obstacles = vehicles.cars.filter((c) => c !== car);
      const res = await runAutopilot({ car, input: controls.input, terrain: world.terrain, points: route.points, obstacles, ...opts, speed: route.speed || opts.speed || 13 });
      return { route: route.name, ...res };
    },
    state() {
      const p = controls.player.position, c = controls.car;
      return {
        mode: controls.mode, player: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), action: controls.player.state.action,
        car: c ? { type: c.type, speed: +(c.body.state.speed * 3.6).toFixed(1), lights: c.lights, pos: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(2)) } : null,
        prompt: controls.interact.current ? controls.interact.current.label : null,
      };
    },
  };
}
