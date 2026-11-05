// Armed police (3+ stars): officers on foot carry pistols (3 stars) or SMGs (4-5 stars, one
// officer with a rifle), and patrol cars in a chase shoot from the window at 3+ stars. They only
// fire with line of sight within ~40 m, in bursts; accuracy ~35% at 20 m, worse with distance
// and the player's speed. On foot the player takes bullet damage; in a car only the car does.
// Officers hold the gun with the same two-bone IK as the player and use the same effects.
import * as THREE from 'three';
import { createGun, animateGun } from '../weapons/gunModels.js';
import { WEAPONS, COP_DMG } from '../weapons/weaponStats.js';
import { solveArm } from '../weapons/ik.js';
import { damageCar } from '../combat/carDamage.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

export const COP_FIRE = { range: 40, acc20: 0.35, minStars: 3, burst: { pistol: [3, 0.3, 1.6], smg: [6, 0.12, 1.9], rifle: [3, 0.25, 1.8] } };
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);
const RIGHT_POLE = new THREE.Vector3(-0.7, -1, -0.35), LEFT_POLE = new THREE.Vector3(0.7, -1, -0.35), Y = new THREE.Vector3(0, 1, 0);

/** Accuracy (hit chance) for distance d and target speed v. */
export function copAccuracy(d, v = 0) {
  const base = COP_FIRE.acc20 * Math.pow(20 / Math.max(4, d), 0.8);
  return Math.max(0.04, Math.min(0.65, base)) / (1 + Math.max(0, v) / 7);
}
/** Which gun an officer gets at this wanted level (null = unarmed). k = officer index. */
export function copWeapon(stars, k = 0) {
  if (stars < COP_FIRE.minStars) return null;
  if (stars === 3) return 'pistol';
  return k === 0 ? 'rifle' : 'smg';
}

export function createCopGuns({ scene, police, controls, combat, world, physics, audio, fx }) {
  const rng = makeRng(3131);
  const st = { shots: 0, hits: 0, carHits: 0, armed: 0, lastShooter: null };
  const tmp = new THREE.Vector3(), grip = new THREE.Vector3(), dir = new THREE.Vector3(), xA = new THREE.Vector3(), yA = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const target = new THREE.Vector3(), muzzle = new THREE.Vector3();

  function los(from, to) {
    const d = from.distanceTo(to);
    if (d < 0.5) return true;
    const hit = physics.world.castRay(new physics.RAPIER.Ray(from, { x: (to.x - from.x) / d, y: (to.y - from.y) / d, z: (to.z - from.z) / d }), d, true, undefined, STATIC_ONLY);
    return !hit || hit.timeOfImpact > d - 0.6;
  }
  function playerTarget() {
    const inCar = controls.mode === 'drive' && controls.car;
    const p = inCar ? controls.car.position : controls.player.position;
    target.set(p.x, p.y + (inCar ? 0.9 : 1.2), p.z);
    return { inCar, speed: inCar ? Math.abs(controls.car.body.state.speed) : controls.player.state.speed };
  }

  /** One shot from muzzle at the player. */
  function shoot(id, from, tinfo, shooter) {
    const W = WEAPONS[id], d = from.distanceTo(target);
    st.shots++; st.lastShooter = shooter;
    dir.subVectors(target, from).normalize();
    fx.muzzle(from, dir, { light: false, scale: 0.9 });
    const lp = controls.focus(), dl = Math.hypot(from.x - lp.x, from.z - lp.z);
    audio.gunshot(W.sound, Math.pow(Math.max(0, 1 - dl / 140), 1.5));
    if (rng.next() < copAccuracy(d, tinfo.speed)) {
      st.hits++;
      if (tinfo.inCar) { st.carHits++; damageCar(controls.car, COP_DMG[id] * 0.6); fx.impact(target, dir.clone().negate(), 'car'); }
      else combat.damagePlayer(COP_DMG[id], 'bullet');
      if (rng.next() < 0.5) fx.tracer(from, target);
    } else {
      // Miss: the round lands somewhere around the player.
      tmp.copy(target).add(new THREE.Vector3((rng.next() - 0.5) * 3, -1.1 - rng.next() * 0.4, (rng.next() - 0.5) * 3));
      dir.subVectors(tmp, from).normalize();
      const hit = physics.world.castRayAndGetNormal(new physics.RAPIER.Ray(from, dir), 80, true, undefined, STATIC_ONLY);
      if (hit) { const p = from.clone().addScaledVector(dir, hit.timeOfImpact), n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z); fx.impact(p, n, hit.collider.shape.type === physics.RAPIER.ShapeType.HeightField ? 'terrain' : 'wall'); if (rng.next() < 0.4) fx.tracer(from, p); }
    }
  }

  /** Burst timing: returns true when this shooter should fire now. */
  function burstTick(s, id, dt, canFire) {
    const [n, gap, pause] = COP_FIRE.burst[id];
    s.t -= dt;
    if (!canFire) { s.left = 0; s.t = Math.max(s.t, 0.4 + rng.next() * 0.5); return false; }
    if (s.t > 0) return false;
    if (s.left <= 0) s.left = n;
    s.left--;
    s.t = s.left > 0 ? gap : pause + rng.next() * 0.6;
    return true;
  }

  /** Officer hold pose (called right after the officer's animation). */
  function holdPose(o) {
    const g = o.gunObj, ch = o.ch, B = ch.bones, long = WEAPONS[o.gun].long;
    if (!g) return;
    if (o.action === 'grab' || o.state === 'dead') { g.group.visible = false; return; }
    g.group.visible = true;
    const aim = o.aimT > 0 ? 1 : 0;
    if (long) B.torso.rotation.y += -0.45;
    ch.root.updateMatrixWorld(true);
    const P = long ? (aim ? [-0.11, 0.54, 0.13] : [-0.12, 0.4, 0.12]) : (aim ? [-0.07, 0.56, 0.44] : [-0.2, 0.26, 0.24]);
    grip.set(...P); B.hips.localToWorld(grip);
    if (aim) dir.subVectors(target, grip).normalize();
    else dir.set(0, -Math.sin(long ? 0.35 : 0.75), Math.cos(long ? 0.35 : 0.75)).applyQuaternion(ch.root.quaternion);
    xA.crossVectors(Y, dir).normalize(); yA.crossVectors(dir, xA);
    m4.makeBasis(xA, yA, dir);
    g.group.quaternion.setFromRotationMatrix(m4);
    g.group.position.copy(grip);
    g.group.updateMatrixWorld(true);
    solveArm(B.rShoulder, B.rElbow, grip, RIGHT_POLE);
    if (long) solveArm(B.lShoulder, B.lElbow, tmp.set(...g.spec.fore).applyMatrix4(g.group.matrixWorld), LEFT_POLE);
    else if (aim) solveArm(B.lShoulder, B.lElbow, tmp.set(0.035, -0.02, 0.005).applyMatrix4(g.group.matrixWorld), LEFT_POLE);
    animateGun(g, { kick: o.kick || 0 });
  }

  function arm(o, id) {
    if (o.gun === id) return;
    if (o.gunObj) { scene.remove(o.gunObj.group); o.gunObj = null; }
    o.gun = id; o.burst = { t: 0.8 + rng.next(), left: 0 }; o.aimT = 0;
    if (id) { o.gunObj = createGun(id); scene.add(o.gunObj.group); o.afterAnimate = holdPose; }
    else o.afterAnimate = null;
  }

  return {
    st, arm,
    update(dt) {
      const stars = world.wanted?.stars || 0;
      const tinfo = playerTarget();
      const active = stars >= COP_FIRE.minStars && !police.st.busted && !combat.ko && !world.cutscene?.active;
      // --- officers on foot ---
      let k = 0;
      st.armed = 0;
      for (const o of police.foot.officers) {
        if (o.cutscene) { if (o.gunObj) o.gunObj.group.visible = false; continue; }
        if (o.state === 'dead') { if (o.gunObj) { scene.remove(o.gunObj.group); o.gunObj = null; o.afterAnimate = null; } continue; }
        arm(o, copWeapon(stars, k++));
        if (!o.gun) continue;
        st.armed++;
        o.gunAction = null;
        const d = Math.hypot(o.pos.x - target.x, o.pos.z - target.z);
        const can = active && o.sees && d < COP_FIRE.range && o.state !== 'exit' && o.state !== 'return';
        o.aimT = can ? 0.6 : Math.max(0, (o.aimT || 0) - dt);
        o.kick = Math.max(0, (o.kick || 0) - dt * 9);
        if (can) { let dy = Math.atan2(target.x - o.pos.x, target.z - o.pos.z) - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 8); }
        if (burstTick(o.burst, o.gun, dt, can) && o.gunObj) {
          o.gunObj.group.updateMatrixWorld(true);
          muzzle.set(...o.gunObj.spec.muzzle).applyMatrix4(o.gunObj.group.matrixWorld);
          o.kick = 1;
          shoot(o.gun, muzzle, tinfo, o);
        }
      }
      // --- patrol cars in a chase shoot from the driver's window ---
      for (const c of police.cars) {
        if (c.dead || c.crewOut) continue;
        c.burst = c.burst || { t: 1 + rng.next(), left: 0 };
        const id = stars >= 4 ? 'smg' : 'pistol';
        const d = Math.hypot(c.pos.x - target.x, c.pos.z - target.z);
        let can = active && c.mode === 'chase' && d < COP_FIRE.range && d > 4;
        if (can && c.burst.t <= 0 && c.burst.left <= 0) { tmp.set(c.pos.x, c.pos.y + 1.3, c.pos.z); can = los(tmp, target); c.losOk = can; }
        else if (can) can = c.losOk !== false;
        if (burstTick(c.burst, id, dt, can)) {
          c.group.updateMatrixWorld(true);
          muzzle.set(-(c.cfg.W / 2 + 0.25), c.cfg.belt + 0.3, c.cfg.seat[2] + 0.3).applyMatrix4(c.group.matrixWorld);
          shoot(id, muzzle, tinfo, c);
        }
      }
    },
  };
}
