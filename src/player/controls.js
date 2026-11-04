// Player/camera mode manager: third-person walk (default) <-> free-fly debug (C).
// Number keys 1-5 jump the debug camera to the named presets.
import { createInput } from './input.js';
import { createThirdPerson } from './thirdPerson.js';
import { createFlyCam } from './flyCam.js';
import { cameraPreset, PRESET_NAMES } from './presets.js';

export function createControls({ camera, dom, physics, scene, world, spawn, lighting, startMode = 'walk' }) {
  const input = createInput(dom);
  const player = createThirdPerson({ physics, scene, spawn });
  const fly = createFlyCam(camera);
  let mode = startMode;
  if (mode === 'fly') fly.syncFromCamera();

  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:10;font:12px/1.5 system-ui,sans-serif;color:#f6eedf;background:rgba(36,30,26,.62);padding:8px 11px;border-radius:6px;pointer-events:none;transition:opacity .6s';
  const setHint = () => {
    hint.innerHTML = mode === 'walk'
      ? '<b>Walk</b> &nbsp;WASD move · Shift run · Space jump · mouse look (click to capture) · wheel zoom<br>C debug fly cam · T dusk/afternoon · F3 stats'
      : '<b>Debug fly</b> &nbsp;WASD · Space/E up · Ctrl/Q down · Shift fast · 1-5 presets<br>C back to walking · T dusk/afternoon · F3 stats';
  };
  setHint();
  document.body.appendChild(hint);
  let hintTimer = 0;

  return {
    get mode() { return mode; },
    player,
    hint,
    fixedUpdate(dt) { player.fixedUpdate(dt, input, mode === 'walk'); },
    update(dt) {
      if (input.pressed('KeyC')) {
        mode = mode === 'walk' ? 'fly' : 'walk';
        if (mode === 'fly') fly.syncFromCamera();
        setHint();
        hint.style.opacity = '1';
        hintTimer = 0;
      }
      if (input.pressed('KeyT')) lighting.toggleDusk();
      if (mode === 'fly') {
        PRESET_NAMES.forEach((name, i) => {
          if (input.pressed(`Digit${i + 1}`)) {
            const p = cameraPreset(name, world, spawn);
            camera.position.copy(p.position);
            camera.lookAt(p.target);
            fly.syncFromCamera();
          }
        });
        fly.update(dt, input);
      }
      player.update(dt, input, camera, mode === 'walk');
      hintTimer += dt;
      if (hintTimer > 12) hint.style.opacity = '0.35';
      input.endFrame();
    },
    /** Where the shadow camera should centre. */
    focus() { return mode === 'walk' ? player.position : camera.position; },
    debugText() {
      const p = mode === 'walk' ? player.position : camera.position;
      return `mode ${mode}\npos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`;
    },
  };
}
