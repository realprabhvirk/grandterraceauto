// Grand Terrace Auto - entry point: renderer, world, physics, cars, controls, loop.
//   ?cam=<preset>  start in the debug camera at a named view (hero-front, hero-34,
//                  street, overview, top, hero-car, cars...); add "-dusk" for dusk lighting.
//   ?cam=player    third-person at the spawn (default when no ?cam is given).
//   ?hud           show the F3 overlay on load.   ?shot  hide the controls panel.
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
import { createHeadlightRig } from './vehicles/headlightRig.js';
import { createCarAudio } from './audio/carAudio.js';
import { createDebugApi } from './utils/debugApi.js';
import { createPedestrians } from './npc/pedestrians.js';
import { createTraffic } from './traffic/trafficManager.js';

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
world.hero?.attach(physics.toggles); // 62's door colliders
world.vehicles = vehicles;
const headlights = createHeadlightRig(scene);
const audio = createCarAudio();

const camName = (params.get('cam') || 'player').replace(/-dusk$/, '');
const preset = cameraPreset(camName, world, spawn);
camera.position.copy(preset.position);
camera.lookAt(preset.target);
if ((params.get('cam') || '').endsWith('-dusk')) lighting.setDusk(1);

const controls = createControls({
  camera, dom: renderer.domElement, physics, scene, world, spawn, lighting, vehicles, audio,
  startMode: camName === 'player' ? 'walk' : 'fly',
});
if (params.has('shot')) controls.panel.hide();
// Order matters: controls set this step's car input, then every car steps.
physics.onStep((h) => { controls.fixedUpdate(h); vehicles.fixedUpdate(h); });
for (const t of world.hero?.targets || []) controls.interact.register(t); // E: front door, garage
const debugDraw = createDebugDraw(scene, physics, world.terrain);
const peds = createPedestrians({ scene, physics, world });
const traffic = createTraffic({ scene, physics, world, vehicles, audio });
/** Everything with wheels that pedestrians should watch out for. */
const movingCars = () => [...vehicles.cars.map((c) => { const f = c.body.forward(), p = c.position; return { x: p.x, z: p.z, fx: f.x, fz: f.z, speed: c.body.state.speed }; }), ...traffic.movers()];

const overlay = createOverlay(renderer, { visible: params.has('hud') });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__gta = {
  ready: false, stats: () => overlay.stats(), world, scene, renderer, camera, controls, physics, RAPIER, vehicles, lighting, peds, traffic,
  debug: createDebugApi({ world, vehicles, controls, camera, lighting }),
};
const timer = new THREE.Timer();
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  physics.step(dt);
  vehicles.sync();
  controls.update(dt);
  traffic.update(dt, { player: controls.mode === 'walk' ? controls.player.position : null, night: lighting.dusk > 0.5 });
  audio.setListener(controls.focus());
  world.heroState = world.hero?.update(dt, { player: controls.focus(), night: lighting.dusk });
  peds.update(dt, { focus: controls.focus(), player: controls.mode === 'walk' ? controls.player.position : null, cars: movingCars() });
  const lit = controls.car && controls.car.lights ? controls.car : vehicles.cars.find((c) => c.lights) || null;
  headlights.update(dt, lit, lighting.dusk);
  lighting.update(dt, preset.noFog && controls.mode === 'fly' ? preset.target : controls.focus(), camera.position);
  if (preset.noFog && controls.mode === 'fly') scene.fog.far = 1e5;
  debugDraw.update(controls.focus());
  renderer.render(scene, camera);
  overlay.update(dt, controls.debugText());
  if (++frames > 3) window.__gta.ready = true;
});
