// The player's guns (on foot only): input (LMB fire, RMB aim, R reload, 1-4 select, Q
// holster/draw), third-person hold pose with two-bone IK (right hand on the grip, left hand
// on the foregrip / supporting the pistol), holstered guns on the hip / back, the first-person
// viewmodel item, hitscan from the camera through the crosshair, effects, sounds, damage and
// crime heat.
import * as THREE from 'three';
import { WEAPONS, ORDER, CAR_DMG, hitDamage } from './weaponStats.js';
import { createArsenal } from './arsenal.js';
import { createGun, animateGun } from './gunModels.js';
import { createGunFx } from './gunFx.js';
import { createHitscan } from './hitscan.js';
import { solveArm, handWorld } from './ik.js';
import { createWeaponHud } from '../ui/weaponHud.js';
import { damageCar } from '../combat/carDamage.js';

const RIGHT_POLE = new THREE.Vector3(-0.7, -1, -0.35), LEFT_POLE = new THREE.Vector3(0.7, -1, -0.35);
const Y = new THREE.Vector3(0, 1, 0), Zv = new THREE.Vector3(0, 0, 1);
// Hold poses: grip point in hips-local space (character +Z forward, +X = the character's left).
const POSE = {
  pistol: { ready: [-0.2, 0.26, 0.24], aim: [-0.07, 0.56, 0.44], readyPitch: 0.75 },
  long: { ready: [-0.12, 0.4, 0.12], aim: [-0.11, 0.54, 0.13], readyPitch: 0.35 },
};

export function createPlayerWeapons({ scene, camera, controls, physics, world, peds, police, vehicles, traffic, breakables, particles, audio, wanted, combat, viewmodel, theft }) {
  const arsenal = createArsenal();
  const hud = createWeaponHud();
  const fx = createGunFx(scene);
  const hitscan = createHitscan({ physics, world, peds, police, vehicles, traffic, breakables });
  const player = controls.player, ch = player.character, B = ch.bones, ps = player.state;
  const input = controls.input;

  // In-hand (world) guns, holstered guns (on bones) and viewmodel guns, one of each per weapon.
  const hand = {}, holster = {}, vm = {};
  for (const id of ORDER) {
    hand[id] = createGun(id); hand[id].group.visible = false; scene.add(hand[id].group);
    holster[id] = createGun(id);
    vm[id] = createGun(id, { shadow: false }); vm[id].group.rotation.y = Math.PI;
    const h = holster[id].group;
    if (id === 'pistol') {
      B.hips.add(h); h.position.set(-0.2, -0.02, 0.03); h.rotation.set(Math.PI / 2, 0, 0); // on the right hip, muzzle down
    } else {
      B.torso.add(h);
      const k = ORDER.indexOf(id) - 1; // 0..2
      h.position.set(0.02 - k * 0.03, 0.3, -0.16 - k * 0.035);
      h.quaternion.setFromUnitVectors(Zv, new THREE.Vector3(k % 2 ? -0.5 : 0.5, 0.86, 0).normalize()); // slung across the back
      h.rotateZ(Math.PI / 2);
    }
    h.visible = false;
  }

  const st = {
    aimBlend: 0, armedBlend: 0, recoil: 0, kick: 0, lastFireT: -9, t: 0, shotsFiredHeat: 0, lastHeatT: -9, copCarHeatT: -9,
    shot: new Set(), lastHit: null, fired: 0, hits: 0, lastShot: null, viewItem: null, tracerN: 0,
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), aimPoint = new THREE.Vector3(), grip = new THREE.Vector3(), dirV = new THREE.Vector3();
  const camFwd = new THREE.Vector3(), origin = new THREE.Vector3(), muzzleW = new THREE.Vector3(), basis = new THREE.Matrix4(), xAx = new THREE.Vector3(), yAx = new THREE.Vector3();
  const playerChest = () => tmp2.copy(player.position).setY(player.position.y + 1.35);

  function onFoot() { return controls.mode === 'walk' && !combat.ko && !(world.cutscene?.active); }

  /** Random direction inside a cone of half-angle a around d. */
  function jitter(d, a, out) {
    if (a <= 0) return out.copy(d);
    const u = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.tan(a);
    xAx.crossVectors(d, Math.abs(d.y) > 0.95 ? Zv : Y).normalize();
    yAx.crossVectors(xAx, d);
    return out.copy(d).addScaledVector(xAx, Math.cos(u) * r).addScaledVector(yAx, Math.sin(u) * r).normalize();
  }

  /** Every crime goes through the witness system (crimeWitness.js). */
  function heat(kind, victim = null) { world.crimes?.report(kind, player.position, victim ? { victim } : {}); }

  /** Apply one hit. Returns true if a person was hit. */
  function applyHit(W, h) {
    if (h.kind === 'none') return false;
    st.lastHit = { kind: h.kind, zone: h.zone || null, dist: +h.dist.toFixed(1) };
    if (h.kind === 'animal') { world.rural?.animals?.hit(h.ref); return false; } // scatter only: no injury, impact/decal or hit score
    if (h.kind === 'ped' || h.kind === 'officer') {
      const dmg = hitDamage(W, h.zone, h.dist);
      fx.impact(h.point, h.normal, 'body');
      let killed;
      const isCop = h.kind === 'officer' || h.ref?.role === 'cop'; // officers on foot and the cops at the station
      if (h.kind === 'ped' && !isCop) {
        killed = peds.shoot(h.ref, dmg, player.position);
        const p = h.ref;
        if (!st.shot.has(p)) { st.shot.add(p); heat('shootCiv', killed ? null : { ref: p, alive: () => p.state !== 'dead' && p.state !== 'down' }); }
        if (killed) heat('killCiv');
      } else {
        // Hitting a police officer: 5 stars straight away, witnesses or not (crimeWitness alwaysKnown).
        const o = h.ref;
        killed = h.kind === 'officer' ? police.foot.damage(o, dmg) : peds.shoot(o, dmg, player.position);
        world.crimes?.report('shootCop', player.position, { alwaysKnown: true, minStars: 5, amount: st.shot.has(o) ? 0 : undefined });
        st.shot.add(o);
        if (killed) world.crimes?.report('killCop', player.position, { alwaysKnown: true, minStars: 5 });
      }
      st.hits++;
      hud.hit(killed);
      return true;
    }
    if (h.kind === 'car') {
      damageCar(h.ref, W.dmg * CAR_DMG);
      fx.impact(h.point, h.normal, 'car');
      if (h.police && st.t - st.copCarHeatT > 3) { st.copCarHeatT = st.t; const pc = h.ref; heat('policeDamage', { ref: pc, alive: () => !pc.dead }); }
      return false;
    }
    if (h.kind === 'prop') {
      const it = h.ref;
      fx.impact(h.point, h.normal, 'metal');
      it.bulletDmg = (it.bulletDmg || 0) + W.dmg;
      if (!it.broken && it.bulletDmg >= it.set.toughness * 5) {
        breakables.breakItem(it, tmp.subVectors(h.point, player.position));
        if (it.set.sparks) particles.sparks(new THREE.Vector3(it.x, it.y + it.set.h * 0.85, it.z));
        audio.snap();
        combat.emit('propBroken', { item: it, byPlayer: true, x: it.x, z: it.z });
      }
      return false;
    }
    fx.impact(h.point, h.normal, h.kind === 'terrain' ? 'terrain' : 'wall');
    fx.decal(h.point, h.normal);
    return false;
  }

  /** One trigger pull: n rays (shotgun pellets) from the camera through the crosshair. */
  function fire(W, n, move) {
    st.fired++; st.lastFireT = st.t;
    camera.getWorldDirection(camFwd);
    // Start the ray level with the player (skip anything between the camera and the player).
    const skip = Math.max(0, playerChest().sub(camera.position).dot(camFwd));
    origin.copy(camera.position).addScaledVector(camFwd, skip);
    const spread = arsenal.spread(move) * (st.aimBlend > 0.5 ? 0.7 : 1);
    let firstHit = null;
    for (let i = 0; i < n; i++) {
      const d = jitter(camFwd, n > 1 ? spread : spread * (i === 0 ? 1 : 1), dirV);
      const h = hitscan.cast(origin, d, W.range);
      applyHit(W, h);
      if (!firstHit || i < 2) {
        // Tracers on ~1 in 3 shots (shotgun: up to 2 pellets per shot).
        if ((st.tracerN++ % 3 === 0) || (n > 1 && i < 2)) fx.tracer(muzzleW, h.point);
      }
      firstHit = firstHit || h;
    }
    st.lastShot = { kind: firstHit.kind, dist: +firstHit.dist.toFixed(1), zone: firstHit.zone || null, n };
    fx.muzzle(muzzleW, tmp.copy(firstHit.point).sub(muzzleW).normalize(), { scale: W.id === 'shotgun' ? 1.4 : W.id === 'pistol' ? 0.8 : 1 });
    audio.gunshot(W.sound, 1);
    st.kick = 1;
    st.recoil = Math.min(0.2, st.recoil + W.kick);
    // Casing out of the right side of the gun (shotguns eject on the pump).
    if (W.id !== 'shotgun') ejectCasing(W);
    // Everybody within 40 m reacts; witnessed gunfire is a crime (capped per burst).
    peds.alarm?.(player.position, 40);
    world.rural?.animals?.alarm(player.position);
    if (st.t - st.lastHeatT > 2.5 && st.shotsFiredHeat < 40 && world.crimes?.isWitnessed(player.position)) { st.lastHeatT = st.t; st.shotsFiredHeat += 10; heat('shotsFired'); }
  }

  function ejectCasing(W) {
    const g = controls.cameraMode === 'first' ? null : hand[W.id].group;
    if (g) {
      g.updateMatrixWorld(true);
      tmp.set(0, 0.08, 0.05).applyMatrix4(g.matrixWorld);
      tmp2.set(-1, 0, 0).transformDirection(g.matrixWorld);
    } else {
      tmp.copy(muzzleW).addScaledVector(camFwd, -0.25);
      tmp2.set(1, 0, 0).transformDirection(camera.matrixWorld);
    }
    fx.casing(tmp, tmp2);
  }

  /** Third-person: place the in-hand gun + IK both arms onto it. */
  function poseThirdPerson(W, dt, reloadK) {
    const long = W.long, P = long ? POSE.long : POSE.pistol;
    const gun = hand[W.id];
    // Rifle stance: left shoulder forward a little.
    if (long) B.torso.rotation.y += -0.45 * st.armedBlend;
    ch.root.updateMatrixWorld(true);
    const a = st.aimBlend;
    grip.set(P.ready[0] + (P.aim[0] - P.ready[0]) * a, P.ready[1] + (P.aim[1] - P.ready[1]) * a, P.ready[2] + (P.aim[2] - P.ready[2]) * a);
    // Aim pitch moves the gun up / down a little (and the gun points at the aim point).
    camera.getWorldDirection(camFwd);
    grip.y += Math.max(-0.2, Math.min(0.2, camFwd.y * 0.25)) * a;
    B.hips.localToWorld(grip);
    // Direction: at the crosshair target when aiming, low ready otherwise.
    const ready = tmp.set(0, -Math.sin(P.readyPitch), Math.cos(P.readyPitch)).applyQuaternion(ch.root.quaternion);
    dirV.subVectors(aimPoint, grip).normalize().multiplyScalar(a).addScaledVector(ready, 1 - a).normalize();
    xAx.crossVectors(Y, dirV).normalize();
    yAx.crossVectors(dirV, xAx);
    basis.makeBasis(xAx, yAx, dirV);
    gun.group.quaternion.setFromRotationMatrix(basis);
    gun.group.position.copy(grip);
    gun.group.rotateX(-st.kick * W.gunKick * 0.18);
    gun.group.updateMatrixWorld(true);
    // Right hand on the grip.
    solveArm(B.rShoulder, B.rElbow, grip, RIGHT_POLE);
    // Left hand: foregrip (long guns), supporting the pistol when aiming; reload = to the magazine.
    let left = null;
    if (long) left = tmp.set(...gun.spec.fore).applyMatrix4(gun.group.matrixWorld);
    else if (a > 0.3) left = tmp.set(0.035, -0.02, 0.005).applyMatrix4(gun.group.matrixWorld);
    if (reloadK != null) {
      const m = tmp2.set(...gun.spec.mag).applyMatrix4(gun.group.matrixWorld);
      const belt = new THREE.Vector3(0.12, 0.02, 0.12); B.hips.localToWorld(belt);
      const k = Math.sin(reloadK * Math.PI);
      left = (left ? left.clone() : m.clone()).lerp(reloadK < 0.5 ? m : belt, Math.min(1, k * 1.4));
    }
    if (left) solveArm(B.lShoulder, B.lElbow, left, LEFT_POLE);
    muzzleW.set(...gun.spec.muzzle).applyMatrix4(gun.group.matrixWorld);
  }

  const api = {
    arsenal, hud, fx, hitscan, st, hand, holster, vm,
    get aiming() { return st.aimBlend > 0.5; },
    /** Test helper: one shot of weapon `id` along a ray (damage, heat, effects - no ammo used). */
    debugShot(o, d, id = arsenal.weapon.id) {
      const W = WEAPONS[id], dir = new THREE.Vector3(d.x, d.y, d.z).normalize();
      const h = hitscan.cast(new THREE.Vector3(o.x, o.y, o.z), dir, W.range);
      applyHit(W, h);
      return { kind: h.kind, zone: h.zone || null, dist: +h.dist.toFixed(2), dmg: h.zone ? +hitDamage(W, h.zone, h.dist).toFixed(2) : null };
    },
    /** Numbers for tests: grip->right hand, foregrip->left hand, muzzle ahead of the body. */
    holdCheck() {
      const W = arsenal.weapon, gun = hand[W.id];
      if (!gun.group.visible) return null;
      const r = handWorld(B.rElbow), l = handWorld(B.lElbow);
      const g = new THREE.Vector3(...gun.spec.grip).applyMatrix4(gun.group.matrixWorld);
      const f = gun.spec.fore ? new THREE.Vector3(...gun.spec.fore).applyMatrix4(gun.group.matrixWorld) : null;
      const m = new THREE.Vector3(...gun.spec.muzzle).applyMatrix4(gun.group.matrixWorld);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.root.quaternion);
      const ahead = m.clone().sub(player.position).dot(fwd);
      return { weapon: W.id, gripToHand: +g.distanceTo(r).toFixed(3), foreToHand: f ? +f.distanceTo(l).toFixed(3) : null, muzzleAhead: +ahead.toFixed(3) };
    },
    update(dt) {
      st.t += dt;
      const walk = onFoot();
      const fp = controls.cameraMode === 'first' && walk;
      if (!walk && !arsenal.state.holstered && controls.mode !== 'walk') arsenal.holster();
      // ---- input ------------------------------------------------------------------------
      let trig = false, trigP = false, rel = false;
      if (walk && !ps.action) {
        if (!input.down('KeyG')) for (let k = 1; k <= 4; k++) if (input.pressed(`Digit${k}`)) { if (!arsenal.select(k) && arsenal.state.owned.size) hud.state.note = 'not owned'; }
        if (input.pressed('KeyQ')) arsenal.toggleHolster();
        trig = input.down('Mouse0'); trigP = input.pressed('Mouse0'); rel = input.pressed('KeyR');
      }
      const W = arsenal.weapon, armed = walk && arsenal.armed;
      const aimHeld = armed && input.down('Mouse2');
      st.aimBlend += ((aimHeld ? 1 : 0) - st.aimBlend) * Math.min(1, dt * 10);
      st.armedBlend += ((armed ? 1 : 0) - st.armedBlend) * Math.min(1, dt * 8);
      ps.aim = { on: aimHeld, blend: st.aimBlend };
      ps.faceCam = armed && (aimHeld || st.t - st.lastFireT < 1.2 || trig);
      const move = Math.min(1, ps.speed / 7.6);
      // ---- aim point (crosshair target) ---------------------------------------------------
      if (armed) {
        camera.getWorldDirection(camFwd);
        const skip = Math.max(0, playerChest().sub(camera.position).dot(camFwd));
        origin.copy(camera.position).addScaledVector(camFwd, skip);
        const h = hitscan.cast(origin, camFwd, 150);
        aimPoint.copy(h.point);
      }
      // ---- weapon logic -------------------------------------------------------------------
      const before = arsenal.ammo.mag;
      const ev = walk ? arsenal.update(dt, { trigger: trig, triggerPressed: trigP, reload: rel, move }) : { fired: 0 };
      arsenal.tickAutoReload(dt);
      if (ev.dry) audio.gunClick('dry');
      if (ev.reloaded || ev.shellIn) audio.gunClick('mag', 0.8);
      if (ev.pumped) { audio.gunClick('pump', 0.9); if (W.id === 'shotgun') ejectCasing(W); }
      if (arsenal.state.reloading && arsenal.state.reloadT < dt * 1.5) audio.gunClick('mag', 0.6);
      // ---- visuals: which guns are where --------------------------------------------------
      const inHandId = armed ? W.id : null;
      for (const id of ORDER) {
        const owned = arsenal.owns(id);
        hand[id].group.visible = !fp && id === inHandId;
        holster[id].group.visible = owned && id !== inHandId && controls.mode !== 'drive' && !fp;
      }
      const reloadK = arsenal.reloadProgress, pumpK = arsenal.pumpProgress;
      st.kick = Math.max(0, st.kick - dt * 9);
      st.recoil *= Math.exp(-dt * 7);
      ps.recoil = st.recoil;
      if (ev.fired) {
        // Muzzle for the flash / tracers: third person uses last frame's gun pose.
        if (fp) { viewmodel.muzzle(muzzleW); muzzleW.applyMatrix4(camera.matrixWorld); }
        else if (inHandId) { const g = hand[inHandId].group; g.updateMatrixWorld(true); muzzleW.set(...hand[inHandId].spec.muzzle).applyMatrix4(g.matrixWorld); }
        fire(W, ev.fired, move);
      }
      if (!fp && inHandId) poseThirdPerson(W, dt, reloadK);
      if (inHandId) animateGun(hand[inHandId], { kick: st.kick, pump: pumpK, magOut: reloadK != null && !W.perShell ? Math.sin(reloadK * Math.PI) : 0 });
      // ---- first-person viewmodel ----------------------------------------------------------
      const vmItem = fp && inHandId ? vm[inHandId] : null;
      if (st.viewItem !== vmItem) { viewmodel.setItem(vmItem ? vmItem.group : null, vmItem ? vmItem.spec : null); st.viewItem = vmItem; }
      if (vmItem) animateGun(vmItem, { kick: st.kick, pump: pumpK, magOut: reloadK != null && !W.perShell ? Math.sin(reloadK * Math.PI) : 0 });
      viewmodel.update({
        active: fp && !world.cutscene?.active, dt, speed: ps.speed, look: ps.lastLook || { x: 0, y: 0 }, aim: st.aimBlend > 0.5,
        kick: ev.fired ? Math.min(1, W.gunKick + 0.3) : 0, reload: reloadK, reloadKind: W.perShell ? 'pump' : 'mag', pump: pumpK,
        dusk: world.lighting?.dusk || 0, aspect: camera.aspect, holster: !armed,
      });
      fx.update(dt);
      // ---- HUD -----------------------------------------------------------------------------
      const a = arsenal.ammo;
      const spreadPx = (arsenal.spread(move) / Math.tan((camera.fov * Math.PI) / 360)) * (window.innerHeight / 2);
      hud.update(dt, { visible: walk && arsenal.state.owned.size > 0 && armed, crosshair: armed && !fp ? true : armed && st.aimBlend < 0.5, name: W.name, mag: a.mag, reserve: a.reserve, magSize: W.mag, reloading: arsenal.state.reloading, spreadPx });
      void before;
    },
  };
  return api;
}
