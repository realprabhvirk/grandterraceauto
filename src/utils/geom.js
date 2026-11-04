// Geometry helpers: per-face colour painting, primitive builders, merging.
// Every static mesh in the game goes through paint() so it gets the same flat-shaded,
// slightly hand-painted look (small per-triangle brightness/warmth jitter).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

/**
 * Convert to non-indexed, keep only position+normal, add a per-triangle 'color'
 * attribute: base colour with a small deterministic brightness + warmth jitter.
 */
export function paint(geo, color, jitter = 0.05, seed = 1) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  let s = (seed * 2654435761) >>> 0;
  for (let i = 0; i < n; i += 3) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const r1 = s / 4294967296 - 0.5;
    s = (s * 1664525 + 1013904223) >>> 0;
    const r2 = s / 4294967296 - 0.5;
    const k = 1 + r1 * 2 * jitter;
    const warm = r2 * jitter * 0.6;
    const r = _c.r * k * (1 + warm), gg = _c.g * k, b = _c.b * k * (1 - warm);
    for (let j = 0; j < 3; j++) {
      col[(i + j) * 3] = r;
      col[(i + j) * 3 + 1] = gg;
      col[(i + j) * 3 + 2] = b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

let _seed = 1;
const nextSeed = () => (_seed = (_seed * 48271) % 2147483647);

/** Axis-aligned box centred at (x, y, z), optional Y rotation, painted. */
export function box(w, h, d, x, y, z, color, { rotY = 0, jitter = 0.05 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, color, jitter, nextSeed());
}

/** Box whose bottom sits at y (handier for building parts). */
export function boxB(w, h, d, x, y, z, color, opts) {
  return box(w, h, d, x, y + h / 2, z, color, opts);
}

export function cylinder(rTop, rBot, h, seg, x, y, z, color, { jitter = 0.05 } = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(x, y + h / 2, z);
  return paint(g, color, jitter, nextSeed());
}

export function icosa(r, detail, x, y, z, color, { sx = 1, sy = 1, sz = 1, jitter = 0.08 } = {}) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return paint(g, color, jitter, nextSeed());
}

/** Paint an arbitrary geometry and translate it. */
export function painted(geo, color, x = 0, y = 0, z = 0, jitter = 0.05) {
  geo.translate(x, y, z);
  return paint(geo, color, jitter, nextSeed());
}

/** Build a painted geometry from a flat list of triangles [[x,y,z]x3, ...]. */
export function trisGeometry(tris, color, jitter = 0.05) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((v, j) => pos.set(v, i * 9 + j * 3)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, color, jitter, nextSeed());
}

/** Merge painted geometries (all must have position/normal/color). Disposes inputs. */
export function merge(list) {
  const valid = list.filter(Boolean);
  if (!valid.length) return new THREE.BufferGeometry();
  const out = mergeGeometries(valid, false);
  for (const g of valid) g.dispose();
  return out;
}

/** Apply a transform matrix to a list of geometries in place. */
export function transformAll(list, matrix) {
  for (const g of list) g.applyMatrix4(matrix);
  return list;
}
