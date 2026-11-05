// Building kit for the town: oriented frames, a chunk accumulator (solid + glass geometry,
// merged into 2 meshes per chunk), generic multi-storey buildings with window bands and
// parapets, and a shared sign atlas (all shop/civic signs in one texture = 1 draw call).
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, boxB, merge } from '../utils/geom.js';

/** Oriented frame: local +Z = front (fx, fz); local X along the frontage. */
export function frame(cx, cz, fx, fz, y = 0) {
  const rot = Math.atan2(fx, fz), c = Math.cos(rot), s = Math.sin(rot);
  const toW = (lx, lz) => ({ x: cx + lx * c + lz * s, z: cz - lx * s + lz * c });
  return { cx, cz, fx, fz, rot, y, toW };
}

/** Collects geometry + colliders for one chunk of the town. */
export function makeChunk(name) {
  const solid = [], glass = [], colliders = [], props = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const grow = (x, z, r = 0) => { minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r); minZ = Math.min(minZ, z - r); maxZ = Math.max(maxZ, z + r); };
  const ch = {
    name, solid, glass, colliders, props,
    /** Box in frame-local coords (bottom at ly). */
    box(F, w, h, d, lx, ly, lz, color, { glassy = false, jitter } = {}) {
      const p = F.toW(lx, lz);
      grow(p.x, p.z, Math.max(w, d) / 2);
      (glassy ? glass : solid).push(boxB(w, h, d, p.x, F.y + ly, p.z, color, { rotY: F.rot, jitter }));
    },
    /** Static collider for a frame-local box. */
    collide(F, w, h, d, lx, ly, lz) {
      const p = F.toW(lx, lz);
      colliders.push({ x: p.x, y: F.y + ly + h / 2, z: p.z, hx: w / 2, hy: h / 2, hz: d / 2, rot: F.rot });
    },
    /** Box that is also solid. */
    block(F, w, h, d, lx, ly, lz, color, opts) { ch.box(F, w, h, d, lx, ly, lz, color, opts); ch.collide(F, w, h, d, lx, ly, lz); },
    finish(parent) {
      const group = new THREE.Group();
      group.name = `town-${name}`;
      // Props merged into this chunk (stealable parked cars) remember their vertex ranges so
      // they can be collapsed out of the merged mesh when they turn into real cars.
      const starts = (list) => { const m = new Map(); let n = 0; for (const g of list) { m.set(g, n); n += g.attributes.position.count; } return m; };
      const sS = starts(solid), sG = starts(glass);
      for (const p of props) {
        p.ranges = { solid: p.solidGeos.map((g) => [sS.get(g), g.attributes.position.count]), glass: p.glassGeos.map((g) => [sG.get(g), g.attributes.position.count]) };
        p.meshes = {};
      }
      if (solid.length) { const m = new THREE.Mesh(merge(solid), MAT.solid); m.castShadow = m.receiveShadow = true; group.add(m); for (const p of props) p.meshes.solid = m; }
      if (glass.length) { const m = new THREE.Mesh(merge(glass), MAT.glass); m.receiveShadow = true; group.add(m); for (const p of props) p.meshes.glass = m; }
      for (const p of props) { delete p.solidGeos; delete p.glassGeos; }
      parent.add(group);
      return { group, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, r: Math.hypot(maxX - minX, maxZ - minZ) / 2 };
    },
  };
  return ch;
}

/** Remove a merged prop (see finish) from its chunk mesh by collapsing its vertices. */
export function hideProp(p) {
  for (const k of ['solid', 'glass']) {
    const m = p.meshes?.[k];
    if (!m) continue;
    const a = m.geometry.attributes.position;
    for (const [s, n] of p.ranges[k]) a.array.fill(0, s * 3, (s + n) * 3);
    a.needsUpdate = true;
  }
  p.hidden = true;
}

/**
 * Generic building: shell, floor slabs line, window bands on every side, parapet + roof
 * plant. F at the centre of the FRONT face; the building extends backwards (-Z local).
 */
export function building(ch, F, { w, d, floors, floorH = 3.4, wall, trim = '#efe9dd', roof = '#8d8a84', ground = null, windows = true }) {
  const H = floors * floorH;
  ch.block(F, w, H, d, 0, 0, -d / 2, wall);
  ch.box(F, w + 0.3, 0.6, d + 0.3, 0, H, -d / 2, trim); // parapet cap
  ch.box(F, w - 0.6, 0.05, d - 0.6, 0, H + 0.6, -d / 2, roof);
  ch.box(F, Math.min(4, w / 3), 1.2, Math.min(3, d / 3), w / 5, H + 0.6, -d * 0.6, '#9b9890'); // roof plant
  if (!windows) return H;
  const start = ground === null ? 0 : 1;
  for (let f = start; f < floors; f++) {
    const y = f * floorH + 0.95;
    // Front + back bands of windows.
    for (let x = -w / 2 + 1.6; x <= w / 2 - 1.6; x += 2.6) {
      ch.box(F, 1.7, 1.55, 0.12, x, y, 0.04, '#4d6577', { glassy: true });
      ch.box(F, 1.7, 1.55, 0.12, x, y, -d - 0.04, '#4d6577', { glassy: true });
    }
    for (let z = -1.6; z >= -d + 1.6; z -= 2.6) {
      ch.box(F, 0.12, 1.55, 1.7, w / 2 + 0.04, y, z, '#4d6577', { glassy: true });
      ch.box(F, 0.12, 1.55, 1.7, -w / 2 - 0.04, y, z, '#4d6577', { glassy: true });
    }
    ch.box(F, w + 0.12, 0.14, d + 0.12, 0, f * floorH, -d / 2, trim); // floor line
  }
  return H;
}

/** One shared canvas atlas of sign texts: rows of 64 px. */
export function createSignAtlas() {
  const W = 1024, ROW = 64, ROWS = 16;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = ROW * ROWS;
  const g = canvas.getContext('2d');
  const rows = new Map();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.15 });
  const quads = [];
  const atlas = {
    tex, mat,
    /** Reserve a row: text on a background colour. Returns the row index. */
    row(text, bg = '#2f3b44', fg = '#f4f1e8', font = 'bold 40px Arial') {
      const key = `${text}|${bg}|${fg}`;
      if (rows.has(key)) return rows.get(key);
      const i = rows.size;
      g.fillStyle = bg; g.fillRect(0, i * ROW, W, ROW);
      g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, W / 2, i * ROW + ROW / 2 + 2, W - 40);
      rows.set(key, i);
      tex.needsUpdate = true;
      return i;
    },
    /** A sign face (plane) at frame-local position, facing +Z local. u0/u1 crop the row. */
    sign(F, row, w, h, lx, ly, lz, { u0 = 0, u1 = 1, back = false } = {}) {
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) {
        uv.setX(k, u0 + uv.getX(k) * (u1 - u0));
        uv.setY(k, 1 - (row + 1 - uv.getY(k)) * ROW / (ROW * ROWS));
      }
      if (back) geo.rotateY(Math.PI);
      geo.rotateY(F.rot);
      const p = F.toW(lx, lz);
      geo.translate(p.x, F.y + ly, p.z);
      quads.push(geo);
    },
    mesh() {
      const m = new THREE.Mesh(quads.length ? merge(quads.map((q) => { q.deleteAttribute('normal'); q.computeVertexNormals(); return q; })) : new THREE.BufferGeometry(), mat);
      m.name = 'town-signs';
      return m;
    },
  };
  return atlas;
}

export { box, boxB };
