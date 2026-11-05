// Third-person on foot: Rapier kinematic capsule + KinematicCharacterController
// (slopes, steps, snap-to-ground, collision with houses/fences/trunks/cars),
// camera-relative movement with smooth acceleration, Shift run, Space jump, Ctrl crouch,
// emotes on 1-4 (wave, dance, sit, point - any movement interrupts), orbit camera that
// pulls in when blocked.
import * as THREE from 'three';
import { createCharacter } from './character.js';
import { G_PLAYER, groups, GROUP } from '../physics/physicsWorld.js';

export const RADIUS = 0.32, HALF = 0.55; // capsule: total height 2*(HALF+RADIUS) = 1.74 m
const WALK = 4.2, RUN = 7.6, CROUCH = 1.9, ACCEL = 9, JUMP = 5.4, GRAVITY = -18;
const CAM = { dist: 4.6, min: 1.8, max: 8, height: 1.55, crouchHeight: 1.05, pitchMin: -0.35, pitchMax: 1.2 };
const EMOTES = { Digit1: 'wave', Digit2: 'dance', Digit3: 'sit', Digit4: 'point' }; // hold G + 1-4
export const FP_FOV = { min: 60, max: 100, def: 75 };

/** Ease the camera FOV toward f (snaps when close). */
function setFov(camera, f, dt) {
  if (Math.abs(camera.fov - f) < 0.05) return;
  camera.fov += (f - camera.fov) * Math.min(1, dt * 10);
  if (Math.abs(camera.fov - f) < 0.1) camera.fov = f;
  camera.updateProjectionMatrix();
}

export function createThirdPerson({ physics, scene, spawn }) {
  const { world, RAPIER } = physics;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.position.x, spawn.position.y + HALF + RADIUS + 0.05, spawn.position.z),
  );
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(G_PLAYER), body);
  const ctrl = world.createCharacterController(0.03);
  ctrl.setUp({ x: 0, y: 1, z: 0 });
  ctrl.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
  ctrl.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(60));
  ctrl.enableAutostep(0.45, 0.25, true);
  ctrl.enableSnapToGround(0.5);
  ctrl.setApplyImpulsesToDynamicBodies(false);

  const character = createCharacter();
  scene.add(character.root);

  const state = {
    yaw: spawn.yaw,           // camera yaw; forward = (sin yaw, 0, cos yaw)
    pitch: 0.18,
    facing: spawn.yaw,
    vy: 0,
    grounded: true,
    speed: 0,
    vel: new THREE.Vector3(),
    dist: CAM.dist,
    crouch: false,
    action: null,             // current emote
    jumpQueued: false,
    enabled: true,
    camHeight: CAM.height,
    firstPerson: false,
    fpPitch: 0,
    bob: 0,
    fpFov: FP_FOV.def,
    lockT: 0,               // stumble / cutscene: ignore movement input
    aim: null,              // set by the weapons: { on } (over-the-shoulder / ADS)
  };
  const pos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const move = new THREE.Vector3();

  // Render interpolation between the pose before and after the last fixed physics step.
  const prevT = new THREE.Vector3(), curT = new THREE.Vector3();
  let hasPrev = false;
  function syncVisual() {
    const t = body.translation();
    curT.set(t.x, t.y, t.z);
    const a = physics.alpha ?? 1;
    if (hasPrev && a < 1) curT.lerpVectors(prevT, curT, a);
    pos.set(curT.x, curT.y - HALF - RADIUS, curT.z);
    if (character.root.parent === scene) {
      character.root.position.copy(pos);
      character.root.rotation.set(0, state.facing, 0);
    }
  }
  syncVisual();

  /** Where the walk camera wants to be (no side effects except the blocked-ray test). */
  function cameraPose(outPos, outTarget) {
    outTarget.copy(pos).y += state.camHeight;
    // Over-the-shoulder while aiming: target slides right + closer camera.
    const ab = state.aim?.blend || 0;
    if (ab > 0.001) { outTarget.x += -Math.cos(state.yaw) * 0.55 * ab; outTarget.z += Math.sin(state.yaw) * 0.55 * ab; outTarget.y += 0.08 * ab; }
    const pitch = state.pitch - (state.recoil || 0) * 0.8;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    desired.set(-Math.sin(state.yaw) * cp, sp, -Math.cos(state.yaw) * cp);
    let dist = state.dist + (Math.min(state.dist, 2.3) - state.dist) * ab;
    const hit = world.castRay(new RAPIER.Ray(outTarget, desired), dist, true, undefined, groups(GROUP.PLAYER, GROUP.STATIC), collider);
    if (hit) dist = Math.max(0.6, hit.timeOfImpact - 0.25);
    // Pull in at once (never clip), ease back out (no flicker when the ray grazes something).
    state.pull = state.pull == null || dist < state.pull ? dist : state.pull + (dist - state.pull) * 0.12;
    outPos.copy(outTarget).addScaledVector(desired, state.pull);
  }

  return {
    get position() { return pos; },
    get state() { return state; },
    character,
    collider,
    cameraPose,

    /** Turn the walker on/off (off while driving: collider disabled, no movement). */
    /** Switch first-person on/off (hides the head, tighter near plane is set by the caller). */
    setFirstPerson(on) { state.firstPerson = on; character.setHeadVisible(!on); character.mesh.visible = !on; if (on) state.fpPitch = 0; },
    setEnabled(on) {
      state.enabled = on;
      collider.setEnabled(on);
      if (!on) { state.action = null; state.speed = 0; state.vel.set(0, 0, 0); }
    },
    /** Put the walker at a ground position facing yaw (used when leaving a car). */
    teleport(p, yaw) {
      body.setTranslation({ x: p.x, y: p.y + HALF + RADIUS + 0.03, z: p.z }, true);
      body.setNextKinematicTranslation({ x: p.x, y: p.y + HALF + RADIUS + 0.03, z: p.z });
      state.facing = yaw; state.yaw = yaw; state.vy = -1; state.grounded = true;
      hasPrev = false;
      syncVisual();
      pos.set(p.x, p.y, p.z);
    },

    /** Fixed-step physics update. */
    fixedUpdate(dt, input, active) {
      { const t0 = body.translation(); prevT.set(t0.x, t0.y, t0.z); hasPrev = true; }
      if (!state.enabled) return;
      move.set(0, 0, 0);
      if (state.lockT > 0) state.lockT -= dt;
      if (active && state.lockT <= 0) {
        const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
        const r = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
        if (f || r) {
          const sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
          // forward (sin, cos); right = (-cos, sin) for a camera looking along forward
          move.set(sy * f - cy * r, 0, cy * f + sy * r).normalize();
        }
        state.crouch = input.down('ControlLeft') || input.down('ControlRight');
      }
      const moving = move.lengthSq() > 0;
      const jump = active && state.jumpQueued;
      state.jumpQueued = false;
      if (moving || jump) state.action = null; // movement interrupts emotes
      const aiming = state.aim?.on;
      const run = active && !state.crouch && !aiming && (input.down('ShiftLeft') || input.down('ShiftRight'));
      const top = (!moving || state.action ? 0 : state.crouch ? CROUCH : run ? RUN : WALK) * (aiming ? 0.55 : 1); // aiming slows you down
      // Smooth acceleration toward the target velocity.
      const tv = move.clone().multiplyScalar(top);
      state.vel.lerp(tv, Math.min(1, dt * ACCEL));
      state.speed = Math.hypot(state.vel.x, state.vel.z);
      if (state.firstPerson) {
        state.facing = state.yaw; // first person: body always faces where you look
      } else if (state.faceCam) {
        // Armed + aiming / firing: face where the camera looks.
        let d = state.yaw - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        state.facing += d * Math.min(1, dt * 16);
      } else if (moving) {
        const target = Math.atan2(move.x, move.z);
        let d = target - state.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        state.facing += d * Math.min(1, dt * 12);
      }
      if (state.grounded) {
        state.vy = -1;
        if (jump && !state.crouch) { state.vy = JUMP; state.grounded = false; }
      } else {
        state.vy += GRAVITY * dt;
      }
      const dir = new THREE.Vector3(state.vel.x * dt, state.vy * dt, state.vel.z * dt);
      ctrl.computeColliderMovement(collider, dir, undefined, G_PLAYER);
      const m = ctrl.computedMovement();
      const t = body.translation();
      body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
      const wasAir = !state.grounded;
      state.grounded = ctrl.computedGrounded();
      if (state.grounded && wasAir) state.vy = -1;
      // Safety net: fell through the world -> back to spawn.
      if (t.y < -60) body.setNextKinematicTranslation({ x: spawn.position.x, y: spawn.position.y + 2, z: spawn.position.z });
    },

    /** Per-frame: animation + camera (when `active` drives the camera). */
    update(dt, input, camera, active, seated = null) {
      syncVisual();
      state.camHeight += ((state.crouch ? CAM.crouchHeight : CAM.height) - state.camHeight) * Math.min(1, dt * 8);
      character.animate({
        dt, speed: state.speed, grounded: state.grounded, crouch: state.crouch,
        action: seated ? 'seated' : state.action, steer: seated ? seated.steer : 0,
      });
      if (!active) return;
      // Edge-triggered keys are read per frame (physics may run 0 or 2 steps in a frame).
      if (input.pressed('Space')) state.jumpQueued = true;
      if (input.down('KeyG')) for (const [code, name] of Object.entries(EMOTES)) {
        if (input.pressed(code)) state.action = state.action === name ? null : name;
      }
      const look = input.look(dt);
      state.lastLook = look;
      state.yaw -= look.x * 0.0028;
      if (state.firstPerson) {
        // First person: eye at the head (head bone hidden), pitch +-85 deg, subtle walk bob.
        state.fpPitch = THREE.MathUtils.clamp(state.fpPitch + look.y * 0.0022, -1.48, 1.48);
        state.fpFov = THREE.MathUtils.clamp(state.fpFov + input.wheel() * 4, FP_FOV.min, FP_FOV.max);
        setFov(camera, state.fpFov * (state.aim?.on ? 0.78 : 1), dt);
        state.bob += dt * state.speed * 2.2;
        character.eyeWorld(camera.position);
        camera.position.y += Math.sin(state.bob) * 0.025 * Math.min(1, state.speed / 4);
        const fpP = state.fpPitch - (state.recoil || 0), cp = Math.cos(fpP);
        camTarget.set(camera.position.x + Math.sin(state.yaw) * cp, camera.position.y - Math.sin(fpP), camera.position.z + Math.cos(state.yaw) * cp);
        camera.lookAt(camTarget);
        return;
      }
      state.pitch = THREE.MathUtils.clamp(state.pitch + look.y * 0.0022, CAM.pitchMin, CAM.pitchMax);
      state.dist = THREE.MathUtils.clamp(state.dist + input.wheel() * 0.6, CAM.min, CAM.max);
      setFov(camera, state.aim?.on ? 52 : 60, dt);
      cameraPose(camera.position, camTarget);
      camera.lookAt(camTarget);
    },
  };
}
