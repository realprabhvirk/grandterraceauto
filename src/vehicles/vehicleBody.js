// Arcade car physics on top of Rapier's DynamicRayCastVehicleController.
// No three.js here, so it can be tuned/tested in plain Node.
//
// Car-local: +Z forward, +Y up, +X left. Body origin = ground level between the axles.
// Assists (all deliberately "forgiving"): speed-sensitive eased steering, lateral grip
// assist, roll damping, upright torque, downforce, anti-launch clamp, handbrake drift.
import { G_CAR, groups, GROUP } from '../physics/physicsWorld.js';
import { BRAKE } from './brakeConfig.js';

const WHEEL_GROUPS = groups(GROUP.CAR, GROUP.STATIC | GROUP.CAR);

function yawQuat(yaw) { return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }; }
function rotate(q, v) {
  // v' = q * v * q^-1
  const { x, y, z, w } = q;
  const ix = w * v.x + y * v.z - z * v.y, iy = w * v.y + z * v.x - x * v.z;
  const iz = w * v.z + x * v.y - y * v.x, iw = -x * v.x - y * v.y - z * v.z;
  return { x: ix * w + iw * -x + iy * -z - iz * -y, y: iy * w + iw * -y + iz * -x - ix * -z, z: iz * w + iw * -z + ix * -y - iy * -x };
}
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export class VehicleBody {
  /**
   * @param physics  createPhysics() result
   * @param cfg      CAR_TYPES entry
   * @param pose     { x, y (ground height), z, yaw }
   * @param opts     { surfaceAt(x, z) -> grip multiplier }
   */
  constructor(physics, cfg, pose, opts = {}) {
    const { world, RAPIER } = physics;
    this.physics = physics;
    this.cfg = cfg;
    this.surfaceAt = opts.surfaceAt || (() => 1);
    this.steer = 0;
    this.parked = true;
    this.lastVel = { x: 0, y: 0, z: 0 };
    this.impact = 0; // collision strength this step (for the thud sound)
    this.state = { speed: 0, throttle: 0, braking: false, reversing: false, handbrake: false, grounded: 0, slip: 0, boost: false };

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pose.x, pose.y + 0.12, pose.z)
        .setRotation(yawQuat(pose.yaw))
        .setCcdEnabled(true)
        .setLinearDamping(0.04)
        .setAngularDamping(0.9)
        .setCanSleep(false),
    );
    // Lower hull (rounded edges, bottom raised a little: lips and seams slide instead of catching -
    // Phase 6.2, docs/BUMPS.md) + cabin box.
    const rr = BRAKE.chassisRound, lift = BRAKE.chassisLift;
    const bodyH = (cfg.belt - cfg.clearance - lift) / 2;
    const zMid = cfg.frontOverhang - cfg.L / 2 + cfg.wheelBase / 2;
    const yHull = cfg.clearance + lift + bodyH;
    const main = RAPIER.ColliderDesc.roundCuboid(cfg.W / 2 - 0.02 - rr, bodyH - rr, cfg.L / 2 - 0.04 - rr, rr)
      .setTranslation(0, yHull, zMid)
      .setCollisionGroups(G_CAR).setFriction(BRAKE.chassisFriction).setRestitution(0.15);
    // Mass properties: extra roll inertia = hard to flip (arcade). NOTE the centre of mass is in the
    // collider's frame: it sits 0.36 above the original hull centre (~0.9 m up). Phase 6.2 keeps that exact
    // height (handling unchanged); braking no longer pitches the car because it acts at the COM.
    const m = cfg.mass, Lx = cfg.L, Wx = cfg.W, Hx = 1.2;
    const comBody = cfg.clearance + (cfg.belt - cfg.clearance) / 2 + 0.36;
    main.setMassProperties(m, { x: 0, y: comBody - yHull, z: 0.05 },
      { x: (m / 12) * (Hx * Hx + Lx * Lx) * 1.2, y: (m / 12) * (Wx * Wx + Lx * Lx) * 1.1, z: (m / 12) * (Wx * Wx + Hx * Hx) * 1.8 },
      { x: 0, y: 0, z: 0, w: 1 });
    this.colliders = [world.createCollider(main, this.body)];
    const [c0, c1] = cfg.cabin;
    const cabinH = (cfg.roof - cfg.belt) / 2;
    const cabin = RAPIER.ColliderDesc.cuboid(cfg.W / 2 - 0.16, cabinH, (c1 - c0) / 2 - 0.05)
      .setTranslation(0, cfg.belt + cabinH, (c0 + c1) / 2)
      .setCollisionGroups(G_CAR).setFriction(0.4).setDensity(0);
    this.colliders.push(world.createCollider(cabin, this.body));
    for (const c of this.colliders) physics.tag?.(c, 'car', pose.type || cfg.label);
    const own = new Set(this.colliders.map((c) => c.handle));
    this.wheelFilter = (c) => !own.has(c.handle);

    // Wheels: FL, FR, RL, RR. Connection height puts the wheel bottom on the ground at rest.
    const ctrl = (this.ctrl = world.createVehicleController(this.body));
    ctrl.indexUpAxis = 1;
    ctrl.setIndexForwardAxis = 2;
    // Physics wheels are 4 cm larger than the visual tyres so tyres sit ON the road ribbon,
    // which is a 5 cm visual decal above the terrain the wheels actually touch.
    const R = cfg.wheelR + 0.04;
    const yConn = R + cfg.rest;
    this.wheelPos = [
      [cfg.track / 2, yConn, cfg.wheelBase / 2], [-cfg.track / 2, yConn, cfg.wheelBase / 2],
      [cfg.track / 2, yConn, -cfg.wheelBase / 2], [-cfg.track / 2, yConn, -cfg.wheelBase / 2],
    ];
    for (const [x, y, z] of this.wheelPos) {
      ctrl.addWheel({ x, y, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, cfg.rest, R);
    }
    for (let i = 0; i < 4; i++) {
      ctrl.setWheelSuspensionStiffness(i, cfg.stiffness);
      ctrl.setWheelSuspensionCompression(i, cfg.compression);
      ctrl.setWheelSuspensionRelaxation(i, cfg.relaxation);
      ctrl.setWheelMaxSuspensionTravel(i, cfg.travel);
      ctrl.setWheelMaxSuspensionForce(i, cfg.mass * 40);
      ctrl.setWheelFrictionSlip(i, cfg.grip);
      ctrl.setWheelSideFrictionStiffness(i, 1.0);
    }
    this.driven = cfg.drive === 'front' ? [0, 1] : cfg.drive === 'rear' ? [2, 3] : [0, 1, 2, 3];
  }

  get position() { return this.body.translation(); }
  get rotation() { return this.body.rotation(); }
  forward() { return rotate(this.body.rotation(), { x: 0, y: 0, z: 1 }); }
  up() { return rotate(this.body.rotation(), { x: 0, y: 1, z: 0 }); }
  left() { return rotate(this.body.rotation(), { x: 1, y: 0, z: 0 }); }
  /** Heading angle in the XZ plane (same convention as the player: forward = (sin, cos)). */
  yaw() { const f = this.forward(); return Math.atan2(f.x, f.z); }

  /** Place the car upright at (x, ground y, z) facing yaw, at rest. */
  teleport(x, y, z, yaw) {
    this.body.setTranslation({ x, y: y + 0.15, z }, true);
    this.body.setRotation(yawQuat(yaw), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.steer = 0;
    this.lastVel = { x: 0, y: 0, z: 0 }; this.impactDv = 0; // a teleport is not a crash
    this.snapRender = true; // render interpolation: don't blend from the old place
  }

  /** R key: flip upright where it is, lifted a little, keeping the heading. */
  resetUpright(groundY) {
    const p = this.position;
    this.teleport(p.x, Math.max(groundY, p.y - 1) + 0.6, p.z, this.yaw());
  }

  /**
   * Fixed-step update.
   * @param input { throttle 0..1, reverse 0..1, steer -1..1 (+ = left), handbrake, boost } or null when parked
   */
  update(dt, input) {
    const cfg = this.cfg, ctrl = this.ctrl, body = this.body;
    const st = this.state;
    const speed = ctrl.currentVehicleSpeed();
    st.speed = speed;
    const parked = !input;
    this.parked = parked;
    const thr = parked || this.dead ? 0 : input.throttle, rev = parked || this.dead ? 0 : input.reverse; // dead engine: no drive
    const boost = !parked && input.boost && thr > 0;

    // --- Steering: eased, with less lock at speed ---------------------------------
    const lock = cfg.steer * Math.max(0.22, 1 / (1 + Math.abs(speed) / 11));
    const target = parked ? 0 : input.steer * lock;
    const rate = (Math.abs(target) < Math.abs(this.steer) ? 4.0 : 2.6) * dt;
    this.steer += Math.max(-rate, Math.min(rate, target - this.steer));
    ctrl.setWheelSteering(0, this.steer);
    ctrl.setWheelSteering(1, this.steer);

    // --- Engine / brakes ------------------------------------------------------------
    // S = brake while moving forward (> BRAKE.reverseBelow), never reverse throttle; reverse engages only
    // once (almost) stopped and S is still held for BRAKE.reverseDelay. Brake input ramps in; the braking
    // force itself is applied at the centre of mass below (no pitch torque) - only a small residual goes
    // through the wheels (front/rear bias) so the tyres scrub.
    let engine = 0, brake = 0, brakeIn = 0;
    st.braking = false; st.reversing = false;
    if (parked) {
      brake = cfg.brake * 2; this.revHold = 0;
    } else if (thr > 0 && speed > -1) {
      const top = cfg.top * (boost ? 1.15 : 1);
      const taper = Math.max(0, 1 - (Math.max(0, speed) / top) ** 2);
      engine = cfg.engine * thr * (boost ? 1.55 : 1) * taper; this.revHold = 0;
    } else if (thr > 0) {
      brakeIn = thr; st.braking = true; this.revHold = 0; // rolling backwards + W: brake first
    } else if (rev > 0 && speed > BRAKE.reverseBelow) {
      brakeIn = rev; st.braking = true; this.revHold = 0;
    } else if (rev > 0) {
      this.revHold = (this.revHold || 0) + dt;
      if (this.revHold < BRAKE.reverseDelay && speed > -0.5) { brakeIn = rev; st.braking = true; }
      else { engine = speed > -9 ? -cfg.engine * 0.7 * rev : 0; st.reversing = true; }
    } else {
      brake = 1.2; this.revHold = 0; // engine braking / rolling resistance
    }
    const lvl0 = this.brakeLvl || 0, rampStep = dt / BRAKE.rampIn;
    this.brakeLvl = brakeIn > lvl0 ? Math.min(brakeIn, lvl0 + rampStep) : Math.max(brakeIn, lvl0 - rampStep * 2);
    const bl = this.brakeLvl;
    for (let i = 0; i < 4; i++) {
      ctrl.setWheelEngineForce(i, this.driven.includes(i) ? engine * (this.driven.length === 4 ? 0.6 : 1) : 0);
      const wb = bl > 0 ? BRAKE.wheelBrake * bl * 2 * (i < 2 ? BRAKE.bias : 1 - BRAKE.bias) : 0;
      ctrl.setWheelBrake(i, brake + wb);
    }
    const hb = !parked && input.handbrake;
    st.handbrake = hb;
    if (hb) { ctrl.setWheelBrake(2, cfg.brake * 1.6); ctrl.setWheelBrake(3, cfg.brake * 1.6); }

    // --- Grip: asphalt vs grass, handbrake loosens the rear -------------------------
    const p = body.translation();
    for (let i = 0; i < 4; i++) {
      const cp = ctrl.wheelIsInContact(i) ? ctrl.wheelContactPoint(i) : p;
      const surf = this.surfaceAt(cp.x, cp.z);
      const rear = i >= 2;
      ctrl.setWheelFrictionSlip(i, cfg.grip * surf * (hb && rear ? 0.42 : 1));
    }

    ctrl.updateVehicle(dt, undefined, WHEEL_GROUPS, this.wheelFilter);

    // --- Arcade assists ---------------------------------------------------------------
    let grounded = 0;
    for (let i = 0; i < 4; i++) if (ctrl.wheelIsInContact(i)) grounded++;
    st.grounded = grounded;
    const m = cfg.mass;
    const v = body.linvel();
    const f = this.forward(), up = this.up(), left = this.left();
    const fwdSpeed = dot(v, f), latSpeed = dot(v, left);
    st.slip = grounded ? Math.min(1, Math.abs(latSpeed) / 6) : 0;
    if (grounded >= 2) {
      // Lateral grip assist (not while drifting on the handbrake).
      const k = hb ? 0.6 : 2.4;
      const j = -latSpeed * m * Math.min(1, k * dt);
      body.applyImpulse({ x: left.x * j, y: left.y * j, z: left.z * j }, true);
      // Downforce grows with speed: keeps it planted over crests (Phase 6.2: much gentler - the old
      // 9 m/s^2 squashed the suspension until the hull scraped the ground).
      const df = m * Math.min(BRAKE.downforceMax, BRAKE.downforceK * fwdSpeed * fwdSpeed) * dt;
      body.applyImpulse({ x: -up.x * df, y: -up.y * df, z: -up.z * df }, true);
    }
    // Braking at the centre of mass: decel up to BRAKE.maxDecelG, clamped by a friction circle
    // (tyre load x mu over the grounded wheels), never past a standstill.
    if (bl > 0 && grounded) {
      // Friction circle: tyres that are also steering have less grip left for braking.
      const steerUse = Math.min(1, Math.abs(this.steer) / Math.max(0.05, cfg.steer * 0.5));
      const aMax = Math.min(BRAKE.maxDecelG * (1 - BRAKE.steerShare * steerUse), BRAKE.mu * (grounded / 4)) * 9.81 * bl;
      const dvB = Math.min(aMax * dt, Math.abs(fwdSpeed));
      const jB = -Math.sign(fwdSpeed) * m * dvB;
      body.applyImpulse({ x: f.x * jB, y: f.y * jB, z: f.z * jB }, true);
    }
    // Pitch: clamp the grounded pitch rate; while braking, push the nose back up beyond the limit.
    {
      const wv = body.angvel(), pr = dot(wv, left), lim = BRAKE.pitchRateLimit / 57.2958;
      if (grounded >= 2 && Math.abs(pr) > lim) {
        const cut = pr - Math.sign(pr) * lim;
        body.setAngvel({ x: wv.x - left.x * cut, y: wv.y - left.y * cut, z: wv.z - left.z * cut }, true);
      }
      const pitchDeg = Math.asin(Math.max(-1, Math.min(1, f.y))) * 57.2958;
      if (bl > 0 && grounded >= 2 && pitchDeg < -BRAKE.pitchLimit) {
        const k = (-BRAKE.pitchLimit - pitchDeg) / 57.2958 * 8 * m * dt; // nose-down = +rotation about left
        body.applyTorqueImpulse({ x: -left.x * k, y: -left.y * k, z: -left.z * k }, true);
      }
    }
    // Roll damping + upright torque (stronger in the air so landings come out wheels-down).
    const w = body.angvel();
    const roll = dot(w, f);
    const rd = roll * (grounded ? 0.5 : 0.25) * m * dt;
    body.applyTorqueImpulse({ x: -f.x * rd, y: -f.y * rd, z: -f.z * rd }, true);
    // Torque toward world up: a positive rotation about (up x Y) turns `up` toward Y.
    const ax = { x: -up.z, y: 0, z: up.x }; // up x (0,1,0)
    const al = Math.hypot(ax.x, ax.z);
    if (al > 1e-4) {
      const tilt = Math.acos(Math.max(-1, Math.min(1, up.y)));
      const kU = (grounded ? 2.5 : 6) * m * tilt * dt / al;
      body.applyTorqueImpulse({ x: ax.x * kU, y: 0, z: ax.z * kU }, true);
    }
    // Never launch into orbit off a crest or kerb.
    if (v.y > 4.5) body.setLinvel({ x: v.x, y: 4.5, z: v.z }, true);
    // Speed cap: excess speed (e.g. boost released at the boosted top speed) bleeds off at BRAKE.capRate,
    // never in one step (that was a ~4 m/s single-step jolt).
    const top = cfg.top * (boost ? 1.15 : 1) * 1.05;
    if (Math.abs(fwdSpeed) > top && !(bl > 0.05)) { // (while braking, the brake does the slowing)
      const vc = body.linvel(), fs = Math.abs(dot(vc, f));
      const s = Math.max(top, fs - BRAKE.capRate * dt) / fs;
      body.setLinvel({ x: vc.x * s, y: vc.y, z: vc.z * s }, true);
    }
    // Collision strength (sudden velocity change not explained by braking).
    const dv = Math.hypot(v.x - this.lastVel.x, v.y - this.lastVel.y, v.z - this.lastVel.z);
    this.impact = dv > 2.2 ? Math.min(1, (dv - 2.2) / 6) : 0;
    this.impactDv = Math.max(this.impactDv || 0, dv); // peak since last read (consumed by combat)
    // Remember the velocity AFTER our own impulses / caps this step, so only what the solver
    // does (real contacts) shows up as dv next step (boost cut / speed cap used to look like a crash).
    const vEnd = body.linvel();
    this.lastVel = { x: vEnd.x, y: vEnd.y, z: vEnd.z };
    st.throttle = thr;
    st.boost = boost;
    this.recordTrace(dt, input, engine, brake, hb, boost, vEnd, f, up, left);
  }

  /** Always-on ring buffer of the last ~3 s of physics steps (debug.carTrace()). Cheap: plain numbers. */
  recordTrace(dt, input, engine, brake, hb, boost, v, f, up, left) {
    const tr = this.trace || (this.trace = { buf: [], t: 0, lastAx: 0, lastPitch: 0 });
    tr.t += dt;
    const ctrl = this.ctrl, cfg = this.cfg, w = this.body.angvel();
    const pitch = Math.asin(Math.max(-1, Math.min(1, f.y))) * 57.2958; // + = nose up
    const fwd = dot(v, f), ax = (fwd - (tr.lastFwd ?? fwd)) / dt / 9.81;
    const comp = [], lift = [];
    for (let i = 0; i < 4; i++) {
      const c = ctrl.wheelIsInContact(i);
      const len = ctrl.wheelSuspensionLength(i) ?? cfg.rest;
      comp.push(+(c ? (cfg.rest - len) / cfg.travel : -1).toFixed(2)); lift.push(c ? 0 : 1);
    }
    const mode = !input ? 'parked' : this.state.braking ? 'brake' : this.state.reversing ? 'reverse' : (input.throttle > 0 ? 'throttle' : 'coast');
    tr.buf.push({ t: +tr.t.toFixed(3), kmh: +(fwd * 3.6).toFixed(1), pitch: +pitch.toFixed(2), pitchRate: +(dot(w, left) * 57.2958).toFixed(1), vy: +v.y.toFixed(2),
      comp, lift, axG: +ax.toFixed(2), jerk: +((ax - tr.lastAx) / dt).toFixed(1), engine: +engine.toFixed(0), brake: +brake.toFixed(1), hb: !!hb, boost: !!boost,
      inS: input ? +(input.reverse || 0).toFixed(2) : 0, inW: input ? +(input.throttle || 0).toFixed(2) : 0, mode });
    if (tr.buf.length > 180) tr.buf.shift();
    tr.lastAx = ax; tr.lastFwd = fwd;
  }

  /** Per-wheel data for rendering (chassis-space hard point + suspension). */
  wheel(i) {
    const c = this.ctrl;
    return {
      conn: this.wheelPos[i],
      susp: c.wheelSuspensionLength(i) ?? this.cfg.rest,
      steer: c.wheelSteering(i) ?? 0,
      spin: c.wheelRotation(i) ?? 0,
      contact: c.wheelIsInContact(i),
    };
  }
}
