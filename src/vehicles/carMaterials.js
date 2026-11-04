// Shared car materials. Light states are swapped by reference (off / on / brake), so
// toggling lights never creates materials or triggers shader recompiles.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';

const C = PALETTE.cars;

/** Elongated soft spot for the headlight wash on the road. */
function washTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 112, 4, 32, 70, 70);
  grd.addColorStop(0, 'rgba(255,240,205,1)');
  grd.addColorStop(0.5, 'rgba(255,232,190,0.35)');
  grd.addColorStop(1, 'rgba(255,225,180,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
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
    color: C.beam, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
    depthWrite: false, map: washTexture(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  }),
};
