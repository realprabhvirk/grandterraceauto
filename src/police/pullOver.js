// Phase 6.1: speeding = a PULL-OVER pursuit, then a fine. No stars, no arrest, no ramming.
// A traffic cop (radar post or cruising patrol car, see trafficCops.js) that spots you speeding
// hands its car over to this module: lights + siren, it follows your path (a breadcrumb trail)
// 6.5-9 m behind, never faster than 0.95x your speed (so you can outrun it) but it catches up
// when you slow down. Stop (< 2 m/s) with it within 8 m for 1 s: the officer walks to your
// window, 3 s "Issuing fine...", -$200, then the cop drives off. Drive off while it's issuing:
// the pursuit resumes, no fine. No line of sight for 8 s / > 150 m: "You lost the police".
// 90 s: it gives up. Becoming wanted cancels it (the normal police take over).
import * as THREE from 'three';
import { PULLOVER as P, SPEEDING } from './speedingConfig.js';
import { PoliceCar } from './policeCar.js';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { createWheelInstances } from '../vehicles/wheels.js';
import { createCharacter } from '../player/character.js';
import { roleOutfit } from '../npc/outfits.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function createPullOver({ scene, world, physics, controls, speeding, hud, wanted, traffic }) {
  const rng = makeRng(6161);
  const wheels = createWheelInstances(4).mesh; wheels.name = 'pullover-wheels'; scene.add(wheels);
  const lane = traffic.graph.lanes.find((l) => l.town && l.len > 20) || traffic.graph.lanes[0];
  const car = new PoliceCar({ id: 'pullover', type: 'sedan', cfg: CAR_TYPES.sedan, paint: '#f1f1ec', lane, s: 1, cruise: 10, physics, scene, wheels, wheelOffset: 0, terrain: world.terrain, rng: rng.fork(1) });
  car.isPullOver = true;
  const officer = createCharacter(roleOutfit('cop', rng.fork(2)), { name: 'pullover-officer' });
  scene.add(officer.root);
  // HUD: flashing PULL OVER + hint, issuing bar.
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:84px;transform:translateX(-50%);text-align:center;pointer-events:none;z-index:12;display:none;font-family:system-ui,sans-serif';
  el.innerHTML = '<div data-t style="font:900 30px system-ui,sans-serif;letter-spacing:.12em;text-shadow:0 2px 6px rgba(0,0,0,.6)">PULL OVER</div><div data-h style="color:#f6eedf;font-size:13px;text-shadow:0 1px 3px #000">stop your car</div><div data-b style="display:none;margin:6px auto 0;width:200px;height:8px;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden"><div data-f style="height:100%;width:0;background:#ffcf4a"></div></div>';
  document.body.appendChild(el);
  const elT = el.querySelector('[data-t]'), elH = el.querySelector('[data-h]'), elB = el.querySelector('[data-b]'), elF = el.querySelector('[data-f]');

  const st = { state: 'idle', catcher: null, t: 0, lostT: 0, holdT: 0, issueT: 0, leaveT: 0, starts: 0, fines: 0, lost: 0, gaveUp: 0, cancelled: 0, resumed: 0, minGap: Infinity, maxCopKmh: 0, dist: 0, los: true };
  const trail = [];
  let ti = 0, door = null, win = null;

  function show(on) {
    car.group.visible = on; car.body.setEnabled(on);
    if (!on) { for (let k = 0; k < 4; k++) wheels.setMatrixAt(k, ZERO); wheels.instanceMatrix.needsUpdate = true; }
  }
  show(false);
  officer.root.visible = false;
  const lights = (on) => { car.lampL.visible = on && Math.floor(st.t * 6) % 2 === 0; car.lampR.visible = on && !car.lampL.visible; };
  function los(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d < 0.5) return true;
    const hit = physics.world.castRay(new physics.RAPIER.Ray(a, { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d }), d, true, undefined, STATIC_ONLY);
    return !hit || hit.timeOfImpact > d - 1.2;
  }
  function player() {
    const c = controls.mode === 'drive' ? controls.car : null;
    if (c) { const f = c.body.forward(); return { pos: c.position, v: Math.abs(c.body.state.speed), f: { x: f.x, z: f.z }, car: c }; }
    const p = controls.player.position, yaw = controls.player.state.facing || 0;
    return { pos: p, v: 0, f: { x: Math.sin(yaw), z: Math.cos(yaw) }, car: null };
  }
  function place(x, y, z, yaw) {
    car.pos.set(x, y, z); car.fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); car.v = 0;
    car.body.setTranslation({ x, y, z }, true);
    car.directMove(0, yaw);
  }

  function end(reason) {
    const c = st.catcher;
    world.pullOverSiren = 0;
    el.style.display = 'none';
    if (reason === 'lost' || reason === 'gave up') {
      speeding.cooldown(c.id);
      if (reason === 'lost') { st.lost++; hud.message('You lost the police', 2.5, '#9fd18b'); if (SPEEDING.EVADE_STARS > 0) wanted.raiseTo?.(SPEEDING.EVADE_STARS); }
      else { st.gaveUp++; hud.message('The police gave up', 2.5, '#9fd18b'); }
    } else if (reason === 'wanted') st.cancelled++;
    if (reason === 'fined') { st.state = 'leaving'; st.leaveT = 0; return; } // officer walks back, the car drives off
    reset();
  }
  function reset() {
    officer.root.visible = false;
    show(false);
    st.catcher?.restore();
    st.catcher = null; st.state = 'idle'; world.pullOverSiren = 0; el.style.display = 'none';
  }

  /** Drive along the trail toward a point `behind` m behind the player. */
  function drive(dt, pl, behind, cap) {
    const pos = car.pos;
    // Goal: the trail point `behind` metres (path length) back from the player.
    let acc = 0, gi = trail.length - 1, prev = pl.pos;
    for (; gi >= 0; gi--) { acc += Math.hypot(trail[gi].x - prev.x, trail[gi].z - prev.z); prev = trail[gi]; if (acc >= behind) break; }
    gi = Math.max(0, gi);
    // Skip points already reached or behind the car (it never turns back for a missed point).
    const behindCar = (q) => (q.x - pos.x) * car.fwd.x + (q.z - pos.z) * car.fwd.z < 0.5;
    while (ti < gi && (Math.hypot(trail[ti].x - pos.x, trail[ti].z - pos.z) < 3 || behindCar(trail[ti]))) ti++;
    if (ti > gi) ti = gi;
    const aim = trail[ti] || pl.pos;
    // Path length from the cop to the goal.
    let L = Math.hypot(aim.x - pos.x, aim.z - pos.z);
    for (let k = ti; k < gi; k++) L += Math.hypot(trail[k + 1].x - trail[k].x, trail[k + 1].z - trail[k].z);
    const d = Math.hypot(pl.pos.x - pos.x, pl.pos.z - pos.z);
    const gap = d < behind ? d - behind : L; // negative = closer than wanted
    let yaw = Math.atan2(car.fwd.x, car.fwd.z);
    if (Math.hypot(aim.x - pos.x, aim.z - pos.z) > 0.8) yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, angDiff(Math.atan2(aim.x - pos.x, aim.z - pos.z), yaw)));
    let want = gap > 0 ? pl.v + Math.sqrt(2 * 5 * gap) : Math.max(0, pl.v + gap * 0.8); // brake to arrive at the follow distance
    want = Math.min(want, cap, P.maxV);
    if (d < 5) want = Math.min(want, pl.v * 0.5); // never rams: back off when close
    car.v += Math.max(-10 * dt, Math.min(4.5 * dt, want - car.v));
    car.v = Math.max(0, car.v); car.speed = car.v;
    car.directMove(dt, yaw);
    st.minGap = Math.min(st.minGap, d); st.maxCopKmh = Math.max(st.maxCopKmh, car.v * 3.6);
    return d;
  }

  const api = {
    st, car, officer, trail,
    get active() { return st.state !== 'idle'; },
    /** A traffic cop spotted the player speeding. catcher: { id, kind, pose:{x,y,z,yaw}, hide(), restore() }. */
    start(catcher) {
      if (st.state !== 'idle') return false;
      const pl = player();
      if (!pl.car || (wanted.stars || 0) > 0) return false;
      st.catcher = catcher; st.state = 'pursuit'; st.t = 0; st.lostT = 0; st.holdT = 0; st.issueT = 0; st.minGap = Infinity; st.maxCopKmh = 0; st.starts++;
      catcher.hide();
      const q = catcher.pose;
      place(q.x, q.y, q.z, q.yaw);
      show(true);
      // Seed the trail with a straight line from the cop to the player (1.5 m spacing).
      trail.length = 0; ti = 0;
      const n = Math.max(1, Math.ceil(Math.hypot(pl.pos.x - q.x, pl.pos.z - q.z) / 1.5));
      for (let k = 0; k <= n; k++) trail.push({ x: q.x + (pl.pos.x - q.x) * k / n, z: q.z + (pl.pos.z - q.z) * k / n });
      el.style.display = 'block'; elB.style.display = 'none'; elH.textContent = 'stop your car';
      return true;
    },
    cancel(reason = 'wanted') { if (st.state !== 'idle') end(reason); },
    update(dt) {
      if (st.state === 'idle') return;
      st.t += dt;
      const pl = player(), pos = car.pos;
      // Trail of the player's path (the cop follows it, so it takes the same corners).
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(pl.pos.x - last.x, pl.pos.z - last.z) > 1.5) trail.push({ x: pl.pos.x, z: pl.pos.z });
      if (trail.length > 600) { trail.splice(0, 100); ti = Math.max(0, ti - 100); }
      if (st.state === 'leaving') {
        st.leaveT += dt;
        lights(false); world.pullOverSiren = 0;
        if (st.leaveT < 1.5 && door) { const k = st.leaveT / 1.5; officer.root.position.set(win.x + (door.x - win.x) * k, pos.y, win.z + (door.z - win.z) * k); officer.animate({ dt, speed: 1.4, grounded: true, crouch: false, action: null, steer: 0 }); return; }
        officer.root.visible = false;
        // Pull out past the player on the outside, then away.
        const side = { x: pl.f.z, z: -pl.f.x }, tx = pl.pos.x + side.x * 4.5 + pl.f.x * 40, tz = pl.pos.z + side.z * 4.5 + pl.f.z * 40;
        let yaw = Math.atan2(car.fwd.x, car.fwd.z);
        yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, angDiff(Math.atan2(tx - pos.x, tz - pos.z), yaw)));
        car.v = Math.min(14, car.v + 3 * dt); car.speed = car.v;
        car.directMove(dt, yaw);
        if (st.leaveT > P.leaveTime) reset();
        return;
      }
      if ((wanted.stars || 0) > 0) { end('wanted'); return; }
      const d = Math.hypot(pl.pos.x - pos.x, pl.pos.z - pos.z);
      st.dist = d;
      st.los = los({ x: pos.x, y: pos.y + 1.5, z: pos.z }, { x: pl.pos.x, y: pl.pos.y + 1, z: pl.pos.z });
      st.lostT = st.los ? 0 : st.lostT + dt;
      world.pullOverSiren = Math.max(0, 1 - d / 90);
      lights(true);
      // HUD flash.
      const red = Math.floor(st.t * 4) % 2 === 0;
      elT.style.color = red ? '#ff3b3b' : '#3b8bff';
      if (st.state === 'issuing') {
        st.issueT += dt;
        elB.style.display = 'block'; elF.style.width = `${Math.min(100, (st.issueT / P.issueTime) * 100)}%`; elH.textContent = 'Issuing fine...';
        // Officer walks from the driver's door to the player's window, then points (writing the ticket).
        const k = Math.min(1, st.issueT / 1.5);
        officer.root.position.set(door.x + (win.x - door.x) * k, pos.y, door.z + (win.z - door.z) * k);
        officer.root.rotation.y = Math.atan2(win.x - door.x, win.z - door.z);
        officer.animate({ dt, speed: k < 1 ? 1.4 : 0, grounded: true, crouch: false, action: k < 1 ? null : 'point', steer: 0 });
        if (pl.v > P.driveOff || d > 16) { // drove off: back in the car, pursuit resumes, no fine
          st.state = 'pursuit'; st.issueT = 0; st.holdT = 0; st.resumed++; officer.root.visible = false;
          elB.style.display = 'none'; elH.textContent = 'stop your car';
        } else if (st.issueT >= P.issueTime) {
          speeding.applyFine(st.catcher.id, 'pull over');
          st.fines++;
          end('fined');
        }
        return;
      }
      // Pursuit.
      const behind = pl.v < P.stopSpeed ? P.followStopped : P.follow;
      const cap = pl.v > P.slowBelow ? pl.v * P.tailCap : P.catchUp;
      drive(dt, pl, behind, cap);
      if (st.lostT > P.loseLOS || d > P.loseDist) { end('lost'); return; }
      if (st.t > P.maxTime) { end('gave up'); return; }
      if (pl.v < P.stopSpeed && d < P.stopDist && car.v < 1.5) {
        st.holdT += dt;
        if (st.holdT >= P.stopHold) {
          st.state = 'issuing'; st.issueT = 0;
          const yaw = Math.atan2(car.fwd.x, car.fwd.z), left = { x: Math.cos(yaw), z: -Math.sin(yaw) };
          door = { x: pos.x + left.x * 1.2, z: pos.z + left.z * 1.2 };
          // Window: the player's car side nearest the cop's door, level with the driver.
          const s = { x: pl.f.z, z: -pl.f.x }, side = (door.x - pl.pos.x) * s.x + (door.z - pl.pos.z) * s.z >= 0 ? 1 : -1;
          win = { x: pl.pos.x + s.x * side * 1.75 - pl.f.x * 0.2, z: pl.pos.z + s.z * side * 1.75 - pl.f.z * 0.2 };
          officer.root.visible = true;
        }
      } else st.holdT = 0;
    },
  };
  return api;
}
