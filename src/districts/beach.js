// TERRACE BEACH / WATERFRONT (south of downtown): promenade + sea wall with railings, sand
// sloping into a cheap animated water plane (vertex waves, no refraction), a timber pier with
// collision, beach kiosk, lifeguard tower, volleyball net, palms, a small car park of stealable
// cars, beach NPC spots (sunbathers, volleyball, lifeguard, kiosk vendor) and seagulls (boids).
import * as THREE from 'three';
import { frame, makeChunk } from '../town/townKit.js';
import { staticCar } from '../town/townBuildings.js';
import { BEACH, WATER_Y, beachHeight, TOWN } from '../world/terrain.js';
import { cylinder, paint, merge } from '../utils/geom.js';
import { makeRng } from '../utils/rng.js';

export const PIER = { x: 800, z0: BEACH.prom - 1, z1: 205, w: 5.2, y: TOWN.h };
const SAND = '#e6d3a3', WOOD = '#9a7650', RAIL = '#e8e4d8';

function palm(ch, x, z, y, rng) {
  const h = 6 + rng.next() * 3, lean = (rng.next() - 0.5) * 0.5, segs = 5;
  let px = x, pz = z, py = y;
  const dirA = rng.next() * Math.PI * 2;
  for (let k = 0; k < segs; k++) {
    const t = (k + 1) / segs, nx = x + Math.cos(dirA) * lean * h * t * t, nz = z + Math.sin(dirA) * lean * h * t * t, ny = y + h * t;
    const len = Math.hypot(nx - px, ny - py, nz - pz);
    const g = new THREE.CylinderGeometry(0.17 - k * 0.015, 0.22 - k * 0.015, len, 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx - px, ny - py, nz - pz).normalize()));
    g.translate((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
    ch.solid.push(paint(g, '#8a6a48', 0.06));
    px = nx; py = ny; pz = nz;
  }
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2 + rng.next() * 0.3;
    const leaf = new THREE.ConeGeometry(0.55, 3.4, 4).rotateX(Math.PI / 2).translate(0, 0, 1.7);
    leaf.scale(1, 0.25, 1);
    leaf.rotateX(0.35).rotateY(a).translate(px, py, pz);
    ch.solid.push(paint(leaf, f % 2 ? '#4f8a3e' : '#5f9a48', 0.08));
  }
  ch.colliders.push({ x, y: y + 2, z, hx: 0.25, hy: 2, hz: 0.25, rot: 0 });
}

export function buildBeach({ parent, atlas, rng: seed }) {
  const rng = seed || makeRng(4747);
  const out = { chunks: [], colliders: [], places: [], npcSpots: [], updaters: [], pedLines: [], propChunks: [], landmarks: [], water: null, gulls: null, pier: PIER };
  const y = TOWN.h, zMid = (BEACH.prom + 54.5) / 2;
  const parts = [['w', BEACH.x0 - 5, 750], ['m', 750, 880], ['e', 880, BEACH.x1 + 5]].map(([n, a, b]) => ({ ch: makeChunk(`beach-${n}`), a, b }));
  const chunkAt = (x) => parts.find((p) => x >= p.a && x < p.b)?.ch || parts[1].ch;
  const F0 = frame(0, 0, 0, 1, y);

  // ---- Promenade slab, sea wall + railing, steps down to the sand -------------------------------
  for (const p of parts) {
    const w = p.b - p.a, cx = (p.a + p.b) / 2;
    p.ch.box(F0, w, 0.06, BEACH.prom - 54.6, cx, 0.0, zMid, '#cfc6b4');
    for (let x = p.a + 4; x < p.b - 2; x += 8) p.ch.box(F0, 0.12, 0.02, BEACH.prom - 55, x, 0.065, zMid, '#b9ae99'); // paving joints
    p.ch.box(F0, w, 1.3, 0.5, cx, -1.25, BEACH.prom + 0.25, '#bdb3a2');                                          // sea wall face
    // Railing (gaps at the steps every 40 m, and at the pier).
    for (let x = p.a; x < p.b; x += 4) {
      const gap = Math.abs(((x - BEACH.x0) % 40) - 20) < 2.2 || Math.abs(x - PIER.x) < PIER.w / 2 + 0.6;
      if (gap) continue;
      p.ch.box(F0, 0.08, 1.0, 0.08, x, 0, BEACH.prom - 0.2, RAIL);
      p.ch.box(F0, 4, 0.07, 0.07, x + 2, 0.95, BEACH.prom - 0.2, RAIL);
      p.ch.collide(F0, 4, 1.0, 0.15, x + 2, 0, BEACH.prom - 0.2);
    }
  }
  for (let x = BEACH.x0 + 20; x < BEACH.x1; x += 40) {
    const ch = chunkAt(x);
    for (let s = 0; s < 4; s++) ch.box(F0, 3.6, 0.3, 0.6, x, -0.3 * (s + 1), BEACH.prom + 0.3 + s * 0.6, '#cfc6b4'); // steps
  }

  // ---- Pier (timber deck on piles, railings, shelter at the end) --------------------------------
  {
    const ch = chunkAt(PIER.x), L = PIER.z1 - PIER.z0, zc = (PIER.z0 + PIER.z1) / 2;
    ch.block(F0, PIER.w, 0.3, L, PIER.x, -0.3, zc, WOOD);
    for (let z = PIER.z0 + 4; z < PIER.z1; z += 8) {
      for (const s of [-1, 1]) {
        const ground = beachHeight(z);
        ch.solid.push(cylinder(0.18, 0.18, y - 0.3 - ground + 0.5, 6, PIER.x + s * (PIER.w / 2 - 0.4), ground - 0.5, z, '#6b5040'));
      }
      for (let k = 0; k < 2; k++) ch.box(F0, PIER.w, 0.02, 0.12, PIER.x, 0.005, z + k * 4, '#86643f');
    }
    for (const s of [-1, 1]) {
      ch.box(F0, 0.1, 1.0, L, PIER.x + s * (PIER.w / 2 - 0.05), 0, zc, RAIL);
      ch.collide(F0, 0.2, 1.1, L, PIER.x + s * (PIER.w / 2 - 0.05), 0, zc);
    }
    const E = frame(PIER.x, PIER.z1 - 5, 0, -1, y);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) ch.block(E, 0.2, 2.8, 0.2, x, 0, z, WOOD);
    ch.box(E, 5.4, 0.25, 5.4, 0, 2.8, 0, '#2f6fc0');
    atlas.sign(frame(PIER.x, PIER.z0 + 1.5, 0, -1, y), atlas.row('TERRACE PIER', '#2f6fc0', '#ffffff'), 5, 0.8, 0, 3.2, 0);
    ch.box(frame(PIER.x, PIER.z0 + 1.5, 0, -1, y), 0.2, 3.6, 0.2, -2.7, 0, 0, '#2b2b2e'); ch.box(frame(PIER.x, PIER.z0 + 1.5, 0, -1, y), 0.2, 3.6, 0.2, 2.7, 0, 0, '#2b2b2e');
    out.landmarks.push({ name: 'Terrace Pier', x: PIER.x, z: zc });
    out.places.push({ kind: 'landmark', x: PIER.x, z: zc, label: 'Terrace Pier' });
  }

  // ---- Kiosk (Surf Shack) on the promenade ------------------------------------------------------
  {
    const kx = 705, ch = chunkAt(kx);
    const K = frame(kx, BEACH.prom - 6.5, 0, 1, y);
    ch.block(K, 6, 2.8, 4, 0, 0, -2, '#f4f1e8');
    ch.box(K, 4, 1.2, 0.08, 0, 1.0, 0.02, '#2b2b2e');
    ch.box(K, 7, 0.14, 2.4, 0, 2.8, 0.8, '#3fb0c0');
    ch.box(K, 6.6, 0.25, 4.6, 0, 2.95, -2, '#e2553e');
    atlas.sign(K, atlas.row('SURF SHACK', '#3fb0c0', '#ffffff'), 4.6, 0.6, 0, 3.4, 0.05);
    const v = K.toW(0, -1.2);
    out.npcSpots.push({ role: 'vendor', x: v.x, y, z: v.z, yaw: K.rot, action: 'look' });
    out.places.push({ kind: 'shop', x: kx, z: BEACH.prom - 8, label: 'Surf Shack' });
  }

  // ---- Lifeguard tower, volleyball net, towels + umbrellas, palms --------------------------------
  {
    const lx = 860, lz = 92, ch = chunkAt(lx), g = beachHeight(lz);
    const Lf = frame(lx, lz, 0, 1, g);
    for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) ch.block(Lf, 0.18, 2.6, 0.18, x, 0, z, '#e8e4d8');
    ch.block(Lf, 2.8, 0.2, 2.8, 0, 2.6, 0, WOOD);
    ch.box(Lf, 2.6, 1.6, 2.6, 0, 2.8, 0, '#e2332a');
    ch.box(Lf, 3.2, 0.2, 3.2, 0, 4.4, 0, '#f2d23a');
    ch.box(Lf, 1.6, 0.8, 0.1, 0, 3.3, 1.32, '#9fc4d6', { glassy: true });
    ch.box(Lf, 0.06, 3.0, 0.06, 1.4, 4.6, 1.4, '#2b2b2e'); ch.box(Lf, 0.9, 0.5, 0.03, 1.85, 7.1, 1.4, '#e2332a'); // flag
    for (let s = 0; s < 5; s++) ch.box(Lf, 0.8, 0.08, 0.3, 0, 0.5 * s + 0.2, 1.6 + s * 0.35, WOOD); // ladder
    out.npcSpots.push({ role: 'lifeguard', x: Lf.toW(0, 0.2).x, y: g + 2.75, z: Lf.toW(0, 0.2).z, yaw: 0, action: 'look' });
    out.landmarks.push({ name: 'Lifeguard tower', x: lx, z: lz });
    // Volleyball court.
    const vx = 760, vz = 92, vg = beachHeight(vz), V = frame(vx, vz, 1, 0, vg), vch = chunkAt(vx);
    for (const s of [-1, 1]) vch.box(V, 0.1, 2.5, 0.1, s * 4.6, 0, 0, '#e8e4d8');
    vch.box(V, 9.2, 0.9, 0.04, 0, 1.55, 0, '#f4f1e8');
    for (const [x, z, yaw] of [[0, -4, 0], [-2.5, -6, 0.2], [0, 4, Math.PI], [2.4, 6, Math.PI - 0.2]]) {
      const p = V.toW(x, z);
      out.npcSpots.push({ role: 'beach', x: p.x, y: beachHeight(p.z) + 0.02, z: p.z, yaw: yaw + V.rot, action: 'volley' });
    }
    // Towels, umbrellas, sunbathers.
    const towel = ['#e2553e', '#3fb0c0', '#f2d23a', '#8a5aa8', '#4f9a55'];
    for (let n = 0; n < 7; n++) {
      const x = 640 + n * 48 + rng.next() * 12, z = 84 + rng.next() * 16, gy = beachHeight(z), ch2 = chunkAt(x);
      const Tw = frame(x, z, 0, 1, gy + 0.01);
      ch2.box(Tw, 0.95, 0.02, 2.0, 0, 0, 0, towel[n % towel.length]);
      const up = Tw.toW(1.2, -0.6);
      ch2.solid.push(cylinder(0.035, 0.035, 2.3, 5, up.x, gy, up.z, '#e8e4d8'));
      ch2.solid.push(paint(new THREE.ConeGeometry(1.4, 0.55, 8).translate(up.x, gy + 2.3, up.z), towel[(n + 2) % towel.length], 0.05));
      if (n < 3) out.npcSpots.push({ role: 'beach', x: Tw.toW(0, 0.75).x, y: gy + 0.03, z: Tw.toW(0, 0.75).z, yaw: Math.PI, action: 'sunbathe' });
    }
    for (let n = 0; n < 14; n++) {
      const x = BEACH.x0 + 10 + n * 26 + rng.next() * 8;
      if (Math.abs(x - PIER.x) < 8 || Math.abs(x - 705) < 7) continue;
      palm(chunkAt(x), x, BEACH.prom - 2.2, y, rng);
    }
  }

  // ---- Beach car park (west end of the promenade) -----------------------------------------------
  {
    const ch = chunkAt(BEACH.x0 + 10);
    ch.box(F0, 22, 0.05, 9.5, BEACH.x0 + 14, 0.07, 60.5, '#5c5d60');
    for (let k = 0; k < 5; k++) {
      const x = BEACH.x0 + 6 + k * 3.6;
      ch.box(F0, 0.1, 0.02, 4.6, x - 1.8, 0.1, 61, '#e8e4d8');
      if (k < 4) staticCar(ch, x, 60.4, Math.PI, ['ute', 'hatch', 'suv', 'sedan'][k], ['#3fb0c0', '#e9e6dc', '#e2553e', '#46566b'][k]);
    }
  }

  // ---- Water: one plane with cheap vertex waves (CPU, every other frame) + a foam line ---------
  {
    const W = 760, D = 360, nx = 64, nz = 30;
    const geo = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2).translate((BEACH.x0 + BEACH.x1) / 2, WATER_Y, 108 + D / 2);
    const base = geo.attributes.position.array.slice();
    const mat = new THREE.MeshLambertMaterial({ color: '#3f8fb0', transparent: true, opacity: 0.86, flatShading: true });
    const water = new THREE.Mesh(geo, mat);
    water.name = 'beach-water';
    water.receiveShadow = true;
    parent.add(water);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(BEACH.x1 - BEACH.x0 + 40, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f4f8f8', transparent: true, opacity: 0.55, depthWrite: false }));
    const zWater = BEACH.wall + (TOWN.h - 1.2 - WATER_Y) / BEACH.slope;
    foam.position.set((BEACH.x0 + BEACH.x1) / 2, WATER_Y + 0.04, zWater);
    parent.add(foam);
    out.water = { mesh: water, foam, y: WATER_Y, zShore: zWater };
    let t = 0, frameN = 0;
    out.updaters.push((dt, ctx) => {
      t += dt;
      const f = ctx.focus;
      const near = Math.hypot(f.x - 810, f.z - 120) < 520;
      water.visible = foam.visible = near;
      if (!near || frameN++ % 2) return;
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = base[i + 1] + Math.sin(base[i] * 0.07 + t * 1.3) * 0.12 + Math.cos(base[i + 2] * 0.09 + t * 0.9) * 0.1;
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      foam.position.z = zWater + Math.sin(t * 0.8) * 0.8;
      foam.material.opacity = 0.4 + Math.sin(t * 0.8) * 0.15;
    });
    // Invisible wall in the water so nobody walks off to sea (~1.8 m deep).
    // (top at -6.5: blocks walkers on the sea bed but passes under the pier deck)
    out.colliders.push({ x: (BEACH.x0 + BEACH.x1) / 2, y: -9, z: zWater + 36, hx: (BEACH.x1 - BEACH.x0) / 2 + 30, hy: 2.5, hz: 0.5, rot: 0 });
  }

  // ---- Seagulls: a small flock (boids: cohesion + separation + wander) ---------------------------
  {
    const N = 12;
    const g = merge([
      paint(new THREE.BoxGeometry(0.12, 0.1, 0.42), '#f4f4f0', 0.03),
      paint(new THREE.BoxGeometry(0.5, 0.025, 0.18).translate(0.27, 0.02, 0).rotateZ(0.25), '#e8e8e4', 0.03),
      paint(new THREE.BoxGeometry(0.5, 0.025, 0.18).translate(-0.27, 0.02, 0).rotateZ(-0.25), '#e8e8e4', 0.03),
    ]);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), N);
    mesh.name = 'seagulls';
    mesh.frustumCulled = false;
    parent.add(mesh);
    const birds = Array.from({ length: N }, (_, i) => ({ p: new THREE.Vector3(780 + rng.next() * 60, 4 + rng.next() * 6, 90 + rng.next() * 40), v: new THREE.Vector3(rng.next() - 0.5, 0, rng.next() - 0.5).multiplyScalar(6), ph: i }));
    const centre = new THREE.Vector3(800, 7, 110), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), acc = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let t = 0;
    out.gulls = { birds, mesh };
    out.updaters.push((dt, ctx) => {
      const f = ctx.focus;
      mesh.visible = Math.hypot(f.x - centre.x, f.z - centre.z) < 300;
      if (!mesh.visible) return;
      t += dt;
      centre.set(800 + Math.sin(t * 0.07) * 90, 7 + Math.sin(t * 0.3) * 1.5, 110 + Math.cos(t * 0.05) * 25);
      birds.forEach((b, i) => {
        acc.subVectors(centre, b.p).multiplyScalar(0.25);
        for (const o of birds) { if (o === b) continue; tmp.subVectors(b.p, o.p); const d2 = tmp.lengthSq(); if (d2 < 9) acc.addScaledVector(tmp, 2 / (d2 + 0.1)); }
        acc.x += Math.sin(t * 0.7 + i) * 1.5; acc.z += Math.cos(t * 0.6 + i * 1.7) * 1.5;
        b.v.addScaledVector(acc, dt);
        const sp = b.v.length(); if (sp > 9) b.v.multiplyScalar(9 / sp); if (sp < 4) b.v.multiplyScalar(4 / Math.max(sp, 0.01));
        b.v.y *= 0.95;
        b.p.addScaledVector(b.v, dt);
        b.p.y = Math.max(WATER_Y + 2.5, b.p.y);
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmp.copy(b.v).setY(0).normalize());
        s.set(1, 1 + Math.sin(t * 9 + b.ph) * 0.8, 1);
        m.compose(b.p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      void up;
    });
  }

  // ---- Promenade walkers' line (both ways) + places --------------------------------------------
  const line = [];
  for (let x = BEACH.x0 + 4; x <= BEACH.x1 - 4; x += 2.5) line.push({ x, z: 59.5, y, ox: 0, oz: 1, detour: null });
  for (let x = BEACH.x1 - 4; x >= BEACH.x0 + 4; x -= 2.5) line.push({ x, z: 62.5, y, ox: 0, oz: -1, detour: null });
  line.push({ ...line[0] });
  out.pedLines.push(line);
  out.places.push({ kind: 'beach', x: 820, z: 95, label: 'Terrace Beach' });

  for (const p of parts) {
    const c = p.ch.finish(parent);
    out.chunks.push(c);
    out.colliders.push(...p.ch.colliders);
    if (p.ch.props.length) out.propChunks.push(p.ch);
  }
  return out;
}
