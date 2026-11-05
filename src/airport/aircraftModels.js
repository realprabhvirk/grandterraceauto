// Procedural low-poly aircraft (flat-shaded, palette liveries): small prop plane, regional jet,
// airliner. Local space: +Z = nose, +Y up, origin on the ground under the fuselage centre with
// the gear down. Parts returned for animation: gear (scaled to retract), props (spin), nav lights
// (red left / green right wingtip), strobe + beacon (blink), engine glow discs.
import * as THREE from 'three';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';

export const AIRCRAFT = {
  prop: { label: 'Prop plane', L: 11, span: 14, r: 0.75, gearH: 1.3, vr: 34, vapp: 36, accel: 2.6, climb: 0.14, taxi: 7, prop: true, wing: 'high' },
  regional: { label: 'Regional jet', L: 26, span: 22, r: 1.35, gearH: 2.0, vr: 58, vapp: 60, accel: 3.0, climb: 0.12, taxi: 8, tailEngines: true, tTail: true },
  airliner: { label: 'Airliner', L: 38, span: 34, r: 2.0, gearH: 2.9, vr: 70, vapp: 68, accel: 3.6, climb: 0.1, taxi: 8, wingEngines: true },
};
const LIVERIES = [['#f4f1e8', '#2f6fc0', '#e2c25a'], ['#f4f1e8', '#c8322a', '#26262a'], ['#e9e6dc', '#2f6b5a', '#e2b33a'], ['#f4f1e8', '#d86c3d', '#3d5f8a']];
const BASIC = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

/** Build one aircraft. Returns { group, body, gear, props, navL, navR, strobe, beacon, glows, cfg }. */
export function buildAircraft(type, liveryIndex = 0) {
  const c = AIRCRAFT[type], [base, tail, stripe] = LIVERIES[liveryIndex % LIVERIES.length];
  const { L, span, r, gearH } = c, yC = gearH + r * 0.15; // fuselage centre height
  const P = [];
  const add = (g, col, j = 0.02) => P.push(paint(g, col, j));
  // Fuselage: 8-sided tube + nose / tail cones.
  const tube = L * 0.62, nose = L * 0.16, tailL = L * 0.22;
  add(new THREE.CylinderGeometry(r, r, tube, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8).translate(0, yC, L * 0.04), base);
  add(new THREE.ConeGeometry(r, nose, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8).translate(0, yC, L * 0.04 + tube / 2 + nose / 2), base);
  add(new THREE.CylinderGeometry(r, r * 0.3, tailL, 8).rotateX(-Math.PI / 2).rotateZ(Math.PI / 8).translate(0, yC + r * 0.25, L * 0.04 - tube / 2 - tailL / 2), base);
  // Livery: belly stripe + window strips + cockpit glass.
  add(new THREE.BoxGeometry(r * 2.02, r * 0.28, tube * 0.98).translate(0, yC - r * 0.35, L * 0.04), stripe);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, r * 0.22, tube * 0.86).translate(s * r * 0.97, yC + r * 0.25, L * 0.06), '#26323c');
  add(new THREE.BoxGeometry(r * 1.2, r * 0.35, 0.5).rotateX(-0.6).translate(0, yC + r * 0.55, L * 0.04 + tube / 2 + nose * 0.15), '#26323c');
  // Wings (swept for jets), stabilisers, fin.
  const wingY = c.wing === 'high' ? yC + r * 0.85 : yC - r * 0.45, chord = L * (c.prop ? 0.13 : 0.16), sweep = c.prop ? 0 : 0.5;
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(span / 2, 0.22, chord);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + span / 4; p.setXYZ(i, s * x, p.getY(i), p.getZ(i) - x * sweep * (span > 15 ? 0.45 : 0.2) + (x / (span / 2)) * chord * 0.25 * (p.getZ(i) > 0 ? -1 : 0)); }
    g.computeVertexNormals();
    add(g.translate(0, wingY, L * 0.02), base);
  }
  const tailZ = L * 0.04 - tube / 2 - tailL * 0.7, finH = r * (c.prop ? 2.0 : 2.4);
  add(new THREE.BoxGeometry(0.25, finH, tailL * 0.7).translate(0, yC + r * 0.6 + finH / 2, tailZ), tail);
  const stabY = c.tTail ? yC + r * 0.6 + finH : yC + r * 0.4;
  add(new THREE.BoxGeometry(span * 0.36, 0.16, tailL * 0.45).translate(0, stabY, tailZ - tailL * 0.1), base);
  // Engines.
  const glowPos = [];
  if (c.wingEngines) for (const s of [-1, 1]) {
    const ex = s * span * 0.2, ez = L * 0.08, ey = wingY - r * 0.55;
    add(new THREE.CylinderGeometry(r * 0.55, r * 0.5, L * 0.13, 10).rotateX(Math.PI / 2).translate(ex, ey, ez), '#cfd3d6');
    add(new THREE.BoxGeometry(0.2, r * 0.5, L * 0.06).translate(ex, wingY - r * 0.2, ez), '#cfd3d6');
    glowPos.push([ex, ey, ez - L * 0.066, r * 0.42]);
  }
  if (c.tailEngines) for (const s of [-1, 1]) {
    const ex = s * (r + 0.7), ez = tailZ + tailL * 0.35, ey = yC + r * 0.5;
    add(new THREE.CylinderGeometry(r * 0.42, r * 0.38, L * 0.13, 10).rotateX(Math.PI / 2).translate(ex, ey, ez), '#cfd3d6');
    glowPos.push([ex, ey, ez - L * 0.066, r * 0.32]);
  }
  if (c.prop) add(new THREE.ConeGeometry(0.3, 0.6, 8).rotateX(Math.PI / 2).translate(0, yC, L * 0.04 + tube / 2 + nose + 0.1), '#26262a');
  const body = new THREE.Mesh(merge(P), MAT.solid);
  body.castShadow = true; body.name = `aircraft-${type}`;
  const group = new THREE.Group(); group.add(body);
  // Gear: nose leg + two mains (one merged mesh, scaled in y to retract).
  const G = [];
  const leg = (x, z) => { G.push(paint(new THREE.CylinderGeometry(0.09, 0.09, gearH, 6).translate(x, gearH / 2, z), '#8d9196', 0)); G.push(paint(new THREE.CylinderGeometry(gearH * 0.22, gearH * 0.22, 0.3, 10).rotateZ(Math.PI / 2).translate(x, gearH * 0.22, z), '#1c1d20', 0)); };
  leg(0, L * 0.04 + tube / 2 + nose * 0.2);
  for (const s of [-1, 1]) leg(s * r * 1.2, L * 0.0);
  const gear = new THREE.Group(); const gm = new THREE.Mesh(merge(G), MAT.solid); gm.position.y = -gearH; gear.add(gm); gear.position.y = gearH; group.add(gear);
  // Prop disc (two blades) on the nose.
  const props = [];
  if (c.prop) {
    const p = new THREE.Mesh(paint(new THREE.BoxGeometry(2.4, 0.18, 0.06), '#26262a', 0), MAT.solid);
    p.position.set(0, yC, L * 0.04 + tube / 2 + nose + 0.45); group.add(p); props.push(p);
  }
  // Lights.
  const lamp = (col, x, y, z, s = 0.22) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), BASIC(col)); m.position.set(x, y, z); group.add(m); return m; };
  const navL = lamp('#ff2a2a', span / 2, wingY, L * 0.02 - (c.prop ? 0 : span * 0.22 * 0.45 * 2));
  const navR = lamp('#2aff6a', -span / 2, wingY, navL.position.z);
  const strobe = lamp('#ffffff', 0, yC + r * 0.6 + finH, tailZ - tailL * 0.3, 0.26);
  const beacon = lamp('#ff3b2a', 0, yC - r, 0, 0.3);
  const glows = glowPos.map(([x, y, z, rr]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(rr, 12).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffb36a', toneMapped: false, transparent: true, opacity: 0.2 })); m.position.set(x, y, z); group.add(m); return m; });
  return { group, body, gear, props, navL, navR, strobe, beacon, glows, cfg: c, type, yC };
}
