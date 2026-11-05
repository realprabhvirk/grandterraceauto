// Sky dressing (cheap): slow drifting low-poly clouds (one InstancedMesh) and two small flocks
// of birds by day (boids, one InstancedMesh). Both hide / thin out at night.
import * as THREE from 'three';
import { paint, merge } from '../utils/geom.js';
import { makeRng } from '../utils/rng.js';

export function createSkyLife(scene) {
  const rng = makeRng(2468);
  // ---- Clouds -------------------------------------------------------------------------------
  const puff = merge([
    paint(new THREE.IcosahedronGeometry(9, 0).scale(1.6, 0.7, 1.1), '#ffffff', 0.04),
    paint(new THREE.IcosahedronGeometry(7, 0).scale(1.3, 0.75, 1).translate(11, 1.5, 2), '#f7f7f4', 0.04),
    paint(new THREE.IcosahedronGeometry(6.5, 0).scale(1.2, 0.7, 1).translate(-11, 0.5, -1), '#f4f4f0', 0.04),
    paint(new THREE.IcosahedronGeometry(6, 0).scale(1, 0.8, 1).translate(3, 4.5, -2), '#ffffff', 0.04),
  ]);
  const N = 16;
  const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.92, fog: false });
  const clouds = new THREE.InstancedMesh(puff, cloudMat, N);
  clouds.name = 'clouds';
  clouds.frustumCulled = false;
  const X0 = -700, X1 = 1500;
  const C = Array.from({ length: N }, () => ({ x: rng.range(X0, X1), y: rng.range(115, 165), z: rng.range(-750, 450), s: rng.range(0.8, 1.9), r: rng.range(0, 6.28) }));
  scene.add(clouds);
  // ---- Birds (two flocks) ---------------------------------------------------------------------
  const bird = merge([
    paint(new THREE.BoxGeometry(0.1, 0.08, 0.32), '#2f2a26', 0.03),
    paint(new THREE.BoxGeometry(0.42, 0.02, 0.14).translate(0.22, 0.02, 0).rotateZ(0.3), '#3a332e', 0.03),
    paint(new THREE.BoxGeometry(0.42, 0.02, 0.14).translate(-0.22, 0.02, 0).rotateZ(-0.3), '#3a332e', 0.03),
  ]);
  const flocks = [{ c: new THREE.Vector3(0, 30, 0), home: [0, 0] }, { c: new THREE.Vector3(470, 28, -100), home: [470, -100] }];
  const per = 8;
  const birds = new THREE.InstancedMesh(bird, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), flocks.length * per);
  birds.name = 'birds';
  birds.frustumCulled = false;
  scene.add(birds);
  const B = [];
  flocks.forEach((f, fi) => { for (let k = 0; k < per; k++) B.push({ f, p: new THREE.Vector3(f.home[0] + rng.range(-20, 20), 28 + rng.range(-4, 4), f.home[1] + rng.range(-20, 20)), v: new THREE.Vector3(rng.range(-4, 4), 0, rng.range(-4, 4)), ph: fi * 10 + k }); });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  let t = 0;
  const st = { cloudX0: C[0].x, birdsVisible: true };
  return {
    clouds, birds, state: st,
    update(dt, { dusk = 0 } = {}) {
      t += dt;
      // Clouds drift east at ~2.5 m/s and wrap.
      for (let i = 0; i < N; i++) {
        const c = C[i];
        c.x += dt * (2.2 + c.s * 0.4);
        if (c.x > X1) c.x = X0;
        q.setFromAxisAngle(tmp.set(0, 1, 0), c.r);
        m.compose(p.set(c.x, c.y, c.z), q, s.set(c.s, c.s, c.s));
        clouds.setMatrixAt(i, m);
      }
      clouds.instanceMatrix.needsUpdate = true;
      st.cloudX0 = C[0].x;
      cloudMat.opacity = 0.92 - dusk * 0.45;
      // Birds by day only.
      birds.visible = st.birdsVisible = dusk < 0.6;
      if (!birds.visible) return;
      for (const f of flocks) f.c.set(f.home[0] + Math.sin(t * 0.05 + f.home[0]) * 120, 28 + Math.sin(t * 0.2) * 4, f.home[1] + Math.cos(t * 0.04) * 110);
      B.forEach((b, i) => {
        acc.subVectors(b.f.c, b.p).multiplyScalar(0.12);
        for (const o of B) { if (o === b || o.f !== b.f) continue; tmp.subVectors(b.p, o.p); const d2 = tmp.lengthSq(); if (d2 < 6) acc.addScaledVector(tmp, 1.5 / (d2 + 0.1)); }
        b.v.addScaledVector(acc, dt);
        const sp = b.v.length(); if (sp > 11) b.v.multiplyScalar(11 / sp); if (sp < 6) b.v.multiplyScalar(6 / Math.max(0.01, sp));
        b.v.y *= 0.96;
        b.p.addScaledVector(b.v, dt);
        q.setFromUnitVectors(Z, tmp.copy(b.v).setY(0).normalize());
        m.compose(b.p, q, s.set(1, 1 + Math.sin(t * 11 + b.ph) * 0.9, 1));
        birds.setMatrixAt(i, m);
      });
      birds.instanceMatrix.needsUpdate = true;
    },
  };
}
