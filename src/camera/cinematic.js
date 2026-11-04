// CINEMATIC car camera: letterbox bars + an auto-director cycling shots every 4-7 s with
// smooth blends: low front-wheel, roadside fly-by, high chase, orbit, hood cam. Shots placed
// in the world are ray-checked against walls/terrain and skipped if blocked.
import * as THREE from 'three';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

const SHOTS = ['wheel', 'flyby', 'high', 'orbit', 'hood'];
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);

export function createCinematic(camera, physics) {
  const { world, RAPIER } = physics;
  const rng = makeRng(77);
  const bars = ['top', 'bottom'].map((side) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:0;right:0;${side}:0;height:0;background:#0d0c0b;z-index:6;transition:height .5s;pointer-events:none`;
    document.body.appendChild(el);
    return el;
  });
  const st = { shot: 'high', t: 0, len: 5, blend: 1, fly: null, orbit: 0, active: false };
  const from = { p: new THREE.Vector3(), t: new THREE.Vector3() };
  const want = { p: new THREE.Vector3(), t: new THREE.Vector3() };
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();

  const clear = (a, b) => {
    tmp.subVectors(b, a);
    const d = tmp.length();
    if (d < 0.01) return true;
    const hit = world.castRay(new RAPIER.Ray(a, tmp.clone().divideScalar(d)), d, true, undefined, STATIC_ONLY);
    return !hit || hit.timeOfImpact > d - 0.2;
  };
  const carLocal = (car, x, y, z, out) => { car.model.updateMatrixWorld(true); return out.set(x, y, z).applyMatrix4(car.model.matrixWorld); };

  function pose(car, shot) {
    const c = car.cfg, p = car.position, f = car.body.forward(), up = car.cfg.roof;
    const centre = new THREE.Vector3(p.x, p.y + up * 0.5, p.z);
    switch (shot) {
      case 'wheel': carLocal(car, -(c.W / 2 + 0.55), 0.38, c.wheelBase / 2 + c.frontOverhang - 0.2, want.p); want.t.copy(centre); break;
      case 'hood': carLocal(car, 0, c.belt + 0.32, c.wheelBase / 2 + c.frontOverhang - 0.9, want.p); carLocal(car, 0, c.belt + 0.1, 30, want.t); break;
      case 'high': want.p.set(p.x - f.x * 13, p.y + 7, p.z - f.z * 13); want.t.copy(centre); break;
      case 'orbit': {
        st.orbit += 0.004;
        want.p.set(p.x + Math.cos(st.orbit * 60) * 8, p.y + 2.6, p.z + Math.sin(st.orbit * 60) * 8); want.t.copy(centre); break;
      }
      case 'flyby':
      default: {
        if (!st.fly) st.fly = new THREE.Vector3(p.x + f.x * 28 + f.z * 5, p.y + 1.3, p.z + f.z * 28 - f.x * 5);
        want.p.copy(st.fly); want.t.copy(centre);
        if (tmp.subVectors(centre, st.fly).dot(new THREE.Vector3(f.x, 0, f.z)) > 22) st.fly = null; // car long gone: re-place next frame
      }
    }
    // Raycast check for shots placed out in the world.
    if (shot === 'high' || shot === 'orbit' || shot === 'flyby') return clear(centre, want.p);
    return true;
  }

  return {
    get shot() { return st.shot; },
    enter() {
      st.active = true; bars.forEach((b) => (b.style.height = '9vh')); st.t = 0; st.blend = 0;
      from.p.copy(camera.position); camera.getWorldDirection(look); from.t.copy(camera.position).addScaledVector(look, 8);
    },
    exit() { st.active = false; bars.forEach((b) => (b.style.height = '0')); },
    update(dt, car) {
      st.t += dt;
      if (st.t > st.len) {
        // Next shot: random (seeded), skipping blocked ones.
        from.p.copy(camera.position);
        camera.getWorldDirection(look);
        from.t.copy(camera.position).addScaledVector(look, 8);
        for (let k = 0; k < 6; k++) {
          const next = SHOTS[rng.int(0, SHOTS.length - 1)];
          if (next === st.shot) continue;
          st.fly = null;
          if (pose(car, next)) { st.shot = next; break; }
        }
        st.t = 0; st.len = rng.range(4, 7); st.blend = 0;
      }
      if (!pose(car, st.shot)) { st.shot = 'hood'; pose(car, 'hood'); }
      st.blend = Math.min(1, st.blend + dt / 1.0);
      const k = st.blend * st.blend * (3 - 2 * st.blend);
      camera.position.lerpVectors(from.p, want.p, k);
      look.lerpVectors(from.t, want.t, k);
      camera.lookAt(look);
      if (st.blend >= 1) { from.p.copy(want.p); from.t.copy(want.t); }
    },
  };
}
