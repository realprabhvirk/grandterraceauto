// window.__gta.debug - helpers for the Playwright scripts (and for poking at things
// from the browser console). Nothing here is used by normal play.
import * as THREE from 'three';
import { buildRoutes, runAutopilot } from '../vehicles/autopilot.js';
import { MAT } from '../art/materials.js';

export function createDebugApi({ world, vehicles, controls, camera }) {
  const hero = () => vehicles.cars.find((c) => c.hero);
  return {
    /** Exact live material registry, including Vite's current module identity. */
    materials: () => MAT,
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
    /** Is the camera inside any static collider or car (other than the one being driven)? */
    cameraInside() {
      const { world: w, RAPIER } = window.__gta.physics, p = camera.position, own = controls.car ? new Set(controls.car.body.colliders.map((c) => c.handle)) : new Set();
      const hit = w.intersectionWithShape({ x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Ball(0.08), undefined, ((0x4 << 16) | 0x3), undefined, undefined, (c) => !own.has(c.handle) && c.shape.type !== RAPIER.ShapeType.HeightField);
      const below = p.y < world.terrain.getHeight(p.x, p.z) - 0.05;
      return !!hit || below;
    },
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
    /** Teleport the walker to a world point (y = ground + dy). */
    teleport(x, z, yaw = 0, dy = 0.1) { const y = world.terrain.getHeight(x, z) + dy; controls.player.teleport({ x, y, z }, yaw); return [x, y, z]; },
    /** Walk (virtual W) to a world point. Resolves with the final world position. */
    async walkToWorld(tx, tz, timeout = 12000) {
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
      const p = controls.player.position;
      return [p.x, p.y, p.z].map((v) => +v.toFixed(2));
    },
    /** Teleport the driven car onto the town ring road and autopilot one full loop (keep left). */
    async driveTownLoop(opts = {}) {
      const car = controls.car;
      if (!car) throw new Error('not driving');
      const { X, Z } = { X: world.town.plan.nodes.filter((n) => !n.north).map((n) => n.x), Z: world.town.plan.nodes.filter((n) => !n.north).map((n) => n.z) };
      const x0 = Math.min(...X), x1 = Math.max(...X), z0 = Math.min(...Z), z1 = Math.max(...Z), L = 2.2;
      const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const [ax, az] = corners[k], [bx, bz] = corners[k + 1];
        const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
        for (let s = 10; s <= len - 10; s += 4) pts.push({ x: ax + dx * s + dz * L, z: az + dz * s - dx * L });
      }
      pts.push({ ...pts[0] });
      const a = pts[0], b = pts[1];
      car.body.teleport(a.x, world.terrain.getHeight(a.x, a.z), a.z, Math.atan2(b.x - a.x, b.z - a.z));
      controls.chase.reset(car);
      await new Promise((r) => setTimeout(r, 400));
      return runAutopilot({ car, input: controls.input, terrain: world.terrain, points: pts, obstacles: [], speed: 15, timeout: 160, ...opts });
    },
    /** Town summary: what is in the district right now. */
    town() {
      const g = window.__gta, T = world.town, b = T.plan.bounds, inTown = (x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
      return {
        chunks: T.chunks.length, visibleChunks: T.chunks.filter((c) => c.group.visible).length,
        traffic: g.traffic.cars.filter((c) => inTown(c.pos.x, c.pos.z)).length,
        peds: g.peds.peds.filter((p) => inTown(p.pos.x, p.pos.z)).length,
        storeInside: T.interiors.chunks.length, places: world.places?.length,
      };
    },
    /**
     * Cabin camera check (call while in the cabin cam): rays from the eye to road points
     * 6/10/20 m ahead at lateral -1.5/0/+1.5 m; any solid car-interior mesh in the way counts as
     * blocked. Also the projected top edge of the dash/binnacle (0 = top of the screen, 1 = bottom).
     */
    cabinCheck() {
      const car = controls.car, cab = car?.cabin;
      if (!cab) return null;
      camera.updateMatrixWorld(true); car.model.updateMatrixWorld(true);
      const meshes = [];
      car.model.traverse((o) => { if (o.isMesh && o.material === MAT.solid) { let v = true, own = false; for (let p = o; p; p = p.parent) { if (!p.visible) v = false; if (p.name === 'player' || /^gun-/.test(p.name)) own = true; } if (v && !own) meshes.push(o); } }); // the driver's own body/guns are not cabin interior
      const f = car.body.forward(), r = { x: -f.z, z: f.x }, eye = camera.position.clone();
      const ray = new THREE.Raycaster(), blocked = [];
      for (const ahead of [6, 10, 20]) for (const lat of [-1.5, 0, 1.5]) {
        const x = car.position.x + f.x * ahead + r.x * lat, z = car.position.z + f.z * ahead + r.z * lat;
        const p = new THREE.Vector3(x, world.terrain.getHeight(x, z) + 0.05, z), d = p.distanceTo(eye);
        ray.set(eye, p.clone().sub(eye).normalize()); ray.far = d - 0.05;
        const hit = ray.intersectObjects(meshes, false)[0];
        if (hit) blocked.push({ ahead, lat, by: hit.object.name || hit.object.parent?.name || 'mesh', at: +hit.distance.toFixed(2) });
      }
      const [sx] = car.cfg.seat;
      const proj = (y, z) => { const v = new THREE.Vector3(sx, y, z).applyMatrix4(car.model.matrixWorld).project(camera); return +((1 - v.y) / 2).toFixed(3); };
      const dashTopY = Math.min(proj(cab.dashTop, cab.dashZ), proj(cab.dashTop + 0.04, cab.dashZ - 0.11));
      return { type: car.type, blocked, rays: 9, dashTopY, fov: camera.fov, eyeY: +(eye.y - car.position.y).toFixed(2) };
    },
    /**
     * Scripted chase: the driven car goes to the start of Grand Terrace, wanted = stars, two
     * cops placed 8-12 m behind in chase mode, then autopilot flat out for `seconds`.
     */
    async chaseTest({ stars = 3, seconds = 12, speed = 34 } = {}) {
      const g = window.__gta, car = controls.car;
      if (!car) throw new Error('not driving');
      // The town ring road: a 280 m straight then the corner.
      const X = world.town.plan.nodes.filter((n) => !n.north).map((n) => n.x), Z = world.town.plan.nodes.filter((n) => !n.north).map((n) => n.z);
      const x0 = Math.min(...X), x1 = Math.max(...X), z0 = Math.min(...Z), z1 = Math.max(...Z);
      const pts = [];
      for (let x = x0 + 6; x <= x1 - 12; x += 4) pts.push({ x, z: z0 - 2.2 });
      for (let z = z0 + 12; z <= z1 - 12; z += 4) pts.push({ x: x1 + 2.2, z });
      const route = { points: pts }, [a, b] = pts;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      car.body.teleport(a.x, world.terrain.getHeight(a.x, a.z), a.z, yaw);
      controls.chase.reset(car);
      g.wanted.clear(true); g.wanted.add('test', [0, 20, 60, 120, 200, 300][stars] + 1);
      g.police.reset();
      await new Promise((r) => setTimeout(r, 300));
      for (const [back, side] of [[9, 1.6], [13, -1.6]]) {
        g.police.spawnOne({ x: a.x, y: 0, z: a.z });
        const c = g.police.cars[g.police.cars.length - 1];
        if (!c) continue;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        c.pos.set(a.x - fx * back - fz * side, 0, a.z - fz * back + fx * side); c.fwd.set(fx, 0, fz); c.mode = 'chase'; c.v = 6;
      }
      // A clear path (spec): traffic on the ring road's north side and east corner is removed.
      for (const t of [...g.traffic.cars]) if ((Math.abs(t.pos.z - z0) < 10 && t.pos.x > x0 - 10) || (Math.abs(t.pos.x - x1) < 10 && t.pos.z < z0 + 120)) g.traffic.removeCar(t);
      g.police.st.contactTime = 0; g.police.st.contacts = 0;
      const res = await runAutopilot({ car, input: controls.input, terrain: world.terrain, points: route.points, obstacles: [], speed, timeout: seconds });
      const p = car.position, d = g.police.cars.map((c) => +Math.hypot(c.pos.x - p.x, c.pos.z - p.z).toFixed(1));
      return { reason: res.reason, time: res.time, wp: res.waypoints, stalls: res.stalls, nearest: Math.min(...d), d, contactTime: +g.police.st.contactTime.toFixed(2), contacts: g.police.st.contacts, maxKmh: res.maxSpeed, dist: res.dist, cops: g.police.cars.length };
    },
    /** Teleport the driven car to pts[0] and autopilot through the points (physics checks). */
    async drivePoints(pts, opts = {}) {
      const car = controls.car;
      if (!car) throw new Error('not driving');
      const [a, b] = pts;
      car.body.teleport(a.x, world.terrain.getHeight(a.x, a.z), a.z, Math.atan2(b.x - a.x, b.z - a.z));
      controls.chase.reset(car);
      await new Promise((r) => setTimeout(r, 400));
      return runAutopilot({ car, input: controls.input, terrain: world.terrain, points: pts, obstacles: opts.obstacles || [], speed: opts.speed || 15, timeout: opts.timeout || 90 });
    },
    /** Straight lane points from (ax, az) to (bx, bz), keep-left offset, every 4 m. */
    lanePoints(ax, az, bx, bz, lane = 2.2) {
      const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, out = [];
      for (let s = 0; s <= len; s += 4) out.push({ x: ax + dx * s + dz * lane, z: az + dz * s - dx * lane });
      return out;
    },
    /** Last 30 crash damage events / ignored velocity jumps (phantom-crash diagnostics). */
    /** Last ~3 s of the driven car's physics steps (pitch, rates, suspension, inputs). */
    carTrace() { return controls.car?.body.trace?.buf.slice() || []; },
    damageEvents() { return window.__gta.combat.damageLog.slice(); },
    ignoredImpacts() { return window.__gta.combat.ignoredLog.slice(); },
    /** Wanted timing state (phase none/solid/flashing + timers). */
    wanted() { const s = window.__gta.wanted.state; return { stars: s.stars, wantedPhase: s.phase, graceRemaining: +s.grace.toFixed(2), flashRemaining: +Math.max(0, s.flashT).toFixed(2), hiddenTimer: +s.hidden.toFixed(2), nearestCopDistance: Number.isFinite(s.nearest) ? +s.nearest.toFixed(1) : null }; },
    /** Who would witness a crime at pos right now: [{ kind, cop, dist }]. */
    getWitnesses(pos) { return window.__gta.crimes.getWitnesses(pos).map((w) => ({ kind: w.kind, cop: w.cop, dist: w.dist })); },
    /** Put a patrol car (chase mode, stopped) at a world point facing yaw. */
    placeCop(x, z, yaw = 0) {
      const g = window.__gta;
      g.police.spawnOne({ x, y: 0, z });
      const c = g.police.cars[g.police.cars.length - 1];
      if (!c) return null;
      c.pos.set(x, world.terrain.getHeight(x, z), z); c.fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); c.mode = 'chase'; c.v = 0;
      return c.id;
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
        cameraMode: controls.cameraMode,
        health: +(window.__gta.combat?.hp ?? 100).toFixed(1),
        carHealth: controls.car ? +(controls.car.health ?? 100).toFixed(1) : null,
        cash: window.__gta.wallet?.cash,
        stars: window.__gta.world.wanted?.stars || 0,
        heat: window.__gta.world.wanted?.heat || 0,
        searching: !!window.__gta.world.wanted?.searching,
        police: window.__gta.police ? window.__gta.police.cars.map((c) => ({ mode: c.mode, d: +Math.hypot(c.pos.x - controls.focus().x, c.pos.z - controls.focus().z).toFixed(1) })) : [],
        stolen: !!controls.car?.stolen,
        ko: !!window.__gta.combat?.ko,
        wheelAngle: +controls.cabin.wheelAngle().toFixed(3),
      };
    },
  };
}
