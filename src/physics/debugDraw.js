// F4 collider debug view. Every non-terrain collider comes from Rapier's own debugRender
// (so it shows exactly what physics sees); the terrain heightfield is drawn as a local
// wireframe patch around the focus point (the full field would be ~350k segments).
import * as THREE from 'three';
import { MAP } from '../world/terrain.js';

const PATCH = 18; // cells either side of the focus

export function createDebugDraw(scene, physics, terrain) {
  const { world, RAPIER } = physics;
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.85, fog: false });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
  lines.frustumCulled = false;
  lines.renderOrder = 999;
  lines.visible = false;
  scene.add(lines);

  const hfMat = new THREE.LineBasicMaterial({ color: 0x55ddff, depthTest: true, transparent: true, opacity: 0.55, fog: false });
  const hf = new THREE.LineSegments(new THREE.BufferGeometry(), hfMat);
  hf.frustumCulled = false;
  hf.visible = false;
  scene.add(hf);
  const hfPos = new Float32Array((PATCH * 2) * (PATCH * 2) * 3 * 2 * 3);
  hf.geometry.setAttribute('position', new THREE.BufferAttribute(hfPos, 3));

  const notTerrain = (c) => c.shape.type !== RAPIER.ShapeType.HeightField;
  let on = false, tick = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F4') { e.preventDefault(); on = !on; lines.visible = hf.visible = on; }
  });

  function drawTerrainPatch(focus) {
    const { cell, half } = MAP, vn = terrain.vn, H = terrain.heights;
    const cx = Math.floor((focus.x + half) / cell), cz = Math.floor((focus.z + half) / cell);
    let k = 0;
    const v = (ix, iz) => { hfPos[k++] = -half + ix * cell; hfPos[k++] = H[iz * vn + ix] + 0.03; hfPos[k++] = -half + iz * cell; };
    for (let iz = cz - PATCH; iz < cz + PATCH; iz++) for (let ix = cx - PATCH; ix < cx + PATCH; ix++) {
      if (ix < 0 || iz < 0 || ix >= MAP.n || iz >= MAP.n) { for (let i = 0; i < 18; i++) hfPos[k++] = 0; continue; }
      // Edges a-b, a-d and the b-d diagonal (the split Rapier uses).
      v(ix, iz); v(ix + 1, iz);
      v(ix, iz); v(ix, iz + 1);
      v(ix + 1, iz); v(ix, iz + 1);
    }
    hf.geometry.attributes.position.needsUpdate = true;
  }

  return {
    get on() { return on; },
    update(focus) {
      if (!on) return;
      // Colliders change slowly except cars: refresh every 2nd frame.
      if (tick++ % 2 === 0) {
        const { vertices, colors } = world.debugRender(undefined, notTerrain);
        const g = lines.geometry;
        g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
        g.attributes.position.needsUpdate = true;
      }
      drawTerrainPatch(focus);
    },
  };
}
