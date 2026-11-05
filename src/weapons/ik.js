// Analytic two-bone IK for the character's arms (shoulder = ball joint, elbow = hinge about
// its local X; the forearm bends toward the shoulder's local +Z). Upper arm and forearm are
// both 0.29 m (character.js). The hand point is 0.29 m down the elbow's local -Y.
import * as THREE from 'three';

export const UPPER = 0.29, FORE = 0.29;
const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3();
const _p = new THREE.Vector3(), _w = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();

/**
 * Point the arm (shoulder bone -> elbow bone) so the hand reaches `target` (world).
 * pole: preferred elbow direction in the shoulder's PARENT space (e.g. down + out).
 * Leaves the bones' matrices updated. Returns the residual distance (0 if reachable).
 */
export function solveArm(shoulder, elbow, target, pole) {
  const parent = shoulder.parent;
  parent.updateWorldMatrix(true, false);
  _inv.copy(parent.matrixWorld).invert();
  _t.copy(target).applyMatrix4(_inv);               // target in parent space
  _s.copy(shoulder.position);                       // shoulder in parent space
  _d.subVectors(_t, _s);
  const dist = _d.length();
  const reach = UPPER + FORE - 1e-4;
  const d = THREE.MathUtils.clamp(dist, 0.06, reach);
  _d.normalize();
  // Angle between the shoulder->target line and the upper arm (law of cosines).
  const cosA = THREE.MathUtils.clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1);
  const a = Math.acos(cosA);
  // Pole direction perpendicular to the line.
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0).addScaledVector(_d, -_d.y);
  _p.normalize();
  _u.copy(_d).multiplyScalar(Math.cos(a)).addScaledVector(_p, Math.sin(a)); // upper arm direction
  // Shoulder basis: local -Y = upper arm, local +Z = toward the target side (bend plane).
  _y.copy(_u).negate();
  _w.copy(_d).addScaledVector(_u, -_d.dot(_u));
  if (_w.lengthSq() < 1e-8) _w.copy(_p).negate();
  _w.normalize();
  _x.crossVectors(_y, _w).normalize();
  _m.makeBasis(_x, _y, _w);
  shoulder.quaternion.setFromRotationMatrix(_m);
  // Elbow bend: interior angle from the law of cosines; hinge rotates -Y toward +Z for negative x.
  const cosE = THREE.MathUtils.clamp((UPPER * UPPER + FORE * FORE - d * d) / (2 * UPPER * FORE), -1, 1);
  elbow.rotation.set(-(Math.PI - Math.acos(cosE)), 0, 0);
  shoulder.updateWorldMatrix(false, true);
  return Math.max(0, dist - reach);
}

/** World position of the hand at the end of `elbow` (0.29 m down its local -Y). */
export function handWorld(elbow, out = new THREE.Vector3()) {
  elbow.updateWorldMatrix(true, false);
  return out.set(0, -FORE, 0.005).applyMatrix4(elbow.matrixWorld);
}
