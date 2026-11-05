// Procedural low-poly guns at real-world scale, flat-shaded in the palette (gunmetal, polymer,
// wood accents). Local space: origin = the right hand's grip point, +Z = forward (muzzle),
// +Y = up. Each model has a body mesh plus moving parts (slide / magazine / pump) as separate
// meshes, and a spec: grip, fore (left hand, long guns), muzzle, sightY (sight line height),
// mag (where the left hand goes when reloading) and viewmodel hip / ADS positions.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { paint, merge } from '../utils/geom.js';

const GM = '#3b3e44', PO = '#25262a', WD = '#7a5233', ST = '#8e9298', DK = '#1c1d20';
let seed = 77;
/** Box w x h x d centred at (x, y, z), optional X tilt (rad). */
function bx(w, h, d, x, y, z, color, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return paint(g, color, 0.04, seed++);
}
/** Tube along +Z from z0 to z1 at height y. */
function tube(r, z0, z1, y, color, seg = 8) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg).rotateX(Math.PI / 2).translate(0, y, (z0 + z1) / 2);
  return paint(g, color, 0.03, seed++);
}
/** Trigger guard + trigger at z (grip front). */
const guard = (z, y = 0.018) => [
  bx(0.008, 0.006, 0.052, 0, y, z + 0.012, DK), bx(0.008, 0.03, 0.006, 0, y + 0.014, z + 0.036, DK),
  bx(0.006, 0.022, 0.006, 0, y + 0.014, z + 0.01, ST),
];

const BUILD = {
  pistol: () => ({
    body: [
      bx(0.03, 0.1, 0.046, 0, -0.012, -0.014, PO, 0.25),   // grip (raked)
      bx(0.032, 0.008, 0.05, 0, -0.064, -0.026, DK, 0.25), // magazine base plate
      bx(0.028, 0.026, 0.15, 0, 0.05, 0.045, PO),          // frame / dust cover
      ...guard(0.02),
    ],
    slide: [
      bx(0.03, 0.032, 0.19, 0, 0.077, 0.055, GM),           // slide
      bx(0.012, 0.012, 0.01, 0, 0.077, 0.151, DK),          // muzzle face
      bx(0.006, 0.008, 0.006, 0, 0.097, 0.14, DK),          // front sight
      bx(0.022, 0.008, 0.008, 0, 0.097, -0.03, DK),         // rear sight
    ],
    spec: { grip: [0, 0, 0], fore: null, muzzle: [0, 0.077, 0.152], sightY: 0.1, mag: [0, -0.05, -0.02], hip: [0.13, -0.17, -0.34], ads: [0, -0.1, -0.3], len: 0.19 },
  }),
  smg: () => ({
    body: [
      bx(0.03, 0.1, 0.045, 0, -0.012, -0.01, PO, 0.22),     // pistol grip
      bx(0.045, 0.07, 0.26, 0, 0.065, 0.07, GM),           // receiver
      tube(0.016, 0.2, 0.25, 0.075, DK),                   // barrel shroud
      tube(0.007, 0.25, 0.272, 0.075, ST),                 // barrel
      bx(0.03, 0.08, 0.034, 0, 0.0, 0.17, PO),             // vertical foregrip
      bx(0.008, 0.008, 0.12, 0.016, 0.062, -0.12, ST), bx(0.008, 0.008, 0.12, -0.016, 0.062, -0.12, ST), // wire stock
      bx(0.04, 0.08, 0.012, 0, 0.04, -0.18, PO),           // butt plate
      bx(0.02, 0.016, 0.01, 0, 0.106, -0.04, DK), bx(0.006, 0.02, 0.008, 0, 0.108, 0.19, DK), // sights
      ...guard(0.025),
    ],
    mag: [bx(0.026, 0.15, 0.034, 0, -0.03, 0.1, DK)],
    spec: { grip: [0, 0, 0], fore: [0, 0.005, 0.17], muzzle: [0, 0.075, 0.272], sightY: 0.114, mag: [0, -0.1, 0.1], hip: [0.14, -0.17, -0.27], ads: [0, -0.114, -0.2], len: 0.45 },
  }),
  shotgun: () => ({
    body: [
      bx(0.032, 0.06, 0.09, 0, 0.012, -0.03, WD, 0.5),      // wrist
      bx(0.04, 0.09, 0.26, 0, 0.03, -0.2, WD, 0.12),        // stock
      bx(0.042, 0.1, 0.02, 0, 0.018, -0.335, DK, 0.12),     // butt pad
      bx(0.045, 0.07, 0.2, 0, 0.065, 0.06, GM),            // receiver
      tube(0.012, 0.16, 0.62, 0.082, GM),                  // barrel
      tube(0.011, 0.16, 0.56, 0.052, DK),                  // magazine tube
      bx(0.006, 0.006, 0.006, 0, 0.097, 0.61, ST),         // bead sight
      ...guard(0.02),
    ],
    pump: [bx(0.05, 0.045, 0.17, 0, 0.05, 0.32, WD)],
    spec: { grip: [0, 0, 0], fore: [0, 0.04, 0.32], muzzle: [0, 0.082, 0.62], sightY: 0.097, mag: [0, 0.03, 0.12], hip: [0.15, -0.18, -0.24], ads: [0, -0.097, -0.18], len: 0.955 },
  }),
  rifle: () => ({
    body: [
      bx(0.03, 0.1, 0.045, 0, -0.012, -0.01, PO, 0.22),     // pistol grip
      bx(0.045, 0.075, 0.3, 0, 0.065, 0.08, GM),           // receiver
      bx(0.05, 0.055, 0.26, 0, 0.068, 0.36, PO),           // handguard
      tube(0.008, 0.49, 0.6, 0.075, ST),                   // barrel
      tube(0.011, 0.58, 0.625, 0.075, DK, 6),              // flash hider
      bx(0.04, 0.07, 0.22, 0, 0.045, -0.18, PO),           // stock
      bx(0.045, 0.11, 0.02, 0, 0.035, -0.295, DK),         // butt
      bx(0.022, 0.012, 0.28, 0, 0.108, 0.12, DK),          // top rail
      bx(0.02, 0.025, 0.02, 0, 0.125, -0.02, DK), bx(0.006, 0.04, 0.01, 0, 0.112, 0.46, DK), // sights
      ...guard(0.025),
    ],
    mag: [bx(0.028, 0.15, 0.06, 0, -0.03, 0.13, DK, -0.2)],
    spec: { grip: [0, 0, 0], fore: [0, 0.04, 0.29], muzzle: [0, 0.075, 0.625], sightY: 0.13, mag: [0, -0.1, 0.14], hip: [0.14, -0.18, -0.24], ads: [0, -0.13, -0.17], len: 0.925 },
  }),
};

const cache = new Map();
function geometries(id) {
  if (!cache.has(id)) {
    const b = BUILD[id]();
    const out = { spec: b.spec, parts: {} };
    for (const k of ['body', 'slide', 'mag', 'pump']) if (b[k]) out.parts[k] = merge(b[k]);
    cache.set(id, out);
  }
  return cache.get(id);
}

/** A new gun instance (shares geometry). Returns { group, parts: {body, slide?, mag?, pump?}, spec }. */
export function createGun(id, { shadow = true } = {}) {
  const g = geometries(id);
  const group = new THREE.Group();
  group.name = `gun-${id}`;
  const parts = {};
  for (const [k, geo] of Object.entries(g.parts)) {
    const m = new THREE.Mesh(geo, MAT.solid);
    m.castShadow = shadow;
    group.add(m);
    parts[k] = m;
  }
  return { id, group, parts, spec: g.spec };
}

/** Pump / slide / magazine animation: kick 0..1 (slide back), pump 0..1, magOut 0..1. */
export function animateGun(gun, { kick = 0, pump = null, magOut = 0 } = {}) {
  if (gun.parts.slide) gun.parts.slide.position.z = -kick * 0.03;
  if (gun.parts.pump) gun.parts.pump.position.z = pump == null ? 0 : -Math.sin(pump * Math.PI) * 0.08;
  if (gun.parts.mag) { gun.parts.mag.position.y = -magOut * 0.18; gun.parts.mag.visible = magOut < 0.95; }
}
