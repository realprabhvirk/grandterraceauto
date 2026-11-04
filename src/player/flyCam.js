// Free-fly debug camera: mouse look, WASD, Space/E up, Ctrl/Q down, Shift = fast.
import * as THREE from 'three';

export function createFlyCam(camera) {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  return {
    /** Adopt the camera's current orientation (call when switching into fly mode). */
    syncFromCamera() { euler.setFromQuaternion(camera.quaternion, 'YXZ'); },
    update(dt, input) {
      const look = input.look(dt);
      euler.y -= look.x * 0.0025;
      euler.x = THREE.MathUtils.clamp(euler.x - look.y * 0.0025, -1.55, 1.55);
      camera.quaternion.setFromEuler(euler);
      const speed = (input.down('ShiftLeft') || input.down('ShiftRight')) ? 70 : 18;
      v.set(
        (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0),
        ((input.down('Space') || input.down('KeyE')) ? 1 : 0) - ((input.down('ControlLeft') || input.down('KeyQ')) ? 1 : 0),
        (input.down('KeyS') ? 1 : 0) - (input.down('KeyW') ? 1 : 0),
      );
      if (v.lengthSq()) {
        const up = v.y;
        v.y = 0;
        v.applyQuaternion(camera.quaternion);
        v.y += up;
        camera.position.addScaledVector(v.normalize(), speed * dt);
      }
    },
  };
}
