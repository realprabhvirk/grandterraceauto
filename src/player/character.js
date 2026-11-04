// Stylised low-poly character (player AND pedestrians) as ONE SkinnedMesh per person:
// each body part is rigidly bound to one bone, so a whole character is a single draw call.
// Root sits at the feet, +Z forward. Bones: hips -> torso -> head, shoulders -> elbows,
// hip joints -> knees. Each frame a target pose is computed for the current state and the
// live pose eases toward it, so every transition (walk -> emote -> sit) is smooth.
// Geometry is cached per outfit, so pedestrians with the same outfit share it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, icosa, paint, merge } from '../utils/geom.js';

export const HIP_HEIGHT = 0.92;

/** Default outfit = the player. Pedestrians pass their own (see npc/outfits.js). */
export const PLAYER_OUTFIT = { ...PALETTE.player, hairStyle: 'short' };

/** Tapered box (frustum) from bottom w0 x d0 to top w1 x d1, height h, bottom at y0. */
function taper(w0, d0, w1, d1, h, y0, color, z = 0) {
  const g = new THREE.CylinderGeometry(1, 1, h, 4, 1);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    const sx = (top ? w1 : w0) / Math.SQRT2, sz = (top ? d1 : d0) / Math.SQRT2;
    p.setXYZ(i, p.getX(i) * sx, p.getY(i) + h / 2 + y0, p.getZ(i) * sz + z);
  }
  g.computeVertexNormals();
  return paint(g, color, 0.04, Math.round((w0 + h) * 1000));
}

// Bone layout: [name, parent, rest offset from parent].
const BONES = [
  ['hips', null, [0, HIP_HEIGHT, 0]],
  ['torso', 'hips', [0, 0.1, 0]],
  ['head', 'torso', [0, 0.57, 0.01]],
  ['lShoulder', 'torso', [0.235, 0.47, 0]], ['lElbow', 'lShoulder', [0, -0.29, 0]],
  ['rShoulder', 'torso', [-0.235, 0.47, 0]], ['rElbow', 'rShoulder', [0, -0.29, 0]],
  ['lHip', 'hips', [0.095, -0.08, 0]], ['lKnee', 'lHip', [0, -0.42, 0]],
  ['rHip', 'hips', [-0.095, -0.08, 0]], ['rKnee', 'rHip', [0, -0.42, 0]],
];
const BONE_INDEX = Object.fromEntries(BONES.map(([n], i) => [n, i]));
function bindPosition(name) {
  const out = [0, 0, 0];
  for (let n = name; n;) {
    const [, parent, off] = BONES[BONE_INDEX[n]];
    out[0] += off[0]; out[1] += off[1]; out[2] += off[2];
    n = parent;
  }
  return out;
}

function hairParts(O) {
  const H = O.hair;
  switch (O.hairStyle) {
    case 'long': return [
      icosa(0.15, 1, 0, 0.19, -0.02, H, { sx: 0.97, sy: 0.72, sz: 1.02, jitter: 0.06 }),
      box(0.27, 0.3, 0.1, 0, 0.02, -0.11, H),
    ];
    case 'bun': return [
      icosa(0.148, 1, 0, 0.19, -0.02, H, { sx: 0.95, sy: 0.7, sz: 1.0, jitter: 0.06 }),
      icosa(0.07, 0, 0, 0.3, -0.1, H, { jitter: 0.05 }),
    ];
    case 'cap': return [
      icosa(0.15, 1, 0, 0.2, -0.01, O.cap, { sx: 0.98, sy: 0.6, sz: 1.0, jitter: 0.04 }),
      box(0.22, 0.025, 0.14, 0, 0.215, 0.13, O.cap),
    ];
    case 'bald': return [];
    default: return [icosa(0.148, 1, 0, 0.19, -0.02, H, { sx: 0.95, sy: 0.7, sz: 1.0, jitter: 0.06 })];
  }
}

/** Parts per bone, in that bone's local space. */
function bodyParts(O) {
  const P = {};
  P.hips = [taper(0.3, 0.2, 0.34, 0.22, 0.2, -0.12, O.shorts), box(0.35, 0.05, 0.23, 0, 0.08, 0, O.belt)];
  P.torso = [
    taper(0.33, 0.21, 0.44, 0.25, 0.46, 0, O.shirt),
    taper(0.3, 0.2, 0.16, 0.14, 0.08, 0.46, O.shirt),
    box(0.12, 0.08, 0.02, 0, 0.36, 0.127, O.shirtTrim),
    box(0.1, 0.08, 0.1, 0, 0.53, 0, O.skin),
  ];
  P.head = [
    icosa(0.14, 1, 0, 0.13, 0, O.skin, { sx: 0.92, sy: 1.08, sz: 0.98, jitter: 0.03 }),
    ...hairParts(O),
    box(0.05, 0.05, 0.05, 0, 0.12, 0.135, O.skinShade),
    box(0.035, 0.03, 0.02, -0.05, 0.16, 0.122, O.eyes),
    box(0.035, 0.03, 0.02, 0.05, 0.16, 0.122, O.eyes),
    box(0.04, 0.06, 0.04, -0.13, 0.13, 0, O.skin),
    box(0.04, 0.06, 0.04, 0.13, 0.13, 0, O.skin),
  ];
  for (const s of ['l', 'r']) {
    P[`${s}Shoulder`] = [taper(0.1, 0.1, 0.13, 0.12, 0.17, -0.17, O.shirt), taper(0.075, 0.075, 0.09, 0.09, 0.14, -0.29, O.skin)];
    P[`${s}Elbow`] = [taper(0.065, 0.065, 0.08, 0.08, 0.24, -0.24, O.skin), box(0.075, 0.1, 0.05, 0, -0.29, 0.005, O.skin)];
    P[`${s}Hip`] = [taper(0.13, 0.14, 0.16, 0.17, 0.24, -0.24, O.shorts), taper(0.11, 0.12, 0.13, 0.13, 0.2, -0.42, O.legs || O.skin)];
    P[`${s}Knee`] = [
      taper(0.085, 0.09, 0.11, 0.115, 0.36, -0.36, O.legs || O.skin),
      box(0.1, 0.05, 0.08, 0, -0.33, 0, O.socks),
      box(0.115, 0.08, 0.27, 0, -0.38, 0.055, O.shoes),
      box(0.118, 0.025, 0.275, 0, -0.415, 0.055, O.soles),
    ];
  }
  return P;
}

const geoCache = new Map();
/** One skinned geometry for an outfit (bind pose = rest pose, each vertex on one bone). */
function bodyGeometry(O) {
  const key = JSON.stringify(O);
  if (geoCache.has(key)) return geoCache.get(key);
  const parts = bodyParts(O);
  const list = [];
  for (const [name] of BONES) {
    const g = merge(parts[name]);
    const [x, y, z] = bindPosition(name);
    g.translate(x, y, z);
    const n = g.attributes.position.count, bi = BONE_INDEX[name];
    const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { idx[i * 4] = bi; wt[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    list.push(g);
  }
  const geo = mergeGeometries(list);
  list.forEach((g) => g.dispose());
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += 0.6; // room for poses
  geoCache.set(key, geo);
  return geo;
}

/**
 * @param outfit colours + hairStyle (defaults to the player)
 * @param opts   { shadow = true, name }
 */
export function createCharacter(outfit = PLAYER_OUTFIT, { shadow = true, name = 'player' } = {}) {
  const root = new THREE.Group();
  root.name = name;
  const bones = BONES.map(([n, , off]) => { const b = new THREE.Bone(); b.name = n; b.position.set(...off); return b; });
  BONES.forEach(([, parent], i) => { if (parent) bones[BONE_INDEX[parent]].add(bones[i]); });
  const mesh = new THREE.SkinnedMesh(bodyGeometry({ ...PLAYER_OUTFIT, ...outfit }), MAT.solid);
  mesh.add(bones[0]);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  const B = Object.fromEntries(BONES.map(([n], i) => [n, bones[i]]));
  const hips = B.hips, torso = B.torso, head = B.head;
  const L = { shoulder: B.lShoulder, elbow: B.lElbow, hip: B.lHip, knee: B.lKnee };
  const R = { shoulder: B.rShoulder, elbow: B.rElbow, hip: B.rHip, knee: B.rKnee };

  // Pose = plain object of joint angles; `cur` eases toward each frame's target.
  const zero = () => ({
    rootY: 0, hipsY: 0, hipsZ: 0, torsoX: 0, torsoY: 0, torsoZ: 0, headX: 0, headY: 0, headZ: 0,
    lsx: 0, lsz: 0.08, lex: 0, rsx: 0, rsz: -0.08, rex: 0,
    lhx: 0, lhz: 0, lkx: 0, rhx: 0, rhz: 0, rkx: 0,
  });
  const cur = zero();
  let phase = 0, t = Math.random() * 10;

  function target(s) {
    const p = zero();
    const k = Math.min(1, s.speed / 4.2);
    const run = Math.max(0, Math.min(1, (s.speed - 4.5) / 3));
    t += s.dt;
    switch (s.action) {
      case 'seated': {
        p.rootY = 0; p.lhx = p.rhx = -1.45; p.lkx = p.rkx = 1.35;
        p.lsx = p.rsx = -1.05; p.lsz = 0.2; p.rsz = -0.2; p.lex = p.rex = -0.55;
        // Hands follow the wheel, head looks into the turn.
        p.lsx += s.steer * 0.25; p.rsx -= s.steer * 0.25;
        p.headY = s.steer * 0.35; p.torsoX = -0.05; p.torsoZ = s.steer * 0.04;
        return p;
      }
      case 'sit': {
        p.rootY = -0.68; p.lhx = p.rhx = -1.5; p.lhz = 0.12; p.rhz = -0.12; p.lkx = p.rkx = 0.4;
        p.torsoX = -0.12; p.lsx = p.rsx = 0.55; p.lsz = 0.35; p.rsz = -0.35; p.lex = p.rex = -0.2;
        p.headX = 0.05 * Math.sin(t * 0.8);
        return p;
      }
      case 'wave': {
        p.rsz = -2.55; p.rsx = -0.25; p.rex = -0.35 - 0.45 * (0.5 + 0.5 * Math.sin(t * 9));
        p.headZ = -0.08; p.torsoZ = 0.05; p.lsz = 0.12;
        return p;
      }
      case 'point': {
        p.rsx = -1.52; p.rsz = -0.1; p.rex = 0; p.torsoY = -0.15; p.headY = -0.1; p.headX = -0.05;
        p.lsz = 0.1;
        return p;
      }
      case 'dance': {
        const b = Math.sin(t * 8);
        p.rootY = -0.06 * Math.abs(b); p.hipsZ = 0.12 * Math.sin(t * 4); p.torsoZ = -0.1 * Math.sin(t * 4);
        p.lsz = 2.2 + 0.4 * Math.sin(t * 8); p.rsz = -2.2 + 0.4 * Math.sin(t * 8 + Math.PI);
        p.lex = p.rex = -0.9; p.headY = 0.25 * Math.sin(t * 4); p.lkx = p.rkx = 0.25 * Math.abs(b);
        p.lhx = p.rhx = -0.12 * Math.abs(b);
        return p;
      }
      case 'look': {
        // Pause and look around.
        p.headY = 0.65 * Math.sin(t * 0.9); p.headX = -0.05; p.torsoY = 0.15 * Math.sin(t * 0.9);
        p.lsz = 0.12; p.rsz = -0.12;
        return p;
      }
      case 'phone': {
        // Checking a phone: right forearm up in front of the face, head tipped down.
        p.rsx = -0.55; p.rsz = 0.25; p.rex = -2.0; p.lsx = -0.3; p.lsz = -0.15; p.lex = -1.2;
        p.headX = 0.32; p.torsoX = 0.04;
        return p;
      }
      default: break;
    }
    if (!s.grounded) {
      p.lhx = -0.55; p.rhx = -0.15; p.lkx = 0.95; p.rkx = 0.45;
      p.lsx = -0.5; p.rsx = -0.5; p.lsz = 0.5; p.rsz = -0.5; p.lex = p.rex = -0.6; p.torsoX = 0.08;
      return p;
    }
    phase += s.dt * (4.2 + s.speed * 1.35);
    const sw = Math.sin(phase);
    if (s.crouch) {
      p.rootY = -0.34; p.torsoX = 0.38; p.headX = -0.3;
      p.lhx = -0.95 + sw * 0.35 * k; p.rhx = -0.95 - sw * 0.35 * k;
      p.lkx = 1.55 + Math.max(0, sw) * 0.3 * k; p.rkx = 1.55 + Math.max(0, -sw) * 0.3 * k;
      p.lsx = -0.4 - sw * 0.3 * k; p.rsx = -0.4 + sw * 0.3 * k; p.lex = p.rex = -0.9;
      return p;
    }
    const amp = 0.55 + 0.35 * run;
    p.lhx = -sw * amp * k; p.rhx = sw * amp * k;
    p.lkx = Math.max(0, Math.sin(phase - 1.2)) * (0.75 + 0.6 * run) * k + 0.04;
    p.rkx = Math.max(0, Math.sin(phase - 1.2 + Math.PI)) * (0.75 + 0.6 * run) * k + 0.04;
    p.lsx = sw * (0.6 + 0.3 * run) * k; p.rsx = -sw * (0.6 + 0.3 * run) * k;
    p.lex = p.rex = -0.15 - 1.0 * run - 0.15 * k;
    p.torsoX = 0.05 * k + 0.16 * run; p.torsoY = -sw * 0.08 * k;
    p.rootY = -Math.abs(Math.cos(phase)) * 0.045 * k;
    // Idle breathing.
    const br = Math.sin(t * 1.7) * (1 - k);
    p.torsoX += br * 0.015; p.lsz += br * 0.02; p.rsz -= br * 0.02;
    return p;
  }

  function apply() {
    hips.position.y = HIP_HEIGHT + cur.rootY;
    hips.rotation.set(0, cur.hipsY, cur.hipsZ);
    torso.rotation.set(cur.torsoX, cur.torsoY, cur.torsoZ);
    head.rotation.set(cur.headX, cur.headY, cur.headZ);
    L.shoulder.rotation.set(cur.lsx, 0, cur.lsz); L.elbow.rotation.set(cur.lex, 0, 0);
    R.shoulder.rotation.set(cur.rsx, 0, cur.rsz); R.elbow.rotation.set(cur.rex, 0, 0);
    L.hip.rotation.set(cur.lhx, 0, cur.lhz); L.knee.rotation.set(cur.lkx, 0, 0);
    R.hip.rotation.set(cur.rhx, 0, cur.rhz); R.knee.rotation.set(cur.rkx, 0, 0);
  }
  apply();

  return {
    root,
    mesh,
    /**
     * @param s { dt, speed, grounded, crouch, action: null|'wave'|'dance'|'sit'|'point'|'look'|'phone'|'seated', steer }
     */
    animate(s) {
      const tgt = target(s);
      const a = 1 - Math.exp(-s.dt * (s.action === 'seated' ? 20 : 11));
      for (const key in cur) cur[key] += (tgt[key] - cur[key]) * a;
      apply();
    },
  };
}
