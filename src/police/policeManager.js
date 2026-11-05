// Police response: cars by wanted stars (2/3/4/5/6 for 1-5 stars), spawned first from the
// police station then from road points >=100 m away and out of view; Dijkstra routes over
// the lane graph to the lane point nearest the player; direct chase within ~40 m with line
// of sight (flanking, see policeCar.js).
// SOFT CONTACT: police cars never collide rigidly with the player's car. Overlaps are found
// here (2D oriented boxes); the cop is pushed out, the player's car gets a capped impulse
// (dv <= 2.5 m/s, 1.2 s cooldown per cop) + a little damage + camera shake, the cop recovers.
// ARREST: stopped (<2 m/s) with a cop car within 6 m for 1.5 s -> an officer gets out, runs
// to the driver's door, opens it and pulls the player out (~1.2 s) -> BUSTED. On foot:
// officers walk up; within 3 m for 1.5 s -> grabbed -> BUSTED (cutscene, -$500, police
// station, stolen car impounded). Wanted level + every cop reset after a bust or a KO.
import * as THREE from 'three';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { createWheelInstances } from '../vehicles/wheels.js';
import { PoliceCar } from './policeCar.js';
import { createCopsOnFoot } from './copsOnFoot.js';
import { sampleLane } from '../traffic/laneGraph.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { damageCar } from '../combat/carDamage.js';
import { DAMAGE } from '../combat/damageConfig.js';
import { carLocalToWorld } from '../vehicles/exitSpot.js';
import { box } from '../utils/geom.js';
import { MAT } from '../art/materials.js';
import { makeRng } from '../utils/rng.js';

const MAX = 6, COUNTS = [0, 2, 3, 4, 5, 6];
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);
export const ARREST = { carStopSpeed: 2, carNear: 6, carHold: 1.5, footNear: 3, footHold: 1.5, pullTime: 1.2, bustTime: 5 };
export const CHASE = { routeCruise: [15, 20, 22, 24, 27, 30], topFrac: [0.9, 0.9, 0.9, 0.9, 0.95, 1.0], tailCap: 0.95, tailCap5: 1.0, contactDv: 2.5, contactCd: 1.2, recover: 1.5 };

/** Oriented-box overlap in XZ (separating axes). a/b: { x, z, fx, fz, hl, hw }. Returns { pen, nx, nz } (normal a -> b) or null. */
function obbOverlap(a, b) {
  const axes = [[a.fx, a.fz], [-a.fz, a.fx], [b.fx, b.fz], [-b.fz, b.fx]];
  const dx = b.x - a.x, dz = b.z - a.z;
  let best = null;
  for (const [ax, az] of axes) {
    const ra = a.hl * Math.abs(a.fx * ax + a.fz * az) + a.hw * Math.abs(-a.fz * ax + a.fx * az);
    const rb = b.hl * Math.abs(b.fx * ax + b.fz * az) + b.hw * Math.abs(-b.fz * ax + b.fx * az);
    const dist = dx * ax + dz * az, pen = ra + rb - Math.abs(dist);
    if (pen <= 0) return null;
    if (!best || pen < best.pen) best = { pen, nx: ax * Math.sign(dist || 1), nz: az * Math.sign(dist || 1) };
  }
  return best;
}
const boxOf = (p, f, cfg) => {
  const zMid = cfg.frontOverhang - cfg.L / 2 + cfg.wheelBase / 2;
  return { x: p.x + f.x * zMid, z: p.z + f.z * zMid, fx: f.x, fz: f.z, hl: cfg.L / 2, hw: cfg.W / 2 };
};

export function createPolice({ scene, physics, world, traffic, vehicles, controls, audio, wanted, hud, wallet, spawns, camera, cutscene = null }) {
  const rng = makeRng(911);
  const { lanes } = traffic.graph;
  const wheels = createWheelInstances(MAX * 4).mesh;
  wheels.name = 'police-wheels';
  wheels.count = 0;
  scene.add(wheels);
  const cars = [];
  const foot = createCopsOnFoot({ scene, world });
  const st = { bustT: 0, busted: false, bustSeq: 0, spawnT: 0, replanT: 0, siren: 0, seen: false, nearest: Infinity, contactTime: 0, contacts: 0, stopT: 0, pull: null, bustCar: null, busts: 0 };
  const listeners = [];
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
    // The station's first car only when the station is reasonably close (it's in town).
    if (!cars.some((c) => c.fromStation) && Math.hypot(station.x - target.x, station.z - target.z) < 260) lp = nearestLanePoint(station.x, station.z);
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
    cop.fromStation = !cars.some((c) => c.fromStation) && Math.hypot(lp.x - station.x, lp.z - station.z) < 30;
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
    for (const o of foot.officers) if (o.car === cop) o.car = null;
    // Re-pack wheel slots.
    cars.forEach((c, k) => { c.wheelOffset = k * 4; });
    wheels.count = cars.length * 4;
  }

  function reattach(cop) {
    const lp = nearestLanePoint(cop.pos.x, cop.pos.z, (p) => { const t = sampleLane(p.lane, p.s, {}); return t.tx * cop.fwd.x + t.tz * cop.fwd.z > 0.2; });
    if (lp) { cop.lane = lp.lane; cop.s = lp.s; cop.latOff = 0; }
    cop.mode = 'route';
  }

  /** Every cop car + officer goes away (after a bust or a knock-out). */
  function reset() {
    for (const c of [...cars]) despawn(c);
    foot.clear();
    Object.assign(st, { bustT: 0, stopT: 0, pull: null, lastSeen: null });
    audio.siren(0);
  }

  // ---- Driver's door (opens while the player is pulled out) -----------------------------
  let doorFx = null;
  function openDoor(car) {
    const c = car.cfg, h = c.belt - c.clearance - 0.05;
    const pivot = new THREE.Group();
    pivot.position.set(-(c.W / 2 + 0.02), c.clearance + 0.1, c.cabin[1] - 0.12);
    const m = new THREE.Mesh(box(0.06, h, 1.0, 0, h / 2, -0.5, car.spawn?.paint || '#8a8f96'), MAT.solid);
    pivot.add(m);
    car.model.add(pivot);
    doorFx = { car, pivot, t: 0 };
  }
  function closeDoor() { if (doorFx) { doorFx.car.model.remove(doorFx.pivot); doorFx.pivot.children[0].geometry.dispose(); doorFx = null; } }

  // ---- BUSTED -----------------------------------------------------------------------------
  function bust(grabber = null) {
    if (st.busted) return;
    st.busted = true; st.bustSeq = 0; st.busts++;
    if (controls.mode === 'drive' && controls.car?.stolen) st.bustCar = controls.car;
    listeners.forEach((f) => f('busted'));
    if (!cutscene) { hud.fade(true); return; }
    const ps = controls.player.state, p = controls.player.position;
    ps.action = 'cuffed'; ps.lockT = 99;
    // Two officers stand over the player (use whoever is there, fill up with fresh ones).
    const crew = foot.alive.sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p)).slice(0, 2);
    if (grabber && !crew.includes(grabber)) crew.unshift(grabber);
    while (crew.length < 2) { const o = foot.spawn(null, { x: p.x, z: p.z }); if (!o) break; crew.push(o); }
    crew.slice(0, 2).forEach((o, k) => {
      const a = ps.facing + (k ? 2.3 : -0.7), r = k ? 1.3 : 1.0;
      o.pos.set(p.x + Math.sin(a) * r, world.terrain.getHeight(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r), p.z + Math.cos(a) * r);
      o.yaw = Math.atan2(p.x - o.pos.x, p.z - o.pos.z);
      o.cutscene = true; o.action = k ? 'point' : 'grab'; o.state = 'hold';
    });
    cutscene.play('busted', { dur: ARREST.bustTime, timeScale: 1, title: 'BUSTED', sub: '-$500', color: '#7fb0ff', desat: false, focus: () => controls.player.position, startAngle: ps.facing + 0.6, onEnd: finishBust });
  }
  function finishBust() {
    const stolen = st.bustCar || (controls.mode === 'drive' && controls.car && controls.car.stolen ? controls.car : null);
    closeDoor();
    const sp = spawns.police();
    controls.respawnAt(sp.position, sp.yaw);
    controls.player.state.action = null; controls.player.state.lockT = 0;
    if (stolen) vehicles.impound(stolen);
    wallet.add(-500);
    wanted.clear(true);
    world.crimes?.clear();
    hud.fade(false);
    if (!cutscene) hud.message('BUSTED  -$500', 3, '#7fb0ff');
    reset();
    st.busted = false; st.bustT = 0; st.bustCar = null;
  }

  // ---- Soft contact (police car vs player car) ------------------------------------------
  function softContact(dt) {
    const car = controls.mode === 'drive' ? controls.car : null;
    if (!car) return;
    const pf = car.body.forward(), pb = boxOf(car.position, pf, car.cfg);
    const pv = car.body.body.linvel();
    let touching = false;
    for (const c of cars) {
      if (c.dead) continue;
      const hit = obbOverlap(boxOf(c.pos, c.fwd, c.cfg), pb);
      if (!hit) continue;
      touching = true;
      // Push the cop out (it's kinematic: we own its position).
      c.pos.x -= hit.nx * (hit.pen + 0.05); c.pos.z -= hit.nz * (hit.pen + 0.05);
      if (c.mode !== 'chase') c.mode = 'chase';
      c.recoverT = CHASE.recover;
      if (c.contactCd > 0) continue;
      c.contactCd = CHASE.contactCd; st.contacts++;
      const rel = (c.fwd.x * c.v - pv.x) * hit.nx + (c.fwd.z * c.v - pv.z) * hit.nz; // closing speed along n
      const dv = Math.max(0.8, Math.min(CHASE.contactDv, 0.8 + Math.max(0, rel) * 0.5));
      const m = car.body.body.mass();
      car.body.body.applyImpulse({ x: hit.nx * m * dv, y: 0, z: hit.nz * m * dv }, true);
      damageCar(car, DAMAGE.policeContact);
      car.crashShake = Math.max(car.crashShake || 0, 0.5);
      controls.chase.shake?.(0.6);
      audio.crash?.(0.35);
      // Ramming a cop is a crime; being nudged by one isn't.
      const pSpeed = Math.hypot(pv.x, pv.z);
      if (pSpeed > 6 && (pv.x * -hit.nx + pv.z * -hit.nz) > 4) { damageCar(c, 6); world.crimes?.report('ramCop', c.pos, { victim: { ref: c, alive: () => !c.dead } }); }
    }
    if (touching) st.contactTime += dt;
  }

  // ---- Arrests: officers get out, walk up, grab / pull the player out --------------------
  function arrests(dt, stars, target) {
    const inCar = controls.mode === 'drive' && controls.car;
    const pSpeed = inCar ? Math.abs(controls.car.body.state.speed) : controls.player.state.speed;
    const P = controls.player.position;
    if (st.pull) {
      // Pull-out in progress: wait for the exit transition, then BUSTED.
      st.pull.t += dt;
      if (doorFx) doorFx.pivot.rotation.y = Math.min(1.2, doorFx.pivot.rotation.y + dt * 4);
      const o = st.pull.officer;
      o.yaw = Math.atan2(P.x - o.pos.x, P.z - o.pos.z);
      if (controls.mode === 'walk') { const g = o; st.pull = null; bust(g); }
      return;
    }
    if (!stars) { for (const o of foot.alive) if (o.state !== 'return') o.state = 'return'; st.stopT = 0; return; }
    if (inCar) {
      const car = controls.car;
      const near = cars.filter((c) => !c.dead && c.v < 3 && Math.hypot(c.pos.x - target.x, c.pos.z - target.z) < ARREST.carNear);
      st.stopT = pSpeed < ARREST.carStopSpeed && near.length ? st.stopT + dt : 0;
      let puller = foot.alive.find((o) => o.role === 'puller');
      if (st.stopT > ARREST.carHold && !puller) {
        const from = near.sort((a, b) => Math.hypot(a.pos.x - target.x, a.pos.z - target.z) - Math.hypot(b.pos.x - target.x, b.pos.z - target.z))[0];
        puller = foot.spawn(from);
        if (puller) puller.role = 'puller';
      }
      const door = carLocalToWorld(car, -(car.cfg.W / 2 + 0.55), 0, car.cfg.seat[2]);
      for (const o of foot.alive) {
        if (pSpeed > 4 || Math.hypot(o.pos.x - target.x, o.pos.z - target.z) > 45) { if (o.state !== 'return') { o.state = 'return'; o.role = null; } continue; }
        if (o.role === 'puller' && o.state === 'approach') {
          o.goal = door; o.goalStop = 0.25;
          if (Math.hypot(door.x - o.pos.x, door.z - o.pos.z) < 0.5 && pSpeed < ARREST.carStopSpeed) {
            o.state = 'hold'; o.action = 'grab';
            st.pull = { t: 0, officer: o };
            if (car.stolen) st.bustCar = car;
            openDoor(car);
            controls.pullOut?.(ARREST.pullTime);
          }
        } else if (o.state === 'approach') { o.goal = target; o.goalStop = 2.2; }
      }
      return;
    }
    if (controls.mode !== 'walk') return;
    st.stopT = 0;
    // On foot: stopped patrol cars within 30 m deploy an officer each (2 at 3+ stars).
    for (const c of cars) {
      if (c.dead || c.v > 1.5 || Math.hypot(c.pos.x - P.x, c.pos.z - P.z) > 30) continue;
      if ((c.crewOut || 0) < (stars >= 3 ? 2 : 1) && foot.alive.length < 4) { const o = foot.spawn(c); if (o) o.role = 'arrest'; }
    }
    let grabber = null;
    for (const o of foot.alive) {
      if (o.state === 'return' || o.state === 'exit') continue;
      const d = Math.hypot(o.pos.x - P.x, o.pos.z - P.z);
      if (d > 60) { o.state = 'return'; continue; }
      // Armed officers at 4-5 stars keep their distance and shoot instead of grabbing.
      const standoff = o.gun && stars >= 4;
      o.state = d < (standoff ? 10 : ARREST.footNear - 1.6) ? 'hold' : 'approach';
      o.goal = P; o.goalStop = standoff ? 9 : 1.0;
      o.nearT = !standoff && d < ARREST.footNear ? o.nearT + dt : 0;
      o.action = d < 1.8 ? 'grab' : o.gunAction || null;
      if (o.nearT > ARREST.footHold) grabber = o;
    }
    if (grabber) bust(grabber);
  }

  return {
    cars, st, foot,
    nearestLanePoint, routeTo, spawnOne, despawn, reset, bust,
    onEvent(f) { listeners.push(f); },
    /** Obstacles for traffic. */
    movers() { return cars.map((c) => ({ x: c.pos.x, z: c.pos.z, speed: c.v, len: c.cfg.L })); },
    update(dt) {
      if (st.busted) {
        foot.update(dt, { target: playerPos() });
        if (!cutscene) { st.bustSeq += dt; if (st.bustSeq > 1.1) finishBust(); }
        return;
      }
      const stars = wanted.stars, target = playerPos();
      // Spawn / despawn toward the wanted count.
      st.spawnT -= dt;
      const want = COUNTS[stars];
      // No reinforcements while the stars flash (they're searching, not chasing).
      // Dispatch straight away when stars go up (grace period = pursuit time), then one every 1.5 s.
      if (stars > (st.lastStars || 0)) { st.spawnT = 0; st.replanT = 0; }
      st.lastStars = stars;
      if (cars.length < want && st.spawnT <= 0 && !wanted.searching) { spawnOne(target); st.spawnT = 1.5; st.replanT = 0; }
      if (!stars) {
        for (const c of [...cars]) { if (c.crewOut) continue; c.mode = 'patrol'; c.route = []; if (Math.hypot(c.pos.x - target.x, c.pos.z - target.z) > 150 && !inView(c.pos.x, c.pos.z)) despawn(c); }
      }
      // Line of sight + chase/route decisions.
      st.replanT -= dt;
      let seen = false, nearest = Infinity;
      // Cops route to where the player was LAST SEEN (escaping actually works).
      const goal = st.lastSeen || target;
      const tl = st.replanT <= 0 ? nearestLanePoint(goal.x, goal.z) : null;
      if (tl) st.replanT = 2;
      const los = (from, d, dx, dz) => {
        const dir = { x: dx / (d || 1), y: (target.y + 1 - from.y) / (d || 1), z: dz / (d || 1) };
        const hit = d > 0.5 ? physics.world.castRay(new physics.RAPIER.Ray(from, dir), d, true, undefined, STATIC_ONLY) : null;
        return !hit || hit.timeOfImpact > d - 0.8;
      };
      for (const c of cars) {
        const dx = target.x - c.pos.x, dz = target.z - c.pos.z, d = Math.hypot(dx, dz);
        nearest = Math.min(nearest, d);
        const clear = los({ x: c.pos.x, y: c.pos.y + 1.3, z: c.pos.z }, d, dx, dz);
        if (clear && d < 120) seen = true;
        if (!stars) continue;
        if (c.mode !== 'chase' && clear && d < 40) c.mode = 'chase';
        else if (c.mode === 'chase' && (!clear || d > 55 || c.blockedT > 2) && c.recoverT <= 0) { reattach(c); c.route = tl ? routeTo(c.lane, tl.lane) : []; }
        else if (c.mode !== 'chase' && tl) { c.mode = 'route'; c.route = routeTo(c.lane, tl.lane); }
      }
      // Officers on foot see too.
      for (const o of foot.alive) {
        const dx = target.x - o.pos.x, dz = target.z - o.pos.z, d = Math.hypot(dx, dz);
        nearest = Math.min(nearest, d);
        if (d < 80 && los({ x: o.pos.x, y: o.pos.y + 1.6, z: o.pos.z }, d, dx, dz)) { seen = true; o.sees = true; } else o.sees = false;
      }
      st.seen = seen; st.nearest = nearest;
      if (seen || !st.lastSeen) st.lastSeen = { ...target };
      if (!stars) st.lastSeen = null;
      softContact(dt);
      const inCar = controls.mode === 'drive' && controls.car;
      const targetSpeed = inCar ? Math.abs(controls.car.body.state.speed) : 0;
      const tf = inCar ? controls.car.body.forward() : null;
      const heroTop = (inCar ? controls.car.cfg.top : CAR_TYPES.sedan.top) || 40;
      const ctxBase = {
        lanes, honk: () => {}, target, targetSpeed, targetFwd: tf ? { x: tf.x, z: tf.z } : null,
        maxV: heroTop * CHASE.topFrac[stars], tailCap: stars >= 5 ? CHASE.tailCap5 : CHASE.tailCap, routeCruise: CHASE.routeCruise[stars],
      };
      const extra = [...traffic.cars.map((t) => ({ self: null, x: t.pos.x, z: t.pos.z, speed: t.v, len: t.cfg.L })), ...vehicles.cars.filter((v) => !v.impounded).map((v) => ({ x: v.position.x, z: v.position.z, speed: Math.abs(v.body.state.speed), len: v.cfg.L, parked: v !== vehicles.active && Math.abs(v.body.state.speed) < 0.5 }))];
      for (const c of cars) {
        const obstacles = [...extra, ...cars.filter((o) => o !== c).map((o) => ({ x: o.pos.x, z: o.pos.z, speed: o.v, len: o.cfg.L }))];
        c.update(dt, { ...ctxBase, obstacles });
      }
      wheels.instanceMatrix.needsUpdate = true;
      wanted.update(dt, { seen, nearest });
      arrests(dt, stars, target);
      foot.update(dt, { target });
      st.bustT = st.stopT;
      // Siren: loudest nearby pursuing car.
      let lvl = 0;
      if (stars) for (const c of cars) lvl = Math.max(lvl, 1 - Math.hypot(c.pos.x - target.x, c.pos.z - target.z) / 80);
      audio.siren(Math.max(lvl, world.playerSiren ? 0.8 : 0));
    },
  };
}
