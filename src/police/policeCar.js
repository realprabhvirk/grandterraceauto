// Police car: a TrafficCar (cheap kinematic lane follower) with a flashing light bar and
// three behaviours: 'route' (A* lane route toward the player), 'chase' (direct steering when
// within ~40 m with a clear line), 'patrol' (wander lanes). Chasing cops flank the player
// (3 m beside/behind) instead of ramming; after any contact they RECOVER for 1.5 s (brake to
// half the player's speed, steer away). Their collider ignores other cars (soft contact is
// resolved by the police manager), so a cop can never pin the player's car.
import * as THREE from 'three';
import { TrafficCar } from '../traffic/trafficCar.js';
import { groups, GROUP } from '../physics/physicsWorld.js';

/** Police body: solid for the walker / NPCs, but no rigid contact with cars (see policeManager). */
const G_POLICE = groups(GROUP.CAR, GROUP.STATIC | GROUP.PLAYER | GROUP.NPC);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const RED = new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), BLUE = new THREE.MeshBasicMaterial({ color: '#2a6bff' });
const OFF = new THREE.MeshBasicMaterial({ color: '#2a2a2e' });
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);

export class PoliceCar extends TrafficCar {
  constructor(opts) {
    super(opts);
    this.isPolice = true;
    this.mode = 'route';
    this.route = [];
    this.flash = 0;
    const c = this.cfg;
    const bar = new THREE.Group();
    this.lampL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.18), RED);
    this.lampR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.18), BLUE);
    this.lampL.position.set(0.24, 0, 0); this.lampR.position.set(-0.24, 0, 0);
    bar.add(this.lampL, this.lampR);
    bar.position.set(0, c.roof + 0.06, (c.roofSpan[0] + c.roofSpan[1]) / 2);
    this.model.add(bar);
    this.physics = opts.physics;
    this.chaseYaw = 0;
    this.body.collider(0).setCollisionGroups(G_POLICE);
    opts.physics.tag?.(this.body.collider(0), 'police sensor', String(opts.id));
    this.side = (parseInt(String(opts.id).replace(/D/g, ''), 10) || 0) % 2 ? 1 : -1; // flank side
    this.recoverT = 0; this.contactCd = 0; this.crewOut = 0;
  }

  pickExit(exits) { const next = this.route[0]; const e = exits.find((x) => x.lane === next); if (e) this.route.shift(); return e || null; }
  pickBranch(b) { if (this.route[0] === b.lane) { this.route.shift(); return true; } return false; }

  /** Lights + chase override. ctx adds { target: {x,z,y}, chase: bool }. */
  update(dt, ctx) {
    if (this.dead) { super.update(dt, ctx); return; }
    this.flash += dt;
    const on = Math.floor(this.flash * 6) % 2 === 0;
    this.lampL.material = on ? RED : OFF;
    this.lampR.material = on ? OFF : BLUE;
    this.recoverT -= dt; this.contactCd -= dt;
    let yaw = Math.atan2(this.fwd.x, this.fwd.z);
    // Officer out of the car: stay parked.
    if (this.crewOut > 0) { this.v = Math.max(0, this.v - 12 * dt); this.speed = this.v; this.directMove(dt, yaw); return; }
    if (this.mode !== 'chase') { if (ctx.routeCruise) this.cruise = ctx.routeCruise; super.update(dt, ctx); return; }
    const tgt = ctx.target, ts = ctx.targetSpeed || 0, tf = ctx.targetFwd, moving = ts > 3;
    const dx0 = tgt.x - this.pos.x, dz0 = tgt.z - this.pos.z, d0 = Math.hypot(dx0, dz0);
    // Goal: a flank point 3 m beside + 3 m behind a moving player, else the player.
    let gx = tgt.x, gz = tgt.z;
    if (moving && tf && d0 < 30) { gx = tgt.x - tf.x * 3 - tf.z * this.side * 3; gz = tgt.z - tf.z * 3 + tf.x * this.side * 3; }
    const dx = gx - this.pos.x, dz = gz - this.pos.z, d = Math.hypot(dx, dz);
    let want = Math.atan2(dx, dz);
    if (this.recoverT > 0) want = yaw + Math.max(-0.6, Math.min(0.6, angDiff(Math.atan2(-dx0, -dz0), yaw))); // steer away
    yaw += Math.max(-1.8 * dt, Math.min(1.8 * dt, angDiff(want, yaw)));
    const maxV = ctx.maxV || 17, stopD = this.cfg.L / 2 + 3.0;
    let speedWant;
    if (this.recoverT > 0) speedWant = 0.5 * ts;
    else if (!moving) speedWant = d0 < stopD + 2 ? Math.max(0, (d0 - stopD) * 2) : Math.min(maxV, 6 + d0 * 0.5);
    else speedWant = Math.min(maxV, Math.max(0, ts + (d - 2) * 0.3));
    // Close behind a fast player: never faster than 0.95x their speed (5 stars: 1.0x).
    if (tf && ts > 8 && d0 < 6 && (this.pos.x - tgt.x) * tf.x + (this.pos.z - tgt.z) * tf.z < 0) speedWant = Math.min(speedWant, ts * (ctx.tailCap || 0.95));
    this.v += Math.max(-9 * dt, Math.min(2.8 * dt, speedWant - this.v)); // never out-accelerates a hero car
    // Don't drive into walls: if something solid is just ahead, stop and fall back to the lanes.
    const { world, RAPIER } = this.physics;
    const hit = world.castRay(new RAPIER.Ray({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z }, { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }), 3 + this.v * 0.3, true, undefined, STATIC_ONLY);
    if (hit) { this.v *= 0.5; this.blockedT = (this.blockedT || 0) + dt; } else this.blockedT = 0;
    this.speed = this.v;
    this.chaseYaw = yaw;
    this.directMove(dt, yaw);
  }

  /** Off-lane kinematic move used while chasing. */
  directMove(dt, yaw) {
    const T = this.terrain, c = this.cfg;
    const x = this.pos.x + Math.sin(yaw) * this.v * dt, z = this.pos.z + Math.cos(yaw) * this.v * dt;
    const hb = c.wheelBase / 2, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const hF = T.getHeight(x + fx * hb, z + fz * hb), hR = T.getHeight(x - fx * hb, z - fz * hb);
    const y = (hF + hR) / 2;
    this.pos.set(x, y, z);
    this.fwd.set(fx, 0, fz);
    this.group.position.set(x, y, z);
    this.group.rotation.set(-Math.atan2(hF - hR, c.wheelBase), yaw, 0, 'YXZ');
    this.group.updateMatrixWorld(true);
    this.body.setNextKinematicTranslation({ x, y, z });
    const q = this.group.quaternion;
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    this.syncWheels(dt);
    this.wheels.instanceMatrix.needsUpdate = true;
  }
}
