// Lighting rig: one warm directional sun (the ONLY shadow caster, 2048 map, ortho
// shadow camera that follows the player and snaps to texels), a hemisphere fill,
// light distance fog and a vertex-coloured sky dome. setDusk() blends to dusk.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { setGlow } from '../art/materials.js';

const SHADOW_SIZE = 2048;
const SHADOW_EXTENT = 42; // metres either side of the focus point

const C = (hex) => new THREE.Color(hex);

const PRESETS = {
  afternoon: {
    sun: C(PALETTE.light.sun), sunI: 3.7, elev: 24, azim: 250,
    hemiSky: C(PALETTE.light.hemiSky), hemiGround: C(PALETTE.light.hemiGround), hemiI: 1.95,
    fog: C(PALETTE.fog), fogNear: 130, fogFar: 700,
    zenith: C(PALETTE.sky.zenith), mid: C(PALETTE.sky.mid), horizon: C(PALETTE.sky.horizon),
    exposure: 1.0,
  },
  dusk: {
    sun: C(PALETTE.light.sunDusk), sunI: 1.5, elev: 5, azim: 262,
    hemiSky: C(PALETTE.light.hemiSkyDusk), hemiGround: C(PALETTE.light.hemiGroundDusk), hemiI: 1.25,
    fog: C(PALETTE.fogDusk), fogNear: 90, fogFar: 520,
    zenith: C(PALETTE.sky.duskZenith), mid: C(PALETTE.sky.duskMid), horizon: C(PALETTE.sky.duskHorizon),
    exposure: 1.0,
  },
};

export function createLighting(scene, renderer) {
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
  const sc = sun.shadow.camera;
  sc.left = -SHADOW_EXTENT; sc.right = SHADOW_EXTENT;
  sc.top = SHADOW_EXTENT; sc.bottom = -SHADOW_EXTENT;
  sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3; // wider PCF kernel: soft edges instead of stair-steps
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0xffffff, 100, 500);

  // Sky dome: big inverted sphere, colours set per vertex from elevation.
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  const cur = {
    sun: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), fog: new THREE.Color(),
    zenith: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(),
  };
  const sunDir = new THREE.Vector3();
  let dusk = 0, target = 0;

  function apply(f) {
    const a = PRESETS.afternoon, b = PRESETS.dusk;
    const L = (k) => cur[k].copy(a[k]).lerp(b[k], f);
    const n = (k) => a[k] + (b[k] - a[k]) * f;
    sun.color.copy(L('sun'));
    sun.intensity = n('sunI');
    hemi.color.copy(L('hemiSky'));
    hemi.groundColor.copy(L('hemiGround'));
    hemi.intensity = n('hemiI');
    scene.fog.color.copy(L('fog'));
    scene.fog.near = n('fogNear');
    scene.fog.far = n('fogFar');
    renderer.toneMappingExposure = n('exposure');
    const el = THREE.MathUtils.degToRad(n('elev')), az = THREE.MathUtils.degToRad(n('azim'));
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    // Sky gradient: horizon -> mid -> zenith, a little warm glow toward the sun.
    L('zenith'); L('mid'); L('horizon');
    const p = skyGeo.attributes.position, colA = skyGeo.attributes.color;
    const tmp = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const y = v.y;
      if (y < 0) tmp.copy(cur.horizon).lerp(scene.fog.color, Math.min(1, -y * 4));
      else if (y < 0.25) tmp.copy(cur.horizon).lerp(cur.mid, y / 0.25);
      else tmp.copy(cur.mid).lerp(cur.zenith, Math.min(1, (y - 0.25) / 0.6));
      const toward = Math.max(0, v.dot(sunDir));
      tmp.lerp(cur.horizon, toward ** 6 * 0.5);
      colA.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colA.needsUpdate = true;
    setGlow(f);
  }
  apply(0);

  const snap = new THREE.Vector3();
  return {
    sun, hemi, sky,
    get dusk() { return dusk; },
    get target() { return target; },
    toggleDusk() { target = target > 0.5 ? 0 : 1; },
    setDusk(f) { dusk = target = f; apply(f); },
    /** Follow the focus point (player or debug camera) and ease time of day. */
    update(dt, focus, cameraPos) {
      if (Math.abs(target - dusk) > 1e-3) {
        dusk += Math.sign(target - dusk) * Math.min(Math.abs(target - dusk), dt * 0.5);
        apply(dusk);
      }
      // Snap the shadow camera to whole texels to stop shadow edges shimmering.
      const texel = (SHADOW_EXTENT * 2) / SHADOW_SIZE;
      snap.copy(focus);
      snap.x = Math.round(snap.x / texel) * texel;
      snap.z = Math.round(snap.z / texel) * texel;
      sun.target.position.copy(snap);
      sun.position.copy(snap).addScaledVector(sunDir, 200);
      sun.target.updateMatrixWorld();
      sky.position.copy(cameraPos);
    },
  };
}
