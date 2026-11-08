// Breakable street furniture (all instanced): timber power poles with wires along Grand
// Terrace, regulatory signs (give way / speed 50 / no through road), bollards at the
// cul-de-sac heads, kerbside wheelie bins and letterboxes for the regular houses.
// Returns breakable set definitions; main.js registers them with combat/breakables.js.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, boxB, cylinder, merge } from '../utils/geom.js';
import { ROAD } from './roadNetwork.js';
import { lotToWorld } from './layout.js';
import { VARIANTS } from './houses.js';
import { makeRng } from '../utils/rng.js';

const TIMBER = '#7a5b42', STEEL = '#8d8f8a';

function instanced(geo, mat, items, { shadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat === MAT.solid ? MAT.instanced : mat, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  items.forEach((it, i) => { m.compose(new THREE.Vector3(it.x, it.y, it.z), q.setFromAxisAngle(Y, it.rot || 0), one); mesh.setMatrixAt(i, m); });
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 128;
  const g = c.getContext('2d');
  // 0: give way (inverted triangle), 1: speed 50, 2: no through road.
  g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 384, 128);
  g.fillStyle = '#c8322a'; g.beginPath(); g.moveTo(8, 10); g.lineTo(120, 10); g.lineTo(64, 120); g.fill();
  g.fillStyle = '#f4f1e8'; g.beginPath(); g.moveTo(30, 22); g.lineTo(98, 22); g.lineTo(64, 92); g.fill();
  g.fillStyle = '#1d1d1d'; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillText('GIVE', 64, 42); g.fillText('WAY', 64, 58);
  g.fillStyle = '#c8322a'; g.beginPath(); g.arc(192, 64, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(192, 64, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1d1d1d'; g.font = 'bold 52px Arial'; g.fillText('50', 192, 82);
  g.fillStyle = '#f4f1e8'; g.fillRect(266, 14, 108, 100); g.strokeStyle = '#1d1d1d'; g.lineWidth = 4; g.strokeRect(270, 18, 100, 92);
  g.fillStyle = '#1d1d1d'; g.font = 'bold 15px Arial'; g.fillText('NO', 320, 48); g.fillText('THROUGH', 320, 68); g.fillText('ROAD', 320, 88);
  g.fillStyle = '#c8322a'; g.fillRect(310, 92, 20, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildStreetProps(world) {
  const { network, layout, terrain } = world;
  const rng = makeRng(919);
  const group = new THREE.Group();
  group.name = 'street-props';
  const defs = [];
  const occupied = [];
  const free = (x, z, r) => !occupied.some((o) => Math.hypot(o.x - x, o.z - z) < r) && !layout.cuts.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1);

  // --- Power poles along one side of Grand Terrace, with sagging wires ---------------------
  const S = network.main.samples, poles = [];
  for (let s = 20; s < network.main.length - 20; s += 42) {
    const p = S[Math.round(s / ROAD.step)];
    const lat = -(ROAD.curbOut + 0.3);
    const x = p.x + p.nx * lat, z = p.z + p.nz * lat;
    if (network.junctions.some((j) => Math.hypot(j.x - x, j.z - z) < 16) || !free(x, z, 5)) continue;
    poles.push({ x, y: terrain.getHeight(x, z) - 0.05, z, rot: Math.atan2(p.tx, p.tz) });
    occupied.push({ x, z });
  }
  const poleGeo = merge([
    cylinder(0.12, 0.16, 9, 7, 0, 0, 0, TIMBER),
    box(1.8, 0.12, 0.12, 0, 8.4, 0, TIMBER),
    ...[-0.75, 0, 0.75].map((dx) => cylinder(0.04, 0.04, 0.18, 6, dx, 8.46, 0, '#d9d6cc')),
  ]);
  const poleMesh = instanced(poleGeo, MAT.solid, poles);
  group.add(poleMesh);
  // Wires: 3 sagging lines between consecutive poles (one LineSegments).
  const wire = [];
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = poles[i], b = poles[i + 1];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 70) continue;
    for (const dx of [-0.75, 0, 0.75]) {
      const ax = a.x + Math.cos(a.rot) * dx, az = a.z - Math.sin(a.rot) * dx;
      const bx = b.x + Math.cos(b.rot) * dx, bz = b.z - Math.sin(b.rot) * dx;
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8, sag = (t) => -Math.sin(t * Math.PI) * 0.7;
        wire.push(ax + (bx - ax) * t0, a.y + 8.55 + (b.y - a.y) * t0 + sag(t0), az + (bz - az) * t0);
        wire.push(ax + (bx - ax) * t1, a.y + 8.55 + (b.y - a.y) * t1 + sag(t1), az + (bz - az) * t1);
      }
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#2b2b2b' })));
  defs.push({ name: 'powerPole', meshes: [{ mesh: poleMesh, mode: 'follow' }], items: poles, r: 0.16, h: 9, toughness: 9, carDamage: 25, sparks: true });

  // --- Regulatory signs -----------------------------------------------------------------------
  const tex = signAtlas();
  const faceMat = new THREE.MeshLambertMaterial({ map: tex });
  const signs = [[], [], []];
  for (const j of network.junctions) {
    const b = j.branch.samples[Math.round(12 / ROAD.step)];
    // Give way on the branch's outbound (left) side; no-through-road on the inbound side.
    const gx = b.x + b.nx * (ROAD.curbOut + 0.6), gz = b.z + b.nz * (ROAD.curbOut + 0.6);
    signs[0].push({ x: gx, y: terrain.getHeight(gx, gz), z: gz, rot: Math.atan2(-b.tx, -b.tz) });
    const nx = b.x - b.nx * (ROAD.curbOut + 0.6), nz = b.z - b.nz * (ROAD.curbOut + 0.6);
    signs[2].push({ x: nx, y: terrain.getHeight(nx, nz), z: nz, rot: Math.atan2(b.tx, b.tz) });
  }
  for (const [s0, side] of [[30, -1], [network.main.length - 30, 1]]) {
    const p = S[Math.round(s0 / ROAD.step)];
    const x = p.x + p.nx * side * (ROAD.curbOut + 0.6), z = p.z + p.nz * side * (ROAD.curbOut + 0.6);
    signs[1].push({ x, y: terrain.getHeight(x, z), z, rot: Math.atan2(p.tx * -side, p.tz * -side) });
  }
  const allSigns = signs.flat();
  const signPole = instanced(merge([cylinder(0.04, 0.04, 2.6, 6, 0, 0, 0, STEEL), box(0.62, 0.62, 0.03, 0, 2.35, -0.02, '#f4f1e8')]), MAT.solid, allSigns);
  group.add(signPole);
  const uvRow = (i) => { const g = new THREE.PlaneGeometry(0.6, 0.6); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3); return g.translate(0, 2.35, 0.0); };
  let off = 0;
  const faceMeshes = signs.map((list, i) => {
    const m = instanced(uvRow(i), faceMat, allSigns, { shadow: false });
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    allSigns.forEach((_, k) => { if (k < off || k >= off + list.length) m.setMatrixAt(k, zero); });
    off += list.length;
    group.add(m);
    return m;
  });
  defs.push({ name: 'sign', meshes: [{ mesh: signPole, mode: 'follow' }, ...faceMeshes.map((mesh) => ({ mesh, mode: 'follow' }))], items: allSigns, r: 0.08, h: 2.7, toughness: 5, carDamage: 6 });

  // --- Bollards round the cul-de-sac heads ------------------------------------------------------
  const bollards = [];
  for (const pad of network.pads) {
    const back = Math.atan2(pad.inZ, pad.inX);
    for (const da of [-0.45, -0.15, 0.15, 0.45]) {
      const a = back + da, r = pad.r + (ROAD.pathOut - ROAD.halfW) + 0.4;
      const x = pad.x + Math.cos(a) * r, z = pad.z + Math.sin(a) * r;
      if (!free(x, z, 1.5)) continue;
      bollards.push({ x, y: terrain.getHeight(x, z), z, rot: 0 });
    }
  }
  const bollardMesh = instanced(merge([cylinder(0.09, 0.1, 0.95, 8, 0, 0, 0, '#d9d4c8'), box(0.2, 0.06, 0.2, 0, 0.75, 0, '#e0b03c')]), MAT.solid, bollards);
  group.add(bollardMesh);
  defs.push({ name: 'bollard', meshes: [{ mesh: bollardMesh, mode: 'follow' }], items: bollards, r: 0.12, h: 1, toughness: 7, carDamage: 12 });

  // --- Letterboxes (every regular house) + bins out on the kerb (some houses: bin day) -----------
  const boxes = [], bins = [];
  for (const lot of layout.regular) {
    const v = VARIANTS[lot.variant];
    const lx = v.garageX + (v.garageX > 0 ? -v.driveW / 2 - 0.9 : v.driveW / 2 + 0.9);
    const front = (ROAD.boundary + v.frontYard + v.d / 2) - ROAD.boundary - 0.35;
    const p = lotToWorld(lot, lx, front);
    boxes.push({ x: p.x, y: terrain.getHeight(p.x, p.z), z: p.z, rot: lot.rot });
    if (rng.chance(0.45)) {
      const q = lotToWorld(lot, lx + (v.garageX > 0 ? -1.1 : 1.1), front + 1.7);
      bins.push({ x: q.x, y: terrain.getHeight(q.x, q.z), z: q.z, rot: lot.rot });
    }
  }
  const lbMesh = instanced(merge([boxB(0.08, 1.0, 0.08, 0, 0, 0, TIMBER), boxB(0.4, 0.3, 0.28, 0, 1.0, 0, rng.pick(['#3f6e7a', '#9c5b43', '#5a5c60']))]), MAT.solid, boxes);
  group.add(lbMesh);
  defs.push({ name: 'letterbox', meshes: [{ mesh: lbMesh, mode: 'follow' }], items: boxes, r: 0.2, h: 1.3, toughness: 3, carDamage: 3 });
  const binMesh = instanced(merge([boxB(0.56, 0.92, 0.66, 0, 0, 0, '#3d5e45'), boxB(0.6, 0.07, 0.72, 0, 0.92, 0.02, '#b8443a')]), MAT.solid, bins);
  group.add(binMesh);
  defs.push({ name: 'bin', meshes: [{ mesh: binMesh, mode: 'follow' }], items: bins, r: 0.36, h: 1, toughness: 2, carDamage: 2 });

  return { group, defs };
}
