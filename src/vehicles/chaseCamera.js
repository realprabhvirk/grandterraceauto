// Car chase camera: smooth follow behind the car, auto-swings back behind once moving,
// mouse orbit (mostly when stopped), B = look behind, FOV widens with speed, pulls in
// when a house/tree is between car and camera.
import * as THREE from 'three';
import { groups, GROUP } from '../physics/physicsWorld.js';

const BASE_FOV = 60, MAX_FOV = 74;

export function createChaseCamera(camera, physics) {
  const { world, RAPIER } = physics;
  const state = { yawOff: 0, pitch: 0.2, dist: 7.2, inited: false };
  const pos = new THREE.Vector3(), target = new THREE.Vector3(), want = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let smoothYaw = 0;

  /** Compute the ideal pose without moving the camera (for blends). */
  function pose(car, outPos, outTarget, lookBack = false) {
    const p = car.position;
    const yaw = smoothYaw + state.yawOff + (lookBack ? Math.PI : 0);
    const cfg = car.cfg;
    outTarget.set(p.x, p.y + cfg.roof * 0.75, p.z);
    const speed = Math.abs(car.body.state.speed);
    const dist = state.dist + (cfg.L - 4.5) * 0.6 + Math.min(2.2, speed * 0.05);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    dir.set(-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp);
    let d = dist;
    const hit = world.castRay(new RAPIER.Ray(outTarget, dir), dist, true, undefined, groups(GROUP.PLAYER, GROUP.STATIC));
    if (hit) d = Math.max(1.4, hit.timeOfImpact - 0.3);
    outPos.copy(outTarget).addScaledVector(dir, d);
    return outPos;
  }

  return {
    /** Snap behind the car (call when the player gets in). */
    reset(car) {
      smoothYaw = car.body.yaw();
      state.yawOff = 0;
      state.pitch = 0.2;
      state.inited = true;
    },
    pose,
    update(dt, car, input, apply = true) {
      const speed = car.body.state.speed;
      const carYaw = car.body.yaw();
      // Follow the car heading (when reversing fast, keep looking forward over the boot).
      let d = carYaw - smoothYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      smoothYaw += d * Math.min(1, dt * (2.5 + Math.min(4, Math.abs(speed) * 0.25)));
      const look = input.look(dt);
      const moving = Math.abs(speed) > 2.5;
      state.yawOff -= look.x * 0.0028;
      state.pitch = THREE.MathUtils.clamp(state.pitch + look.y * 0.002, -0.05, 1.0);
      state.dist = THREE.MathUtils.clamp(state.dist + input.wheel() * 0.6, 4.5, 14);
      if (moving && Math.abs(look.x) < 0.5) {
        // Auto-swing back behind the car.
        state.yawOff = Math.atan2(Math.sin(state.yawOff), Math.cos(state.yawOff)) * (1 - Math.min(1, dt * 1.6));
        state.pitch += (0.2 - state.pitch) * Math.min(1, dt * 1.2);
      }
      pose(car, want, target, input.down('KeyB'));
      if (!apply) return;
      // Smooth position, but stay tight enough at speed that the car never leaves frame.
      const k = 1 - Math.exp(-dt * (8 + Math.abs(speed) * 0.15));
      pos.lerp(want, state.inited ? k : 1);
      state.inited = true;
      camera.position.copy(pos);
      camera.lookAt(target);
      const fov = BASE_FOV + (MAX_FOV - BASE_FOV) * Math.min(1, Math.abs(speed) / 38);
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    },
    /** Seed the smoothed position (used at the end of the enter blend). */
    seed(p) { pos.copy(p); },
    restoreFov() { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); },
  };
}
