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
import { createMirrors } from './camera/mirrors.js';
import { createParticles } from './combat/particles.js';
import { createBreakables } from './combat/breakables.js';
import { createCombat } from './combat/combat.js';
import { createWallet } from './combat/wallet.js';
import { createStatusHud } from './ui/statusHud.js';
import { buildStreetProps } from './world/streetProps.js';
import { createSpawnPoints } from './world/spawnPoints.js';
import { createWanted } from './police/wanted.js';
import { createPolice } from './police/policeManager.js';
import { createTheft } from './police/theft.js';
import { createMinimap } from './ui/minimap.js';
import { createCyclists } from './npc/cyclists.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createCutscene } from './camera/cutscene.js';
import { addEmergencyKit } from './vehicles/emergency.js';
import { hideProp } from './town/townKit.js';

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
world.town?.attach(physics.toggles); // town shop doors
world.vehicles = vehicles;
const headlights = createHeadlightRig(scene);
const audio = createCarAudio();

const camName = (params.get('cam') || 'player').replace(/-dusk$/, '');
const preset = cameraPreset(camName, world, spawn);
camera.position.copy(preset.position);
camera.lookAt(preset.target);
if ((params.get('cam') || '').endsWith('-dusk')) lighting.setDusk(1);

const mirrors = createMirrors();
const controls = createControls({
  camera, dom: renderer.domElement, physics, scene, world, spawn, lighting, vehicles, audio, mirrors,
  startMode: camName === 'player' ? 'walk' : 'fly',
});
if (params.has('shot')) controls.panel.hide();
// Order matters: controls set this step's car input, then every car steps.
physics.onStep((h) => { controls.fixedUpdate(h); vehicles.fixedUpdate(h); });
for (const t of world.hero?.targets || []) controls.interact.register(t); // E: front door, garage
for (const t of world.town?.targets || []) controls.interact.register(t); // E: shop doors, Quick Stop counter
const debugDraw = createDebugDraw(scene, physics, world.terrain);
const peds = createPedestrians({ scene, physics, world });
const traffic = createTraffic({ scene, physics, world, vehicles, audio });
const cyclists = createCyclists({ scene, traffic, terrain: world.terrain });
/** Everything with wheels that pedestrians should watch out for. */
const movingCars = () => [...vehicles.cars.filter((c) => !c.impounded).map((c) => { const f = c.body.forward(), p = c.position; return { x: p.x, z: p.z, fx: f.x, fz: f.z, speed: c.body.state.speed, len: c.cfg.L, w: c.cfg.W, player: c === vehicles.active }; }), ...traffic.movers(), ...(world.police ? world.police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, fx: c.fwd.x, fz: c.fwd.z, speed: c.v, len: c.cfg.L, w: c.cfg.W })) : [])];

// --- Damage, destruction, cash -------------------------------------------------------------
const particles = createParticles(scene);
const breakables = createBreakables({ physics });
const SL = world.streetLights;
breakables.addSet({ name: 'streetLight', meshes: [{ mesh: SL.meshes.poles, mode: 'follow' }, { mesh: SL.meshes.heads, mode: 'hide' }, { mesh: SL.meshes.pools, mode: 'hide' }], items: SL.poles, r: 0.12, h: 6.2, toughness: 8, carDamage: 20, sparks: true });
const props = buildStreetProps(world);
scene.add(props.group);
for (const d of props.defs) breakables.addSet(d);
for (const d of world.town?.breakables || []) breakables.addSet(d);
const wallet = createWallet();
const statusHud = createStatusHud();
const spawns = createSpawnPoints(world);
if (world.town) { spawns.setPolice(world.town.spawns.police); spawns.setHospital(world.town.spawns.hospital); }
world.spawns = spawns;
const cutscene = createCutscene({ camera, input: controls.input, canvas: renderer.domElement });
const combat = createCombat({ controls, vehicles, traffic, peds, breakables, particles, audio, wallet, hud: statusHud, spawns, world, cutscene });
peds.onHit((e) => combat.emit('pedHit', e));
cyclists.onHit((e) => combat.emit('pedHit', e));
// Quick Stop: E at the counter buys a snack ($20, +25 health).
if (world.town) world.town.hooks.buySnack = () => {
  if (wallet.cash < 20) { statusHud.message('Not enough cash', 2, '#ff8a7a'); return; }
  wallet.add(-20);
  combat.setHp(Math.min(100, combat.hp + 25));
  statusHud.message('Snack  +25 health  -$20', 2.5, '#9fd18b');
  audio.ding?.(880);
};

// --- Wanted level, police, theft ------------------------------------------------------------
const wanted = createWanted(statusHud);
world.wanted = wanted;
const police = createPolice({ scene, physics, world, traffic, vehicles, controls, audio, wanted, hud: statusHud, wallet, spawns, camera, cutscene });
world.police = police;
// Knocked out: wanted level and every cop reset too.
combat.on('respawn', () => { wanted.clear(true); police.reset(); });
const theft = createTheft({ scene, controls, vehicles, traffic, peds, police, wanted, physics, combat, world });

// --- Minimap (Tab) ---------------------------------------------------------------------------
const heroLot = world.layout.hero;
world.places = [{ kind: 'home', x: heroLot.x, z: heroLot.z, label: '62 Grand Terrace' }, ...(world.town?.places || [])];
const minimap = createMinimap(world);

// --- Stealable parked props (town car park, petrol pumps, police bay, ambulance) -------------
for (const p of world.town?.propCars || []) controls.registerProp(p);
controls.hooks.onPropSteal = (p) => {
  const car = vehicles.spawn({ type: p.type, cfg: p.cfg, paint: p.color, x: p.x, z: p.z, yaw: p.yaw });
  if (!car) return null;
  hideProp(p);
  physics.toggles[p.id]?.setEnabled(false);
  if (p.kind === 'police' || p.kind === 'ambulance') addEmergencyKit(car, p.kind);
  car.fromProp = p.id;
  return car;
};

const viewmodel = createViewmodel();
renderer.info.autoReset = false; // main pass + viewmodel pass both count (mirrors render before the reset)
const overlay = createOverlay(renderer, { visible: params.has('hud') });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__gta = {
  ready: false, stats: () => overlay.stats(), world, scene, renderer, camera, controls, physics, RAPIER, vehicles, lighting, peds, traffic, mirrors, combat, breakables, wallet, particles, spawns, wanted, police, theft, minimap, cyclists, viewmodel, cutscene,
  debug: createDebugApi({ world, vehicles, controls, camera, lighting }),
};
const timer = new THREE.Timer();
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const rdt = Math.min(timer.getDelta(), 0.1);
  const dt = rdt * cutscene.timeScale; // slow motion during the KO cutscene
  vehicles.setFocus(controls.focus());
  physics.step(dt);
  vehicles.sync();
  controls.update(dt);
  cutscene.update(rdt);
  traffic.update(dt, { player: controls.mode === 'walk' ? controls.player.position : null, night: lighting.dusk > 0.5, extra: [...police.movers(), ...cyclists.movers()] });
  { const ac = controls.mode === 'drive' ? controls.car : null; world.playerSiren = !!ac?.emergency?.on; for (const c of vehicles.cars) c.emergency?.update(dt); }
  police.update(dt);
  theft.update(dt, world.terrain);
  { const f = controls.focus(); minimap.update(dt, { player: f, heading: controls.mode === 'drive' && controls.car ? controls.car.body.yaw() : controls.player.state.facing, police: police.cars.map((c) => c.pos), stars: wanted.stars, lastSeen: police.st.lastSeen }); }
  audio.setListener(controls.focus());
  world.heroState = world.hero?.update(dt, { player: controls.focus(), night: lighting.dusk });
  world.town?.update(dt, { focus: controls.focus() });
  combat.update(dt);
  breakables.update(dt, controls.focus());
  particles.update(dt);
  statusHud.update(dt, { health: combat.hp, carHealth: controls.mode === 'drive' && controls.car ? controls.car.health : null, cash: wallet.cash, stars: world.wanted?.stars || 0, searching: world.wanted?.searching || false });
  { const mc = movingCars(); peds.update(dt, { focus: controls.focus(), player: controls.mode === 'walk' ? controls.player.position : null, cars: mc }); cyclists.update(dt, { focus: controls.focus(), cars: mc }); }
  const lit = controls.car && controls.car.lights ? controls.car : vehicles.cars.find((c) => c.lights) || null;
  headlights.update(dt, lit, lighting.dusk);
  lighting.update(dt, preset.noFog && controls.mode === 'fly' ? preset.target : controls.focus(), camera.position);
  if (preset.noFog && controls.mode === 'fly') scene.fog.far = 1e5;
  if (controls.cameraMode === 'cabin') mirrors.update(renderer, scene, controls.car, dt); else mirrors.resetGuard();
  debugDraw.update(controls.focus());
  if (cutscene.active) { controls.player.character.mesh.visible = true; controls.player.character.setHeadVisible(true); }
  viewmodel.update({ active: !cutscene.active && controls.mode === 'walk' && controls.cameraMode === 'first', dt, speed: controls.player.state.speed, look: controls.player.state.lastLook || { x: 0, y: 0 }, aim: false, dusk: lighting.dusk, aspect: camera.aspect });
  renderer.info.reset();
  renderer.render(scene, camera);
  viewmodel.render(renderer);
  overlay.update(dt, controls.debugText());
  if (++frames > 3) window.__gta.ready = true;
});
