// Stylised low-poly player character with a joint hierarchy and procedural poses.
// Root sits at the feet, +Z forward. Joints: hips -> torso -> head, shoulders -> elbows,
// hip joints -> knees. Each frame a target pose is computed for the current state and
// the live pose eases toward it, so every transition (walk -> emote -> sit) is smooth.
import * as THREE from 'three';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { box, icosa, paint, merge } from '../utils/geom.js';

const C = PALETTE.player;
export const HIP_HEIGHT = 0.92;

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

function joint(parent, x, y, z) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}
function mesh(parent, geo) {
  const m = new THREE.Mesh(geo, MAT.solid);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function createCharacter() {
  const root = new THREE.Group();
  root.name = 'player';
  const hips = joint(root, 0, HIP_HEIGHT, 0);
  mesh(hips, merge([
    taper(0.3, 0.2, 0.34, 0.22, 0.2, -0.12, C.shorts),
    box(0.35, 0.05, 0.23, 0, 0.08, 0, C.belt),
  ]));
  const torso = joint(hips, 0, 0.1, 0);
  mesh(torso, merge([
    taper(0.33, 0.21, 0.44, 0.25, 0.46, 0, C.shirt),
    taper(0.3, 0.2, 0.16, 0.14, 0.08, 0.46, C.shirt),          // shoulders slope
    box(0.12, 0.08, 0.02, 0, 0.36, 0.127, C.shirtTrim),        // chest logo stripe
    box(0.1, 0.08, 0.1, 0, 0.53, 0, C.skin),                    // neck
  ]));
  const head = joint(torso, 0, 0.57, 0.01);
  mesh(head, merge([
    icosa(0.14, 1, 0, 0.13, 0, C.skin, { sx: 0.92, sy: 1.08, sz: 0.98, jitter: 0.03 }),
    icosa(0.148, 1, 0, 0.19, -0.02, C.hair, { sx: 0.95, sy: 0.7, sz: 1.0, jitter: 0.06 }),
    box(0.05, 0.05, 0.05, 0, 0.12, 0.135, C.skinShade),         // nose
    box(0.035, 0.03, 0.02, -0.05, 0.16, 0.122, C.eyes),
    box(0.035, 0.03, 0.02, 0.05, 0.16, 0.122, C.eyes),
    box(0.04, 0.06, 0.04, -0.13, 0.13, 0, C.skin),              // ears
    box(0.04, 0.06, 0.04, 0.13, 0.13, 0, C.skin),
  ]));

  const arm = (side) => {
    const shoulder = joint(torso, side * 0.235, 0.47, 0);
    mesh(shoulder, merge([
      taper(0.1, 0.1, 0.13, 0.12, 0.17, -0.17, C.shirt),        // sleeve
      taper(0.075, 0.075, 0.09, 0.09, 0.14, -0.29, C.skin),
    ]));
    const elbow = joint(shoulder, 0, -0.29, 0);
    mesh(elbow, merge([
      taper(0.065, 0.065, 0.08, 0.08, 0.24, -0.24, C.skin),
      box(0.075, 0.1, 0.05, 0, -0.29, 0.005, C.skin),            // hand
    ]));
    return { shoulder, elbow };
  };
  const leg = (side) => {
    const hip = joint(hips, side * 0.095, -0.08, 0);
    mesh(hip, merge([
      taper(0.13, 0.14, 0.16, 0.17, 0.24, -0.24, C.shorts),
      taper(0.11, 0.12, 0.13, 0.13, 0.2, -0.42, C.skin),
    ]));
    const knee = joint(hip, 0, -0.42, 0);
    mesh(knee, merge([
      taper(0.085, 0.09, 0.11, 0.115, 0.36, -0.36, C.skin),
      box(0.1, 0.05, 0.08, 0, -0.33, 0, C.socks),
      box(0.115, 0.08, 0.27, 0, -0.38, 0.055, C.shoes),
      box(0.118, 0.025, 0.275, 0, -0.415, 0.055, C.soles),
    ]));
    return { hip, knee };
  };
  const L = { ...arm(1), ...leg(1) }, R = { ...arm(-1), ...leg(-1) };

  // Pose = plain object of joint angles; `cur` eases toward each frame's target.
  const zero = () => ({
    rootY: 0, hipsY: 0, hipsZ: 0, torsoX: 0, torsoY: 0, torsoZ: 0, headX: 0, headY: 0, headZ: 0,
    lsx: 0, lsz: 0.08, lex: 0, rsx: 0, rsz: -0.08, rex: 0,
    lhx: 0, lhz: 0, lkx: 0, rhx: 0, rhz: 0, rkx: 0,
  });
  const cur = zero();
  let phase = 0, t = 0;

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
    root.children[0].position.y = HIP_HEIGHT + cur.rootY;
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
    /**
     * @param s { dt, speed, grounded, crouch, action: null|'wave'|'dance'|'sit'|'point'|'seated', steer }
     */
    animate(s) {
      const tgt = target(s);
      const a = 1 - Math.exp(-s.dt * (s.action === 'seated' ? 20 : 11));
      for (const key in cur) cur[key] += (tgt[key] - cur[key]) * a;
      apply();
    },
  };
}
