// Hello-world check: spinning cube + directional light + Rapier init.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();
console.log(`[gta] Rapier ${RAPIER.version()} WASM initialised, three r${THREE.REVISION}`);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9c9a3');
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.5, 2, 3.5);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#bcd3e6', '#6d5a44', 1.0));
const sun = new THREE.DirectionalLight('#ffd8a8', 2.5);
sun.position.set(3, 5, 2);
scene.add(sun);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial({ color: '#c98b6b', flatShading: true }),
);
scene.add(cube);

window.__gta = { ready: false };
renderer.setAnimationLoop((t) => {
  cube.rotation.set(t * 0.0005, t * 0.0008, 0);
  renderer.render(scene, camera);
  window.__gta.ready = true;
});
