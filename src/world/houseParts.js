// Reusable low-poly building parts shared by the regular houses and the hero house.
// All functions push painted geometries into caller-supplied arrays.
import * as THREE from 'three';
import { box, trisGeometry, painted } from '../utils/geom.js';

/**
 * Framed window with sill. face: 'z' (+Z front), '-z', 'x', '-x'.
 * (x, y, z) is the centre of the window on the wall plane; y is the window centre height.
 */
export function addWindow(out, { x, y, z, w, h, face = 'z', frame, glassColor, sill = true, mullion = true, frameT = 0.09, depth = 0.08 }) {
  const { detail, glass } = out;
  const along = face === 'z' || face === '-z';
  const sign = face.startsWith('-') ? -1 : 1;
  const ft = frameT, d = depth;
  const place = (W, H, D, cx, cy, off, color) => {
    if (along) return box(W, H, D, x + cx, y + cy, z + sign * off, color);
    return box(D, H, W, x + sign * off, y + cy, z + cx, color);
  };
  // Frame: head, foot, two jambs.
  detail.push(place(w + ft * 2, ft, d, 0, h / 2 + ft / 2, d / 2, frame));
  detail.push(place(w + ft * 2, ft, d, 0, -h / 2 - ft / 2, d / 2, frame));
  detail.push(place(ft, h, d, -w / 2 - ft / 2, 0, d / 2, frame));
  detail.push(place(ft, h, d, w / 2 + ft / 2, 0, d / 2, frame));
  if (mullion && w > 1.1) detail.push(place(ft * 0.7, h, d * 0.8, 0, 0, d / 2, frame));
  if (sill) detail.push(place(w + ft * 2 + 0.16, 0.07, 0.2, 0, -h / 2 - ft - 0.035, 0.1, frame));
  glass.push(place(w, h, 0.03, 0, 0, 0.02, glassColor));
}

/** Hip roof over a W x D rectangle (centred at cx, cz) with eaves overhang. Ridge along the longer axis. */
export function hipRoof(out, { cx = 0, cz = 0, y, W, D, pitch = 24, overhang = 0.55, color, fascia, soffit, fasciaH = 0.22, caps = null }) {
  const w = W / 2 + overhang, d = D / 2 + overhang;
  const t = Math.tan(THREE.MathUtils.degToRad(pitch));
  const tris = [];
  const v = (x, yy, z) => [cx + x, yy, cz + z];
  if (w >= d) {
    const rise = d * t, r = w - d; // ridge half-length
    const top = y + rise;
    tris.push([v(-w, y, d), v(w, y, d), v(r, top, 0)], [v(-w, y, d), v(r, top, 0), v(-r, top, 0)]);
    tris.push([v(w, y, -d), v(-w, y, -d), v(-r, top, 0)], [v(w, y, -d), v(-r, top, 0), v(r, top, 0)]);
    tris.push([v(w, y, d), v(w, y, -d), v(r, top, 0)]);
    tris.push([v(-w, y, -d), v(-w, y, d), v(-r, top, 0)]);
  } else {
    const rise = w * t, r = d - w;
    const top = y + rise;
    tris.push([v(w, y, d), v(w, y, -d), v(0, top, -r)], [v(w, y, d), v(0, top, -r), v(0, top, r)]);
    tris.push([v(-w, y, -d), v(-w, y, d), v(0, top, r)], [v(-w, y, -d), v(0, top, r), v(0, top, -r)]);
    tris.push([v(-w, y, d), v(w, y, d), v(0, top, r)]);
    tris.push([v(w, y, -d), v(-w, y, -d), v(0, top, -r)]);
  }
  out.roof.push(trisGeometry(tris, color, 0.05));
  // Tile roofs: capping along the ridge and the four hips.
  if (caps) {
    const rise = (w >= d ? d : w) * t, top = y + rise;
    const ends = w >= d ? [[-(w - d), 0], [w - d, 0]] : [[0, -(d - w)], [0, d - w]];
    const seg = (a, b) => out.detail.push(capSegment(a, b, caps));
    seg([cx + ends[0][0], top + 0.03, cz + ends[0][1]], [cx + ends[1][0], top + 0.03, cz + ends[1][1]]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const e = w >= d ? ends[sx > 0 ? 1 : 0] : ends[sz > 0 ? 1 : 0];
      seg([cx + sx * w, y + 0.03, cz + sz * d], [cx + e[0], top + 0.03, cz + e[1]]);
    }
  }
  // Soffit (underside) and fascia band around the eaves.
  if (soffit) out.detail.push(soffitPlane(w * 2, d * 2, cx, y - 0.01, cz, soffit));
  if (fascia) {
    out.detail.push(box(w * 2 + 0.04, fasciaH, 0.05, cx, y - fasciaH / 2 + 0.03, cz + d, fascia));
    out.detail.push(box(w * 2 + 0.04, fasciaH, 0.05, cx, y - fasciaH / 2 + 0.03, cz - d, fascia));
    out.detail.push(box(0.05, fasciaH, d * 2, cx + w, y - fasciaH / 2 + 0.03, cz, fascia));
    out.detail.push(box(0.05, fasciaH, d * 2, cx - w, y - fasciaH / 2 + 0.03, cz, fascia));
  }
  return y + (w >= d ? d : w) * t;
}

/** Gable roof, ridge along X, gable triangles go into `walls` so they take the wall colour. */
export function gableRoof(out, { cx = 0, cz = 0, y, W, D, pitch = 22, overhang = 0.5, color, fascia, soffit }) {
  const w = W / 2 + overhang, d = D / 2 + overhang;
  const t = Math.tan(THREE.MathUtils.degToRad(pitch));
  const top = y + d * t;
  const v = (x, yy, z) => [cx + x, yy, cz + z];
  out.roof.push(trisGeometry([
    [v(-w, y, d), v(w, y, d), v(w, top, 0)], [v(-w, y, d), v(w, top, 0), v(-w, top, 0)],
    [v(w, y, -d), v(-w, y, -d), v(-w, top, 0)], [v(w, y, -d), v(-w, top, 0), v(w, top, 0)],
  ], color, 0.05));
  // Gable end walls (slightly inset under the roof).
  const gw = W / 2, gd = D / 2, gTop = y + gd * t;
  out.walls.push(trisGeometry([
    [v(gw, y, gd), v(gw, y, -gd), v(gw, gTop, 0)],
    [v(-gw, y, -gd), v(-gw, y, gd), v(-gw, gTop, 0)],
  ], '#ffffff', 0.03));
  if (soffit) out.detail.push(soffitPlane(w * 2, d * 2, cx, y - 0.01, cz, soffit));
  if (fascia) {
    out.detail.push(box(w * 2 + 0.04, 0.2, 0.05, cx, y - 0.07, cz + d, fascia));
    out.detail.push(box(w * 2 + 0.04, 0.2, 0.05, cx, y - 0.07, cz - d, fascia));
    // Barge boards along the gable rakes.
    const len = Math.hypot(d, d * t), ang = Math.atan(t);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.06, 0.2, len);
      g.rotateX(sz * ang);
      g.translate(cx + sx * (w + 0.01), y + (d * t) / 2 - 0.05, cz + (sz * d) / 2);
      out.detail.push(painted(g, fascia));
    }
  }
  return top;
}

/** Thin capping bar from point a to point b (ridge / hip tiles). */
function capSegment(a, b, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.BoxGeometry(len, 0.09, 0.16);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  const m = A.add(B).multiplyScalar(0.5);
  return painted(g, color, m.x, m.y, m.z, 0.04);
}

/** Downward-facing soffit plane under the eaves. */
function soffitPlane(w, d, x, y, z, color) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(Math.PI / 2);
  return painted(g, color, x, y, z, 0.01);
}

/** Panelled garage door (recessed), centre x at the wall plane z. */
export function addGarageDoor(out, { x, z, w, h, color, dark, frame }) {
  out.detail.push(box(w + 0.24, h + 0.12, 0.08, x, (h + 0.12) / 2, z + 0.02, frame));
  out.detail.push(box(w, h, 0.06, x, h / 2 + 0.02, z + 0.06, color, { jitter: 0.02 }));
  const panels = 5;
  for (let i = 1; i < panels; i++) out.detail.push(box(w - 0.1, 0.035, 0.03, x, (h / panels) * i + 0.02, z + 0.1, dark, { jitter: 0.01 }));
}

/** Front door with frame, optional sidelight, handle. */
export function addDoor(out, { x, z, w = 1.0, h = 2.15, color, frame, glassColor, sidelight = false, handle = '#c9b27a' }) {
  out.detail.push(box(w + 0.18, h + 0.09, 0.07, x, (h + 0.09) / 2, z + 0.02, frame));
  out.detail.push(box(w, h, 0.06, x, h / 2, z + 0.05, color, { jitter: 0.03 }));
  out.detail.push(box(0.05, 0.05, 0.08, x + w * 0.36, 1.0, z + 0.1, handle));
  if (sidelight) {
    out.detail.push(box(0.45, h + 0.09, 0.07, x + w / 2 + 0.33, (h + 0.09) / 2, z + 0.02, frame));
    out.glass.push(box(0.3, h - 0.15, 0.03, x + w / 2 + 0.33, h / 2, z + 0.07, glassColor));
  }
}
