// Grand Terrace Auto - entry point: renderer, world, physics, controls, loop.
//   ?cam=<preset>  start in the debug camera at a named view (hero-front, hero-34,
//                  street, overview, top); add "-dusk" for dusk lighting.
//   ?cam=player    third-person at the spawn (default when no ?cam is given).
//   ?hud           show the F3 overlay on load.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createLighting } from './world/lighting.js';
import { createOverlay } from './utils/overlay.js';
import { buildWorld, heroSpawn } from './world/world.js';
import { createPhysics } from './physics/physicsWorld.js';
import { createDebugDraw } from './physics/debugDraw.js';
import { createControls } from './player/controls.js';
import { cameraPreset } from './player/presets.js';
import { createVehicles } from './vehicles/vehicleManager.js';

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
const physics = createPhysics(world);
const vehicles = createVehicles({ physics, scene, world });
world.vehicles = vehicles;

const camName = (params.get('cam') || 'player').replace(/-dusk$/, '');
const preset = cameraPreset(camName, world, spawn);
camera.position.copy(preset.position);
camera.lookAt(preset.target);
if ((params.get('cam') || '').endsWith('-dusk')) lighting.setDusk(1);

const controls = createControls({
  camera, dom: renderer.domElement, physics, scene, world, spawn, lighting,
  startMode: camName === 'player' ? 'walk' : 'fly',
});
if (params.has('shot')) controls.hint.style.display = 'none';
physics.onStep((h) => controls.fixedUpdate(h));
const debugDraw = createDebugDraw(scene, physics, world.terrain);

const overlay = createOverlay(renderer, { visible: params.has('hud') });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug helpers (used by the Playwright scripts).
const debug = {
  /** Park one car of each type in a row on Grand Terrace near 62, for a group photo. */
  lineup() {
    const S = world.network.main.samples, i0 = world.layout.hero.site.i + 30;
    const seen = new Set(), out = [];
    for (const car of vehicles.cars) { if (!seen.has(car.type)) { seen.add(car.type); out.push(car); } }
    out.forEach((car, k) => {
      const s = S[i0 + k * 6], x = s.x - s.nx * 1.6, z = s.z - s.nz * 1.6;
      car.body.teleport(x, world.terrain.getHeight(x, z), z, Math.atan2(s.tx, s.tz));
    });
    const a = S[i0 + 9];
    const side = { x: a.nx * 8, z: a.nz * 8 }; // across the road from the parked row
    camera.position.set(a.x + side.x + a.tx * 9, a.h + 2.4, a.z + side.z + a.tz * 9);
    camera.lookAt(a.x, a.h + 0.6, a.z);
    controls.syncFly?.();
    return out.map((c) => c.type);
  },
};

window.__gta = { debug, ready: false, stats: () => overlay.stats(), world, scene, renderer, controls, physics, RAPIER, vehicles };
const timer = new THREE.Timer();
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  physics.step(dt);
  vehicles.sync();
  controls.update(dt);
  lighting.update(dt, preset.noFog && controls.mode === 'fly' ? preset.target : controls.focus(), camera.position);
  if (preset.noFog && controls.mode === 'fly') scene.fog.far = 1e5;
  debugDraw.update(controls.focus());
  renderer.render(scene, camera);
  overlay.update(dt, controls.debugText());
  if (++frames > 3) window.__gta.ready = true;
});
