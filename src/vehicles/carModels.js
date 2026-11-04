// Procedural low-poly cars (hatch, sedan, ute, 4WD) built from CAR_TYPES proportions.
// Lower body = extruded side profile with real wheel-arch cut-outs and bevelled edges;
// cabin = tapered hull with inset glass panels (pillars read naturally between them).
// Returns separate geometries per material so each car is 5 draw calls + shared wheels.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { box, boxB, cylinder, paint, merge } from '../utils/geom.js';

const C = PALETTE.cars;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Push a quad as 2 triangles into a flat position list, wound to face `want`. */
function quad(list, a, b, c, d, want) {
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const pts = n.dot(want) >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  for (const p of pts) list.push(p.x, p.y, p.z);
}
function geoFrom(list, color, jitter = 0.03) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3));
  g.computeVertexNormals();
  return paint(g, color, jitter, list.length);
}

/** Side profile of the lower body in (z, y), with wheel arches cut into the bottom edge. */
function bodyProfile(t) {
  const zf = t.wheelBase / 2 + t.frontOverhang, zr = zf - t.L;
  const yb = t.clearance, belt = t.belt, nose = belt - 0.2, tail = belt - 0.05;
  const ra = t.wheelR + 0.07;
  const pts = [];
  const arch = (zc) => {
    const dy = t.wheelR - yb, dx = Math.sqrt(Math.max(0.01, ra * ra - dy * dy));
    const d = Math.asin(Math.min(1, dy / ra));
    pts.push([zc - dx, yb]);
    for (let k = 1; k < 9; k++) {
      const th = Math.PI + d - ((Math.PI + 2 * d) * k) / 9;
      pts.push([zc + Math.cos(th) * ra, t.wheelR + Math.sin(th) * ra]);
    }
    pts.push([zc + dx, yb]);
  };
  pts.push([zr + 0.1, yb]);
  arch(-t.wheelBase / 2);
  arch(t.wheelBase / 2);
  pts.push([zf - 0.12, yb], [zf, yb + 0.16], [zf + 0.01, nose - 0.1], [zf - 0.14, nose]);
  // Hood rises gently to the windscreen base.
  pts.push([t.cabin[1] + 0.05, belt]);
  if (t.tray) {
    pts.push([t.cabin[0], belt], [t.tray[1], belt], [zr + 0.08, belt - 0.02]);
  } else {
    pts.push([zr + 0.28, tail]);
  }
  pts.push([zr, tail - 0.12], [zr - 0.01, yb + 0.18]);
  return { pts, zf, zr, nose, tail };
}

function extrudeProfile(points, width, color) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const bevel = 0.06;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 4,
  });
  // Shape x -> car z, extrusion -> car x (centred).
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  return paint(g, color, 0.025, 7);
}

/**
 * Tapered cabin hull + inset glass. b = bottom (belt) z-range/half-width, t = top.
 * windows: list of side window spans as fractions [u0, u1] along the side.
 */
function cabin(out, cfg, paintColor, windows) {
  const yb = cfg.belt, yt = cfg.roof;
  const bw = cfg.W / 2 - 0.08, tw = cfg.W / 2 - 0.25;
  const [bz0, bz1] = cfg.cabin, [tz0, tz1] = cfg.roofSpan;
  const P = {
    bl0: V(bw, yb, bz0), bl1: V(bw, yb, bz1), br0: V(-bw, yb, bz0), br1: V(-bw, yb, bz1),
    tl0: V(tw, yt, tz0), tl1: V(tw, yt, tz1), tr0: V(-tw, yt, tz0), tr1: V(-tw, yt, tz1),
  };
  const shell = [];
  const faceN = (a, b, c) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  const front = [P.br1, P.bl1, P.tl1, P.tr1], rear = [P.bl0, P.br0, P.tr0, P.tl0];
  const left = [P.bl0, P.bl1, P.tl1, P.tl0], right = [P.br1, P.br0, P.tr0, P.tr1];
  const top = [P.tl0, P.tl1, P.tr1, P.tr0];
  const outward = (f) => {
    const n = faceN(f[0], f[1], f[2]);
    const c = f.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    if (n.dot(c.clone().sub(V(0, (yb + yt) / 2, (bz0 + bz1) / 2))) < 0) n.negate();
    return n;
  };
  for (const f of [front, rear, left, right, top]) quad(shell, f[0], f[1], f[2], f[3], outward(f));
  out.paint.push(geoFrom(shell, paintColor, 0.025));

  // Glass: inset copies of the faces, pushed 1.5 cm out.
  const glass = [];
  const inset = (f, ins, n) => {
    const c = f.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    return f.map((p) => p.clone().lerp(c, ins).addScaledVector(n, 0.015));
  };
  for (const f of [front, rear]) {
    const n = outward(f);
    const g = inset(f, 0.11, n);
    quad(glass, g[0], g[1], g[2], g[3], n);
  }
  // Side windows: spans along the side trapezoid, between belt+6 cm and roof-6 cm.
  for (const s of [1, -1]) {
    const f = s > 0 ? left : right;
    const n = outward(f);
    const y0 = yb + 0.07, y1 = yt - 0.07;
    const at = (y, u) => {
      const k = (y - yb) / (yt - yb);
      const z0 = bz0 + (tz0 - bz0) * k, z1 = bz1 + (tz1 - bz1) * k;
      const x = (bw + (tw - bw) * k) * s;
      return V(x, y, z0 + (z1 - z0) * u).addScaledVector(n, 0.015);
    };
    for (const [u0, u1] of windows) quad(glass, at(y0, u0), at(y0, u1), at(y1, u1), at(y1, u0), n);
  }
  out.glass.push(geoFrom(glass, '#ffffff', 0.0));
}

/**
 * Build a car's geometries.
 * @returns { paint, glass, head, tail, reverse } geometries (car-local) + light anchor points
 */
export function buildCarGeometry(type, cfg, paintColor, { hero = false } = {}) {
  const out = { paint: [], glass: [], head: [], tail: [], reverse: [] };
  const prof = bodyProfile(cfg);
  out.paint.push(extrudeProfile(prof.pts, cfg.W, paintColor));
  const { zf, zr, nose, tail } = prof;
  const W = cfg.W, hw = W / 2;
  const trim = C.trim;

  const windows = type === 'suv' ? [[0.05, 0.36], [0.41, 0.7], [0.75, 0.95]]
    : type === 'ute' ? [[0.08, 0.92]]
    : type === 'hatch' ? [[0.06, 0.48], [0.53, 0.9]]
    : [[0.06, 0.47], [0.52, 0.93]];
  cabin(out, cfg, paintColor, windows);

  // Bumpers / lower trim, grille, plates.
  out.paint.push(box(W - 0.02, 0.2, 0.16, 0, cfg.clearance + 0.12, zf - 0.04, trim));
  out.paint.push(box(W - 0.02, 0.2, 0.16, 0, cfg.clearance + 0.12, zr + 0.04, trim));
  out.paint.push(box(W - 0.8, 0.15, 0.05, 0, nose - 0.19, zf + 0.0, trim));
  out.paint.push(box(0.4, 0.12, 0.03, 0, cfg.clearance + 0.25, zf + 0.05, C.plate));
  out.paint.push(box(0.4, 0.12, 0.03, 0, cfg.clearance + 0.36, zr - 0.065, C.plate));
  // Side skirts + door seams + handles + mirrors.
  for (const s of [1, -1]) {
    out.paint.push(box(0.05, 0.09, cfg.wheelBase - 2 * (cfg.wheelR + 0.12), s * (hw - 0.01), cfg.clearance + 0.05, 0, trim));
    const seams = type === 'ute' ? [cfg.cabin[1] - 0.02, cfg.cabin[0] + 0.05]
      : [cfg.cabin[1] - 0.02, (cfg.cabin[0] + cfg.cabin[1]) / 2 + 0.05, cfg.cabin[0] + 0.12];
    for (const z of seams) out.paint.push(box(0.012, cfg.belt - cfg.clearance - 0.22, 0.02, s * (hw + 0.004), (cfg.belt + cfg.clearance) / 2 + 0.04, z, trim));
    out.paint.push(box(0.03, 0.035, 0.14, s * (hw + 0.01), cfg.belt - 0.12, cfg.cabin[1] - 0.35, C.chrome));
    out.paint.push(box(0.09, 0.1, 0.17, s * (hw + 0.06), cfg.belt + 0.1, cfg.cabin[1] - 0.22, paintColor));
    out.paint.push(box(0.03, 0.08, 0.14, s * (hw + 0.1), cfg.belt + 0.1, cfg.cabin[1] - 0.22, C.glass));
  }

  // Lights.
  const lx = hw - 0.3;
  for (const s of [1, -1]) {
    // Lights sit proud of the bevelled surface (the bevel pushes the skin out ~5 cm).
    out.head.push(box(0.38, 0.13, 0.12, s * lx, nose - 0.075, zf - 0.03, '#ffffff', { jitter: 0 }));
    out.paint.push(box(0.46, 0.19, 0.1, s * lx, nose - 0.075, zf - 0.05, trim)); // lamp surround
    out.tail.push(box(0.32, 0.14, 0.08, s * (hw - 0.22), tail - 0.12, zr - 0.035, '#ffffff', { jitter: 0 }));
    out.paint.push(box(0.62, 0.2, 0.06, s * (hw - 0.34), tail - 0.12, zr - 0.02, trim)); // tail cluster surround
    out.reverse.push(box(0.1, 0.09, 0.07, s * (hw - 0.49), tail - 0.12, zr - 0.03, '#ffffff', { jitter: 0 }));
  }

  // Type extras.
  if (type === 'ute') {
    const [t0, t1] = cfg.tray;
    // Black tonneau cover over the tray + sports bar behind the cabin.
    out.paint.push(box(W - 0.16, 0.03, t1 - t0 - 0.1, 0, cfg.belt + 0.005, (t0 + t1) / 2, trim));
    for (const s of [1, -1]) out.paint.push(boxB(0.06, 0.42, 0.06, s * (hw - 0.14), cfg.belt, cfg.cabin[0] - 0.12, C.chrome));
    out.paint.push(box(W - 0.22, 0.06, 0.06, 0, cfg.belt + 0.42, cfg.cabin[0] - 0.12, C.chrome));
  }
  if (type === 'suv') {
    for (const s of [1, -1]) out.paint.push(box(0.05, 0.05, cfg.roofSpan[1] - cfg.roofSpan[0] - 0.2, s * (hw - 0.32), cfg.roof + 0.06, (cfg.roofSpan[0] + cfg.roofSpan[1]) / 2, trim));
    // Dark wheel-arch cladding band and a rear spare wheel.
    for (const s of [1, -1]) out.paint.push(box(0.04, 0.16, cfg.L - 0.3, s * (hw + 0.005), cfg.clearance + 0.2, (zf + zr) / 2, trim));
    const spare = new THREE.CylinderGeometry(cfg.wheelR * 0.95, cfg.wheelR * 0.95, 0.22, 12);
    spare.rotateX(Math.PI / 2);
    out.paint.push(paint(spare.translate(0, cfg.belt - 0.05, zr - 0.13), C.tyre, 0.03, 3));
    const hub = new THREE.CylinderGeometry(cfg.wheelR * 0.5, cfg.wheelR * 0.5, 0.24, 8);
    hub.rotateX(Math.PI / 2);
    out.paint.push(paint(hub.translate(0, cfg.belt - 0.05, zr - 0.135), C.rim, 0.02, 4));
  }
  if (type === 'hatch') {
    out.paint.push(box(W - 0.4, 0.05, 0.22, 0, cfg.roof - 0.02, cfg.roofSpan[0] - 0.05, paintColor)); // roof spoiler lip
  }
  if (hero) {
    // Hero sedan: boot spoiler on two posts and twin exhaust tips.
    for (const s of [1, -1]) out.paint.push(boxB(0.05, 0.1, 0.05, s * 0.55, tail, zr + 0.22, trim));
    out.paint.push(box(1.45, 0.04, 0.24, 0, tail + 0.12, zr + 0.2, paintColor));
    for (const s of [1, -1]) out.paint.push(cylinder(0.045, 0.045, 0.12, 8, s * 0.45, cfg.clearance + 0.02, zr - 0.02, C.chrome));
  }

  return {
    paint: merge(out.paint),
    glass: merge(out.glass),
    head: merge(out.head),
    tail: merge(out.tail),
    reverse: merge(out.reverse),
    anchors: { headZ: zf, headY: nose - 0.07, headX: lx, tailZ: zr },
  };
}
