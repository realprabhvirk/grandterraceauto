// Axis-aligned wall slabs with rectangular openings (doorways, garage), used to make
// 62 Grand Terrace a hollow, enterable shell. A wall has an outer skin and an inner
// lining (different colours) and produces matching box colliders in lot-local space.
import { boxB } from '../utils/geom.js';

/**
 * @param out  { solid: [], colliders: [] } (colliders = lot-local boxes)
 * @param w    { axis: 'x' | 'z'  - the wall runs along this axis,
 *               at               - its outer face plane (z for axis x, x for axis z),
 *               from, to         - extent along the axis,
 *               y0, y1           - bottom / top,
 *               inward: +1 | -1  - which side (along the other axis) is inside,
 *               outer, inner     - colours (outer skin / inner lining),
 *               thick = 0.2, skin = 0.12,
 *               openings: [{ a, b, top, bottom = y0 }] - along-axis gaps }
 */
export function wallSlab(out, w) {
  const { axis, at, from, to, y0, y1, inward, outer, inner, thick = 0.2, skin = 0.12, openings = [], collide = true } = w;
  const ops = [...openings].sort((p, q) => p.a - q.a);
  // Rectangular pieces in (along, y) space.
  const pieces = [];
  let cur = from;
  for (const o of ops) {
    if (o.a > cur) pieces.push([cur, o.a, y0, y1]);
    if (o.top < y1) pieces.push([o.a, o.b, o.top, y1]);                 // lintel
    if ((o.bottom ?? y0) > y0) pieces.push([o.a, o.b, y0, o.bottom]);   // sill
    cur = o.b;
  }
  if (cur < to) pieces.push([cur, to, y0, y1]);

  const place = (a, b, ya, yb, c0, c1, color) => {
    const len = b - a, mid = (a + b) / 2, h = yb - ya;
    const t = Math.abs(c1 - c0), c = at + inward * (c0 + c1) / 2;
    if (axis === 'x') out.solid.push(boxB(len, h, t, mid, ya, c, color, { jitter: 0.02 }));
    else out.solid.push(boxB(t, h, len, c, ya, mid, color, { jitter: 0.02 }));
  };
  for (const [a, b, ya, yb] of pieces) {
    if (b - a < 0.01 || yb - ya < 0.01) continue;
    if (inner === outer) place(a, b, ya, yb, 0, thick, outer);
    else { place(a, b, ya, yb, 0, skin, outer); place(a, b, ya, yb, skin, thick, inner); }
    if (collide) {
      const ca = at + inward * thick / 2;
      out.colliders.push(axis === 'x'
        ? { x0: a, x1: b, z0: ca - thick / 2, z1: ca + thick / 2, y0: ya, y1: yb }
        : { x0: ca - thick / 2, x1: ca + thick / 2, z0: a, z1: b, y0: ya, y1: yb });
    }
  }
}

/** Interior partition centred on `at` (same colour both sides). */
export function partition(out, w) {
  const t = w.thick ?? 0.12;
  wallSlab(out, { ...w, at: w.at - t / 2, inward: 1, thick: t, inner: w.color, outer: w.color });
}
