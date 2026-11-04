// Police car: a TrafficCar (cheap kinematic lane follower) with a flashing light bar and
// three behaviours: 'route' (A* lane route toward the player), 'chase' (direct steering when
// within ~40 m with a clear line - boxes in / rams, never shoots), 'patrol' (wander lanes).
import * as THREE from 'three';
import { TrafficCar } from '../traffic/trafficCar.js';
import { groups, GROUP } from '../physics/physicsWorld.js';

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
    if (this.mode !== 'chase') { super.update(dt, ctx); return; }
    // Direct chase: steer toward the player, slow to box them in, nudge/ram when close.
    const tgt = ctx.target, dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let yaw = Math.atan2(this.fwd.x, this.fwd.z);
    let dy = want - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += Math.max(-1.8 * dt, Math.min(1.8 * dt, dy));
    // Box in: stop half a car length + 3 m away (ram only if the player keeps moving).
    const stopD = this.cfg.L / 2 + 3.0, moving = (ctx.targetSpeed || 0) > 3;
    const speedWant = d < stopD + 2 ? (moving ? 8 : Math.max(0, (d - stopD) * 2)) : Math.min(17, 6 + d * 0.5);
    this.v += Math.max(-9 * dt, Math.min(4 * dt, speedWant - this.v));
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
