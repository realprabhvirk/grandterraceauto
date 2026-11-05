// INDUSTRIAL ESTATE (north of downtown, townPlan.js INDUSTRY grid joined by King St): warehouses
// with roller doors and sawtooth roofs, shipping-container stacks, fenced yards, graffiti walls,
// port workers, a slow forklift doing laps of its yard, parked utes (stealable). No highway
// (see DECISIONS.md - needs multi-level roads).
import * as THREE from 'three';
import { frame, makeChunk } from '../town/townKit.js';
import { T, INDUSTRY } from '../town/townPlan.js';
import { staticCar } from '../town/townBuildings.js';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';

const CONT = ['#c8553e', '#2f6fc0', '#e2b33a', '#3a8a4a', '#8a5aa8', '#d27a3c', '#5c6772', '#b8322a'];
const SHED = ['#a8a196', '#8f979e', '#b9b2a3', '#9aa49a'];

function graffitiTexture(rng) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, 512, 128);
  for (let k = 0; k < 9; k++) { g.fillStyle = `hsl(${Math.floor(rng.next() * 360)},70%,${45 + rng.next() * 15}%)`; g.beginPath(); g.ellipse(rng.next() * 512, 30 + rng.next() * 70, 30 + rng.next() * 60, 14 + rng.next() * 26, rng.next() * 3, 0, Math.PI * 2); g.fill(); }
  const words = ['TERRACE', 'GTA', 'BOLT', 'WAVE', 'NORTH', 'RAD', 'KAPOW'];
  for (let k = 0; k < 3; k++) {
    g.save(); g.translate(40 + k * 160 + rng.next() * 20, 80 + rng.next() * 20); g.rotate((rng.next() - 0.5) * 0.4);
    g.font = `900 ${40 + Math.floor(rng.next() * 20)}px Arial`; g.lineWidth = 6; g.strokeStyle = '#1f1f22';
    const w = words[Math.floor(rng.next() * words.length)];
    g.strokeText(w, 0, 0); g.fillStyle = `hsl(${Math.floor(rng.next() * 360)},85%,60%)`; g.fillText(w, 0, 0); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Warehouse: shell + roller doors on the front + sawtooth roof. */
function warehouse(ch, F, { w, d, h, wall }) {
  ch.block(F, w, h, d, 0, 0, -d / 2, wall);
  const n = Math.max(2, Math.floor(w / 12));
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + (k + 0.5) * (w / n);
    ch.box(F, 4.4, 4.6, 0.12, x, 0, 0.05, '#6c7177');
    for (let s = 0; s < 8; s++) ch.box(F, 4.4, 0.05, 0.14, x, 0.4 + s * 0.55, 0.06, '#5a5f64');
  }
  const teeth = Math.max(2, Math.floor(d / 8));
  for (let k = 0; k < teeth; k++) {
    const z = -(k + 0.5) * (d / teeth);
    const g = new THREE.BoxGeometry(w, 0.2, d / teeth * 1.05).rotateX(0.32);
    const p = F.toW(0, z);
    g.rotateY(F.rot).translate(p.x, F.y + h + 1.2, p.z);
    ch.solid.push(paint(g, '#7b8288', 0.04));
    ch.box(F, w, 2.2, 0.15, 0, h, z - d / teeth / 2 + 0.1, '#9fc4d6', { glassy: true });
  }
}

export function buildIndustrial({ parent, atlas, rng }) {
  const out = { chunks: [], colliders: [], places: [], npcSpots: [], updaters: [], propChunks: [], landmarks: [], containers: 0, warehouses: 0, forklift: null };
  const { X, Z } = INDUSTRY, y = T.h, front = T.front;
  const chunks = new Map();
  const chunk = (name) => { if (!chunks.has(name)) chunks.set(name, makeChunk(name)); return chunks.get(name); };
  const graffiti = [];

  for (let j = 0; j + 1 < Z.length; j++) for (let i = 0; i + 1 < X.length; i++) {
    const ch = chunk(`ind${i}${j}`);
    const x0 = X[i] + front, x1 = X[i + 1] - front, z0 = Z[j] + front, z1 = Z[j + 1] - front, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const bw = x1 - x0, bd = z1 - z0;
    // Warehouse on the south half (facing the street to the south), yard + containers north.
    warehouse(ch, frame(cx, z1, 0, 1, y), { w: bw * 0.85, d: bd * 0.42, h: 9 + (i + j) % 3 * 2, wall: SHED[(i + j) % SHED.length] });
    out.warehouses++;
    atlas.sign(frame(cx, z1, 0, 1, y), atlas.row(['TERRACE FREIGHT', 'HARBOUR LOGISTICS', 'BOLT STEEL', 'NORTH CRATES', 'WAVE TIMBER', 'DEPOT 7'][(i + j * 3) % 6], '#26282c', '#e2c25a'), 12, 1.2, 0, 8.2, 0.15);
    // Yard fence along the north street with a gate gap.
    const YF = frame(0, 0, 0, 1, y);
    for (let x = x0; x < x1 - 1; x += 3) {
      if (Math.abs(x + 1.5 - cx) < 5) continue;
      ch.box(YF, 3, 2.0, 0.05, x + 1.5, 0, z0 + 0.6, '#8d9196');
      ch.collide(YF, 3, 2.0, 0.12, x + 1.5, 0, z0 + 0.6);
    }
    for (const sx of [x0, x1]) { ch.box(YF, 0.05, 2.0, bd * 0.5, sx, 0, z0 + bd * 0.25, '#8d9196'); ch.collide(YF, 0.12, 2.0, bd * 0.5, sx, 0, z0 + bd * 0.25); }
    // Container stacks (1-3 high).
    const rows = 2, cols = Math.floor((bw - 16) / 7);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() < 0.25) continue;
      const lx = x0 + 6 + c * 7 + 3, lz = z0 + 6 + r * 3.2;
      const hgt = 1 + Math.floor(rng.next() * 3);
      for (let k = 0; k < hgt; k++) {
        const col = CONT[Math.floor(rng.next() * CONT.length)];
        ch.box(YF, 6.06, 2.59, 2.44, lx, k * 2.6, lz, col);
        for (let s = -2; s <= 2; s++) ch.box(YF, 0.06, 2.3, 2.46, lx + s * 1.2, k * 2.6 + 0.15, lz, col); // corrugation ribs
        out.containers++;
      }
      ch.collide(YF, 6.06, hgt * 2.6, 2.44, lx, 0, lz);
    }
    // A parked ute in some yards (stealable).
    if ((i + j) % 2 === 0) staticCar(ch, x1 - 6, z0 + 14, Math.PI / 2, 'ute', ['#e9e6dc', '#46566b', '#b98a4a'][i % 3]);
    // Graffiti wall on the block's west side.
    graffiti.push({ x: x0 + 0.4, z: cz - bd * 0.05, len: Math.min(28, bd * 0.4) });
    // Port workers.
    const wp = { x: cx + 4, z: z0 + 12 };
    if ((i + j) % 2 === 0) out.npcSpots.push({ role: 'worker', x: wp.x, y, z: wp.z, yaw: rng.next() * 6, action: (i + j) % 2 ? 'look' : 'phone' });
  }

  // Graffiti walls: one shared material per texture variant (3), merged quads.
  const gTex = [0, 1, 2].map(() => graffitiTexture(rng));
  const gMats = gTex.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  graffiti.forEach((gw) => {
    const ch = chunk('ind-graffiti');
    ch.box(frame(0, 0, 0, 1, y), 0.4, 3.2, gw.len, gw.x - 0.2, 0, gw.z, '#b9b2a6');
    ch.collide(frame(0, 0, 0, 1, y), 0.4, 3.2, gw.len, gw.x - 0.2, 0, gw.z);
  });
  const gGroup = new THREE.Group(); gGroup.name = 'graffiti';
  graffiti.forEach((gw, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(gw.len, 3.0).rotateY(-Math.PI / 2).translate(gw.x - 0.42, y + 1.6, gw.z), gMats[k % 3]); gGroup.add(m); });
  parent.add(gGroup);
  out.chunks.push({ group: gGroup, x: (X[0] + X[X.length - 1]) / 2, z: (Z[0] + Z[Z.length - 1]) / 2, r: 180 });
  out.landmarks.push({ name: 'Graffiti walls', x: X[0] + front, z: Z[1] });

  // Gantry crane over the north-east yard (landmark).
  {
    const ch = chunk('ind-crane'), cx = X[2] + 40, cz = Z[0] + 22, F = frame(cx, cz, 0, 1, y);
    for (const s of [-1, 1]) for (const t of [-1, 1]) ch.block(F, 0.9, 22, 0.9, s * 14, 0, t * 5, '#e2b33a');
    for (const s of [-1, 1]) ch.box(F, 30, 1.4, 1.2, 0, 22, s * 5, '#e2b33a');
    ch.box(F, 3, 2.4, 11, 4, 23.4, 0, '#2b2b2e');
    ch.box(F, 0.12, 12, 0.12, 4, 11, 0, '#2b2b2e');
    out.landmarks.push({ name: 'Gantry crane', x: cx, z: cz });
    out.places.push({ kind: 'landmark', x: cx, z: cz, label: 'Gantry Crane' });
  }

  // Forklift: slow laps of the first yard (kinematic, visual + moving collider via a toggle-free box check).
  {
    const fx0 = X[0] + front + 8, fz0 = Z[0] + front + 15, fw = 40, fd = 6;
    const parts = merge([
      paint(new THREE.BoxGeometry(1.2, 1.0, 2.0).translate(0, 0.8, 0), '#e2b33a', 0.04),
      paint(new THREE.BoxGeometry(1.1, 0.08, 1.0).translate(0, 2.3, -0.3), '#2b2b2e', 0.03),
      paint(new THREE.BoxGeometry(0.06, 2.0, 0.06).translate(0.5, 1.3, -0.6), '#2b2b2e', 0.03), paint(new THREE.BoxGeometry(0.06, 2.0, 0.06).translate(-0.5, 1.3, -0.6), '#2b2b2e', 0.03),
      paint(new THREE.BoxGeometry(0.1, 2.6, 0.1).translate(0.35, 1.3, 1.1), '#3a3d42', 0.03), paint(new THREE.BoxGeometry(0.1, 2.6, 0.1).translate(-0.35, 1.3, 1.1), '#3a3d42', 0.03),
      paint(new THREE.BoxGeometry(0.12, 0.06, 1.1).translate(0.3, 0.12, 1.65), '#3a3d42', 0.03), paint(new THREE.BoxGeometry(0.12, 0.06, 1.1).translate(-0.3, 0.12, 1.65), '#3a3d42', 0.03),
      paint(new THREE.BoxGeometry(1.0, 0.6, 1.0).translate(0, 0.45, 1.75), '#a87a4a', 0.05), // crate on the forks
      ...[[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.7], [0.6, -0.7]].map(([x, z]) => paint(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10).rotateZ(Math.PI / 2).translate(x, 0.3, z), '#262628', 0.03)),
    ]);
    const mesh = new THREE.Mesh(parts, MAT.solid);
    mesh.castShadow = true; mesh.name = 'forklift';
    parent.add(mesh);
    const path = [[fx0, fz0], [fx0 + fw, fz0], [fx0 + fw, fz0 + fd], [fx0, fz0 + fd]];
    const per = path.map((p, k) => Math.hypot(path[(k + 1) % 4][0] - p[0], path[(k + 1) % 4][1] - p[1]));
    const total = per.reduce((a, b) => a + b, 0);
    let s = 0;
    const fl = { mesh, speed: 1.6, pos: new THREE.Vector3(fx0, y, fz0), dist: 0 };
    out.forklift = fl;
    out.updaters.push((dt, ctx) => {
      const f = ctx.focus;
      const near = Math.hypot(f.x - fx0, f.z - fz0) < 220;
      mesh.visible = near;
      if (!near) return;
      s = (s + dt * fl.speed) % total; fl.dist += dt * fl.speed;
      let k = 0, r = s;
      while (r > per[k]) { r -= per[k]; k = (k + 1) % 4; }
      const [ax, az] = path[k], [bx, bz] = path[(k + 1) % 4], t = r / per[k];
      fl.pos.set(ax + (bx - ax) * t, y, az + (bz - az) * t);
      mesh.position.copy(fl.pos);
      mesh.rotation.y = Math.atan2(bx - ax, bz - az);
    });
    out.npcSpots.push({ role: 'worker', x: fx0 + fw / 2, y, z: fz0 - 3, yaw: 0, action: 'look' });
  }

  out.places.push({ kind: 'industry', x: (X[0] + X[X.length - 1]) / 2, z: Z[1], label: 'Industrial Estate' });
  for (const ch of chunks.values()) {
    const c = ch.finish(parent);
    out.chunks.push(c);
    out.colliders.push(...ch.colliders);
    if (ch.props.length) out.propChunks.push(ch);
  }
  return out;
}
