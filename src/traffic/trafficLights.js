// Phase 6: traffic lights at the six 4-way junctions on Terrace Pde (x 420 -> 880). Each
// junction cycles: Pde (east-west) green 14 s, amber 3 s, all-red 1.5 s, cross street green
// 10 s, amber 3 s, all-red 1.5 s (phase-offset per junction, so a green wave runs east).
// AI traffic stops at the stop line on red / amber (lane.signal, see trafficCar.js); cars
// already past the line carry on. Visuals: a pole + 3-lamp head on the left kerb of every
// approach (one InstancedMesh for all lamps, recoloured on phase change), stop lines and
// zebra crossings. The player is free to run reds (no fine / heat - arcade).
import * as THREE from 'three';
import { T } from '../town/townPlan.js';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';

export const SIGNAL = { ew: 14, ns: 10, amber: 3, allRed: 1.5, offset: 4.5 };
const CYCLE = SIGNAL.ew + SIGNAL.ns + 2 * (SIGNAL.amber + SIGNAL.allRed);
const STOP = T.hw + 2.6; // = townLanes STOP (lane ends here)
const COL = { red: new THREE.Color('#ff3b2a'), amber: new THREE.Color('#ffb11f'), green: new THREE.Color('#3dff7a'), off: new THREE.Color('#2a2c2e') };

/** Phase of one axis at cycle time t: 'green' | 'amber' | 'red'. */
export function signalAt(t, axis) {
  let u = ((t % CYCLE) + CYCLE) % CYCLE;
  const ew = u < SIGNAL.ew ? 'green' : u < SIGNAL.ew + SIGNAL.amber ? 'amber' : 'red';
  u -= SIGNAL.ew + SIGNAL.amber + SIGNAL.allRed;
  const ns = u >= 0 && u < SIGNAL.ns ? 'green' : u >= SIGNAL.ns && u < SIGNAL.ns + SIGNAL.amber ? 'amber' : 'red';
  return axis === 'ew' ? ew : ns;
}

export function buildTrafficLights({ scene, plan, graph, physics, terrain }) {
  const zPde = T.Z[1];
  const nodes = plan.nodes.filter((n) => !n.north && n.z === zPde && n.links.length === 4);
  const junctions = nodes.map((n, k) => ({ id: n.id, x: n.x, z: n.z, offset: k * SIGNAL.offset, ew: 'green', ns: 'red', heads: [] }));
  const byNode = new Map(junctions.map((j) => [j.id, j]));
  // Tag the approach lanes (lanes ending at a signal node) + make the straight connectors priority.
  let approaches = 0;
  for (const L of graph.lanes) {
    if (L.town && L.to && byNode.has(L.to.id)) {
      const P = L.pts, a = P[P.length - 2], b = P[P.length - 1];
      L.signal = { j: byNode.get(L.to.id), axis: Math.abs(b.x - a.x) > Math.abs(b.z - a.z) ? 'ew' : 'ns' };
      approaches++;
      for (const e of L.exits) { const c = graph.lanes[e.lane]; if (c && !c.slow) c.giveWay = null; }
    }
  }
  const parts = [], lamps = [];
  const y0 = (x, z) => terrain.getHeight(x, z);
  for (const j of junctions) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // Approach travelling (dx, dz) into the junction; its left kerb = (dz, -dx).
      const lx = dz, lz = -dx, px = j.x - dx * (STOP + 0.4) + lx * (T.hw + T.kerb + 0.7), pz = j.z - dz * (STOP + 0.4) + lz * (T.hw + T.kerb + 0.7);
      const y = y0(px, pz), yaw = Math.atan2(-dx, -dz); // head faces the oncoming approach
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(px, y, pz);
      parts.push(paint(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8).translate(0, 1.8, 0), '#3a3d42', 0.02).applyMatrix4(m));
      parts.push(paint(new THREE.BoxGeometry(0.42, 1.15, 0.3).translate(0, 3.55, 0), '#26282b', 0.02).applyMatrix4(m));
      parts.push(paint(new THREE.BoxGeometry(0.5, 1.25, 0.04).translate(0, 3.55, -0.16), '#f2c41a', 0.02).applyMatrix4(m)); // backboard
      const head = { axis: dx !== 0 ? 'ew' : 'ns', lamps: [] };
      ['red', 'amber', 'green'].forEach((c, k) => {
        const lm = new THREE.Matrix4().makeRotationY(yaw).setPosition(px, y + 3.92 - k * 0.37, pz).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.16));
        head.lamps.push(lamps.length); lamps.push({ m: lm, c });
      });
      j.heads.push(head);
      const col = physics.world.createCollider(physics.RAPIER.ColliderDesc.cylinder(1.8, 0.12).setTranslation(px, y + 1.8, pz));
      physics.tag?.(col, 'traffic light', j.id);
      // Stop line across the approach's half of the road + zebra crossing behind it.
      const sx = j.x - dx * STOP, sz = j.z - dz * STOP;
      const cx = sx + lx * T.hw / 2, cz = sz + lz * T.hw / 2, ys = y0(cx, cz) + 0.075;
      const along = dx !== 0; // road runs along x
      parts.push(paint(new THREE.BoxGeometry(along ? 0.45 : T.hw - 0.2, 0.02, along ? T.hw - 0.2 : 0.45), '#f4f1e8', 0.01).translate(cx, ys, cz));
      for (let s = -T.hw + 0.6; s <= T.hw - 0.5; s += 1.1) {
        const zx = j.x - dx * (STOP - 2.0) + lx * s, zz = j.z - dz * (STOP - 2.0) + lz * s;
        parts.push(paint(new THREE.BoxGeometry(along ? 2.6 : 0.55, 0.02, along ? 0.55 : 2.6), '#f4f1e8', 0.01).translate(zx, ys, zz));
      }
    }
  }
  const mesh = new THREE.Mesh(merge(parts), MAT.solid);
  mesh.name = 'traffic-lights'; mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  const lampMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 10), new THREE.MeshBasicMaterial({ toneMapped: false }), lamps.length);
  lampMesh.name = 'traffic-lamps';
  lamps.forEach((l, i) => { lampMesh.setMatrixAt(i, l.m); lampMesh.setColorAt(i, COL.off); });
  scene.add(lampMesh);

  let t = 0;
  const st = { junctions: junctions.length, approaches, heads: junctions.length * 4, changes: 0 };
  function paintHeads(j) {
    for (const h of j.heads) {
      const s = j[h.axis];
      h.lamps.forEach((i, k) => lampMesh.setColorAt(i, ['red', 'amber', 'green'][k] === s ? COL[s] : COL.off));
    }
  }
  for (const j of junctions) { j.ew = signalAt(j.offset, 'ew'); j.ns = signalAt(j.offset, 'ns'); paintHeads(j); }
  lampMesh.instanceColor.needsUpdate = true;
  return {
    junctions, st, mesh, lampMesh,
    /** Signal state for an axis at a junction id. */
    state: (id, axis) => byNode.get(id)?.[axis],
    update(dt) {
      t += dt;
      let dirty = false;
      for (const j of junctions) {
        const ew = signalAt(t + j.offset, 'ew'), ns = signalAt(t + j.offset, 'ns');
        if (ew !== j.ew || ns !== j.ns) { j.ew = ew; j.ns = ns; paintHeads(j); dirty = true; st.changes++; }
      }
      if (dirty) lampMesh.instanceColor.needsUpdate = true;
    },
    /** Test hook: jump the cycle clock. */
    setTime(v) { t = v; this.update(0); },
  };
}
