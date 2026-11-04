// Concrete driveways draped over the final terrain, from the garage to the kerb.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { paint, merge } from '../utils/geom.js';

const LIFT = 0.09; // above terrain: clears the footpath (+0.05)

function strip(dw, terrain) {
  const pos = [];
  const steps = Math.max(2, Math.ceil(dw.len / 1.0));
  const rx = -dw.fz, rz = dw.fx; // across
  const hw = dw.width / 2;
  const at = (t, a, dy = LIFT) => {
    const x = dw.start.x + dw.fx * t + rx * a, z = dw.start.z + dw.fz * t + rz * a;
    return [x, terrain.getHeight(x, z) + dy, z];
  };
  const lat = [-hw, 0, hw];
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * dw.len, t1 = ((i + 1) / steps) * dw.len;
    for (let k = 0; k < 2; k++) {
      const a = at(t0, lat[k]), b = at(t0, lat[k + 1]), c = at(t1, lat[k + 1]), d = at(t1, lat[k]);
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
    // Side skirts so the slab never shows a gap on slopes.
    for (const s of [-1, 1]) {
      const a = at(t0, hw * s), b = at(t1, hw * s), c = at(t1, hw * s, -0.1), d = at(t0, hw * s, -0.1);
      if (s > 0) pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildDriveways(driveways, terrain) {
  const geos = driveways.map((dw, i) => {
    const g = strip(dw, terrain);
    // Fix winding so all top faces point up regardless of driveway direction.
    const p = g.attributes.position;
    for (let t = 0; t < p.count; t += 3) {
      const ax = p.getX(t), az = p.getZ(t);
      const bx = p.getX(t + 1) - ax, bz = p.getZ(t + 1) - az;
      const cx = p.getX(t + 2) - ax, cz = p.getZ(t + 2) - az;
      const ny = bz * cx - bx * cz; // y of cross(b - a, c - a); ~0 for vertical skirts
      if (ny < -1e-4) {
        const x = p.getX(t + 1), y = p.getY(t + 1), z = p.getZ(t + 1);
        p.setXYZ(t + 1, p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2));
        p.setXYZ(t + 2, x, y, z);
      }
    }
    g.computeVertexNormals();
    return paint(g, dw.hero ? PALETTE.hero.driveway : PALETTE.road.driveway, 0.04, 100 + i);
  });
  const mesh = new THREE.Mesh(merge(geos), MAT.decal);
  mesh.receiveShadow = true;
  mesh.name = 'driveways';
  return mesh;
}
