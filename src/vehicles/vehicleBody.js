// Arcade car physics on top of Rapier's DynamicRayCastVehicleController.
// No three.js here, so it can be tuned/tested in plain Node.
//
// Car-local: +Z forward, +Y up, +X left. Body origin = ground level between the axles.
// Assists (all deliberately "forgiving"): speed-sensitive eased steering, lateral grip
// assist, roll damping, upright torque, downforce, anti-launch clamp, handbrake drift.
import { G_CAR, groups, GROUP } from '../physics/physicsWorld.js';

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
    // Lower body + cabin boxes (rounded-ish feel comes from the assists, not the shape).
    const bodyH = (cfg.belt - cfg.clearance) / 2;
    const zMid = cfg.frontOverhang - cfg.L / 2 + cfg.wheelBase / 2;
    const main = RAPIER.ColliderDesc.cuboid(cfg.W / 2 - 0.02, bodyH, cfg.L / 2 - 0.04)
      .setTranslation(0, cfg.clearance + bodyH, zMid)
      .setCollisionGroups(G_CAR).setFriction(0.4).setRestitution(0.15);
    // Mass properties: low centre of mass + extra roll inertia = hard to flip (arcade).
    const m = cfg.mass, Lx = cfg.L, Wx = cfg.W, Hx = 1.2;
    main.setMassProperties(m, { x: 0, y: 0.36, z: 0.05 },
      { x: (m / 12) * (Hx * Hx + Lx * Lx) * 1.2, y: (m / 12) * (Wx * Wx + Lx * Lx) * 1.1, z: (m / 12) * (Wx * Wx + Hx * Hx) * 1.8 },
      { x: 0, y: 0, z: 0, w: 1 });
    this.colliders = [world.createCollider(main, this.body)];
    const [c0, c1] = cfg.cabin;
    const cabinH = (cfg.roof - cfg.belt) / 2;
    const cabin = RAPIER.ColliderDesc.cuboid(cfg.W / 2 - 0.16, cabinH, (c1 - c0) / 2 - 0.05)
      .setTranslation(0, cfg.belt + cabinH, (c0 + c1) / 2)
      .setCollisionGroups(G_CAR).setFriction(0.4).setDensity(0);
    this.colliders.push(world.createCollider(cabin, this.body));
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
    const thr = parked ? 0 : input.throttle, rev = parked ? 0 : input.reverse;
    const boost = !parked && input.boost && thr > 0;

    // --- Steering: eased, with less lock at speed ---------------------------------
    const lock = cfg.steer * Math.max(0.22, 1 / (1 + Math.abs(speed) / 11));
    const target = parked ? 0 : input.steer * lock;
    const rate = (Math.abs(target) < Math.abs(this.steer) ? 4.0 : 2.6) * dt;
    this.steer += Math.max(-rate, Math.min(rate, target - this.steer));
    ctrl.setWheelSteering(0, this.steer);
    ctrl.setWheelSteering(1, this.steer);

    // --- Engine / brakes ------------------------------------------------------------
    let engine = 0, brake = 0;
    st.braking = false; st.reversing = false;
    if (parked) {
      brake = cfg.brake * 2;
    } else if (thr > 0 && speed > -1) {
      const top = cfg.top * (boost ? 1.15 : 1);
      const taper = Math.max(0, 1 - (Math.max(0, speed) / top) ** 2);
      engine = cfg.engine * thr * (boost ? 1.55 : 1) * taper;
    } else if (thr > 0) {
      brake = cfg.brake; st.braking = true;
    } else if (rev > 0 && speed > 1) {
      brake = cfg.brake * rev; st.braking = true;
    } else if (rev > 0) {
      engine = speed > -9 ? -cfg.engine * 0.7 * rev : 0;
      st.reversing = true;
    } else {
      brake = 1.2; // engine braking / rolling resistance
    }
    for (let i = 0; i < 4; i++) {
      ctrl.setWheelEngineForce(i, this.driven.includes(i) ? engine * (this.driven.length === 4 ? 0.6 : 1) : 0);
      ctrl.setWheelBrake(i, brake);
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
      // Downforce grows with speed: keeps it planted over crests.
      const df = m * Math.min(9, 0.012 * fwdSpeed * fwdSpeed) * dt;
      body.applyImpulse({ x: -up.x * df, y: -up.y * df, z: -up.z * df }, true);
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
    // Hard speed cap.
    const top = cfg.top * (boost ? 1.15 : 1) * 1.05;
    if (Math.abs(fwdSpeed) > top) {
      const s = top / Math.abs(fwdSpeed);
      body.setLinvel({ x: v.x * s, y: v.y, z: v.z * s }, true);
    }
    // Collision strength (sudden velocity change not explained by braking).
    const dv = Math.hypot(v.x - this.lastVel.x, v.y - this.lastVel.y, v.z - this.lastVel.z);
    this.impact = dv > 2.2 ? Math.min(1, (dv - 2.2) / 6) : 0;
    this.lastVel = { x: v.x, y: v.y, z: v.z };
    st.throttle = thr;
    st.boost = boost;
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
