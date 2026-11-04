// Grand Terrace Auto - entry point: renderer, world, lighting, loop.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createLighting } from './world/lighting.js';
import { createOverlay } from './utils/overlay.js';
import { buildWorld, heroSpawn } from './world/world.js';
import { cameraPreset } from './player/presets.js';

const params = new URLSearchParams(location.search);

await RAPIER.init();
console.log(`[gta] Rapier ${RAPIER.version()} ready, three r${THREE.REVISION}`);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.25, 2000);

const lighting = createLighting(scene, renderer);
const world = buildWorld(scene);
const spawn = heroSpawn(world);

const camName = params.get('cam') || 'hero-front';
const preset = cameraPreset(camName.replace(/-dusk$/, ''), world, spawn);
camera.position.copy(preset.position);
camera.lookAt(preset.target);
if (camName.endsWith('-dusk')) lighting.setDusk(1);
if (preset.noFog) scene.fog.far = 1e5;
const focus = preset.target.clone();

const overlay = createOverlay(renderer, { visible: params.has('hud') });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__gta = { ready: false, stats: () => overlay.stats(), world, scene, renderer };
const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  lighting.update(dt, focus, camera.position);
  if (preset.noFog) scene.fog.far = 1e5;
  renderer.render(scene, camera);
  overlay.update(dt);
  window.__gta.ready = true;
});
