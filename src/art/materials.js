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

// Three caches object-type shader flags per material. Keep each render path stable
// while sharing identical appearance and the same compiled shader families.
MAT.skinned = MAT.solid.clone();
MAT.instanced = MAT.solid.clone();
MAT.instancedColor = MAT.solid.clone();
MAT.instancedGlass = MAT.glass.clone();

// Street light heads and the soft additive pools they throw on the road.
MAT.streetHead = new THREE.MeshLambertMaterial({ color: '#e9e2cf', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
MAT.pool = new THREE.MeshBasicMaterial({
  color: '#ffd7a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
  depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true,
});

// 62 has its own window glass (its glow follows the interior lights, not just the clock),
// interior lamp shades, and unlit "view out" panes on the inside of its windows.
MAT.heroGlass = MAT.glass.clone();
MAT.interiorLamp = new THREE.MeshLambertMaterial({ color: '#f3e6c8', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
MAT.innerPane = new THREE.MeshBasicMaterial({ color: '#cfe0ea' });

/** 0 = afternoon, 1 = dusk/night. Drives window, lamp and street-light glow. */
export function setGlow(dusk) {
  const d = Math.min(1, Math.max(0, dusk));
  MAT.glass.emissiveIntensity = d * d * 1.25;
  MAT.instancedGlass.emissiveIntensity = MAT.glass.emissiveIntensity;
  MAT.lamp.emissiveIntensity = 0.15 + d * 1.6;
  const s = Math.max(0, (d - 0.35) / 0.65); // street lights come on a little after sunset
  MAT.streetHead.emissiveIntensity = s * 2.4;
  MAT.pool.opacity = s * 0.85;
  MAT.pool.visible = s > 0.01;
}
