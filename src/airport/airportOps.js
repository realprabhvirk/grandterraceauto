// Terrace Airport operations (Phase 6.1): seeded, continuous, kinematic.
//   departure: parked -> pushback -> taxiOut -> hold (short of runway 27) -> lineup -> takeoff
//              (roll, rotate) -> climb ('airborne') -> gone
//   arrival:   final (3 deg glide slope from the east) -> [go-around if the runway is blocked at
//              ~300 m final] -> flare / touchdown -> rollout -> taxiIn -> parked (gate booked at spawn)
// Up to 4 aircraft moving + the parked ones (4 gates, never double-booked). The first departure
// pushes back within ~6 s and the first arrival is on final at ~8 s. Taxiing / rolling aircraft brake
// for the player, cars and each other. On the ground each aircraft has a kinematic collider; in the air
// none. Nothing here can be shot or boarded. Plus 2 distant cruise flyovers, apron vehicles (2 baggage
// tugs with carts, a fuel truck, a shuttle bus) and synth engine audio (jet roar / prop buzz, spool,
// touchdown chirp) through the master volume.
import * as THREE from 'three';
import { AP, onRunway } from './airportPlan.js';
import { AIRCRAFT, buildAircraft } from './aircraftModels.js';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

export const OPS = { maxMoving: 4, glide: Math.tan(3 * Math.PI / 180), tdX: 840, finalCheck: 300, spawnX: 4200, firstArrivalX: 2700, firstDeparture: 6, firstArrival: 8, arrivalGap: [55, 85], departDelay: [45, 100], goneX: -3800 };
const G_AC = groups(GROUP.STATIC, GROUP.CAR | GROUP.PLAYER | GROUP.NPC);
const R = AP.rwy, TW = AP.twy;

/** Polyline path with arc-length sampling. pts: [{x, z, y?}] */
class Path {
  constructor(pts) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    this.len = this.cum[this.cum.length - 1];
  }
  at(s, out = {}) {
    s = Math.max(0, Math.min(this.len, s));
    let i = 1; while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i], seg = this.cum[i] - this.cum[i - 1] || 1, t = (s - this.cum[i - 1]) / seg;
    out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t; out.y = (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t;
    out.tx = (b.x - a.x) / seg; out.tz = (b.z - a.z) / seg;
    return out;
  }
}
const line = (a, b, step = 6) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step)), o = []; for (let k = 0; k <= n; k++) o.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }); return o; };
const arc = (cx, cz, r, a0, a1, n = 10) => { const o = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; o.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r }); } return o; };
const join = (...parts) => { const o = []; for (const p of parts) for (const q of p) { const l = o[o.length - 1]; if (!l || Math.hypot(l.x - q.x, l.z - q.z) > 0.05) o.push(q); } return o; };
const gateCentreZ = (cfg) => AP.gateNoseZ - cfg.L / 2;
// Angles in the x/z plane for arc(): angle a -> (cos a, sin a); +z is "south" on the map.
const RT = 15; // ground turn radius

/** Pushback (travelled backward): straight back to the apron edge, then a quarter arc onto the taxiway, nose east. */
function pushbackPath(gx, cfg) {
  const z0 = gateCentreZ(cfg), zA = TW.z + RT;
  return new Path(join(line({ x: gx, z: z0 }, { x: gx, z: zA }), arc(gx - RT, zA, RT, 0, -Math.PI / 2)));
}
/** Taxi out: east along the taxiway, left onto the east connector, hold short. */
function taxiOutPath(x0) {
  const hx = AP.holdShort.x;
  return new Path(join(line({ x: x0, z: TW.z }, { x: hx - RT, z: TW.z }), arc(hx - RT, TW.z - RT, RT, Math.PI / 2, 0), line({ x: hx, z: TW.z - RT }, { x: hx, z: AP.holdShort.z })));
}
/** Line up from the hold point onto the runway heading west, then the take-off roll and the climb-out. */
function departPath() {
  const hx = AP.holdShort.x;
  return new Path(join(line({ x: hx, z: AP.holdShort.z }, { x: hx, z: R.z + RT }), arc(hx - RT, R.z + RT, RT, 0, -Math.PI / 2), line({ x: hx - RT, z: R.z }, { x: OPS.goneX, z: R.z }, 25)));
}
/** Arrival: final from the east, rollout west, exit at AP.exitX, taxiway east, into the booked gate. */
function arrivalPath(gx, cfg, fromX) {
  const ex = AP.exitX, z0 = gateCentreZ(cfg);
  return new Path(join(
    line({ x: fromX, z: R.z }, { x: ex + RT, z: R.z }, 25),
    arc(ex + RT, R.z + RT, RT, -Math.PI / 2, -Math.PI),                     // left onto the connector (south)
    line({ x: ex, z: R.z + RT }, { x: ex, z: TW.z - RT }),
    arc(ex + RT, TW.z - RT, RT, Math.PI, Math.PI / 2),                      // left onto the taxiway (east)
    line({ x: ex + RT, z: TW.z }, { x: gx - RT, z: TW.z }),
    arc(gx - RT, TW.z + RT, RT, -Math.PI / 2, 0),                           // right into the gate (south)
    line({ x: gx, z: TW.z + RT }, { x: gx, z: z0 }),
  ));
}

export function createAirportOps({ scene, physics, world, controls, traffic, police, audio, cars }) {
  const rng = makeRng(7171);
  const types = ['airliner', 'regional', 'prop'];
  const pool = [], planes = [];
  const gates = AP.gates.map((x, i) => ({ i, x, by: null }));
  const st = { t: 0, departures: 0, arrivals: 0, goArounds: 0, holds: 0, doubleBook: 0, nan: 0, airborne: 0, parkedIn: 0, chirps: 0, spawned: 0, nextArrival: OPS.firstArrival, brakes: 0, visible: true };
  const P0 = {}, P1 = {};

  function model(type) {
    let m = pool.find((p) => !p.busy && p.type === type);
    if (!m) {
      m = buildAircraft(type, pool.length);
      m.busy = false;
      const c = m.cfg, rb = physics.world.createRigidBody(physics.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -100, 0));
      const fus = physics.world.createCollider(physics.RAPIER.ColliderDesc.cuboid(c.r, c.r, c.L / 2).setTranslation(0, m.yC, 0).setCollisionGroups(G_AC), rb);
      const wing = physics.world.createCollider(physics.RAPIER.ColliderDesc.cuboid(c.span / 2, 0.25, c.L * 0.08).setTranslation(0, m.yC - c.r * 0.4, 0).setCollisionGroups(G_AC), rb);
      physics.tag?.(fus, 'aircraft', type); physics.tag?.(wing, 'aircraft', type);
      m.rb = rb; rb.setEnabled(false);
      scene.add(m.group);
      pool.push(m);
    }
    m.busy = true; m.group.visible = true;
    return m;
  }
  function makePlane(type, extra) {
    const m = model(type), cfg = AIRCRAFT[type];
    const p = { id: `ac-${st.spawned++}`, type, cfg, m, s: 0, v: 0, dir: 1, alt: 0, pitch: 0, bank: 0, gearUp: 0, thrust: 0.05, strobeT: rng.next(), pos: new THREE.Vector3(), yaw: 0, path: null, state: 'parked', timer: 0, gate: null, checked: false, ...extra };
    planes.push(p);
    return p;
  }
  function freePlane(p) {
    p.m.busy = false; p.m.group.visible = false; p.m.rb.setEnabled(false);
    if (p.gate !== null && gates[p.gate].by === p.id) gates[p.gate].by = null;
    planes.splice(planes.indexOf(p), 1);
  }
  function book(gi, p) { if (gates[gi].by !== null) { st.doubleBook++; return false; } gates[gi].by = p.id; p.gate = gi; return true; }
  const moving = () => planes.filter((p) => p.state !== 'parked').length;
  function parkAt(gi, type, timer) {
    const p = makePlane(type, { state: 'parked', timer });
    book(gi, p);
    const z = gateCentreZ(p.cfg);
    p.pos.set(gates[gi].x, AP.h, z); p.yaw = 0; // nose south (+z) toward the terminal
    return p;
  }
  // Initial: 3 parked (the first one pushes back within OPS.firstDeparture), gate 4 free for the first arrival.
  parkAt(0, 'airliner', OPS.firstDeparture);
  parkAt(1, 'regional', 70 + rng.next() * 30);
  parkAt(2, 'prop', 120 + rng.next() * 40);

  // --- Obstacles (player, cars, other aircraft) ---------------------------------------------
  function obstacles() {
    const o = [];
    const f = controls.mode === 'drive' && controls.car ? controls.car.position : controls.player.position;
    o.push({ x: f.x, z: f.z, r: 3, player: true });
    for (const c of traffic.cars) if (!c.suspended) o.push({ x: c.pos.x, z: c.pos.z, r: 3 });
    for (const c of police?.cars || []) o.push({ x: c.pos.x, z: c.pos.z, r: 3 });
    for (const v of cars?.cars || []) if (!v.impounded) { const q = v.position; o.push({ x: q.x, z: q.z, r: 3 }); }
    return o;
  }
  /** Something on the runway (player / any car / an aircraft rolling or lining up)? */
  function runwayBusy(self, forArrival) {
    for (const o of obstacles()) if (onRunway(o.x, o.z, 4)) return o.player ? 'player' : 'car';
    for (const p of planes) {
      if (p === self) continue;
      if (p.state === 'lineup' || (p.state === 'takeoff' && p.alt < 3) || p.state === 'rollout') return 'aircraft';
      if (!forArrival && p.state === 'final' && p.pos.x < 3600) return 'arrival';
    }
    return '';
  }
  function blockedAhead(p, travel) {
    const c = p.cfg, look = c.L / 2 + 14 + (p.v * p.v) / (2 * 6), half = c.span / 2 + 2;
    for (const o of obstacles()) {
      const dx = o.x - p.pos.x, dz = o.z - p.pos.z, ahead = dx * travel.x + dz * travel.z, lat = Math.abs(dx * travel.z - dz * travel.x);
      if (ahead > 0 && ahead < look && lat < half) return true;
    }
    for (const q of planes) {
      if (q === p || q.alt > 3) continue;
      const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, ahead = dx * travel.x + dz * travel.z, lat = Math.abs(dx * travel.z - dz * travel.x);
      if (ahead > 0 && ahead < (c.L + q.cfg.L) / 2 + 20 + (p.v * p.v) / 12 && lat < (c.span + q.cfg.span) / 4 + 4) return true;
    }
    return false;
  }

  // --- Per-aircraft update ---------------------------------------------------------------------------
  function move(p, dt, vWant, decel = 3) {
    p.v += Math.max(-decel * dt, Math.min((p.state === 'takeoff' ? p.cfg.accel : 2) * dt, vWant - p.v));
    p.v = Math.max(0, p.v);
    p.s = Math.min(p.path.len, p.s + p.v * dt);
    p.path.at(p.s, P0);
    p.pos.x = P0.x; p.pos.z = P0.z;
    const hy = Math.atan2(P0.tx, P0.tz) + (p.dir < 0 ? Math.PI : 0);
    p.yaw = hy;
    return { x: P0.tx, z: P0.tz }; // travel direction (pushback travels backward: heading = -travel)
  }
  function update(p, dt) {
    const c = p.cfg;
    switch (p.state) {
      case 'parked': {
        p.thrust = 0.05; p.timer -= dt;
        if (p.timer <= 0 && moving() < OPS.maxMoving && !taxiwayBusyNear(gates[p.gate].x, p)) {
          p.state = 'pushback'; p.path = pushbackPath(gates[p.gate].x, c); p.s = 0; p.dir = -1; p.v = 0;
        }
        break;
      }
      case 'pushback': {
        const tr = move(p, dt, blockedAhead(p, tr0(p)) ? 0 : 2.6);
        void tr; p.thrust = 0.15;
        if (p.s >= p.path.len - 0.01) {
          gates[p.gate].by = null; p.gate = null;
          p.state = 'taxiOut'; p.path = taxiOutPath(p.pos.x); p.s = 0; p.dir = 1; p.v = 0;
        }
        break;
      }
      case 'taxiOut': {
        const travel = tr0(p);
        const stop = blockedAhead(p, travel);
        if (stop) st.brakes++;
        move(p, dt, stop ? 0 : c.taxi, 4); p.thrust = 0.3;
        if (p.s >= p.path.len - 0.01) { p.state = 'hold'; p.v = 0; }
        break;
      }
      case 'hold': {
        p.thrust = 0.25;
        if (runwayBusy(p, false)) { p.holding = true; break; }
        if (p.holding) { st.holds++; p.holding = false; }
        p.state = 'lineup'; p.path = departPath(); p.s = 0; p.dir = 1;
        break;
      }
      case 'lineup': {
        const travel = tr0(p);
        move(p, dt, blockedAhead(p, travel) ? 0 : 5, 4); p.thrust = 0.35;
        if (p.s > Math.abs(AP.holdShort.z - (R.z + RT)) + RT * Math.PI / 2 - 0.5) { p.state = 'takeoff'; p.rollStart = p.pos.x; }
        break;
      }
      case 'takeoff': {
        const travel = tr0(p), ground = p.alt < 0.5;
        const stop = ground && blockedAhead(p, travel);
        if (stop) st.brakes++;
        move(p, dt, stop ? 0 : 140, stop ? 6 : 3); p.thrust = stop ? 0.3 : 1;
        if (p.v >= c.vr || p.alt > 0) {
          p.alt += p.v * c.climb * Math.min(1, (p.v - c.vr * 0.95) / 6 + (p.alt > 0 ? 1 : 0)) * dt;
          p.pitch += (Math.min(0.16, 0.05 + p.alt * 0.01) - p.pitch) * Math.min(1, dt * 1.5);
        }
        if (p.alt > 12) p.gearUp = Math.min(1, p.gearUp + dt / 4);
        if (p.alt > 3 && !p.wasAir) { p.wasAir = true; st.airborne++; st.departures++; }
        if (p.pos.x < OPS.goneX + 30 || p.alt > 700) { freePlane(p); return; }
        break;
      }
      case 'final': {
        // Glide slope: altitude from distance to the touchdown point.
        move(p, dt, c.vapp); p.thrust = 0.4;
        const d = p.pos.x - OPS.tdX;
        if (!p.checked && p.pos.x - R.x1 < OPS.finalCheck) {
          p.checked = true;
          const why = runwayBusy(p, true);
          if (why) { p.state = 'goaround'; p.why = why; st.goArounds++; if (p.gate !== null) { gates[p.gate].by = null; p.gate = null; } p.path = new Path(line({ x: p.pos.x, z: p.pos.z }, { x: OPS.goneX, z: R.z }, 50)); p.s = 0; break; }
        }
        p.gearUp = p.pos.x > 3000 ? 1 : Math.max(0, p.gearUp - dt / 4);
        if (d > 45) { p.alt = d * OPS.glide; p.pitch += (0.03 - p.pitch) * Math.min(1, dt); }
        else { // flare
          p.alt = Math.max(0, p.alt - Math.max(0.6, p.alt * 1.6) * dt);
          p.pitch += (0.09 - p.pitch) * Math.min(1, dt * 2);
          if (d <= 0 || p.alt <= 0.01) { p.alt = 0; p.state = 'rollout'; st.chirps++; chirp(p); }
        }
        break;
      }
      case 'goaround': {
        move(p, dt, c.vapp + 15); p.thrust = 1;
        p.alt += p.v * 0.12 * dt; p.pitch += (0.14 - p.pitch) * Math.min(1, dt);
        p.gearUp = Math.min(1, p.gearUp + dt / 4);
        if (p.pos.x < OPS.goneX + 30 || p.alt > 600) { freePlane(p); return; }
        break;
      }
      case 'rollout': {
        const travel = tr0(p), stop = blockedAhead(p, travel);
        if (stop) st.brakes++;
        move(p, dt, stop ? 0 : c.taxi, stop ? 6 : 4.5); p.thrust = p.v > 30 ? 0.7 : 0.25; // reverse thrust roar
        p.pitch += (0 - p.pitch) * Math.min(1, dt * 2);
        if (p.v <= c.taxi + 0.5 && p.pos.x < AP.exitX + RT + 5) p.state = 'taxiIn';
        break;
      }
      case 'taxiIn': {
        const travel = tr0(p), stop = blockedAhead(p, travel);
        if (stop) st.brakes++;
        const left = p.path.len - p.s;
        move(p, dt, stop ? 0 : Math.min(c.taxi, 1 + left * 0.4), 4); p.thrust = 0.3;
        if (left < 0.05) { p.state = 'parked'; p.v = 0; p.timer = OPS.departDelay[0] + rng.next() * (OPS.departDelay[1] - OPS.departDelay[0]); st.parkedIn++; st.arrivals++; p.yaw = 0; }
        break;
      }
      default: break;
    }
  }
  const tr0 = (p) => { if (!p.path) return { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }; p.path.at(p.s, P1); return { x: P1.tx, z: P1.tz }; }; // travel direction
  function taxiwayBusyNear(x, self) {
    for (const q of planes) if (q !== self && q.alt < 3 && q.state !== 'parked' && Math.abs(q.pos.z - TW.z) < 25 && q.pos.x > x - 90 && q.pos.x < x + 60) return true;
    return false;
  }
  function spawnArrival(fromX = OPS.spawnX) {
    const gi = gates.findIndex((g) => g.by === null);
    if (gi < 0 || moving() >= OPS.maxMoving || planes.some((p) => p.state === 'final')) return null;
    const type = types[Math.floor(rng.next() * types.length)];
    const p = makePlane(type, { state: 'final', dir: 1, gearUp: 1 });
    book(gi, p);
    p.path = arrivalPath(gates[gi].x, p.cfg, fromX); p.s = 0; p.v = p.cfg.vapp;
    p.path.at(0, P0); p.pos.set(P0.x, AP.h, P0.z); p.alt = (P0.x - OPS.tdX) * OPS.glide;
    return p;
  }

  // --- Render state: pose, gear, lights, props, collider ------------------------------------------
  const _e = new THREE.Euler(), _q = new THREE.Quaternion();
  function render(p, dt) {
    const m = p.m, c = p.cfg;
    if (!Number.isFinite(p.pos.x + p.pos.z + p.alt + p.yaw)) { st.nan++; return; }
    const y = AP.h + p.alt;
    m.group.position.set(p.pos.x, y, p.pos.z);
    // Bank a little in turns (from the path curvature), pitch nose-up in the air.
    _e.set(-p.pitch, p.yaw, p.bank, 'YXZ'); m.group.quaternion.setFromEuler(_e);
    m.gear.scale.y = Math.max(0.02, 1 - p.gearUp); m.gear.visible = p.gearUp < 0.98;
    p.strobeT += dt;
    const blink = (p.strobeT % 1.2) < 0.08;
    m.strobe.visible = blink; m.beacon.visible = (p.strobeT % 1.0) < 0.5 && p.state !== 'parked';
    m.navL.visible = m.navR.visible = p.state !== 'parked' || p.timer < 20;
    for (const pr of m.props) pr.rotation.z += dt * (8 + p.thrust * 60);
    for (const gl of m.glows) gl.material.opacity = 0.12 + p.thrust * 0.75;
    // Collider only on the ground.
    const ground = p.alt < 3;
    if (m.rb.isEnabled() !== ground) m.rb.setEnabled(ground);
    if (ground) { m.rb.setNextKinematicTranslation({ x: p.pos.x, y, z: p.pos.z }); _q.setFromAxisAngle(_Y, p.yaw); m.rb.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }); }
    void c;
  }
  const _Y = new THREE.Vector3(0, 1, 0);

  // --- Apron vehicles (fixed loops; stop for the player) -------------------------------------------
  const vehicles = [];
  {
    const veh = (parts, path, speed, trail = []) => {
      const mesh = new THREE.Mesh(merge(parts), MAT.solid); mesh.castShadow = true; scene.add(mesh);
      const carts = trail.map((p) => { const cm = new THREE.Mesh(merge(p), MAT.solid); scene.add(cm); return cm; });
      vehicles.push({ mesh, carts, path: new Path(path), s: rng.next() * 50, v: speed, speed });
    };
    const box = (w, h, d, x, y, z, col) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), col, 0.03);
    const wheels = (w, l) => [-1, 1].flatMap((s) => [-1, 1].map((t) => paint(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8).rotateZ(Math.PI / 2).translate(s * w / 2, 0.3, t * l / 2), '#1c1d20', 0)));
    const tug = [box(1.5, 0.8, 2.4, 0, 0.3, 0, '#e2b33a'), box(1.2, 0.8, 0.9, 0, 1.1, -0.5, '#26323c'), ...wheels(1.5, 1.6)];
    const cart = [box(1.4, 0.15, 2.2, 0, 0.45, 0, '#5c5f66'), box(1.3, 0.6, 2.0, 0, 0.6, 0, ['#c8553e', '#3f7fc0', '#4f9a55'][0]), ...wheels(1.3, 1.4)];
    const Tz = AP.terminal.z0 - 5;
    const tugLoop = (x0, x1, z) => join(line({ x: x0, z }, { x: x1, z }, 4), arc(x1, z - 2.5, 2.5, Math.PI / 2, -Math.PI / 2, 6), line({ x: x1, z: z - 5 }, { x: x0, z: z - 5 }, 4), arc(x0, z - 2.5, 2.5, -Math.PI / 2, -Math.PI * 1.5, 6));
    veh(tug, tugLoop(445, 615, Tz + 2), 4.5, [cart, cart]);
    veh(tug, tugLoop(470, 590, Tz + 2), 4, [cart]);
    const fuel = [box(2.3, 1.6, 2.2, 0, 0.4, 2.3, '#e9e6dc'), box(2.4, 2.0, 5.4, 0, 0.4, -1.6, '#c8322a'), box(2.42, 0.25, 5.4, 0, 1.6, -1.6, '#f4f1e8'), ...wheels(2.2, 5.2)];
    const rect = (x0, x1, z0, z1) => join(line({ x: x0, z: z0 }, { x: x1, z: z0 }, 4), line({ x: x1, z: z0 }, { x: x1, z: z1 }, 4), line({ x: x1, z: z1 }, { x: x0, z: z1 }, 4), line({ x: x0, z: z1 }, { x: x0, z: z0 }, 4));
    veh(fuel, rect(640, 718, -628, -592), 5);
    const bus = [box(2.5, 2.6, 10, 0, 0.35, 0, '#2f6fc0'), box(2.52, 0.9, 9.2, 0, 1.6, 0.2, '#26323c'), ...wheels(2.4, 6.5)];
    veh(bus, rect(386, 428, -628, -590), 5);
  }
  function updateVehicles(dt) {
    const f = controls.mode === 'drive' && controls.car ? controls.car.position : controls.player.position;
    for (const v of vehicles) {
      v.path.at(v.s, P0);
      const ahead = (f.x - P0.x) * P0.tx + (f.z - P0.z) * P0.tz, lat = Math.abs((f.x - P0.x) * P0.tz - (f.z - P0.z) * P0.tx);
      const want = ahead > 0 && ahead < 9 && lat < 2.5 ? 0 : v.speed;
      v.v += Math.max(-6 * dt, Math.min(2 * dt, want - v.v));
      v.s = (v.s + v.v * dt) % v.path.len;
      v.path.at(v.s, P0);
      v.mesh.position.set(P0.x, AP.h, P0.z); v.mesh.rotation.y = Math.atan2(P0.tx, P0.tz);
      v.carts.forEach((cm, k) => { v.path.at((v.s - 3.6 * (k + 1) + v.path.len) % v.path.len, P1); cm.position.set(P1.x, AP.h, P1.z); cm.rotation.y = Math.atan2(P1.tx, P1.tz); });
    }
  }

  // --- Cruise flyovers (cheap, always visible) ------------------------------------------------------
  const cruise = [0, 1].map((k) => {
    const m = buildAircraft(k ? 'airliner' : 'regional', k + 2); m.gear.visible = false;
    for (const part of [m.navL, m.navR, m.beacon]) part.visible = true;
    scene.add(m.group);
    return { m, t: k * 70, period: 140, alt: 800 + k * 150, a: k ? 0.6 : 2.4 };
  });
  function updateCruise(dt) {
    for (const c of cruise) {
      c.t = (c.t + dt) % c.period;
      const u = c.t / c.period, L = 9000, dx = Math.cos(c.a), dz = Math.sin(c.a);
      const x = 400 + dx * (u - 0.5) * L, z = -200 + dz * (u - 0.5) * L;
      c.m.group.position.set(x, c.alt, z); c.m.group.rotation.set(0, Math.atan2(dx, dz), 0);
      c.m.strobe.visible = (c.t % 1.2) < 0.08;
    }
  }

  // --- Audio: summed jet roar + prop buzz, distance attenuated; touchdown chirps ------------------
  let A = null;
  function initAudio() {
    const ctx = audio.ctx, master = audio.master;
    if (!ctx || !master) return null;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.03 * w) / 1.03; d[i] = last * 3; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const jf = ctx.createBiquadFilter(); jf.type = 'lowpass'; jf.frequency.value = 900;
    const jg = ctx.createGain(); jg.gain.value = 0; src.connect(jf); jf.connect(jg); jg.connect(out); src.start();
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70;
    const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 420;
    const pg = ctx.createGain(); pg.gain.value = 0; osc.connect(pf); pf.connect(pg); pg.connect(out); osc.start();
    return { ctx, out, jg, jf, pg, osc, buf };
  }
  function chirp(p) {
    if (!A) return;
    const f = controls.focus(), d = Math.hypot(p.pos.x - f.x, p.pos.z - f.z), lvl = Math.min(0.08, 0.08 / (1 + (d / 120) ** 2));
    if (lvl < 0.003) return;
    const s = A.ctx.createBufferSource(); s.buffer = A.buf;
    const hp = A.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    const g = A.ctx.createGain(), now = A.ctx.currentTime; g.gain.setValueAtTime(lvl, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    s.connect(hp); hp.connect(g); g.connect(A.out); s.start(now); s.stop(now + 0.3);
  }
  function updateAudio(dt) {
    if (!audio.ready) return;
    if (!A) A = initAudio();
    if (!A) return;
    const f = controls.focus();
    let jet = 0, prop = 0, pitch = 0;
    for (const p of planes) {
      p.spool = (p.spool ?? p.thrust) + (p.thrust - (p.spool ?? p.thrust)) * Math.min(1, dt * 0.8); // spool up / down
      const d = Math.hypot(p.pos.x - f.x, p.alt - (f.y - AP.h), p.pos.z - f.z), att = 1 / (1 + (d / 90) ** 2);
      if (p.cfg.prop) prop += p.spool * att; else { jet += p.spool * att; pitch = Math.max(pitch, p.spool * att); }
    }
    const now = A.ctx.currentTime;
    A.jg.gain.setTargetAtTime(Math.min(0.09, jet * 0.09), now, 0.2);
    A.jf.frequency.setTargetAtTime(500 + pitch * 1800, now, 0.3);
    A.pg.gain.setTargetAtTime(Math.min(0.03, prop * 0.03), now, 0.2);
    st.audio = { jet: +jet.toFixed(3), prop: +prop.toFixed(3) };
  }

  return {
    st, planes, gates, vehicles, cruise, OPS,
    spawnArrival, runwayBusy: (forArrival) => runwayBusy(null, forArrival),
    update(dt) {
      if (dt <= 0) return;
      st.t += dt;
      if (st.t >= st.nextArrival && planes.some((p) => p.state === 'hold')) st.nextArrival = st.t + 12; // a departure is waiting: let it go first
      if (st.t >= st.nextArrival) {
        const first = st.spawned <= 3;
        const p = spawnArrival(first ? OPS.firstArrivalX : OPS.spawnX);
        st.nextArrival = st.t + (p ? OPS.arrivalGap[0] + rng.next() * (OPS.arrivalGap[1] - OPS.arrivalGap[0]) : 6);
      }
      for (const p of [...planes]) update(p, dt);
      // Hide ground traffic far from the airport (airborne aircraft stay visible).
      const f = controls.focus(), dx = Math.max(AP.site.x0 - f.x, 0, f.x - AP.site.x1), dz = Math.max(AP.site.z0 - f.z, 0, f.z - AP.site.z1), near = Math.hypot(dx, dz) < 600;
      st.visible = near;
      for (const p of planes) { p.m.group.visible = near || p.alt > 3; render(p, dt); }
      if (near) updateVehicles(dt);
      for (const v of vehicles) { v.mesh.visible = near; for (const c of v.carts) c.visible = near; }
      updateCruise(dt);
      updateAudio(dt);
    },
  };
}
