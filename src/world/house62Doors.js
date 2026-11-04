// 62 Grand Terrace doors: hinged front door (swings in) and a roller garage door (rolls up
// into a coil box under the ceiling). E toggles each (prompt from the interaction system).
// Each door has a "toggle" collider that is enabled only while the door is mostly shut.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, boxB, merge } from '../utils/geom.js';

/**
 * @param o { door: {x, w, h, z}, garage: {x, w, h, z}, colors: {door, frame, garage, line, glass} }
 * @returns { group, toggles: [{ id, box }], targets: [...], update(dt), state }
 */
export function buildDoors(o) {
  const group = new THREE.Group();
  group.name = 'hero-62-doors';
  const C = o.colors;

  // --- Front door: pivot on the hinge (left edge), panel hangs to +X ---------------------
  const d = o.door;
  const pivot = new THREE.Group();
  pivot.position.set(d.x - d.w / 2, 0, d.z + 0.05);
  const panel = new THREE.Mesh(merge([
    boxB(d.w, d.h, 0.05, d.w / 2, 0, 0, C.door, { jitter: 0.02 }),
    box(0.12, d.h - 0.4, 0.02, d.w / 2 - 0.3, d.h / 2 + 0.05, 0.035, C.glass),
    box(0.03, 0.4, 0.05, d.w / 2 + 0.36, 1.05, 0.05, '#b9b6ae'),
    box(0.03, 0.4, 0.05, d.w / 2 + 0.36, 1.05, -0.05, '#b9b6ae'),
  ]), MAT.solid);
  panel.castShadow = true;
  pivot.add(panel);
  group.add(pivot);

  // --- Garage roller door: slatted panel that rises and shrinks into a coil box ------------
  const g = o.garage;
  const roller = new THREE.Group();
  roller.position.set(g.x, 0, g.z + 0.06);
  const slats = [boxB(g.w, g.h, 0.05, 0, 0, 0, C.garage, { jitter: 0.02 })];
  for (let y = 0.25; y < g.h; y += 0.16) slats.push(box(g.w - 0.12, 0.018, 0.02, 0, y, 0.035, C.line, { jitter: 0.01 }));
  const rollerMesh = new THREE.Mesh(merge(slats), MAT.solid);
  rollerMesh.castShadow = true;
  roller.add(rollerMesh);
  const coil = new THREE.Mesh(box(g.w + 0.1, 0.32, 0.36, g.x, g.h + 0.18, g.z - 0.2, C.frame), MAT.solid);
  group.add(roller, coil);

  const state = { front: 0, frontTarget: 0, garage: 0, garageTarget: 0 };
  const toggles = [
    { id: 'frontDoor', box: { x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - 0.05, z1: d.z + 0.12, y0: 0.15, y1: d.h } },
    { id: 'garageDoor', box: { x0: g.x - g.w / 2, x1: g.x + g.w / 2, z0: g.z - 0.05, z1: g.z + 0.12, y0: 0.1, y1: g.h } },
  ];
  let handles = null;
  return {
    group, toggles, state,
    /** physics handles for the toggle colliders, keyed by id. */
    attach(h) { handles = h; },
    toggleFront() { state.frontTarget = state.frontTarget > 0.5 ? 0 : 1; },
    toggleGarage() { state.garageTarget = state.garageTarget > 0.5 ? 0 : 1; },
    update(dt) {
      state.front += Math.sign(state.frontTarget - state.front) * Math.min(Math.abs(state.frontTarget - state.front), dt / 0.6);
      state.garage += Math.sign(state.garageTarget - state.garage) * Math.min(Math.abs(state.garageTarget - state.garage), dt / 2.2);
      const ef = state.front * state.front * (3 - 2 * state.front);
      pivot.rotation.y = ef * 1.65; // swings inward
      const eg = state.garage;
      roller.position.y = eg * (g.h - 0.05);
      roller.scale.y = 1 - eg * 0.93;
      roller.visible = eg < 0.99;
      if (handles) {
        handles.frontDoor?.setEnabled(state.front < 0.3);
        handles.garageDoor?.setEnabled(state.garage < 0.7);
      }
    },
  };
}
