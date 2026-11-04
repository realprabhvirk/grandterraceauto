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
      // simple: centreline waypoints, no obstacle avoidance (physics-only check).
      const route = buildRoutes(world, opts.simple ? { lane: 0 } : {})[idx];
      const [a, b] = route.points;
      car.body.teleport(a.x, world.terrain.getHeight(a.x, a.z), a.z, Math.atan2(b.x - a.x, b.z - a.z));
      controls.chase.reset(car);
      await new Promise((r) => setTimeout(r, 400));
      const obstacles = opts.simple ? [] : vehicles.cars.filter((c) => c !== car);
      const res = await runAutopilot({ car, input: controls.input, terrain: world.terrain, points: route.points, obstacles, ...opts, speed: route.speed || opts.speed || 13 });
      return { route: route.name, ...res };
    },
    /** Autopilot the driven car out of 62's driveway and along Grand Terrace (no teleport). */
    async driveOut(waypoints = 40, opts = {}) {
      const car = controls.car;
      if (!car) throw new Error('not driving');
      const hero = world.layout.hero, S = world.network.main.samples;
      const c = Math.cos(hero.rot), s = Math.sin(hero.rot);
      const mouth = { x: hero.x + 7.05 * c + 17.5 * s, z: hero.z - 7.05 * s + 17.5 * c };
      const pts = [mouth];
      for (let k = 0; k < waypoints; k++) {
        const p = S[Math.min(S.length - 1, hero.site.i + 10 + k * 6)];
        pts.push({ x: p.x - p.nx * 1.8, z: p.z - p.nz * 1.8 }); // keep left (normals point right)
      }
      const obstacles = vehicles.cars.filter((o) => o !== car);
      return runAutopilot({ car, input: controls.input, terrain: world.terrain, points: pts, obstacles, speed: 13, timeout: 90, ...opts });
    },
    /** Teleport the walker to a 62 lot-local point (x across, z toward street, y above the pad), facing yaw (lot-relative). */
    teleportLocal(x, y, z, yawLocal = Math.PI) {
      const lot = world.layout.hero, c = Math.cos(lot.rot), s = Math.sin(lot.rot);
      const wx = lot.x + x * c + z * s, wz = lot.z - x * s + z * c;
      controls.player.teleport({ x: wx, y: lot.h + y, z: wz }, lot.rot + yawLocal);
      return [wx, lot.h + y, wz];
    },
    /** Point the debug camera from one 62-local point at another. */
    lookLocal(from, to) {
      const lot = world.layout.hero, c = Math.cos(lot.rot), s = Math.sin(lot.rot);
      const W = ([x, y, z]) => [lot.x + x * c + z * s, lot.h + y, lot.z - x * s + z * c];
      camera.position.set(...W(from));
      camera.lookAt(...W(to));
      controls.syncFly();
    },
    doors: () => world.hero.doors.state,
    /** Walk (virtual W, steering the camera yaw) to a 62 lot-local point. Resolves with the final local pos. */
    async walkTo(lx, lz, timeout = 8000) {
      const lot = world.layout.hero, c = Math.cos(lot.rot), s = Math.sin(lot.rot);
      const tx = lot.x + lx * c + lz * s, tz = lot.z - lx * s + lz * c;
      const st = controls.player.state, I = controls.input, t0 = performance.now();
      I.setVirtual('KeyW', true);
      while (performance.now() - t0 < timeout) {
        const p = controls.player.position;
        if (Math.hypot(tx - p.x, tz - p.z) < 0.45) break;
        st.yaw = Math.atan2(tx - p.x, tz - p.z);
        await new Promise((r) => requestAnimationFrame(r));
      }
      I.setVirtual('KeyW', false);
      await new Promise((r) => setTimeout(r, 250));
      return this.heroLocal();
    },
    /** Press a key for one frame (virtual). */
    async tap(code) { controls.input.setVirtual(code, true); await new Promise((r) => setTimeout(r, 80)); controls.input.setVirtual(code, false); await new Promise((r) => setTimeout(r, 60)); },
    /** Hero car position in 62 lot-local space. */
    heroCarLocal() {
      const car = vehicles.cars.find((v) => v.hero), p = car.position, lot = world.layout.hero;
      const dx = p.x - lot.x, dz = p.z - lot.z, c = Math.cos(lot.rot), s = Math.sin(lot.rot);
      return { x: +(dx * c - dz * s).toFixed(2), y: +(p.y - lot.h).toFixed(2), z: +(dx * s + dz * c).toFixed(2) };
    },
    /** Lot-local position of the walker relative to 62 (x across, z toward the street). */
    heroLocal() {
      const p = controls.player.position, lot = world.layout.hero;
      const dx = p.x - lot.x, dz = p.z - lot.z, c = Math.cos(lot.rot), s = Math.sin(lot.rot);
      return { x: +(dx * c - dz * s).toFixed(2), y: +(p.y - lot.h).toFixed(2), z: +(dx * s + dz * c).toFixed(2) };
    },
    state() {
      const p = controls.player.position, c = controls.car;
      return {
        mode: controls.mode, player: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), action: controls.player.state.action,
        car: c ? { type: c.type, speed: +(c.body.state.speed * 3.6).toFixed(1), lights: c.lights, pos: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(2)) } : null,
        prompt: controls.interact.current ? (typeof controls.interact.current.label === 'function' ? controls.interact.current.label() : controls.interact.current.label) : null,
        lastExit: controls.lastExit || null,
      };
    },
  };
}
