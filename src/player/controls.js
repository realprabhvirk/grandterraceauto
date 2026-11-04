// Mode manager: walk (default) <-> drive <-> debug fly, with smooth enter/exit car
// transitions. Owns input, the interaction prompt, the driving HUD, audio hooks and the
// controls panel. Keys: F interact / get in-out, F2 debug fly, N day/night, ? or H help.
import * as THREE from 'three';
import { createInput } from './input.js';
import { createThirdPerson, RADIUS, HALF } from './thirdPerson.js';
import { HIP_HEIGHT } from './character.js';
import { createFlyCam } from './flyCam.js';
import { cameraPreset, PRESET_NAMES } from './presets.js';
import { createInteractions } from './interact.js';
import { createPrompt } from '../ui/prompt.js';
import { createHud } from '../ui/hud.js';
import { createControlsPanel } from '../ui/controlsPanel.js';
import { createSettingsPanel } from '../ui/settingsPanel.js';
import { createChaseCamera } from '../vehicles/chaseCamera.js';
import { findExitSpot, carLocalToWorld } from '../vehicles/exitSpot.js';

const ENTER_T = 1.0, EXIT_T = 0.8, MAX_EXIT_SPEED = 30 / 3.6;
const ease = (t) => t * t * (3 - 2 * t);

export function createControls({ camera, dom, physics, scene, world, spawn, lighting, vehicles, audio, startMode = 'walk' }) {
  const input = createInput(dom);
  const player = createThirdPerson({ physics, scene, spawn });
  const fly = createFlyCam(camera);
  const chase = createChaseCamera(camera, physics);
  const prompt = createPrompt();
  const interact = createInteractions(prompt);
  const hud = createHud();
  const panel = createControlsPanel();
  const settings = createSettingsPanel(audio);
  const ch = player.character;

  let mode = startMode;            // 'walk' | 'drive' | 'fly' | 'enter' | 'exit'
  let flyReturn = 'walk';
  let car = null;                  // car being entered / driven / left
  let trans = null;                // transition state
  let message = null, messageT = 0;
  if (mode === 'fly') fly.syncFromCamera();
  panel.setPage(mode === 'fly' ? 'fly' : 'walk');

  // Every car offers "Press F to drive" at its driver's door.
  for (const c of vehicles.cars) {
    interact.register({
      id: `car-${c.type}`,
      range: c.cfg.L / 2 + 0.9,
      label: c.hero ? 'Press F to drive the hero car' : `Press F to drive the ${c.cfg.label.toLowerCase()}`,
      position: () => carLocalToWorld(c, -(c.cfg.W / 2), 0, c.cfg.seat[2]),
      enabled: () => mode === 'walk' && !player.state.action,
      action: () => beginEnter(c),
    });
  }

  const camFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const camTo = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function captureCamera() {
    camFrom.pos.copy(camera.position);
    camera.getWorldDirection(tmp);
    camFrom.target.copy(camera.position).addScaledVector(tmp, 6);
  }

  function beginEnter(c) {
    car = c;
    captureCamera();
    player.setEnabled(false);
    const door = carLocalToWorld(c, -(c.cfg.W / 2 + 0.55), 0, c.cfg.seat[2]);
    trans = { t: 0, from: player.position.clone(), fromYaw: player.state.facing, door, yawIn: c.body.yaw() + Math.PI / 2 };
    chase.reset(c);
    mode = 'enter';
    panel.setPage('drive');
  }

  function seatCharacter(c) {
    c.model.add(ch.root);
    const [sx, sy, sz] = c.cfg.seat;
    ch.root.position.set(sx, sy - HIP_HEIGHT, sz);
    ch.root.rotation.set(0, 0, 0);
  }

  function beginExit() {
    if (Math.abs(car.body.state.speed) > MAX_EXIT_SPEED) { flash('Slow down to get out'); return; }
    const spot = findExitSpot(physics, car, world.terrain, { radius: RADIUS, half: HALF });
    captureCamera();
    // Move the (still disabled) walker body to the landing spot now, while the character mesh
    // is still parented to the car, so the walk camera blend aims at the right place.
    player.teleport(spot.position, car.body.yaw());
    // Detach the seated character into world space where it sits right now.
    ch.root.getWorldPosition(tmp);
    const startYaw = car.body.yaw();
    scene.add(ch.root);
    ch.root.position.copy(tmp);
    ch.root.rotation.set(0, startYaw, 0);
    const door = carLocalToWorld(car, -(car.cfg.W / 2 + 0.55), 0, car.cfg.seat[2]);
    const outYaw = Math.atan2(spot.position.x - door.x, spot.position.z - door.z) || startYaw;
    trans = { t: 0, from: tmp.clone(), door, spot: spot.position, startYaw, outYaw };
    car.driver = null;
    vehicles.setActive(null);   // parked: brakes to a stop on its own
    car.setLights(car.lights && lighting.dusk > 0.5); // leave lights on at night only
    audio.horn(false);
    mode = 'exit';
    panel.setPage('walk');
  }

  function flash(text) { message = text; messageT = 1.6; prompt.show('!', text); }

  function driveInput() {
    return {
      throttle: input.down('KeyW') || input.down('ArrowUp') ? 1 : 0,
      reverse: input.down('KeyS') || input.down('ArrowDown') ? 1 : 0,
      steer: (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0),
      handbrake: input.down('Space'),
      boost: input.down('ShiftLeft') || input.down('ShiftRight'),
    };
  }

  return {
    get mode() { return mode; },
    get car() { return car; },
    player, input, chase, panel, hud, interact, settings,
    hint: panel.el,
    syncFly() { fly.syncFromCamera(); },

    fixedUpdate(dt) {
      player.fixedUpdate(dt, input, mode === 'walk');
      if (mode === 'drive') vehicles.setInput(driveInput());
    },

    update(dt) {
      // ---- global keys ----
      if (input.pressed('F2')) {
        if (mode === 'fly') { mode = flyReturn; panel.setPage(mode === 'drive' ? 'drive' : 'walk'); if (mode === 'drive') vehicles.setActive(car); }
        else if (mode === 'walk' || mode === 'drive') {
          flyReturn = mode; mode = 'fly'; fly.syncFromCamera(); panel.setPage('fly');
          if (flyReturn === 'drive') vehicles.setActive(null);
        }
      }
      if (input.pressed('KeyN') || input.pressed('KeyT')) {
        lighting.toggleDusk();
        const night = lighting.target > 0.5;
        if (car && (mode === 'drive' || mode === 'enter')) car.setLights(night);
      }
      if (input.pressed('Help') || (mode === 'walk' && input.pressed('KeyH'))) panel.toggle();
      if (input.pressed('KeyM')) { flash(audio.toggleMute() ? 'Sound off' : 'Sound on'); settings.syncMute(); }
      if (input.pressed('Escape')) settings.toggle();

      // ---- modes ----
      if (mode === 'walk') {
        player.update(dt, input, camera, true);
        const target = interact.update(player.position, true);
        if (input.pressed('KeyF') && target) interact.fire();
      } else if (mode === 'drive') {
        interact.update(player.position, false);
        if (input.pressed('KeyL')) car.setLights(!car.lights);
        if (input.pressed('KeyR')) car.body.resetUpright(world.terrain.getHeight(car.position.x, car.position.z));
        chase.update(dt, car, input);
        player.update(dt, input, camera, false, { steer: car.body.steer / car.cfg.steer });
        if (input.pressed('KeyF')) beginExit();
      } else if (mode === 'fly') {
        PRESET_NAMES.forEach((name, i) => {
          if (input.pressed(`Digit${i + 1}`)) {
            const p = cameraPreset(name, world, spawn);
            camera.position.copy(p.position);
            camera.lookAt(p.target);
            fly.syncFromCamera();
          }
        });
        fly.update(dt, input);
        player.update(dt, input, camera, false, car && flyReturn === 'drive' ? { steer: 0 } : null);
      } else if (mode === 'enter') {
        trans.t += dt / ENTER_T;
        const t = Math.min(1, trans.t);
        if (t < 0.55) {
          // Walk to the driver's door.
          const k = ease(t / 0.55);
          ch.root.position.lerpVectors(trans.from, trans.door, k);
          ch.root.position.y = world.terrain.getHeight(ch.root.position.x, ch.root.position.z);
          const yaw = Math.atan2(trans.door.x - trans.from.x, trans.door.z - trans.from.z);
          ch.root.rotation.y = Number.isFinite(yaw) && trans.from.distanceTo(trans.door) > 0.2 ? yaw : trans.yawIn;
          ch.animate({ dt, speed: 3.2 * (1 - k * 0.5), grounded: true, crouch: false, action: null, steer: 0 });
        } else {
          // Hop in: slide into the seat while turning to face forward.
          if (ch.root.parent === scene) {
            trans.seatFrom = ch.root.position.clone();
            trans.yawFrom = ch.root.rotation.y;
          }
          const k = ease((t - 0.55) / 0.45);
          const [sx, sy, sz] = car.cfg.seat;
          const seatW = carLocalToWorld(car, sx, sy - HIP_HEIGHT + car.model.position.y, sz);
          ch.root.position.lerpVectors(trans.seatFrom, seatW, k);
          ch.root.position.y += Math.sin(k * Math.PI) * 0.25;
          ch.root.rotation.y = trans.yawFrom + Math.atan2(Math.sin(car.body.yaw() - trans.yawFrom), Math.cos(car.body.yaw() - trans.yawFrom)) * k;
          ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: k > 0.4 ? 'seated' : null, steer: 0 });
        }
        // Camera: blend from where it was to the chase pose.
        chase.update(dt, car, input, false);
        chase.pose(car, camTo.pos, camTo.target);
        const k = ease(t);
        camera.position.lerpVectors(camFrom.pos, camTo.pos, k);
        look.lerpVectors(camFrom.target, camTo.target, k);
        camera.lookAt(look);
        if (t >= 1) {
          seatCharacter(car);
          car.driver = player;
          chase.seed(camera.position);
          vehicles.setActive(car);
          if (lighting.dusk > 0.5) car.setLights(true);
          mode = 'drive';
        }
      } else if (mode === 'exit') {
        trans.t += dt / EXIT_T;
        const t = Math.min(1, trans.t);
        if (t < 0.45) {
          const k = ease(t / 0.45);
          ch.root.position.lerpVectors(trans.from, trans.door, k);
          ch.root.position.y = trans.from.y + (world.terrain.getHeight(trans.door.x, trans.door.z) - trans.from.y) * k + Math.sin(k * Math.PI) * 0.2;
          ch.root.rotation.y = trans.startYaw - Math.PI / 2 * k;
          ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: k < 0.5 ? 'seated' : null, steer: 0 });
        } else {
          const k = ease((t - 0.45) / 0.55);
          ch.root.position.lerpVectors(trans.door, trans.spot, k);
          ch.root.position.y = world.terrain.getHeight(ch.root.position.x, ch.root.position.z);
          ch.root.rotation.y = trans.outYaw;
          ch.animate({ dt, speed: 2.5, grounded: true, crouch: false, action: null, steer: 0 });
        }
        // Camera: chase -> walk camera behind the player's landing spot.
        player.state.yaw = trans.startYaw;
        player.cameraPose(camTo.pos, camTo.target);
        const k = ease(t);
        camera.position.lerpVectors(camFrom.pos, camTo.pos, k);
        look.lerpVectors(camFrom.target, camTo.target, k);
        camera.lookAt(look);
        if (t >= 1) {
          player.teleport(trans.spot, trans.outYaw);
          player.state.yaw = trans.startYaw;
          player.setEnabled(true);
          chase.restoreFov();
          car = null;
          mode = 'walk';
        }
      }

      // ---- HUD, audio ----
      const driving = mode === 'drive' ? car : null;
      hud.setVisible(!!driving);
      if (driving) hud.update(driving);
      const st = driving ? driving.body.state : null;
      audio.engine(!!driving, st ? st.speed : 0, st ? st.throttle : 0, driving ? driving.cfg.top : 1);
      audio.horn(!!driving && input.down('KeyH'));
      audio.screech(driving ? Math.max(st.slip * Math.min(1, Math.abs(st.speed) / 8), st.handbrake && Math.abs(st.speed) > 4 ? 0.7 : 0) : 0);
      for (const c of vehicles.cars) if (c.body.impact > 0) { if (c === car || c.position && player.position.distanceTo(tmp.set(c.position.x, c.position.y, c.position.z)) < 30) audio.thud(c.body.impact); }
      if (messageT > 0) { messageT -= dt; if (messageT <= 0) { message = null; prompt.hide(); } }
      panel.update(dt);
      input.endFrame();
    },

    /** Where the shadow camera should centre. */
    focus() {
      if (mode === 'fly') return camera.position;
      if (car && mode !== 'walk') { const p = car.position; return tmp.set(p.x, p.y, p.z); }
      return player.position;
    },
    debugText() {
      const p = this.focus();
      const extra = car && mode === 'drive' ? `\ncar ${car.cfg.label} ${(car.body.state.speed * 3.6).toFixed(0)} km/h` : '';
      return `mode ${mode}\npos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}${extra}`;
    },
    /** Test helper: enter a car immediately (no walk-up). */
    debugEnter(c) { beginEnter(c); trans.t = 0.999; },
    debugExit() { if (car && mode === 'drive') beginExit(); },
  };
}
