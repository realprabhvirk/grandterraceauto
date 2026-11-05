// Phase 6 landmarks (seen from far, on the map):
//  - City Hall + clock tower (Station St, opposite Central Gardens): sandstone hall, columned
//    portico, 34 m tower with four clock faces whose hands follow the real local time.
//  - Terrace Stadium (south of The Esplanade, on a graded pad): oval bowl of stepped stands,
//    pitch with markings, four floodlight masts, canopy roofs, open gate on the town side.
//  - TV tower on the southern hill: tapered shaft, observation pod, antenna + red beacon.
//  - Three roadside billboards (motorway x2, The Esplanade).
import * as THREE from 'three';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';
import { frame, createSignAtlas } from '../town/townKit.js';

export const LANDMARKS = {
  cityHall: { x: 530, z: -20, w: 28, d: 28 },            // front (west face) on Station St's building line
  stadium: { x: 450, z: 112, a: 44, b: 34, pad: -4.2 },   // ellipse half-axes (outer)
  tv: { x: 440, z: 232 },
  billboards: [{ x: 600, z: -270, fz: 1, ad: 0 }, { x: 660, z: -270, fz: 1, ad: 1 }, { x: 500, z: 64, fz: -1, ad: 2 }],
};
const ADS = [['TERRACE STADIUM - SAT NIGHT', '#1f6a4a', '#ffffff'], ['SURF FM 101.7', '#2f6fc0', '#ffffff'], ['TERRACE COLA', '#c8322a', '#ffffff']];

/** Terrain lot pad for the stadium (passed to new Terrain({ lots })). */
export function landmarkLots() {
  const S = LANDMARKS.stadium;
  return [{ x: S.x, z: S.z, rot: 0, hw: S.a + 4, hd: S.b + 4, h: S.pad, fall: 16 }];
}

export function buildLandmarks({ scene, physics, terrain }) {
  const parts = [], colliders = [], places = [], updaters = [];
  const atlas = createSignAtlas();
  const P = (geo, color, j = 0.03) => parts.push(paint(geo, color, j));
  const box = (w, h, d, x, y, z, color, rotY = 0) => P(new THREE.BoxGeometry(w, h, d).rotateY(rotY).translate(x, y + h / 2, z), color);
  const col = (hx, hy, hz, x, y, z, rotY = 0) => colliders.push({ x, y, z, hx, hy, hz, rot: rotY });

  // ---------------------------------------------------------------- City Hall + clock tower
  {
    const C = LANDMARKS.cityHall, y = terrain.getHeight(C.x + 10, C.z), F = frame(C.x, C.z, -1, 0, y);
    const at = (lx, lz) => F.toW(lx, lz);
    const hall = (w, h, d, lx, ly, lz, color, solid = true) => {
      const p = at(lx, lz);
      box(w, h, d, p.x, y + ly, p.z, color, F.rot);
      if (solid) col(w / 2, h / 2, d / 2, p.x, y + ly + h / 2, p.z, F.rot);
    };
    hall(C.w, 9, C.d - 4, 0, 0, -C.d / 2 - 2, '#d8c49a');                 // main hall
    hall(C.w + 0.6, 0.8, C.d - 3.4, 0, 9, -C.d / 2 - 2, '#efe6d2', false);  // cornice
    hall(14, 1.2, 4, 0, 0, -2, '#cfc3ab');                                 // portico steps
    hall(14, 0.9, 4.4, 0, 8.1, -2, '#efe6d2', false);                      // portico roof
    for (let k = 0; k < 6; k++) hall(0.7, 6.9, 0.7, -6 + k * 2.4, 1.2, -0.6, '#f2ead8');
    for (let k = 0; k < 5; k++) hall(2, 3, 0.1, -C.w / 2 + 3 + k * 5.5 + (k > 1 ? 2 : 0), 3.5, -4.05, '#4d6577', false);
    // Tower over the entrance: shaft, clock stage, belfry, copper spire.
    hall(6, 25, 6, 0, 9, -9, '#d2bd92');
    hall(6.8, 5, 6.8, 0, 26, -9, '#e6dcc4', false);
    hall(5.2, 3.2, 5.2, 0, 31, -9, '#cfc3ab', false);
    const sp = at(0, -9);
    P(new THREE.ConeGeometry(4.2, 7, 4).rotateY(Math.PI / 4 + F.rot).translate(sp.x, y + 34.2 + 3.5, sp.z), '#4f8f7a');
    // Clock faces (white discs + numerals ring) on the 4 sides; hands are separate meshes (animated).
    const handMat = new THREE.MeshLambertMaterial({ color: '#1c1d20' });
    const faces = [];
    for (let k = 0; k < 4; k++) {
      const yaw = F.rot + k * Math.PI / 2, nx = Math.sin(yaw), nz = Math.cos(yaw);
      const cx = sp.x + nx * 3.42, cz = sp.z + nz * 3.42, cy = y + 28.5;
      P(new THREE.CircleGeometry(2.0, 24).rotateY(yaw).translate(cx, cy, cz), '#f6f2e6', 0);
      for (let h = 0; h < 12; h++) {
        const a = h / 12 * Math.PI * 2;
        P(new THREE.BoxGeometry(0.14, 0.4, 0.04).translate(0, 1.6, 0).rotateZ(-a).rotateY(yaw).translate(cx + nx * 0.02, cy, cz + nz * 0.02), '#1c1d20', 0);
      }
      const g = new THREE.Group(); g.position.set(cx + nx * 0.06, cy, cz + nz * 0.06); g.rotation.y = yaw;
      const hr = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.05).translate(0, 0.45, 0), handMat);
      const mn = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.05).translate(0, 0.7, 0.03), handMat);
      g.add(hr, mn); scene.add(g); faces.push({ hr, mn });
    }
    atlas.sign(frame(at(0, 0.2).x, at(0, 0.2).z, -1, 0, y), atlas.row('CITY HALL', '#efe6d2', '#3a2f22', 'bold 46px Georgia'), 9, 0.9, 0, 7.0, 0.05);
    const st = { faces: faces.length, hour: 0, minute: 0 };
    updaters.push(() => {
      const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      st.hour = h; st.minute = m;
      for (const f of faces) { f.hr.rotation.z = -h / 12 * Math.PI * 2; f.mn.rotation.z = -m / 60 * Math.PI * 2; }
    });
    const door = at(0, 2);
    places.push({ kind: 'landmark', x: door.x, z: door.z, label: 'City Hall' });
    LANDMARKS.cityHall.clock = st;
  }

  // ---------------------------------------------------------------- Terrace Stadium
  {
    const S = LANDMARKS.stadium, y = S.pad, N = 28, TIERS = 5;
    const ring = (sa, sb, k) => { const a = ((k - 0.5) / N) * Math.PI * 2; return { x: S.x + Math.cos(a) * sa, z: S.z + Math.sin(a) * sb, a }; };
    const gate = (k) => k === Math.round(N * 0.75); // north (-z, facing town)
    for (let k = 0; k < N; k++) {
      if (gate(k)) continue;
      for (let t = 0; t <= TIERS; t++) {
        const f = t / TIERS, sa = S.a - 12 + f * 12, sb = S.b - 12 + f * 12;
        const p0 = ring(sa, sb, k), p1 = ring(sa, sb, k + 1), mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
        const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.5, rot = Math.atan2(p1.z - p0.z, p1.x - p0.x);
        const outer = t === TIERS, h = outer ? 15 : 1.4 + t * 2.4, thick = outer ? 1.0 : 2.6;
        const colr = outer ? (k % 2 ? '#c9c4b8' : '#b8b2a6') : t % 2 ? '#2f6fc0' : '#e8e4dc';
        box(len, h, thick, mx, y, mz, colr, -rot);
        col(len / 2, h / 2, thick / 2, mx, y + h / 2, mz, -rot);
      }
    }
    // Pitch + markings, canopy roofs over the long stands, floodlights, sign.
    box(S.a * 2 - 26, 0.06, S.b * 2 - 26, S.x, y, S.z, '#4f9a3a');
    for (let k = -3; k <= 3; k++) box(4.5, 0.02, S.b * 2 - 28, S.x + k * 9, y + 0.06, S.z, k % 2 ? '#5aa844' : '#4f9a3a', 0);
    box(0.25, 0.03, S.b * 2 - 30, S.x, y + 0.08, S.z, '#f4f1e8');
    box(S.a * 2 - 30, 0.03, 0.25, S.x, y + 0.08, S.z - S.b + 15, '#f4f1e8');
    box(S.a * 2 - 30, 0.03, 0.25, S.x, y + 0.08, S.z + S.b - 15, '#f4f1e8');
    for (const s of [-1, 1]) box(0.25, 0.03, S.b * 2 - 30, S.x + s * (S.a - 15), y + 0.08, S.z, '#f4f1e8');
    for (const s of [-1, 1]) box(30, 0.4, 9, S.x, y + 15.6, S.z + s * (S.b - 4.5), '#e8e4dc');
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = S.x + sx * (S.a - 3), z = S.z + sz * (S.b - 3);
      box(0.9, 30, 0.9, x, y, z, '#8d9196'); col(0.45, 15, 0.45, x, y + 15, z);
      box(4.4, 2.6, 0.5, x, y + 30, z, '#e8e4dc', Math.atan2(sx, sz));
    }
    const gp = ring(S.a, S.b, Math.round(N * 0.75) + 0.5);
    atlas.sign(frame(gp.x, gp.z - 0.8, 0, -1, y), atlas.row('TERRACE STADIUM', '#1f6a4a', '#ffffff', 'bold 46px Arial'), 16, 1.6, 0, 12.5, 0);
    places.push({ kind: 'landmark', x: gp.x, z: gp.z, label: 'Terrace Stadium' });
  }

  // ---------------------------------------------------------------- TV tower
  {
    const V = LANDMARKS.tv, y = terrain.getHeight(V.x, V.z);
    P(new THREE.CylinderGeometry(1.5, 2.6, 62, 10).translate(V.x, y + 31, V.z), '#e6e2da');
    P(new THREE.CylinderGeometry(7, 5.2, 3.2, 16).translate(V.x, y + 52, V.z), '#cfd3d6');
    P(new THREE.CylinderGeometry(7.1, 7.1, 1.6, 16).translate(V.x, y + 54.4, V.z), '#4d6577');
    P(new THREE.CylinderGeometry(5.6, 7, 1.6, 16).translate(V.x, y + 56, V.z), '#cfd3d6');
    for (let k = 0; k < 6; k++) P(new THREE.CylinderGeometry(0.5, 0.5, 4, 6).translate(V.x, y + 58.8 + k * 4, V.z), k % 2 ? '#e6e2da' : '#c8322a');
    P(new THREE.CylinderGeometry(4, 6, 3, 12).translate(V.x, y + 1.5, V.z), '#b8b2a6');
    col(2.4, 31, 2.4, V.x, y + 31, V.z);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false }));
    beacon.position.set(V.x, y + 83.2, V.z); scene.add(beacon);
    let t = 0;
    updaters.push((dt) => { t += dt; beacon.visible = (t % 1.6) < 0.8; });
    places.push({ kind: 'landmark', x: V.x, z: V.z, label: 'TV Tower' });
  }

  // ---------------------------------------------------------------- Roadside billboards
  for (const b of LANDMARKS.billboards) {
    const y = terrain.getHeight(b.x, b.z), F = frame(b.x, b.z, 0, b.fz, y), ad = ADS[b.ad];
    for (const s of [-1, 1]) { const p = F.toW(s * 5, -0.3); box(0.5, 7, 0.5, p.x, y, p.z, '#5c5f66'); col(0.25, 3.5, 0.25, p.x, y + 3.5, p.z); }
    const p = F.toW(0, -0.5);
    box(15, 4.6, 0.3, p.x, y + 6, p.z, '#2b2b2e', F.rot);
    atlas.sign(F, atlas.row(ad[0], ad[1], ad[2], 'bold 40px Arial'), 14.4, 4.0, 0, 8.3, -0.3);
  }

  const mesh = new THREE.Mesh(merge(parts), MAT.solid);
  mesh.name = 'landmarks'; mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  scene.add(atlas.mesh());
  for (const c of colliders) {
    const q = { x: 0, y: Math.sin(c.rot / 2), z: 0, w: Math.cos(c.rot / 2) };
    const cl = physics.world.createCollider(physics.RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z).setRotation(q));
    physics.tag?.(cl, 'landmark');
  }
  return { mesh, places, colliders: colliders.length, update(dt) { for (const u of updaters) u(dt); }, clock: LANDMARKS.cityHall.clock };
}
