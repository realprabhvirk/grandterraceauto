// Working cabin mirrors: rear-view + two side mirrors, each a 256x128 render target.
// Round-robin: one mirror re-renders per frame (~15-20 fps each), shadows not re-rendered.
// Only active in the cabin view. Perf guard: if enabling them costs >10 fps or fps drops
// under 40, they switch off for good and fall back to a static tinted reflection.
import * as THREE from 'three';

const SIZE = [256, 128];
export const MIRROR_FALLBACK = new THREE.MeshBasicMaterial({ color: '#7d8f9b' });

export function createMirrors() {
  const slots = ['rear', 'left', 'right'].map((name) => {
    const rt = new THREE.WebGLRenderTarget(SIZE[0], SIZE[1], { depthBuffer: true });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: rt.texture });
    mat.map.wrapS = THREE.RepeatWrapping;
    mat.map.repeat.x = -1; // mirror image
    const cam = new THREE.PerspectiveCamera(name === 'rear' ? 38 : 30, 2, 0.3, 300);
    return { name, rt, mat, cam };
  });
  const st = { enabled: true, disabled: false, i: 0, fpsBase: 0, fpsOn: 0, t: 0, phase: 'base', fps: 60 };
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _back = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);

  return {
    materials: Object.fromEntries(slots.map((s) => [s.name, s.mat])),
    get state() { return st; },
    /** Place the mirror cameras for this car (mirrors look backward along the car). */
    update(renderer, scene, car, dt) {
      if (st.disabled || !car?.cabin) return;
      // Perf guard: 1.5 s baseline with mirrors frozen, then 2 s with them live.
      st.fps += ((1 / Math.max(dt, 1e-3)) - st.fps) * Math.min(1, dt * 2);
      st.t += dt;
      if (st.phase === 'base') { if (st.t > 1.5) { st.fpsBase = st.fps; st.phase = 'on'; st.t = 0; } return; }
      if (st.phase === 'on' && st.t > 2) {
        st.fpsOn = st.fps; st.phase = 'run';
        if (st.fpsBase - st.fpsOn > 10 || st.fpsOn < 40) { this.disable(car); return; }
      }
      const c = car.cfg, s = slots[st.i++ % slots.length];
      car.model.updateMatrixWorld(true);
      car.model.getWorldQuaternion(_q);
      const zf = c.cabin[1];
      if (s.name === 'rear') _p.set(0, c.roof - 0.1, zf - 0.6);
      else _p.set((s.name === 'left' ? 1 : -1) * (c.W / 2 + 0.12), c.belt + 0.1, zf - 0.2);
      s.cam.position.copy(_p.applyMatrix4(car.model.matrixWorld));
      s.cam.quaternion.copy(_q).multiply(_back); // cameras look down -Z = car backwards
      if (s.name !== 'rear') s.cam.rotateY((s.name === 'left' ? -1 : 1) * 0.18);
      const shadowAuto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      const prev = renderer.getRenderTarget();
      car.cabin.group.visible = false;
      renderer.setRenderTarget(s.rt);
      renderer.render(scene, s.cam);
      renderer.setRenderTarget(prev);
      car.cabin.group.visible = true;
      renderer.shadowMap.autoUpdate = shadowAuto;
    },
    disable(car) {
      st.disabled = true;
      for (const s of slots) { s.mat.map = null; s.mat.color.set(MIRROR_FALLBACK.color); s.mat.needsUpdate = true; }
      console.log(`[gta] cabin mirrors disabled (fps ${st.fpsBase.toFixed(0)} -> ${st.fpsOn.toFixed(0)}), static fallback`);
      void car;
    },
    resetGuard() { if (!st.disabled) { st.phase = 'base'; st.t = 0; } },
  };
}
