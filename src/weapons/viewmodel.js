// First-person VIEWMODEL: the player's forearms + held weapon, rendered in a second pass
// with its own camera (FOV 60) after the depth buffer is cleared, so it never clips into
// walls. The world-space body of the local player is hidden in first person (controls.js).
// Camera space: -Z forward, +X right, +Y up. Arms are segments (unit boxes stretched
// between joints): hand -> elbow -> shoulder (off-screen).
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { PALETTE } from '../art/palette.js';
import { box, merge } from '../utils/geom.js';

const P = PALETTE.player;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);

/** Unit segment mesh (length 1 along +Z, centred) painted in one colour. */
function segMesh(w, h, color) {
  const m = new THREE.Mesh(box(w, h, 1, 0, 0, 0, color, { jitter: 0.03 }), MAT.viewSolid);
  m.frustumCulled = false;
  return m;
}
function placeSeg(m, a, b) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-3;
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_z, _d.divideScalar(len));
  m.scale.set(1, 1, len);
}

function buildArm() {
  const g = new THREE.Group();
  const fore = segMesh(0.07, 0.07, P.skin), upper = segMesh(0.1, 0.1, P.shirt);
  const hand = new THREE.Mesh(merge([
    box(0.075, 0.085, 0.1, 0, 0, 0, P.skin, { jitter: 0.03 }),
    box(0.03, 0.03, 0.06, 0.035, 0.015, -0.05, P.skinShade, { jitter: 0.02 }), // thumb
  ]), MAT.viewSolid);
  hand.frustumCulled = false;
  g.add(fore, upper, hand);
  return { g, fore, upper, hand, elbow: new THREE.Vector3(), shoulder: new THREE.Vector3() };
}

export function createViewmodel() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.01, 5);
  const hemi = new THREE.HemisphereLight('#fff4e0', '#5a5246', 1.6);
  const sun = new THREE.DirectionalLight('#fff1d6', 1.6);
  sun.position.set(0.4, 1, 0.3);
  scene.add(hemi, sun);
  const root = new THREE.Group();
  scene.add(root);
  const R = buildArm(), L = buildArm();
  root.add(R.g, L.g);
  const itemHolder = new THREE.Group();
  root.add(itemHolder);
  let item = null;            // { obj, spec }
  const st = { visible: false, t: 0, phase: 0, swayX: 0, swayY: 0, kick: 0, ads: 0, drawn: 1 };
  const hR = new THREE.Vector3(), hL = new THREE.Vector3(), tmp = new THREE.Vector3();

  function poseArm(A, hand, side, handYaw = 0) {
    A.elbow.set(hand.x + side * 0.12, hand.y - 0.2, hand.z + 0.26);
    A.shoulder.set(side * 0.24, -0.42, 0.18);
    placeSeg(A.fore, hand, A.elbow);
    placeSeg(A.upper, A.elbow, A.shoulder);
    A.hand.position.copy(hand);
    A.hand.rotation.set(-0.15, handYaw, 0);
  }

  return {
    scene, camera, root,
    get visible() { return st.visible; },
    get state() { return st; },
    /** Hand points (camera space) for tests. */
    hands: () => ({ r: hR.clone(), l: hL.clone() }),
    /**
     * Held item: obj (Object3D in weapon-local space) + spec { grip, fore, muzzle, sightY, hip, ads }.
     * null = unarmed.
     */
    setItem(obj, spec) {
      if (item) itemHolder.remove(item.obj);
      item = obj ? { obj, spec } : null;
      if (obj) { itemHolder.add(obj); obj.traverse((o) => { o.frustumCulled = false; if (o.material === MAT.solid) o.material = MAT.viewSolid; }); }
    },
    /** Muzzle position in camera space (tracers start here in first person). */
    muzzle(out) { if (!item) return null; itemHolder.updateMatrixWorld(true); return out.set(...item.spec.muzzle).applyMatrix4(item.obj.matrixWorld); },
    /**
     * s = { active, dt, speed, look:{x,y}, aim (bool), kick (0..1 recoil impulse), reload (0..1 | null), reloadKind, pump (0..1|null), dusk, aspect, holster (0..1, 1 = lowered) }
     */
    update(s) {
      st.visible = !!s.active;
      if (!st.visible) return;
      const dt = s.dt;
      if (camera.aspect !== s.aspect) { camera.aspect = s.aspect; camera.updateProjectionMatrix(); }
      st.t += dt;
      st.phase += dt * (3 + s.speed * 1.6);
      const walk = Math.min(1, s.speed / 4.2);
      // Sway lags behind mouse look; idle breathing; walk bob.
      st.swayX += (-s.look.x * 0.00025 - st.swayX) * Math.min(1, dt * 8);
      st.swayY += (s.look.y * 0.00025 - st.swayY) * Math.min(1, dt * 8);
      st.ads += ((s.aim && item ? 1 : 0) - st.ads) * Math.min(1, dt * 12);
      st.kick = Math.max(st.kick * Math.exp(-dt * 14), s.kick || 0);
      st.drawn += ((s.holster ? 0 : 1) - st.drawn) * Math.min(1, dt * 9);
      const breathe = Math.sin(st.t * 1.6) * 0.004 * (1 - walk);
      const bobX = Math.sin(st.phase) * 0.012 * walk * (1 - st.ads * 0.8), bobY = -Math.abs(Math.cos(st.phase)) * 0.014 * walk * (1 - st.ads * 0.8);
      const light = 1.6 - (s.dusk || 0) * 1.0;
      hemi.intensity = light; sun.intensity = light;
      root.position.set(st.swayX + bobX, st.swayY + bobY + breathe - (1 - st.drawn) * 0.35, 0);
      root.rotation.set(0, 0, st.swayX * 2);
      if (!item) {
        // Unarmed: forearms low at the bottom of the view, swinging with the stride.
        const sw = Math.sin(st.phase) * 0.07 * walk;
        hR.set(0.2, -0.36 + Math.max(0, sw) * 0.3, -0.36 - sw);
        hL.set(-0.2, -0.36 + Math.max(0, -sw) * 0.3, -0.36 + sw);
        poseArm(R, hR, 1, -0.2); poseArm(L, hL, -1, 0.2);
        return;
      }
      const sp = item.spec;
      // Weapon placement: hip position blends to ADS (sights on the screen centre).
      const hip = sp.hip, ads = sp.ads;
      const k = st.ads;
      itemHolder.position.set(hip[0] + (ads[0] - hip[0]) * k, hip[1] + (ads[1] - hip[1]) * k, hip[2] + (ads[2] - hip[2]) * k + st.kick * 0.06);
      itemHolder.rotation.set(st.kick * 0.22, 0, 0);
      // Reload: tilt the gun and dip it; shotgun shells / pump handled by the item's own parts.
      if (s.reload != null) {
        const r = Math.sin(Math.min(1, s.reload) * Math.PI);
        itemHolder.rotation.x += -r * 0.35; itemHolder.rotation.z += r * 0.5; itemHolder.position.y -= r * 0.08;
      }
      itemHolder.updateMatrixWorld(true);
      hR.set(...sp.grip).applyMatrix4(item.obj.matrixWorld);
      if (sp.fore) hL.set(...sp.fore).applyMatrix4(item.obj.matrixWorld);
      else hL.set(sp.grip[0] - 0.02, sp.grip[1] - 0.03, sp.grip[2] + 0.02).applyMatrix4(item.obj.matrixWorld);
      // Reloading: the left hand leaves the foregrip to swap the magazine.
      if (s.reload != null && s.reloadKind !== 'pump') {
        const r = Math.sin(Math.min(1, s.reload) * Math.PI);
        tmp.set(-0.12, -0.42, -0.25); hL.lerp(tmp, r * 0.8);
      }
      if (s.pump != null) hL.z += Math.sin(s.pump * Math.PI) * 0.07;
      poseArm(R, hR, 1, 0); poseArm(L, hL, -1, 0.4);
    },
    render(renderer) {
      if (!st.visible) return;
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = ac;
    },
  };
}
