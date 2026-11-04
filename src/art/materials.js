// Shared materials. Everything static uses one flat-shaded vertex-colour Lambert
// material (cheap on integrated GPUs); glass and lamps get emissive variants whose
// glow is driven by the time-of-day "dusk" factor.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const MAT = {
  // Generic flat-shaded, vertex-coloured surface.
  solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),

  // Same, but pushed toward the camera in depth so road/footpath ribbons never z-fight
  // with the terrain underneath.
  decal: new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  }),

  // Window glass: dark blue-grey by day, warm glow at dusk.
  glass: new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    emissive: new THREE.Color(PALETTE.house.glow),
    emissiveIntensity: 0,
  }),

  // Exterior wall lights.
  lamp: new THREE.MeshLambertMaterial({
    color: PALETTE.house.lamp,
    emissive: new THREE.Color(PALETTE.house.lamp),
    emissiveIntensity: 0.15,
  }),
};

/** 0 = afternoon, 1 = dusk. Drives window and lamp glow. */
export function setGlow(dusk) {
  const d = Math.min(1, Math.max(0, dusk));
  MAT.glass.emissiveIntensity = d * d * 1.25;
  MAT.lamp.emissiveIntensity = 0.15 + d * 1.6;
}
