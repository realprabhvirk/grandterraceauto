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

  // --- Internal door: garage <-> hall (in the x = 3.9 partition), swings into the hall ---
  const n = o.inner || { x: 3.9, z0: 1.7, z1: 2.6, h: 2.1, y: 0.15 };
  const innerPivot = new THREE.Group();
  innerPivot.position.set(n.x, n.y, n.z0);
  const innerPanel = new THREE.Mesh(merge([
    boxB(0.045, n.h - 0.02, n.z1 - n.z0 - 0.04, 0, 0, (n.z1 - n.z0) / 2, C.innerDoor || '#ece6d8', { jitter: 0.02 }),
    box(0.1, 0.03, 0.12, 0, 1.0 - n.y + 0.05, n.z1 - n.z0 - 0.15, '#b9b6ae'),
  ]), MAT.solid);
  innerPivot.add(innerPanel);
  group.add(innerPivot);

  const state = { front: 0, frontTarget: 0, garage: 0, garageTarget: 0, inner: 0, innerTarget: 0 };
  const toggles = [
    { id: 'frontDoor', box: { x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - 0.05, z1: d.z + 0.12, y0: 0.15, y1: d.h } },
    { id: 'garageDoor', box: { x0: g.x - g.w / 2, x1: g.x + g.w / 2, z0: g.z - 0.05, z1: g.z + 0.12, y0: 0.1, y1: g.h } },
    { id: 'innerDoor', box: { x0: n.x - 0.06, x1: n.x + 0.06, z0: n.z0, z1: n.z1, y0: n.y, y1: n.y + n.h } },
  ];
  let handles = null;
  return {
    group, toggles, state,
    /** physics handles for the toggle colliders, keyed by id. */
    attach(h) { handles = h; },
    toggleFront() { state.frontTarget = state.frontTarget > 0.5 ? 0 : 1; },
    toggleGarage() { state.garageTarget = state.garageTarget > 0.5 ? 0 : 1; },
    toggleInner() { state.innerTarget = state.innerTarget > 0.5 ? 0 : 1; },
    inner: n,
    update(dt) {
      state.front += Math.sign(state.frontTarget - state.front) * Math.min(Math.abs(state.frontTarget - state.front), dt / 0.6);
      state.garage += Math.sign(state.garageTarget - state.garage) * Math.min(Math.abs(state.garageTarget - state.garage), dt / 2.2);
      state.inner += Math.sign(state.innerTarget - state.inner) * Math.min(Math.abs(state.innerTarget - state.inner), dt / 0.6);
      innerPivot.rotation.y = -1.5 * state.inner * state.inner * (3 - 2 * state.inner); // into the hall
      const ef = state.front * state.front * (3 - 2 * state.front);
      pivot.rotation.y = ef * 1.65; // swings inward
      const eg = state.garage;
      roller.position.y = eg * (g.h - 0.05);
      roller.scale.y = 1 - eg * 0.93;
      roller.visible = eg < 0.99;
      if (handles) {
        handles.frontDoor?.setEnabled(state.front < 0.3);
        handles.garageDoor?.setEnabled(state.garage < 0.7);
        handles.innerDoor?.setEnabled(state.inner < 0.3);
      }
    },
  };
}

/**
 * Generic hinged door (town shops) with the same behaviour as 62's front door: E toggles,
 * swings inward over 0.6 s, its toggle collider is enabled only while mostly shut.
 * o = { id, x, y, z, w, h, rot (front faces +Z local), color, glass }
 */
export function buildSwingDoor(o) {
  const root = new THREE.Group();
  root.position.set(o.x, o.y, o.z);
  root.rotation.y = o.rot;
  const pivot = new THREE.Group();
  pivot.position.set(-o.w / 2, 0, 0);
  root.add(pivot);
  const panel = new THREE.Mesh(merge([
    boxB(o.w, o.h, 0.06, o.w / 2, 0, 0, o.color || '#3a3a3c', { jitter: 0.02 }),
    box(o.w - 0.3, o.h - 0.5, 0.07, o.w / 2, o.h / 2 + 0.05, 0, o.glass || '#6f8797'),
    box(0.04, 0.5, 0.12, o.w - 0.15, 1.05, 0, '#b9b6ae'),
  ]), MAT.solid);
  panel.castShadow = true;
  pivot.add(panel);
  const state = { t: 0, target: 0 };
  let handles = null;
  const toggle = () => { state.target = state.target > 0.5 ? 0 : 1; };
  return {
    group: root, state, toggle,
    toggles: [{ id: o.id, x: o.x, y: o.y + o.h / 2, z: o.z, hx: o.w / 2, hy: o.h / 2, hz: 0.08, rot: o.rot }],
    target: { id: o.id, key: 'E', range: 2.6, position: () => ({ x: o.x, y: o.y, z: o.z }), label: () => (state.target > 0.5 ? 'Press E to close' : 'Press E to open'), action: toggle },
    attach(h) { handles = h; },
    update(dt) {
      state.t += Math.sign(state.target - state.t) * Math.min(Math.abs(state.target - state.t), dt / 0.6);
      pivot.rotation.y = state.t * state.t * (3 - 2 * state.t) * 1.6; // swings inward
      handles?.[o.id]?.setEnabled(state.t < 0.3);
    },
  };
}
