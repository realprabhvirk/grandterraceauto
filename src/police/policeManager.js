// Police response: cars by wanted stars (2/3/4/5/6 for 1-5 stars), spawned first from the
// police station then from road points >=100 m away and out of view; Dijkstra routes over
// the lane graph to the lane point nearest the player; direct chase within ~40 m with line
// of sight. BUSTED: in a car <2 m/s with a cop within 6 m for 2.5 s, or on foot with a cop
// within 4 m for 2 s -> fade, -$500, wanted cleared, stolen car impounded, police station.
import * as THREE from 'three';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { createWheelInstances } from '../vehicles/wheels.js';
import { PoliceCar } from './policeCar.js';
import { sampleLane } from '../traffic/laneGraph.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

const MAX = 6, COUNTS = [0, 2, 3, 4, 5, 6];
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);

export function createPolice({ scene, physics, world, traffic, vehicles, controls, audio, wanted, hud, wallet, spawns, camera }) {
  const rng = makeRng(911);
  const { lanes } = traffic.graph;
  const wheels = createWheelInstances(MAX * 4).mesh;
  wheels.name = 'police-wheels';
  wheels.count = 0;
  scene.add(wheels);
  const cars = [];
  const st = { bustT: 0, busted: false, bustSeq: 0, spawnT: 0, replanT: 0, siren: 0, seen: false, nearest: Infinity };
  // Flattened lane points for nearest queries.
  const pts = [];
  for (const L of lanes) for (const p of L.pts) pts.push({ lane: L, s: p.s, x: p.x, z: p.z });
  const nearestLanePoint = (x, z, filter = null) => {
    let best = null, bd = Infinity;
    for (const p of pts) { if (filter && !filter(p)) continue; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  };

  /** Dijkstra over lanes (edges: exits at lane end, branches part-way). Returns lane ids after `from`. */
  function routeTo(fromLane, toLane) {
    if (fromLane === toLane) return [];
    const dist = new Map([[fromLane.id, 0]]), prev = new Map(), open = [fromLane.id];
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b));
      const id = open.shift();
      if (id === toLane.id) break;
      const L = lanes[id];
      for (const e of [...L.exits.map((x) => ({ lane: x.lane, cost: L.len })), ...L.branches.map((b) => ({ lane: b.lane, cost: b.atS }))]) {
        const nd = dist.get(id) + e.cost;
        if (nd < (dist.get(e.lane) ?? Infinity)) { dist.set(e.lane, nd); prev.set(e.lane, id); open.push(e.lane); }
      }
    }
    const out = [];
    for (let id = toLane.id; id !== fromLane.id && prev.has(id); id = prev.get(id)) out.unshift(id);
    return out;
  }

  const playerPos = () => { const p = controls.mode === 'drive' && controls.car ? controls.car.position : controls.player.position; return { x: p.x, y: p.y, z: p.z }; };
  const inView = (x, z) => { const d = new THREE.Vector3(x - camera.position.x, 0, z - camera.position.z), f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; return d.normalize().dot(f.normalize()) > 0.35; };

  function spawnOne(target) {
    if (cars.length >= MAX) return;
    let lp = null;
    const station = spawns.police().position;
    if (!cars.some((c) => c.fromStation)) lp = nearestLanePoint(station.x, station.z);
    if (!lp || Math.hypot(lp.x - target.x, lp.z - target.z) < 60) {
      for (let k = 0; k < 40 && !lp; k++) {
        const p = pts[rng.int(0, pts.length - 1)];
        const d = Math.hypot(p.x - target.x, p.z - target.z);
        if (d >= 100 && d < 260 && !inView(p.x, p.z)) lp = p;
      }
    }
    if (!lp) return;
    const i = cars.length;
    const type = i % 2 ? 'suv' : 'sedan';
    const cop = new PoliceCar({
      id: `police-${i}`, type, cfg: CAR_TYPES[type], paint: '#f1f1ec', lane: lp.lane, s: lp.s, cruise: 15,
      physics, scene, wheels, wheelOffset: i * 4, terrain: world.terrain, rng: rng.fork(i + 30),
    });
    cop.fromStation = !cars.some((c) => c.fromStation);
    wheels.count = (i + 1) * 4;
    cars.push(cop);
  }

  function despawn(cop) {
    const i = cars.indexOf(cop);
    if (i < 0) return;
    cop.group.visible = false;
    cop.body.setEnabled(false);
    cars.splice(i, 1);
    scene.remove(cop.group);
    // Re-pack wheel slots.
    cars.forEach((c, k) => { c.wheelOffset = k * 4; });
    wheels.count = cars.length * 4;
  }

  function reattach(cop) {
    const lp = nearestLanePoint(cop.pos.x, cop.pos.z, (p) => { const t = sampleLane(p.lane, p.s, {}); return t.tx * cop.fwd.x + t.tz * cop.fwd.z > 0.2; });
    if (lp) { cop.lane = lp.lane; cop.s = lp.s; cop.latOff = 0; }
    cop.mode = 'route';
  }

  function bust() {
    st.busted = true; st.bustSeq = 0;
    hud.fade(true);
  }
  function finishBust() {
    const stolen = controls.mode === 'drive' && controls.car && controls.car.stolen ? controls.car : null;
    const sp = spawns.police();
    controls.respawnAt(sp.position, sp.yaw);
    if (stolen) vehicles.impound(stolen);
    wallet.add(-500);
    wanted.clear(true);
    hud.fade(false);
    hud.message('BUSTED  -$500', 3, '#7fb0ff');
    for (const c of [...cars]) if (Math.hypot(c.pos.x - sp.position.x, c.pos.z - sp.position.z) > 30) despawn(c);
    for (const c of cars) c.mode = 'patrol';
    st.busted = false; st.bustT = 0;
  }

  return {
    cars, st,
    nearestLanePoint, routeTo, spawnOne, despawn,
    /** Obstacles for traffic. */
    movers() { return cars.map((c) => ({ x: c.pos.x, z: c.pos.z, speed: c.v, len: c.cfg.L })); },
    update(dt) {
      if (st.busted) { st.bustSeq += dt; if (st.bustSeq > 1.1) finishBust(); return; }
      const stars = wanted.stars, target = playerPos();
      // Spawn / despawn toward the wanted count.
      st.spawnT -= dt;
      const want = COUNTS[stars];
      // No reinforcements while the stars flash (they're searching, not chasing).
      if (cars.length < want && st.spawnT <= 0 && !wanted.searching) { spawnOne(target); st.spawnT = 1.5; }
      if (!stars) {
        for (const c of [...cars]) { c.mode = 'patrol'; c.route = []; if (Math.hypot(c.pos.x - target.x, c.pos.z - target.z) > 150 && !inView(c.pos.x, c.pos.z)) despawn(c); }
      }
      // Line of sight + chase/route decisions.
      st.replanT -= dt;
      let seen = false, nearest = Infinity;
      // Cops route to where the player was LAST SEEN (escaping actually works).
      const goal = st.lastSeen || target;
      const tl = st.replanT <= 0 ? nearestLanePoint(goal.x, goal.z) : null;
      if (tl) st.replanT = 2;
      for (const c of cars) {
        const dx = target.x - c.pos.x, dz = target.z - c.pos.z, d = Math.hypot(dx, dz);
        nearest = Math.min(nearest, d);
        const from = { x: c.pos.x, y: c.pos.y + 1.3, z: c.pos.z }, dir = { x: dx / (d || 1), y: (target.y + 1 - from.y) / (d || 1), z: dz / (d || 1) };
        const hit = d > 0.5 ? physics.world.castRay(new physics.RAPIER.Ray(from, dir), d, true, undefined, STATIC_ONLY) : null;
        const clear = !hit || hit.timeOfImpact > d - 0.8;
        if (clear && d < 120) seen = true;
        if (!stars) continue;
        if (c.mode !== 'chase' && clear && d < 40) c.mode = 'chase';
        else if (c.mode === 'chase' && (!clear || d > 55 || c.blockedT > 2)) { reattach(c); c.route = tl ? routeTo(c.lane, tl.lane) : []; }
        else if (c.mode !== 'chase' && tl) { c.mode = 'route'; c.route = routeTo(c.lane, tl.lane); }
      }
      st.seen = seen; st.nearest = nearest;
      if (seen || !st.lastSeen) st.lastSeen = { ...target };
      if (!stars) st.lastSeen = null;
      const extra = [...traffic.cars.map((t) => ({ self: null, x: t.pos.x, z: t.pos.z, speed: t.v, len: t.cfg.L })), ...vehicles.cars.filter((v) => !v.impounded).map((v) => ({ x: v.position.x, z: v.position.z, speed: Math.abs(v.body.state.speed), len: v.cfg.L, parked: v !== vehicles.active && Math.abs(v.body.state.speed) < 0.5 }))];
      for (const c of cars) {
        const obstacles = [...extra, ...cars.filter((o) => o !== c).map((o) => ({ x: o.pos.x, z: o.pos.z, speed: o.v, len: o.cfg.L }))];
        c.update(dt, { lanes, obstacles, honk: () => {}, target, targetSpeed: controls.mode === 'drive' && controls.car ? Math.abs(controls.car.body.state.speed) : 0 });
      }
      wheels.instanceMatrix.needsUpdate = true;
      wanted.update(dt, { seen, nearest });
      // Busted.
      if (stars) {
        const inCar = controls.mode === 'drive' && controls.car;
        const slow = inCar ? Math.abs(controls.car.body.state.speed) < 2 : true;
        const close = cars.some((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z) < (inCar ? 6 : 4));
        st.bustT = slow && close ? st.bustT + dt : 0;
        if (st.bustT > (inCar ? 2.5 : 2)) bust();
      } else st.bustT = 0;
      // Siren: loudest nearby pursuing car.
      let lvl = 0;
      if (stars) for (const c of cars) lvl = Math.max(lvl, 1 - Math.hypot(c.pos.x - target.x, c.pos.z - target.z) / 80);
      audio.siren(lvl);
    },
  };
}
