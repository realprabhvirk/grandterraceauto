// Street name signs at every cul-de-sac junction: grey pole, two crossed blades.
// All blade text comes from one canvas atlas -> 1 textured draw call for every sign.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, cylinder, merge } from '../utils/geom.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD } from './roadNetwork.js';

const ROWS = 4;
const BLADE = { w: 1.55, h: 0.26, t: 0.035 };

function makeAtlas(labels) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128 * ROWS;
  const g = c.getContext('2d');
  labels.forEach((text, r) => {
    const y = r * 128;
    g.fillStyle = PALETTE.road.signBlade;
    g.fillRect(0, y, 1024, 128);
    g.strokeStyle = PALETTE.road.signText;
    g.lineWidth = 6;
    g.strokeRect(10, y + 10, 1004, 108);
    g.fillStyle = PALETTE.road.signText;
    g.font = 'bold 74px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 512, y + 68, 960);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildSigns(network) {
  const labels = network.roads.map((r) => r.sign).slice(0, ROWS);
  const tex = makeAtlas(labels);
  const solid = [], faces = [];
  const Y = new THREE.Vector3(0, 1, 0);

  const blade = (row, x, y, z, tx, tz) => {
    const rot = Math.atan2(-tz, tx);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, rot), new THREE.Vector3(1, 1, 1));
    const b = box(BLADE.w, BLADE.h, BLADE.t, 0, 0, 0, PALETTE.road.signBlade, { jitter: 0.01 });
    b.applyMatrix4(m);
    solid.push(b);
    for (const side of [1, -1]) {
      const pl = new THREE.PlaneGeometry(BLADE.w - 0.03, BLADE.h - 0.03);
      const uv = pl.attributes.uv;
      const v0 = 1 - (row + 1) / ROWS, v1 = 1 - row / ROWS;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > 0.5 ? v1 : v0);
      if (side < 0) pl.rotateY(Math.PI);
      pl.translate(0, 0, (side * BLADE.t) / 2 + side * 0.002);
      pl.applyMatrix4(m);
      faces.push(pl);
    }
  };

  const signAt = (x, z, h, a, b) => {
    solid.push(cylinder(0.045, 0.045, 3.05, 6, x, h, z, PALETTE.road.signPole, { jitter: 0.02 }));
    solid.push(box(0.1, 0.1, 0.1, x, h + 3.07, z, PALETTE.road.signPole));
    blade(a.row, x, h + 2.62, z, a.tx, a.tz);
    blade(b.row, x, h + 2.9, z, b.tx, b.tz);
  };

  const mainRow = network.roads.indexOf(network.main);
  for (const j of network.junctions) {
    const s = j.main.samples[j.mainIndex];
    const along = j.branch.halfW + 5 + 3.2; // past the corner fillet (radius 5)
    const lat = (ROAD.curbOut + ROAD.pathIn) / 2; // middle of the grass verge
    const x = s.x + s.tx * along + s.nx * j.side * lat;
    const z = s.z + s.tz * along + s.nz * j.side * lat;
    const bs = j.branch.samples[Math.min(8, j.branch.samples.length - 1)];
    signAt(x, z, s.h, { row: mainRow, tx: s.tx, tz: s.tz }, { row: network.roads.indexOf(j.branch), tx: bs.tx, tz: bs.tz });
  }

  const group = new THREE.Group();
  group.name = 'signs';
  const solidMesh = new THREE.Mesh(merge(solid), MAT.solid);
  solidMesh.castShadow = true;
  const faceMesh = new THREE.Mesh(mergeGeometries(faces), new THREE.MeshLambertMaterial({ map: tex }));
  faces.forEach((f) => f.dispose());
  group.add(solidMesh, faceMesh);
  return group;
}
