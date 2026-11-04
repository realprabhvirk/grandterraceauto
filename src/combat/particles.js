// Cheap pooled particles: smoke puffs (grey icosas) and sparks (tiny emissive boxes), one
// InstancedMesh each. emit() reuses the oldest slot; update() integrates and fades by scale.
import * as THREE from 'three';

function pool(scene, geo, mat, n) {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) mesh.setMatrixAt(i, zero);
  scene.add(mesh);
  return { mesh, n, next: 0, p: Array.from({ length: n }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 1, grow: 0, grav: 0 })) };
}

export function createParticles(scene) {
  const smoke = pool(scene, new THREE.IcosahedronGeometry(0.35, 0), new THREE.MeshLambertMaterial({ color: '#5d5a57', flatShading: true, transparent: true, opacity: 0.75, depthWrite: false }), 90);
  const spark = pool(scene, new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), 80);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const emitIn = (P, pos, vel, life, size, grow, grav) => {
    const p = P.p[P.next];
    P.next = (P.next + 1) % P.n;
    p.pos.copy(pos); p.vel.copy(vel); p.life = life; p.max = life; p.size = size; p.grow = grow; p.grav = grav;
  };
  const step = (P, dt) => {
    for (let i = 0; i < P.n; i++) {
      const p = P.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y += p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      const k = Math.max(0, p.life / p.max);
      const sc = p.life > 0 ? p.size * (1 + (1 - k) * p.grow) * (P === smoke ? Math.min(1, k * 3) : k) : 0;
      m.compose(p.pos, q, s.setScalar(sc));
      P.mesh.setMatrixAt(i, m);
    }
    P.mesh.instanceMatrix.needsUpdate = true;
  };
  const v = new THREE.Vector3();
  return {
    smoke(pos, dark = false) { emitIn(smoke, pos, v.set((Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4), 2.2, dark ? 0.7 : 0.5, 1.6, 0.1); },
    sparks(pos, n = 14) { for (let i = 0; i < n; i++) emitIn(spark, pos, v.set((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), 0.5 + Math.random() * 0.4, 1, 0, -9.8); },
    update(dt) { step(smoke, dt); step(spark, dt); },
  };
}
