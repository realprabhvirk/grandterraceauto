// One ambient traffic car: kinematic path-following along the lane graph (cheap - no
// raycast vehicle), with suspension-style pitch/roll visuals, steering/spinning wheels and
// a kinematic collider so the player's real car collides with it.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { CAR_MAT } from '../vehicles/carMaterials.js';
import { buildCarGeometry } from '../vehicles/carModels.js';
import { G_CAR } from '../physics/physicsWorld.js';
import { sampleLane } from './laneGraph.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const P0 = {}, P1 = {};

export class TrafficCar {
  constructor({ id, type, cfg, paint, lane, s, cruise, physics, scene, wheels, wheelOffset, terrain, rng }) {
    Object.assign(this, { id, type, cfg, paint, lane, s, cruise, terrain, wheels, wheelOffset, rng });
    this.v = cruise * 0.6;
    this.latOff = 0;      // sideways shift to pass kerb-parked cars
    this.blockedT = 0;
    this.honked = false;
    this.wait = 0;
    this.spin = 0;
    this.steer = 0;
    this.pitch = 0; this.roll = 0;
    this.lights = false;
    this.speed = 0;

    const g = buildCarGeometry(type, cfg, paint);
    this.group = new THREE.Group();
    this.group.name = `traffic-${id}`;
    this.model = new THREE.Group();
    this.model.position.y = 0.04;
    this.group.add(this.model);
    const mk = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; this.model.add(m); return m; };
    this.paintMesh = mk(g.paint, MAT.solid);
    this.health = 100;
    mk(g.glass, CAR_MAT.glass, false);
    this.headMesh = mk(g.head, CAR_MAT.headOff, false);
    this.tailMesh = mk(g.tail, CAR_MAT.tailOff, false);
    mk(g.reverse, CAR_MAT.revOff, false);
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 11).rotateX(-Math.PI / 2).translate(0, 0.08, g.anchors.headZ + 6.2), CAR_MAT.beam);
    wash.visible = false;
    this.model.add(wash);
    this.wash = wash;
    scene.add(this.group);

    const { world, RAPIER } = physics;
    const start = sampleLane(lane, s, {});
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, terrain.getHeight(start.x, start.z), start.z));
    const h = (cfg.roof - cfg.clearance) / 2;
    const zMid = cfg.frontOverhang - cfg.L / 2 + cfg.wheelBase / 2;
    const col = world.createCollider(RAPIER.ColliderDesc.cuboid(cfg.W / 2, h, cfg.L / 2).setTranslation(0, cfg.clearance + h, zMid).setCollisionGroups(G_CAR), this.body);
    physics.tag?.(col, 'traffic', id);
    this.pos = new THREE.Vector3(start.x, 0, start.z);
    this.fwd = new THREE.Vector3(start.tx, 0, start.tz);
  }

  get position() { return this.pos; }
  setLights(on) { this.lights = on; this.headMesh.material = on ? CAR_MAT.headOn : CAR_MAT.headOff; this.wash.visible = on; }

  /** Advance along the lane network. ctx: { lanes, obstacles, honk(car) } */
  update(dt, ctx) {
    if (this.dead) { this.v = 0; this.speed = 0; this.sync(dt); return; } // wrecked: stays put
    const cfg = this.cfg;
    // --- Target speed: cruise, slower on curves and connectors ----------------------------
    sampleLane(this.lane, this.s, P0);
    sampleLane(this.lane, this.s + 14, P1);
    const turn = Math.acos(Math.max(-1, Math.min(1, P0.tx * P1.tx + P0.tz * P1.tz)));
    const base = this.lane.road?.highway ? (this.lane.road.ramp ? 20 : 25) : this.cruise; // motorway 90 km/h, ramps 72
    let target = base * Math.max(0.42, 1 - turn * 1.1) * (this.lane.slow ? 0.6 : 1);

    // --- Obstacles ahead: keep a gap, swing out round parked cars ------------------------
    const fx = P0.tx, fz = P0.tz, rx = -fz, rz = fx; // right of travel
    let latWant = 0, gapV = Infinity, blockedByPlayer = false;
    for (const o of ctx.obstacles) {
      if (o.self === this) continue;
      const dx = o.x - P0.x, dz = o.z - P0.z;
      const ahead = dx * fx + dz * fz, lat = dx * rx + dz * rz;
      if (ahead < 0 || ahead > 26) continue;
      if (o.parked && Math.abs(lat) < 2.4 && ahead < 20) { latWant = lat < 0 ? 2.3 : -2.3; continue; } // pass on the side away from it
      if (Math.abs(lat - this.latOff) > 1.9) continue;
      const gap = ahead - (cfg.L / 2 + (o.len || 4.5) / 2);
      const v = Math.max(0, (gap - 2.5) * 0.9 + Math.max(0, o.speed || 0) * 0.6);
      if (v < gapV) { gapV = v; blockedByPlayer = !!o.player; }
    }
    target = Math.min(target, gapV);
    this.latOff += (latWant - this.latOff) * Math.min(1, dt * 1.4);

    // --- Give way when pulling out of a side road ------------------------------------------
    if (this.lane.giveWay && this.s < 1.5) {
      const gw = this.lane.giveWay;
      const busy = ctx.obstacles.some((o) => o.self !== this && !o.parked && Math.hypot(o.x - gw.x, o.z - gw.z) < 16 && (o.speed || 0) > 0.5);
      if (busy) target = 0;
    }

    // --- Traffic lights: stop at the line on red / amber (amber: go if too close to stop) ----
    const sig = this.lane.signal;
    this.atRed = false;
    if (sig) {
      const light = sig.j[sig.axis], dist = this.lane.len - this.s - 0.8;
      if (light !== 'green' && dist > -0.3 && dist < 45 && !(light === 'amber' && dist < this.v * 1.1)) {
        target = dist < 0.4 ? 0 : Math.min(target, Math.sqrt(2 * 3.5 * (dist - 0.4))); // brake to stop at the line
        this.atRed = true;
      }
    }

    // --- Accelerate / brake, honk once if the player blocks us for >6 s ---------------------
    const dv = target - this.v;
    this.v += Math.max(-7 * dt, Math.min(2.6 * dt, dv));
    this.v = Math.max(0, this.v);
    this.braking = dv < -0.5;
    if (this.v < 0.3 && blockedByPlayer) {
      this.blockedT += dt;
      if (this.blockedT > 6 && !this.honked) { this.honked = true; ctx.honk(this); }
    } else if (this.v > 1) { this.blockedT = 0; this.honked = false; }

    // --- Move along the lane (and onto the next one) --------------------------------------
    this.s += this.v * dt;
    for (const b of this.lane.branches) {
      if (b.atS > this.s - this.v * dt && b.atS <= this.s && (this.pickBranch ? this.pickBranch(b) : this.rng.next() < b.prob)) {
        this.s = this.s - b.atS;
        this.lane = ctx.lanes[b.lane];
        break;
      }
    }
    while (this.s > this.lane.len) {
      const over = this.s - this.lane.len;
      const exits = this.lane.exits;
      let pick = exits[0], r = this.rng.next();
      for (const e of exits) { if (r < e.prob) { pick = e; break; } r -= e.prob; }
      if (this.pickExit) pick = this.pickExit(exits) || pick; // police follow their A* route
      this.lane = ctx.lanes[pick.lane];
      this.s = pick.s + over;
    }
    this.speed = this.v;
    this.sync(dt);
  }

  /** Place body + visuals from lane position; fake suspension pitch/roll. */
  sync(dt) {
    const cfg = this.cfg, T = this.terrain;
    sampleLane(this.lane, this.s, P0);
    const rx = -P0.tz, rz = P0.tx;
    const x = P0.x + rx * this.latOff, z = P0.z + rz * this.latOff;
    const yaw = Math.atan2(P0.tx, P0.tz);
    // Curvature (for roll + front-wheel steer angle).
    sampleLane(this.lane, this.s + 3, P1);
    const dYaw = Math.atan2(Math.sin(Math.atan2(P1.tx, P1.tz) - yaw), Math.cos(Math.atan2(P1.tx, P1.tz) - yaw));
    const kappa = dYaw / 3;
    const hb = cfg.wheelBase / 2;
    const ny = this.pos.y; // bridge decks: stay up there if we're up there
    const hF = T.driveHeight ? T.driveHeight(x + P0.tx * hb, z + P0.tz * hb, ny) : T.getHeight(x + P0.tx * hb, z + P0.tz * hb);
    const hR = T.driveHeight ? T.driveHeight(x - P0.tx * hb, z - P0.tz * hb, ny) : T.getHeight(x - P0.tx * hb, z - P0.tz * hb);
    const pitchT = -Math.atan2(hF - hR, cfg.wheelBase) - (this.braking ? 0.02 : 0);
    const rollT = Math.max(-0.07, Math.min(0.07, this.v * this.v * kappa * 0.012));
    this.pitch += (pitchT - this.pitch) * Math.min(1, dt * 8);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 5);
    this.steer += (Math.atan(cfg.wheelBase * kappa) - this.steer) * Math.min(1, dt * 6);
    const y = (hF + hR) / 2 + Math.sin(this.s * 1.7) * 0.006;
    this.pos.set(x, y, z);
    this.fwd.set(P0.tx, 0, P0.tz);
    _e.set(this.pitch, yaw, this.roll);
    this.group.position.set(x, y, z);
    this.group.quaternion.setFromEuler(_e);
    this.group.updateMatrixWorld(true);
    this.body.setNextKinematicTranslation({ x, y, z });
    const q = this.group.quaternion;
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    this.tailMesh.material = this.braking ? CAR_MAT.tailBrake : this.lights ? CAR_MAT.tailRun : CAR_MAT.tailOff;

    this.syncWheels(dt);
  }

  /** Wheel instances follow the body (also used by police cars chasing off-lane). */
  syncWheels(dt) {
    const cfg = this.cfg;
    this.spin += (this.v * dt) / cfg.wheelR;
    const pts = [[cfg.track / 2, cfg.wheelBase / 2], [-cfg.track / 2, cfg.wheelBase / 2], [cfg.track / 2, -cfg.wheelBase / 2], [-cfg.track / 2, -cfg.wheelBase / 2]];
    pts.forEach(([wx, wz], i) => {
      _p.set(wx, cfg.wheelR + 0.04, wz).applyMatrix4(this.group.matrixWorld);
      const right = wx < 0;
      _q.copy(this.group.quaternion);
      if (i < 2) _q.multiply(_q2.setFromAxisAngle(Y, this.steer));
      if (right) _q.multiply(_q2.setFromAxisAngle(Y, Math.PI));
      _q.multiply(_q2.setFromAxisAngle(X, right ? -this.spin : this.spin));
      _s.set(cfg.wheelW, cfg.wheelR, cfg.wheelR);
      _m.compose(_p, _q, _s);
      this.wheels.setMatrixAt(this.wheelOffset + i, _m);
    });
  }
}
