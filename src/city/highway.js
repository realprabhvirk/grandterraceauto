// Terrace Motorway visuals + colliders: two carriageways (2 lanes each way) following the
// embankment profile, shoulders, lane markings (dashed between lanes, solid edges), a concrete
// median barrier, reflective posts, two overpass bridges (deck, railings, piers, abutments) over
// Northgate Rd and King St North, and green gantry signs before the ends. Merged into a handful
// of meshes; colliders for the median barrier, bridge decks, bridge railings and abutments.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { paint, merge } from '../utils/geom.js';
import { PALETTE } from '../art/palette.js';
import { HWY, highwayY, BRIDGES } from './highwayPlan.js';

/** Ribbon along x between z offsets a..b (relative to the centreline), lifted dy above the profile. */
function ribbon(x0, x1, a, b, dy, color, step = 4) {
  if (a > b) [a, b] = [b, a];
  const pos = [], za = HWY.z + a, zb = HWY.z + b;
  for (let x = x0; x < x1; x += step) {
    const xa = x, xb = Math.min(x1, x + step), ya = highwayY(xa) + dy, yb = highwayY(xb) + dy;
    // Counter-clockwise seen from above (same split as the terrain).
    pos.push(xa, ya, za, xa, ya, zb, xb, yb, za, xb, yb, za, xa, ya, zb, xb, yb, zb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, color, 0.02);
}

/** Box from (xa) to (xb) along the profile, between z offsets, height h above the surface. */
function profileBox(xa, xb, zc, w, h, color, dy = 0) {
  const len = xb - xa, ya = highwayY(xa), yb = highwayY(xb);
  const g = new THREE.BoxGeometry(len, h, w);
  g.rotateZ(Math.atan2(yb - ya, len));
  g.translate((xa + xb) / 2, (ya + yb) / 2 + h / 2 + dy, HWY.z + zc);
  return paint(g, color, 0.03);
}

export function buildHighway({ scene, terrain }) {
  const group = new THREE.Group(); group.name = 'highway';
  const out = { group, colliders: [], gantries: [] };
  const { x0, x1, lane, median } = HWY;
  const asph = [], marks = [], solid = [];
  const edgeIn = median, edgeOut = median + lane * 2;          // carriageway from 1.2 to 8.2 m off centre
  for (const s of [-1, 1]) {
    asph.push(ribbon(x0, x1, s * edgeIn, s * edgeOut, 0.06, PALETTE.road.asphalt));
    asph.push(ribbon(x0, x1, s * edgeOut, s * (edgeOut + 2.2), 0.055, '#5a5a5e')); // shoulder
    // Markings: solid inner + outer edge lines, dashed lane divider.
    marks.push(ribbon(x0, x1, s * (edgeIn + 0.15), s * (edgeIn + 0.3), 0.075, '#f2d23a', 4));
    marks.push(ribbon(x0, x1, s * (edgeOut - 0.3), s * (edgeOut - 0.15), 0.075, '#f4f4ee', 4));
    for (let x = x0 + 4; x < x1 - 4; x += 12) marks.push(ribbon(x, x + 5, s * (edgeIn + lane - 0.07), s * (edgeIn + lane + 0.07), 0.076, '#f4f4ee', 5));
  }
  asph.push(ribbon(x0, x1, -median, median, 0.05, '#7d7a72')); // median strip
  // Median barrier (concrete, along the profile) + colliders in 20 m segments.
  for (let x = x0 + 10; x < x1 - 10; x += 20) {
    const xb = Math.min(x1 - 10, x + 20);
    solid.push(profileBox(x, xb, 0, 0.5, 0.85, '#c9c4b8'));
    const ym = highwayY((x + xb) / 2);
    out.colliders.push({ x: (x + xb) / 2, y: ym + 0.45, z: HWY.z, hx: (xb - x) / 2, hy: 0.55, hz: 0.25, rot: 0, rotX: 0, tag: 'barrier', owner: 'median' });
  }
  // Reflective posts both sides every 25 m.
  for (let x = x0 + 6; x < x1 - 6; x += 25) for (const s of [-1, 1]) {
    const y = highwayY(x), z = HWY.z + s * (edgeOut + 2.6);
    solid.push(paint(new THREE.BoxGeometry(0.12, 1.0, 0.12).translate(x, y + 0.5, z), '#f4f4ee', 0.02));
    solid.push(paint(new THREE.BoxGeometry(0.13, 0.12, 0.13).translate(x, y + 0.85, z), s > 0 ? '#e8402a' : '#f2d23a', 0.02));
  }
  // Overpass bridges: deck slab, railings, piers, abutment walls (the street passes underneath).
  for (const b of BRIDGES) {
    const len = b.x1 - b.x0, w = b.z1 - b.z0;
    solid.push(paint(new THREE.BoxGeometry(len, 0.9, w).translate(b.cx, b.y - 0.45, HWY.z), '#b8b2a6', 0.03));
    out.colliders.push({ x: b.cx, y: b.y - 0.3, z: HWY.z, hx: len / 2 + 3, hy: 0.3, hz: w / 2, rot: 0, tag: 'bridge', owner: `deck ${b.cx}` }); // overlaps the embankment 3 m each end
    for (const s of [-1, 1]) {
      const z = HWY.z + s * (w / 2 - 0.2);
      solid.push(paint(new THREE.BoxGeometry(len, 1.1, 0.35).translate(b.cx, b.y + 0.55, z), '#d8d2c6', 0.03));
      out.colliders.push({ x: b.cx, y: b.y + 0.55, z, hx: len / 2, hy: 0.55, hz: 0.2, rot: 0, tag: 'barrier', owner: `railing ${b.cx}` });
      // Abutment walls either side of the street underneath.
      const ax = b.cx + s * (HWY.streetHalf + 0.6), ag = HWY.ground;
      solid.push(paint(new THREE.BoxGeometry(1.2, b.y - ag, w).translate(ax, ag + (b.y - ag) / 2 - 0.3, HWY.z), '#a8a196', 0.03));
      out.colliders.push({ x: ax, y: ag + (b.y - 0.6 - ag) / 2, z: HWY.z, hx: 0.6, hy: (b.y - 0.6 - ag) / 2, hz: w / 2, rot: 0, tag: 'bridge', owner: `abutment ${b.cx}` }); // top tucked under the deck: no exposed edge
    }
    // Piers on the median line under the deck (outside the street's lanes).
    for (const s of [-1, 1]) solid.push(paint(new THREE.CylinderGeometry(0.45, 0.5, b.y - HWY.ground - 0.9, 8).translate(b.cx, HWY.ground + (b.y - HWY.ground - 0.9) / 2, HWY.z + s * 0.01), '#a8a196', 0.03));
  }
  // Green gantry signs over each carriageway near the ends.
  const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 512;
  const gc = atlas.getContext('2d');
  const texts = ['NORTHGATE  WARATAH ST  >', 'TOWN CENTRE  RING RD W  >', 'INDUSTRIAL  CRANE ST  >', 'DOWNTOWN  RING RD E  >'];
  texts.forEach((t, i) => {
    const y = i * 128;
    gc.fillStyle = '#1f6a3a'; gc.fillRect(0, y, 1024, 128); gc.strokeStyle = '#f4f4ee'; gc.lineWidth = 6; gc.strokeRect(8, y + 8, 1008, 112);
    gc.fillStyle = '#f4f4ee'; gc.font = 'bold 58px "Segoe UI", Arial'; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText(t, 512, y + 66, 980);
  });
  const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace;
  const faces = [];
  const gantry = (x, side, row) => {
    const y = highwayY(x), zc = HWY.z + side * (median + lane), w = lane * 2 + 1;
    for (const s of [-1, 1]) solid.push(paint(new THREE.BoxGeometry(0.3, 6.6, 0.3).translate(x, y + 3.3, zc + s * (w / 2 + 0.6)), '#8d9196', 0.02));
    solid.push(paint(new THREE.BoxGeometry(0.4, 0.4, w + 1.5).translate(x, y + 6.4, zc), '#8d9196', 0.02));
    const f = new THREE.PlaneGeometry(w - 0.6, 1.6);
    const uv = f.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (row + 1 - uv.getY(k)) / 4);
    f.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x + (side > 0 ? -0.22 : 0.22), y + 5.2, zc);
    faces.push(f);
    out.gantries.push({ x, side, text: texts[row] });
  };
  // Westbound (south side? keep-left: eastbound drives on the -z side... see lanes) - one gantry
  // each way ~200 m before each end.
  gantry(x1 - 200, -1, 2); gantry(x1 - 220, -1, 3);
  gantry(x0 + 200, 1, 0); gantry(x0 + 220, 1, 1);
  const faceMesh = new THREE.Mesh(merge(faces.map((f) => { f.deleteAttribute('normal'); f.computeVertexNormals(); return f; })), new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.2 }));
  const road = new THREE.Mesh(merge([...asph, ...marks]), MAT.decal); road.receiveShadow = true; road.name = 'highway-road';
  const struct = new THREE.Mesh(merge(solid), MAT.solid); struct.castShadow = struct.receiveShadow = true; struct.name = 'highway-structures';
  group.add(road, struct, faceMesh);
  scene.add(group);
  void terrain;
  return out;
}
