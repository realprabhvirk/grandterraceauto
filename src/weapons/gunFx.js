// Pooled gunfire effects (no allocations per shot):
//  - muzzle flash: crossed additive quads shown for 2 frames + ONE shared non-shadow point light
//  - tracers: thin additive streaks muzzle -> hit, fading in ~0.08 s (caller fires ~1 in 3)
//  - shell casings: brass boxes on a short ballistic arc (0.7 s, no collision)
//  - impacts by surface: dirt puffs (terrain), sparks (cars / metal), chips (walls)
//  - bullet holes: up to 60 decals (ring buffer) on static surfaces
import * as THREE from 'three';

function radialTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createGunFx(scene) {
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
  const stats = { flashes: 0, tracers: 0, casings: 0, impacts: 0, decals: 0 };

  // ---- Muzzle flashes (3 pooled) + one light ------------------------------------------------
  const flashMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,250,220,1)', 'rgba(255,170,60,0.85)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const flashGeo = (() => {
    const a = new THREE.PlaneGeometry(0.16, 0.34).rotateX(Math.PI / 2).translate(0, 0, 0.13);
    const b = a.clone().rotateZ(Math.PI / 2);
    const c = new THREE.PlaneGeometry(0.16, 0.16); // facing forward
    const g = new THREE.BufferGeometry();
    const merged = [a, b, c].map((x) => x.toNonIndexed());
    const pos = [], uv = [];
    for (const m of merged) { pos.push(...m.attributes.position.array); uv.push(...m.attributes.uv.array); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  })();
  const flashes = [0, 1, 2].map(() => { const m = new THREE.Mesh(flashGeo, flashMat); m.visible = false; m.frustumCulled = false; m.renderOrder = 10; scene.add(m); return { m, t: 0 }; });
  let flashI = 0;
  const light = new THREE.PointLight('#ffc070', 0, 9, 2);
  light.castShadow = false;
  scene.add(light);
  let lightT = 0;

  // ---- Tracers (10 pooled) -----------------------------------------------------------------
  const tracerGeo = new THREE.BoxGeometry(0.014, 0.014, 1).translate(0, 0, 0.5);
  const tracers = Array.from({ length: 10 }, () => {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const m = new THREE.Mesh(tracerGeo, mat); m.visible = false; m.frustumCulled = false; scene.add(m);
    return { m, t: 0 };
  });
  let tracerI = 0;

  // ---- Instanced pools: casings, debris (puff/chip/spark), decals -------------------------
  function instPool(geo, mat, n) {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, zero);
    scene.add(mesh);
    return { mesh, n, next: 0, p: Array.from({ length: n }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), size: 1, grav: -9.8, grow: 0 })) };
  }
  const casings = instPool(new THREE.BoxGeometry(0.009, 0.009, 0.024), new THREE.MeshLambertMaterial({ color: '#c9a24a' }), 24);
  const debris = instPool(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, transparent: true, opacity: 0.85, depthWrite: false }), 72);
  for (let i = 0; i < debris.n; i++) debris.mesh.setColorAt(i, new THREE.Color('#ffffff'));
  const holeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 32, 32);
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(15,12,10,0.95)'); gr.addColorStop(0.45, 'rgba(30,26,22,0.8)'); gr.addColorStop(1, 'rgba(40,35,30,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  })();
  const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 60);
  decals.frustumCulled = false;
  { const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < 60; i++) decals.setMatrixAt(i, zero); }
  scene.add(decals);
  let decalI = 0, decalCount = 0;
  const col = new THREE.Color();

  function emit(P, pos, vel, life, size, grav, color = null, grow = 0) {
    const i = P.next, p = P.p[i];
    P.next = (P.next + 1) % P.n;
    p.pos.copy(pos); p.vel.copy(vel); p.life = p.max = life; p.size = size; p.grav = grav; p.grow = grow;
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    if (color && P.mesh.instanceColor) { P.mesh.setColorAt(i, col.set(color)); P.mesh.instanceColor.needsUpdate = true; }
  }
  function step(P, dt, spin) {
    const e = new THREE.Euler();
    for (let i = 0; i < P.n; i++) {
      const p = P.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y += p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (spin) p.rot.addScalar(dt * spin);
      const k = Math.max(0, p.life / p.max);
      const sc = p.life > 0 ? p.size * (1 + (1 - k) * p.grow) * (p.grow ? Math.min(1, k * 2.5) : 1) : 0;
      tmpQ.setFromEuler(e.set(p.rot.x, p.rot.y, p.rot.z));
      tmpM.compose(p.pos, tmpQ, tmpS.setScalar(sc));
      P.mesh.setMatrixAt(i, tmpM);
    }
    P.mesh.instanceMatrix.needsUpdate = true;
  }
  const v = new THREE.Vector3();

  return {
    stats, light,
    /** Muzzle flash at pos pointing along dir (unit). light: also pulse the shared light. */
    muzzle(pos, dir, { light: withLight = true, scale = 1 } = {}) {
      const f = flashes[flashI]; flashI = (flashI + 1) % flashes.length;
      f.m.position.copy(pos); f.m.quaternion.setFromUnitVectors(Z, dir);
      f.m.rotateZ(Math.random() * Math.PI);
      f.m.scale.setScalar(scale * (0.8 + Math.random() * 0.4));
      f.m.visible = true; f.t = 2; // frames
      if (withLight) { light.position.copy(pos).addScaledVector(dir, 0.2); light.intensity = 3.5; lightT = 0.05; }
      stats.flashes++;
    },
    tracer(from, to) {
      const tr = tracers[tracerI]; tracerI = (tracerI + 1) % tracers.length;
      const d = v.subVectors(to, from), len = d.length();
      if (len < 0.5) return;
      tr.m.position.copy(from);
      tr.m.quaternion.setFromUnitVectors(Z, d.divideScalar(len));
      tr.m.scale.set(1, 1, len);
      tr.m.material.opacity = 0.9; tr.m.visible = true; tr.t = 0.08;
      stats.tracers++;
    },
    /** Ejected shell from pos; right = the gun's right vector (unit). */
    casing(pos, right) {
      emit(casings, pos, v.copy(right).multiplyScalar(1.6 + Math.random()).addScaledVector(up, 1.8 + Math.random() * 0.8), 0.7, 1, -9.8);
      stats.casings++;
    },
    /** Impact effect by surface: 'terrain' | 'car' | 'metal' | 'wall' | 'body'. */
    impact(point, normal, surface) {
      stats.impacts++;
      if (surface === 'body') return; // no blood: people just react
      if (surface === 'car' || surface === 'metal') {
        for (let i = 0; i < 7; i++) emit(debris, point, v.set((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4).addScaledVector(normal, 2), 0.25 + Math.random() * 0.2, 0.18, -9.8, '#ffd27a');
        return;
      }
      const dust = surface === 'terrain' ? '#8a7356' : '#b8b2a6';
      for (let i = 0; i < 4; i++) emit(debris, point, v.copy(normal).multiplyScalar(0.6 + Math.random() * 0.8).add(tmpS.set((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6)), 0.5 + Math.random() * 0.3, 0.9, 0.4, dust, 2.2);
      if (surface === 'wall') for (let i = 0; i < 4; i++) emit(debris, point, v.copy(normal).multiplyScalar(2.5).add(tmpS.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)), 0.5, 0.22, -9.8, '#9c958a');
    },
    /** Bullet hole decal on a static surface. */
    decal(point, normal) {
      tmpQ.setFromUnitVectors(Z, normal);
      tmpM.compose(v.copy(point).addScaledVector(normal, 0.01), tmpQ, tmpS.setScalar(0.8 + Math.random() * 0.5));
      decals.setMatrixAt(decalI, tmpM); decals.instanceMatrix.needsUpdate = true;
      decalI = (decalI + 1) % 60; decalCount = Math.min(60, decalCount + 1);
      stats.decals++;
    },
    get decalCount() { return decalCount; },
    update(dt) {
      for (const f of flashes) if (f.m.visible && --f.t < 0) f.m.visible = false;
      if (lightT > 0) { lightT -= dt; if (lightT <= 0) light.intensity = 0; }
      for (const t of tracers) if (t.m.visible) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / 0.08) * 0.9; if (t.t <= 0) t.m.visible = false; }
      step(casings, dt, 14);
      step(debris, dt, 3);
    },
  };
}
