// Third-person walking: Rapier kinematic capsule + KinematicCharacterController
// (slopes, steps, snap-to-ground, collision with houses/fences/trunks), camera-relative
// WASD, Shift to run, Space to jump, orbit camera that pulls in when blocked.
import * as THREE from 'three';
import { createCharacter } from './character.js';
import { G_PLAYER, groups, GROUP } from '../physics/physicsWorld.js';

const RADIUS = 0.32, HALF = 0.55; // capsule: total height 2*(HALF+RADIUS) = 1.74 m
const WALK = 4.2, RUN = 7.8, JUMP = 5.2, GRAVITY = -18;
const CAM = { dist: 5.2, min: 1.6, max: 11, height: 1.55, pitchMin: -0.35, pitchMax: 1.2 };

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
    dist: CAM.dist,
  };
  const pos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const move = new THREE.Vector3();

  function syncVisual() {
    const t = body.translation();
    pos.set(t.x, t.y - HALF - RADIUS, t.z);
    character.root.position.copy(pos);
    character.root.rotation.y = state.facing;
  }
  syncVisual();

  return {
    get position() { return pos; },
    get state() { return state; },
    setVisible(v) { character.root.visible = v; },

    /** Fixed-step physics update. */
    fixedUpdate(dt, input, active) {
      move.set(0, 0, 0);
      if (active) {
        const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
        const r = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
        if (f || r) {
          const sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
          // forward (sin, cos); right = (-cos, sin) for a camera looking along forward
          move.set(sy * f - cy * r, 0, cy * f + sy * r).normalize();
        }
      }
      const run = active && (input.down('ShiftLeft') || input.down('ShiftRight'));
      const speed = move.lengthSq() ? (run ? RUN : WALK) : 0;
      state.speed += (speed - state.speed) * Math.min(1, dt * 10);
      if (move.lengthSq()) {
        const target = Math.atan2(move.x, move.z);
        let d = target - state.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        state.facing += d * Math.min(1, dt * 12);
      }
      if (state.grounded) {
        state.vy = -1;
        if (active && input.pressed('Space')) { state.vy = JUMP; state.grounded = false; }
      } else {
        state.vy += GRAVITY * dt;
      }
      const dir = move.lengthSq() ? move.clone().multiplyScalar(state.speed * dt) : new THREE.Vector3();
      dir.y = state.vy * dt;
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

    /** Per-frame: animation + camera. */
    update(dt, input, camera, active) {
      syncVisual();
      character.animate(dt, state.speed, !state.grounded);
      if (!active) return;
      const look = input.look(dt);
      state.yaw -= look.x * 0.0028;
      state.pitch = THREE.MathUtils.clamp(state.pitch + look.y * 0.0022, CAM.pitchMin, CAM.pitchMax);
      state.dist = THREE.MathUtils.clamp(state.dist + input.wheel() * 0.6, CAM.min, CAM.max);

      camTarget.copy(pos).y += CAM.height;
      const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      desired.set(-Math.sin(state.yaw) * cp, sp, -Math.cos(state.yaw) * cp);
      // Pull the camera in if a wall/hedge is between it and the player.
      let dist = state.dist;
      const ray = new RAPIER.Ray(camTarget, desired);
      const hit = world.castRay(ray, dist, true, undefined, groups(GROUP.PLAYER, GROUP.STATIC), collider);
      if (hit) dist = Math.max(0.6, hit.timeOfImpact - 0.25);
      camera.position.copy(camTarget).addScaledVector(desired, dist);
      camera.lookAt(camTarget);
    },
  };
}
