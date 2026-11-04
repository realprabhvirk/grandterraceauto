// Setup check only. The real game entry gets written once the build plan is approved.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();
const app = document.getElementById('app');
app.innerHTML = `<div style="padding:24px;line-height:1.6">
  <h2 style="margin:0 0 8px">Grand Terrace Auto: toolchain OK</h2>
  <div>three.js r${THREE.REVISION}</div>
  <div>Rapier ${RAPIER.version()}</div>
</div>`;
