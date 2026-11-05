// In-car CABIN camera: eye at the driver's seat (right-hand drive), a shared cabin interior
// (dashboard, binnacle, A/B-pillars, roof lining, door cards, seats) sized per car type,
// a steering wheel that turns up to ~450 deg with the steering, working speedo + tacho
// needles, dashboard lamps (headlights / handbrake / engine), limited mouse look with
// auto-recentre, B = look back, impact shake and a cracked-windscreen overlay at low health.
// Built lazily the first time a car is viewed from inside, then cached on the car.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, boxB, painted, merge } from '../utils/geom.js';
import { simGearRpm } from '../vehicles/drivetrain.js';

const IN = { dash: '#2b2c2f', trim: '#45474c', lining: '#d8d3c8', seat: '#3a3c40', gauge: '#141517', needle: '#ff6a3a', wheel: '#1f2023' };
const LAMP_OFF = new THREE.MeshBasicMaterial({ color: '#202124' });
const LAMP = {
  head: new THREE.MeshBasicMaterial({ color: '#4fc3ff' }),
  hand: new THREE.MeshBasicMaterial({ color: '#ff3b2f' }),
  engine: new THREE.MeshBasicMaterial({ color: '#ffb02e' }),
};
const YAW_MAX = THREE.MathUtils.degToRad(110), PITCH_MAX = THREE.MathUtils.degToRad(35);
// Eye 7 cm higher than Phase 4 (0.66), dash top 4 cm under the belt line. FOV zooms 65-85.
const EYE_Y = 0.73, DASH_DROP = 0.04;
export const CABIN_FOV = { min: 65, max: 85, def: 75 };

function seg(a, b, t, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.BoxGeometry(t, t, A.distanceTo(B));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.clone().sub(A).normalize()));
  const m = A.add(B).multiplyScalar(0.5);
  return painted(g, color, m.x, m.y, m.z, 0.03);
}

function buildCabin(car, mirrorMats) {
  const c = car.cfg, hw = c.W / 2 - 0.12, tw = c.W / 2 - 0.29;
  const [z0, z1] = c.cabin, [r0, r1] = c.roofSpan, belt = c.belt, roof = c.roof;
  const [sx, sy, sz] = c.seat;
  const solid = [];
  const dashZ = z1 - 0.3, dashTop = belt - DASH_DROP;
  solid.push(boxB(c.W - 0.24, 0.26, 0.42, 0, dashTop - 0.26, dashZ + 0.06, IN.dash));   // dashboard (low + short)
  solid.push(boxB(0.42, 0.05, 0.14, sx, dashTop - 0.01, dashZ - 0.19, IN.dash));       // slim gauge binnacle hood
  solid.push(box(c.W - 0.3, 0.02, 0.5, 0, c.clearance + 0.16, (z0 + z1) / 2, IN.trim)); // floor
  for (const s of [1, -1]) {
    solid.push(boxB(0.06, belt - c.clearance - 0.12, z1 - z0, s * hw, c.clearance + 0.1, (z0 + z1) / 2, IN.trim)); // door cards
    solid.push(seg([s * hw, belt, z1 - 0.05], [s * tw, roof - 0.02, r1], 0.045, IN.trim));                        // A-pillars (thin)
    if (car.type !== 'ute') solid.push(seg([s * hw, belt, (z0 + z1) / 2], [s * tw, roof - 0.02, (r0 + r1) / 2], 0.1, IN.trim)); // B-pillars
    solid.push(seg([s * hw, belt, z0 + 0.05], [s * tw, roof - 0.02, r0], 0.12, IN.trim));                         // C-pillars
    // Seats: driver (s = -1 is the right-hand side) + passenger.
    const x = s * Math.abs(sx);
    solid.push(boxB(0.5, 0.12, 0.5, x, sy - 0.1, sz, IN.seat));
    solid.push(boxB(0.5, 0.62, 0.12, x, sy - 0.05, sz - 0.3, IN.seat));
  }
  if (car.type !== 'ute') solid.push(boxB(c.W - 0.4, 0.5, 0.45, 0, sy - 0.12, z0 + 0.35, IN.seat)); // rear bench
  const lining = new THREE.PlaneGeometry(tw * 2, r1 - r0).rotateX(Math.PI / 2).translate(0, roof - 0.04, (r0 + r1) / 2);
  solid.push(painted(lining, IN.lining, 0, 0, 0, 0.02));
  // Gauge faces.
  const gz = dashZ - 0.155, gy = dashTop - 0.1;
  for (const dx of [-0.13, 0.13]) solid.push(painted(new THREE.CircleGeometry(0.075, 16).rotateY(Math.PI), IN.gauge, sx + dx, gy, gz, 0.01));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge(solid), MAT.solid));

  // Needles (pivot at the gauge centre, rotate about Z). Speedo is left of the driver's eye.
  const needle = (dx) => {
    const p = new THREE.Group();
    p.position.set(sx + dx, gy, gz - 0.005);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.062, 0.004).translate(0, 0.025, 0), new THREE.MeshBasicMaterial({ color: IN.needle }));
    p.add(m);
    group.add(p);
    return p;
  };
  const speedo = needle(0.13), tacho = needle(-0.13);
  // Dash lamps.
  const lamps = {};
  ['head', 'hand', 'engine'].forEach((k, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.004), LAMP_OFF);
    m.position.set(sx - 0.05 + i * 0.05, gy - 0.075, gz - 0.006);
    group.add(m);
    lamps[k] = m;
  });
  // Steering wheel: column tilt group -> spin group (rotates with steering).
  const col = new THREE.Group();
  col.position.set(sx, sy + 0.32, sz + 0.5);
  col.rotation.x = -0.42;
  const spin = new THREE.Group();
  const rim = new THREE.TorusGeometry(0.18, 0.013, 5, 20);
  const parts = [painted(rim, IN.wheel, 0, 0, 0, 0.03)];
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) parts.push(seg([0, 0, 0], [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0], 0.016, IN.wheel));
  parts.push(painted(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10).rotateX(Math.PI / 2), IN.trim, 0, 0, 0, 0.02));
  spin.add(new THREE.Mesh(merge(parts), MAT.solid));
  col.add(spin);
  group.add(col);
  // Mirrors (render-target materials from mirrors.js, or a static tint fallback).
  if (mirrorMats) {
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.085).rotateY(Math.PI), mirrorMats.rear);
    rear.position.set(0, roof - 0.15, r1 - 0.12);
    group.add(rear);
    for (const [name, s] of [['left', 1], ['right', -1]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.095).rotateY(Math.PI), mirrorMats[name]);
      m.position.set(s * (c.W / 2 + 0.06), belt + 0.1, z1 - 0.32);
      group.add(m);
    }
  }
  group.visible = false;
  car.model.add(group);
  return { group, speedo, tacho, lamps, spin, dashTop, dashZ: dashZ - 0.15, eye: new THREE.Vector3(sx, sy + EYE_Y, sz + 0.02) };
}

export function createCabinView(camera, mirrors = null) {
  const st = { yaw: 0, pitch: -0.05, idle: 0, shake: 0, active: null, fov: CABIN_FOV.def };
  const eyeW = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), qOff = new THREE.Quaternion();
  const crack = document.createElement('div');
  crack.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .4s';
  crack.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none" style="opacity:.55">
    <g stroke="#f4f6f8" stroke-width=".18" fill="none"><path d="M62 18 L70 10 L78 6 M62 18 L74 22 L88 20 M62 18 L58 30 L52 42 M62 18 L50 14 L38 9 M62 18 L66 30 L72 44 M58 30 L46 34 M70 10 L68 3"/>
    <circle cx="62" cy="18" r="1.1"/></g></svg>`;
  document.body.appendChild(crack);

  return {
    get state() { return st; },
    /** Steering wheel rotation (rad) of the active car (for tests). */
    wheelAngle() { return st.active?.cabin ? st.active.cabin.spin.rotation.z : 0; },
    enter(car) {
      car.cabin = car.cabin || buildCabin(car, mirrors?.materials); car.cabin.group.visible = true; st.active = car; st.yaw = 0; st.pitch = -0.05;
      car.paintMesh.visible = false; // the hood + shell would block the road; the cabin interior stands in
    },
    exit() {
      if (st.active?.cabin) { st.active.cabin.group.visible = false; st.active.paintMesh.visible = true; }
      st.active = null; crack.style.opacity = '0';
    },
    update(dt, car, input, health = 100) {
      if (st.active !== car) this.enter(car);
      const cab = car.cabin, s = car.body.state;
      // Gauges + lamps + wheel.
      const kmh = Math.abs(s.speed) * 3.6, { rpm } = simGearRpm(s.speed * 3.6, s.throttle);
      cab.speedo.rotation.z = THREE.MathUtils.degToRad(135 - Math.min(200, kmh) / 200 * 270);
      cab.tacho.rotation.z = THREE.MathUtils.degToRad(135 - Math.min(7000, rpm) / 7000 * 270);
      cab.lamps.head.material = car.lights ? LAMP.head : LAMP_OFF;
      cab.lamps.hand.material = s.handbrake ? LAMP.hand : LAMP_OFF;
      cab.lamps.engine.material = health < 30 ? LAMP.engine : LAMP_OFF;
      cab.spin.rotation.z = -(car.body.steer / car.cfg.steer) * THREE.MathUtils.degToRad(450) * 0.5;
      // Limited look with auto-recentre; B = look back.
      const look = input.look(dt);
      if (Math.abs(look.x) + Math.abs(look.y) > 0.5) st.idle = 0; else st.idle += dt;
      st.yaw = THREE.MathUtils.clamp(st.yaw - look.x * 0.0026, -YAW_MAX, YAW_MAX);
      st.pitch = THREE.MathUtils.clamp(st.pitch - look.y * 0.0022, -PITCH_MAX, PITCH_MAX);
      if (st.idle > 1.5) { st.yaw *= 1 - Math.min(1, dt * 2.5); st.pitch += (-0.05 - st.pitch) * Math.min(1, dt * 2.5); }
      const back = input.down('KeyB');
      st.fov = THREE.MathUtils.clamp(st.fov + input.wheel() * 3, CABIN_FOV.min, CABIN_FOV.max);
      if (Math.abs(camera.fov - st.fov) > 0.01) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
      // Pose: eye in car space, car orientation x look offsets, plus impact shake.
      car.model.updateMatrixWorld(true);
      eyeW.copy(cab.eye).applyMatrix4(car.model.matrixWorld);
      // Shake only from real crashes (combat sets crashShake on a verified collision), never from bumps.
      st.shake = Math.max(st.shake * Math.exp(-dt * 6), car.crashShake || 0);
      car.crashShake = 0;
      eyeW.x += (Math.random() - 0.5) * st.shake * 0.08;
      eyeW.y += (Math.random() - 0.5) * st.shake * 0.08;
      camera.position.copy(eyeW);
      car.model.getWorldQuaternion(q);
      // Cameras look down -Z; the car's forward is +Z, so the base yaw is PI (B looks back = 0).
      e.set(st.pitch, back ? 0 : Math.PI + st.yaw, 0);
      qOff.setFromEuler(e);
      camera.quaternion.copy(q).multiply(qOff);
      crack.style.opacity = health < 35 ? '1' : '0';
    },
  };
}
