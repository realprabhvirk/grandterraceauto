// Debug autopilot used by the Playwright drive test. It "presses" W/S/A/D/Space through
// the same virtual-key path as a real keyboard (so the real driving code is exercised),
// follows a waypoint route and records how well the car stayed on the terrain.
import { ROAD } from '../world/roadNetwork.js';

const LANE = 1.8; // keep left (Australia)

/** Waypoint routes: the full length of Grand Terrace, and in-and-out of each cul-de-sac. */
export function buildRoutes(world) {
  const { network } = world;
  const lanePt = (s, dir) => ({ x: s.x + s.nx * LANE * dir, z: s.z + s.nz * LANE * dir });
  const along = (road, i0, i1, stride = 6) => {
    const pts = [], dir = Math.sign(i1 - i0) || 1;
    for (let i = i0; dir > 0 ? i <= i1 : i >= i1; i += stride * dir) pts.push(lanePt(road.samples[i], dir));
    return pts;
  };
  const routes = [];
  const gt = network.main;
  routes.push({ name: 'Grand Terrace', points: along(gt, 4, gt.samples.length - 6) });
  for (const j of network.junctions) {
    const br = j.branch, n = br.samples.length;
    const lastI = n - 1 - Math.round((br.pad.r + 2) / ROAD.step);
    const pts = along(br, 6, lastI);
    // Loop around the turning circle starting where we arrive, continuing forward (which
    // follows the left kerb in left-hand traffic), then back out.
    const pad = br.pad, R = 7.4;
    const A = pts[pts.length - 1], hs = br.samples[lastI];
    const a0 = Math.atan2(A.z - pad.z, A.x - pad.x);
    const fwd = (sg) => { const a = a0 + sg * 0.4; return (pad.x + Math.cos(a) * R - A.x) * hs.tx + (pad.z + Math.sin(a) * R - A.z) * hs.tz; };
    const sg = fwd(1) > fwd(-1) ? 1 : -1;
    for (let k = 1; k <= 10; k++) {
      const a = a0 + sg * (k / 10) * Math.PI * 2 * 0.85;
      pts.push({ x: pad.x + Math.cos(a) * R, z: pad.z + Math.sin(a) * R });
    }
    pts.push(...along(br, lastI, 4));
    routes.push({ name: br.name, points: pts, speed: 10 });
  }
  return routes;
}

/**
 * Drive `car` (must be the active car) along `points`. Resolves with metrics.
 * opts: { speed m/s (cruise), timeout s }
 */
export function runAutopilot({ car, input, terrain, points, speed = 13, timeout = 120, obstacles = [] }) {
  return new Promise((resolve) => {
    let wp = 0, t = 0, last = performance.now();
    let stuckT = 0, lastProgress = 0, dist = 0, engaged = null, backT = 0, lowT = 0;
    let prev = { ...car.position };
    const m = { maxAbove: -Infinity, minAbove: Infinity, maxTilt: 0, maxSpeed: 0, nan: false, stalls: 0, avoid: 0, nearest: 99 };
    const keys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'];
    const set = (k, on) => input.setVirtual(k, on);
    const finish = (ok, reason) => {
      keys.forEach((k) => set(k, false));
      resolve({ ok, reason, waypoints: `${wp}/${points.length}`, time: +t.toFixed(1), dist: +dist.toFixed(0), ...m,
        maxAbove: +m.maxAbove.toFixed(2), minAbove: +m.minAbove.toFixed(2), maxTilt: +m.maxTilt.toFixed(1), maxSpeed: +(m.maxSpeed * 3.6).toFixed(0) });
    };
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      const p = car.position;
      if (![p.x, p.y, p.z].every(Number.isFinite)) { m.nan = true; return finish(false, 'NaN position'); }
      const above = p.y - terrain.getHeight(p.x, p.z);
      m.maxAbove = Math.max(m.maxAbove, above);
      m.minAbove = Math.min(m.minAbove, above);
      const up = car.body.up();
      m.maxTilt = Math.max(m.maxTilt, (Math.acos(Math.min(1, up.y)) * 180) / Math.PI);
      const v = Math.abs(car.body.state.speed);
      m.maxSpeed = Math.max(m.maxSpeed, v);
      dist += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev = { x: p.x, y: p.y, z: p.z };

      // Advance waypoints.
      while (wp < points.length && Math.hypot(points[wp].x - p.x, points[wp].z - p.z) < 6) wp++;
      if (wp >= points.length) return finish(true, 'done');
      if (t > timeout) return finish(false, 'timeout');
      if (wp > lastProgress) { lastProgress = wp; stuckT = 0; } else stuckT += dt;
      if (stuckT > 10) return finish(false, `stuck before waypoint ${wp}`);

      // Steering: angle to the target point (look one waypoint ahead when close).
      let tgt = points[Math.min(points.length - 1, wp)];
      const yaw = car.body.yaw();
      // Overtake parked cars: if one sits ahead in our lane, aim into the other lane.
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rel = (o) => {
        const q = o.position, dx = q.x - p.x, dz = q.z - p.z;
        return { q, ahead: dx * fx + dz * fz, lat: dx * fz - dz * fx }; // lat > 0 = on our left
      };
      // Engage only when a car is actually in our path; then stay committed (hysteresis)
      // to that car until it is behind us, so we don't swerve back into it.
      if (engaged) {
        const r = rel(engaged.car);
        if (r.ahead < -2.5 || Math.abs(r.lat) > 6) engaged = null;
      }
      if (!engaged) {
        for (const o of obstacles) {
          const r = rel(o);
          if (r.ahead > 0) m.nearest = Math.min(m.nearest, +Math.hypot(r.ahead, r.lat).toFixed(1));
          if (r.ahead > 0 && r.ahead < 24 && Math.abs(r.lat) < 2.0) { engaged = { car: o, side: r.lat > 0 ? 3.6 : -3.6 }; break; }
        }
      }
      if (engaged) {
        // Aim at a point 3.6 m beside it (away from it), 2 m past it. right = (-fz, fx).
        const { q } = rel(engaged.car), s = engaged.side;
        tgt = { x: q.x - fz * s + fx * 2, z: q.z + fx * s + fz * 2 };
        m.avoid++;
      }
      const want = Math.atan2(tgt.x - p.x, tgt.z - p.z);
      let err = want - yaw;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      // Unstick: if we've barely moved for 2.5 s, reverse with opposite lock for 1.4 s.
      if (backT > 0) {
        backT -= dt;
        set('KeyW', false); set('KeyS', true);
        set('KeyA', err < 0); set('KeyD', err > 0);
        requestAnimationFrame(tick);
        return;
      }
      lowT = v < 1.2 ? lowT + dt : 0;
      if (lowT > 2.5) { lowT = 0; backT = 1.4; m.stalls++; }
      set('KeyA', err > 0.05);
      set('KeyD', err < -0.05);
      // Speed: slow down for sharp upcoming turns.
      const nxt = points[Math.min(points.length - 1, wp + 1)];
      const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(nxt.x - tgt.x, nxt.z - tgt.z) - want), Math.cos(Math.atan2(nxt.x - tgt.x, nxt.z - tgt.z) - want)));
      const target = Math.max(5, speed * (1 - Math.min(0.7, turn * 0.9 + Math.abs(err) * 0.6)));
      set('KeyW', v < target);
      set('KeyS', v > target + 3);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
