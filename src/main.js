// Grand Terrace Auto - entry point.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Terrain } from './world/terrain.js';
import { createLighting } from './world/lighting.js';
import { createOverlay } from './utils/overlay.js';

const params = new URLSearchParams(location.search);

await RAPIER.init();
console.log(`[gta] Rapier ${RAPIER.version()} ready, three r${THREE.REVISION}`);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.25, 2000);

const lighting = createLighting(scene, renderer);
const terrain = new Terrain();
scene.add(terrain.mesh);

camera.position.set(-160, 90, 160);
camera.lookAt(0, 0, 0);

const overlay = createOverlay(renderer, { visible: params.has('hud') });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__gta = { ready: false, stats: () => overlay.stats() };
const clock = new THREE.Clock();
const focus = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  lighting.update(dt, focus, camera.position);
  renderer.render(scene, camera);
  overlay.update(dt);
  window.__gta.ready = true;
});
