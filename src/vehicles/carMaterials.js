// Shared car materials. Light states are swapped by reference (off / on / brake), so
// toggling lights never creates materials or triggers shader recompiles.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';

const C = PALETTE.cars;
const lens = (color, emissive, intensity) => new THREE.MeshLambertMaterial({
  color, emissive: new THREE.Color(emissive), emissiveIntensity: intensity, flatShading: true,
});

export const CAR_MAT = {
  glass: new THREE.MeshLambertMaterial({ color: C.glass, transparent: true, opacity: 0.58, flatShading: true, depthWrite: false }),
  headOff: lens(C.head, C.headGlow, 0.0),
  headOn: lens(C.head, C.headGlow, 2.4),
  tailOff: lens(C.tail, C.tailGlow, 0.0),
  tailRun: lens(C.tail, C.tailGlow, 0.7),
  tailBrake: lens(C.tail, C.tailGlow, 2.6),
  revOff: lens(C.reverse, '#ffffff', 0.0),
  revOn: lens(C.reverse, '#ffffff', 1.8),
  beam: new THREE.MeshBasicMaterial({
    color: C.beam, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  }),
};
