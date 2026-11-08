// Street lights along every road: instanced poles (with arm) + instanced glowing heads +
// instanced additive light pools on the road. They switch on with the night factor
// (setGlow in materials.js). No real light sources -> no extra shadow casters, 3 draw calls.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { cylinder, box, merge } from '../utils/geom.js';
import { ROAD } from './roadNetwork.js';

const SPACING = 30, POLE_H = 6.2, ARM = 1.5;

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,220,160,1)');
  grd.addColorStop(0.45, 'rgba(255,205,140,0.45)');
  grd.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildStreetLights(network, layout) {
  MAT.pool.map = poolTexture();
  MAT.pool.needsUpdate = true;
  const spots = [];
  for (const road of network.roads) {
    const S = road.samples;
    let side = road.main ? 1 : -1;
    for (let s = 12; s < road.length - (road.pad ? road.pad.r + 6 : 8); s += SPACING) {
      const p = S[Math.round(s / ROAD.step)];
      const lat = side * (ROAD.curbOut + 0.55);
      const x = p.x + p.nx * lat, z = p.z + p.nz * lat;
      side = -side;
      if (network.junctions.some((j) => Math.hypot(j.x - x, j.z - z) < 15)) continue;
      if (layout.cuts.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.2)) continue;
      // Grade along the road for tilting the light pool.
      const q = S[Math.min(S.length - 1, Math.round(s / ROAD.step) + 2)];
      const grade = (q.h - p.h) / (2 * ROAD.step);
      spots.push({ x, z, h: p.h, ax: -p.nx * Math.sign(lat), az: -p.nz * Math.sign(lat), tx: p.tx, tz: p.tz, grade, roadX: p.x + p.nx * lat * 0.35, roadZ: p.z + p.nz * lat * 0.35 });
    }
  }

  const C = PALETTE.road.signPole;
  // Pole + arm in a local frame where the arm reaches along +Z (toward the road).
  const poleGeo = merge([
    cylinder(0.07, 0.1, POLE_H, 7, 0, 0, 0, C),
    box(0.07, 0.07, ARM, 0, POLE_H - 0.1, ARM / 2, C),
    box(0.14, 0.4, 0.14, 0, 0, 0, '#7a7c78'),
  ]);
  const headGeo = new THREE.BoxGeometry(0.28, 0.1, 0.55).translate(0, POLE_H - 0.18, ARM - 0.05);
  const poolGeo = new THREE.CircleGeometry(5.5, 20).rotateX(-Math.PI / 2);

  const n = spots.length;
  const poles = new THREE.InstancedMesh(poleGeo, MAT.instanced, n);
  const heads = new THREE.InstancedMesh(headGeo, MAT.streetHead, n);
  const pools = new THREE.InstancedMesh(poolGeo, MAT.pool, n);
  poles.castShadow = true;
  pools.renderOrder = 4;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const colliders = [];
  spots.forEach((s, i) => {
    q.setFromAxisAngle(Y, Math.atan2(s.ax, s.az));
    m.compose(p.set(s.x, s.h - 0.05, s.z), q, one);
    poles.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
    // Pool under the head, tilted to the road grade so it sits on the surface.
    const hx = s.x + s.ax * ARM, hz = s.z + s.az * ARM;
    const normal = new THREE.Vector3(-s.tx * s.grade, 1, -s.tz * s.grade).normalize();
    qt.setFromUnitVectors(Y, normal);
    m.compose(p.set(hx, s.h + 0.1, hz), qt, one);
    pools.setMatrixAt(i, m);
    colliders.push({ x: s.x, y: s.h - 0.05, z: s.z, r: 0.12, h: POLE_H });
  });
  for (const mesh of [poles, heads, pools]) mesh.computeBoundingSphere();
  const group = new THREE.Group();
  group.name = 'street-lights';
  group.add(poles, heads, pools);
  return { group, poles: colliders, count: n, meshes: { poles, heads, pools } };
}
