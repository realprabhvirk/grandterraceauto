// City-wide signage, instanced (a handful of draw calls for the whole city):
//  - street-name blade signs at every grid junction (both street names, blades parallel to the
//    street they name, readable from both sides) on the footpath corner;
//  - round speed-limit signs at both ends of every road, where the limit changes (Terrace Pde into
//    downtown) and every ~250 m on the highway; a school-zone sign on School Rd.
// Text comes from canvas atlases; each sign face is an InstancedMesh whose per-instance aCell
// attribute picks its atlas cell. All signs are breakable sets (no heat - Phase 6 rules) and get
// restored out of view like the other street furniture.
import * as THREE from 'three';
import { T } from '../town/townPlan.js';
import { SPEED_LIMITS, DOWNTOWN_AREA } from '../world/speedLimits.js';
import { paint } from '../utils/geom.js';

/** Grid atlas (cols x rows cells) drawn by draw(ctx, i, x, y, w, h). */
function gridAtlas(cols, rows, cellW, cellH, items, draw) {
  const c = document.createElement('canvas'); c.width = cols * cellW; c.height = rows * cellH;
  const g = c.getContext('2d');
  items.forEach((it, i) => draw(g, it, (i % cols) * cellW, Math.floor(i / cols) * cellH, cellW, cellH));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** InstancedMesh of a face geometry whose UVs are remapped per instance to atlas cell aCell. */
function cellMesh(geo, tex, cols, rows, max) {
  const g = geo.clone();
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.12 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        float col = mod(aCell, ${cols.toFixed(1)}), row = floor(aCell / ${cols.toFixed(1)});
        vMapUv = vec2((col + vMapUv.x) / ${cols.toFixed(1)}, 1.0 - (row + 1.0 - vMapUv.y) / ${rows.toFixed(1)});
      #endif
      #ifdef USE_EMISSIVEMAP
        vEmissiveMapUv = vMapUv;
      #endif`);
  };
  mat.customProgramCacheKey = () => `cell${cols}x${rows}`;
  const m = new THREE.InstancedMesh(g, mat, max);
  m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
  return m;
}

export function buildStreetSigns({ network, plan, terrain }) {
  const group = new THREE.Group(); group.name = 'city-signs';
  const roads = network.allRoads;
  const registry = { blades: [], limits: [], school: [] };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);

  // ---- Junctions on the grid: street names at each node ------------------------------------------
  const streetAt = (n, vertical) => {
    for (const r of plan.roads) {
      const a = r.samples[0], b = r.samples[r.samples.length - 1];
      if (vertical && a.tx === 0 && Math.abs(a.x - n.x) < 0.5 && n.z >= Math.min(a.z, b.z) - 0.5 && n.z <= Math.max(a.z, b.z) + 0.5) return r;
      if (!vertical && a.tz === 0 && Math.abs(a.z - n.z) < 0.5 && n.x >= Math.min(a.x, b.x) - 0.5 && n.x <= Math.max(a.x, b.x) + 0.5) return r;
    }
    return null;
  };
  const junctions = [];
  for (const n of plan.nodes) {
    const v = streetAt(n, true), h = streetAt(n, false);
    if (!v || !h) continue;
    junctions.push({ n, v: v.street, h: h.street });
  }
  // Highway / other roads can add junctions later through network.extraJunctions ({ x, z, a, b, yaw }).
  for (const j of network.extraJunctions || []) junctions.push({ n: { x: j.x, z: j.z }, v: j.a, h: j.b, yaw: j.yaw || 0 });
  const names = [...new Set(junctions.flatMap((j) => [j.v, j.h]))];
  const ROWS = Math.max(8, Math.ceil(names.length / 1) + 1);
  const bladeTex = gridAtlas(1, ROWS, 512, 64, names, (g, text, x, y, w, h) => {
    g.fillStyle = '#1f6a3a'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#f4f4ee'; g.lineWidth = 4; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.fillStyle = '#f4f4ee'; g.font = 'bold 34px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.toUpperCase(), x + w / 2, y + h / 2 + 2, w - 24);
  });
  const BW = 1.6, BH = 0.22;
  const face = new THREE.PlaneGeometry(BW, BH);
  const blades = [0, 1, 2, 3].map(() => cellMesh(face, bladeTex, 1, ROWS, junctions.length));
  const poleGeo = paint(new THREE.CylinderGeometry(0.045, 0.05, 3.1, 6).translate(0, 1.55, 0), '#8d9196', 0.03);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), junctions.length);
  poles.castShadow = true; poles.count = 0;
  const off = T.hw + T.kerb + 1.0;
  const bladeItems = [];
  junctions.forEach((j, i) => {
    const x = j.n.x + off, z = j.n.z + off, y = terrain.getHeight(x, z);
    _m.compose(new THREE.Vector3(x, y, z), _q.identity(), _s); poles.setMatrixAt(i, _m);
    // Blade naming the N-S street runs along z (faces +-x); blade naming the E-W street runs along x.
    const put = (mesh, name, yaw, h, side) => {
      _q.setFromAxisAngle(Y, yaw);
      const p = new THREE.Vector3(x, y + h, z).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.02 * side));
      _m.compose(p, _q, _s); mesh.setMatrixAt(i, _m);
      mesh.geometry.attributes.aCell.array[i] = names.indexOf(name);
    };
    const base = j.yaw || 0;
    put(blades[0], j.v, base + Math.PI / 2, 2.95, 1); put(blades[1], j.v, base - Math.PI / 2, 2.95, 1);
    put(blades[2], j.h, base, 2.7, 1); put(blades[3], j.h, base + Math.PI, 2.7, 1);
    bladeItems.push({ x, y, z, rot: 0 });
    registry.blades.push({ x: j.n.x, z: j.n.z, names: [j.v, j.h] });
  });
  for (const b of blades) { b.count = junctions.length; b.geometry.attributes.aCell.needsUpdate = true; b.instanceMatrix.needsUpdate = true; group.add(b); }
  poles.count = junctions.length; poles.instanceMatrix.needsUpdate = true; group.add(poles);

  // ---- Speed limit signs ------------------------------------------------------------------------
  const cells = ['30', '40', '50', '60', '80', '100', 'SCHOOL', 'CAMERA'];
  const limitTex = gridAtlas(8, 1, 128, 128, cells, (g, text, x, y, w, h) => {
    const cx = x + w / 2, cy = y + h / 2;
    if (text === 'SCHOOL' || text === 'CAMERA') {
      g.fillStyle = text === 'SCHOOL' ? '#f2d23a' : '#f4f4ee'; g.fillRect(x + 6, y + 6, w - 12, h - 12);
      g.strokeStyle = '#1f1f22'; g.lineWidth = 5; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
      g.fillStyle = '#1f1f22'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (text === 'SCHOOL') { g.fillText('SCHOOL', cx, cy - 14); g.fillText('ZONE', cx, cy + 6); g.font = 'bold 26px Arial'; g.fillText('40', cx, cy + 34); }
      else { g.font = 'bold 17px Arial'; g.fillText('SPEED', cx, cy - 22); g.fillText('CAMERA', cx, cy); g.fillText('AHEAD', cx, cy + 22); }
      return;
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d8322a'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, 52, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1f1f22'; g.font = `900 ${text.length > 2 ? 44 : 54}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cx, cy + 3);
  });
  const spots = [];
  const addLimit = (x, z, yaw, cell, meta) => spots.push({ x, z, yaw, cell, ...meta });
  const cellOf = (lim) => cells.indexOf(String(lim));
  for (const r of roads) {
    const S = r.samples, lim = r.speedLimit;
    if (!S || S.length < 6 || !lim) continue;
    const hw = (r.halfW || 3.6) + 1.3;
    // Start: traffic heading +t, kerb on its left (-n).
    const a = S[Math.min(4, S.length - 1)];
    addLimit(a.x - a.nx * hw, a.z - a.nz * hw, Math.atan2(-a.tx, -a.tz), cellOf(lim), { road: r.street, limit: lim });
    const b = S[Math.max(0, S.length - 5)];
    addLimit(b.x + b.nx * hw, b.z + b.nz * hw, Math.atan2(b.tx, b.tz), cellOf(lim), { road: r.street, limit: lim });
    if (r.highway && !r.ramp) for (let k = 0; k < S.length; k += Math.max(1, Math.round(250 / Math.max(1, (S[1]?.s ?? 1) - (S[0]?.s ?? 0))))) {
      const s = S[k]; addLimit(s.x - s.nx * hw, s.z - s.nz * hw, Math.atan2(-s.tx, -s.tz), cellOf(lim), { road: r.street, limit: lim });
    }
    // Terrace Pde: 40 entering downtown (eastbound), back to 60 leaving it (westbound).
    if (r.street === 'Terrace Pde') {
      const z = S[0].z;
      addLimit(DOWNTOWN_AREA.x0 + 6, z - (r.halfW + 1.3), Math.PI / 2 + Math.PI, cellOf(SPEED_LIMITS.downtown), { road: r.street, limit: SPEED_LIMITS.downtown, change: true });
      addLimit(DOWNTOWN_AREA.x0 - 6, z + (r.halfW + 1.3), Math.PI / 2, cellOf(SPEED_LIMITS.arterial), { road: r.street, limit: SPEED_LIMITS.arterial, change: true });
    }
    if (r.kind === 'school') { const m = S[Math.floor(S.length / 2)]; addLimit(m.x - m.nx * hw, m.z - m.nz * hw, Math.atan2(-m.tx, -m.tz), cells.indexOf('SCHOOL'), { road: r.street, limit: lim, school: true }); }
  }
  for (const c of network.cameraAheadSigns || []) addLimit(c.x, c.z, c.yaw, cells.indexOf('CAMERA'), { camera: true });
  const disc = new THREE.CircleGeometry(0.36, 20);
  const limFace = cellMesh(disc, limitTex, 8, 1, spots.length), limBack = new THREE.InstancedMesh(paint(new THREE.CircleGeometry(0.36, 20).rotateY(Math.PI), '#9aa0a6', 0.02), new THREE.MeshLambertMaterial({ vertexColors: true }), spots.length);
  const limPole = new THREE.InstancedMesh(paint(new THREE.CylinderGeometry(0.035, 0.04, 2.3, 6).translate(0, 1.15, 0), '#8d9196', 0.03), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length);
  const limItems = [];
  spots.forEach((s, i) => {
    const y = terrain.getHeight(s.x, s.z);
    _q.setFromAxisAngle(Y, s.yaw);
    _m.compose(new THREE.Vector3(s.x, y, s.z), _q.identity(), _s); limPole.setMatrixAt(i, _m);
    _q.setFromAxisAngle(Y, s.yaw);
    _m.compose(new THREE.Vector3(s.x, y + 2.3, s.z), _q, _s); limFace.setMatrixAt(i, _m);
    _m.compose(new THREE.Vector3(s.x - Math.sin(s.yaw) * 0.01, y + 2.3, s.z - Math.cos(s.yaw) * 0.01), _q, _s); limBack.setMatrixAt(i, _m);
    limFace.geometry.attributes.aCell.array[i] = s.cell;
    limItems.push({ x: s.x, y, z: s.z, rot: s.yaw });
    if (s.limit && !s.camera) registry.limits.push({ road: s.road, limit: s.limit, x: s.x, z: s.z, change: !!s.change, school: !!s.school });
    if (s.camera) registry.school.push(s);
  });
  for (const m of [limFace, limBack, limPole]) { m.count = spots.length; m.instanceMatrix.needsUpdate = true; group.add(m); }
  limFace.geometry.attributes.aCell.needsUpdate = true;

  const defs = [
    { name: 'streetBlade', meshes: [{ mesh: poles, mode: 'follow' }, ...blades.map((mesh) => ({ mesh, mode: 'follow' }))], items: bladeItems, r: 0.06, h: 3.1, toughness: 5, carDamage: 6 },
    { name: 'limitSign', meshes: [{ mesh: limPole, mode: 'follow' }, { mesh: limFace, mode: 'follow' }, { mesh: limBack, mode: 'follow' }], items: limItems, r: 0.05, h: 2.6, toughness: 5, carDamage: 6 },
  ];
  return { group, defs, registry, junctions };
}
