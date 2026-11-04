// Enterable town interiors: Terrace Central (department store, ground floor) and the
// Quick Stop convenience store. Hollow shells with a hinged door (same door module as 62),
// fittings with colliders, staff + shoppers. Interiors only render within ~25 m.
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { PALETTE } from '../art/palette.js';
import { buildSwingDoor } from '../world/house62Doors.js';
import { createCharacter } from '../player/character.js';
import { randomOutfit } from '../npc/outfits.js';
import { frame, makeChunk } from './townKit.js';
import { T } from './townPlan.js';
import { ROW_Z } from './townBuildings.js';

const C = PALETTE.town, SHOW = 25;
const PRODUCTS = ['#c8553e', '#3f7fc0', '#e2b33a', '#4f9a55', '#8a5aa8', '#e7e1d4', '#d27a3c'];

/** Hollow single-storey shell (walls t=0.3) with a door gap at lx=doorX on the front. */
function shell(ch, F, { w, d, h, wall, doorX = 0, doorW = 2.2, doorH = 2.5, inner = '#ece6d8', floor = '#d8d2c6' }) {
  const t = 0.3, half = w / 2;
  ch.block(F, w, h, t, 0, 0, -d + t / 2, wall);                          // back
  for (const s of [-1, 1]) ch.block(F, t, h, d, s * (half - t / 2), 0, -d / 2, wall); // sides
  const l0 = -half, l1 = doorX - doorW / 2, r0 = doorX + doorW / 2, r1 = half;
  ch.block(F, l1 - l0, h, t, (l0 + l1) / 2, 0, -t / 2, wall);
  ch.block(F, r1 - r0, h, t, (r0 + r1) / 2, 0, -t / 2, wall);
  ch.block(F, doorW, h - doorH, t, doorX, doorH, -t / 2, wall);         // lintel
  // Inner lining + floor + ceiling (ceiling doesn't cast: the sun still lights the floor).
  ch.box(F, w - 0.62, 0.04, d - 0.62, 0, 0.02, -d / 2, floor);
  ch.box(F, w - 0.62, h - 0.1, 0.02, 0, 0.05, -d + 0.32, inner);
  return { l0, l1, r0, r1 };
}

function npc(group, rng, x, z, yaw, y) {
  const ch = createCharacter(randomOutfit(rng), { name: 'shop-npc' });
  ch.root.position.set(x, y, z);
  ch.root.rotation.y = yaw;
  group.add(ch.root);
  return ch;
}

export function buildTownInteriors({ parent, atlas, rng }) {
  const out = { colliders: [], toggles: [], targets: [], updaters: [], chunks: [], doors: [], counters: {}, people: [] };
  const y = T.h + 0.06;

  // ======================= Terrace Central =======================================================
  {
    const ch = makeChunk('terrace-central'), inside = makeChunk('terrace-central-inside');
    const W = 50, D = 34, H = 5;
    const F = frame(553, ROW_Z.north, 0, 1, y);
    shell(ch, F, { w: W, d: D, h: H, wall: '#e8e2d6', doorX: 0, doorW: 2.6 });
    // Glass shopfront panels outside the front wall, upper storey, roof, sign.
    for (const s of [-1, 1]) for (let x = 2.4; x < W / 2 - 1; x += 3.2) ch.box(F, 2.8, 3.2, 0.1, s * x, 0.5, 0.05, '#5a7183', { glassy: true });
    ch.block(F, W, 5.4, D, 0, H, -D / 2, '#d9cbb4');
    for (let x = -W / 2 + 2; x <= W / 2 - 2; x += 3) ch.box(F, 2.2, 1.6, 0.1, x, H + 2.6, 0.03, '#4d6577', { glassy: true });
    ch.box(F, W + 0.3, 0.6, D + 0.3, 0, H + 5.4, -D / 2, '#efe9dd');
    ch.box(F, W + 1, 0.3, 2.2, 0, H - 0.4, 1.1, '#3d5f8a');          // canopy
    ch.box(F, 22, 1.5, 0.12, 0, H + 0.5, 0.06, '#3d5f8a');
    atlas.sign(F, atlas.row('TERRACE CENTRAL', '#3d5f8a', '#ffffff', 'bold 44px Arial'), 20, 1.3, 0, H + 1.25, 0.13);
    // Inside: aisles of shelving, clothing racks, checkouts, ceiling lights.
    for (const x of [-16, -10, -4, 2]) {
      inside.block(F, 1.3, 2.0, 16, x, 0.05, -18, '#efe9dd');
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) inside.box(F, 0.08, 0.32, 15.2, x + s * 0.66, 0.35 + k * 0.42, -18, PRODUCTS[(k + Math.abs(x)) % PRODUCTS.length]);
    }
    for (const [x, z] of [[11, -12], [17, -12], [11, -20], [17, -20], [14, -27]]) {
      inside.block(F, 1.5, 1.4, 1.5, x, 0.05, z, '#b9b6ae');
      for (let k = 0; k < 6; k++) inside.box(F, 1.7, 0.85, 0.1, x, 0.5, z - 0.6 + k * 0.24, PRODUCTS[(k + x) % PRODUCTS.length]);
    }
    for (const x of [-18, -12]) { inside.block(F, 3.6, 1.0, 1.0, x, 0.05, -5, '#8a6446'); inside.box(F, 0.5, 0.35, 0.4, x - 1.2, 1.05, -5, '#2b2b2e'); }
    for (let x = -20; x <= 20; x += 8) for (let z = -6; z >= -30; z -= 8) inside.box(F, 2.4, 0.06, 0.6, x, H - 0.12, z, '#fffbe8');
    const people = new THREE.Group();
    people.name = 'terrace-central-people';
    const p = (lx, lz) => F.toW(lx, lz);
    const cashier = npc(people, rng, p(-15, -6.2).x, p(-15, -6.2).z, F.rot + Math.PI * 0 + 0, y);
    cashier.root.rotation.y = F.rot;               // faces the customers (front)
    const guard = npc(people, rng, p(3.4, -1.6).x, p(3.4, -1.6).z, F.rot, y);
    const shoppers = [0, 1, 2].map((k) => ({ ch: npc(people, rng, 0, 0, 0, y), path: [[-7, -10], [-7, -26], [-1, -26], [-1, -10]].map(([a, b]) => p(a + k * 0.3, b)), i: k, speed: 0.9 + k * 0.15, pause: 0 }));
    shoppers[2].path = [[8, -9], [20, -9], [20, -24], [8, -24]].map(([a, b]) => p(a, b));
    out.people.push({ role: 'cashier', ch: cashier }, { role: 'guard', ch: guard }, ...shoppers.map((s) => ({ role: 'shopper', ch: s.ch })));
    const insideChunk = inside.finish(parent);
    insideChunk.group.add(people);
    out.chunks.push(ch.finish(parent));
    out.colliders.push(...ch.colliders, ...inside.colliders);
    const door = buildSwingDoor({ id: 'tcDoor', ...p(0, -0.15), y, w: 2.5, h: 2.5, rot: F.rot, color: '#3d5f8a' });
    parent.add(door.group);
    out.doors.push(door);
    out.toggles.push(...door.toggles);
    out.targets.push(door.target);
    const centre = p(0, -D / 2);
    out.updaters.push((dt, { focus }) => {
      door.update(dt);
      const near = Math.hypot(focus.x - centre.x, focus.z - centre.z) < SHOW + D / 2;
      insideChunk.group.visible = near;
      if (!near) return;
      cashier.animate({ dt, speed: 0, grounded: true, crouch: false, action: null, steer: 0 });
      guard.animate({ dt, speed: 0, grounded: true, crouch: false, action: 'look', steer: 0 });
      for (const s of shoppers) {
        const r = s.ch.root, tgt = s.path[s.i];
        const dx = tgt.x - r.position.x, dz = tgt.z - r.position.z, dd = Math.hypot(dx, dz);
        if (s.pause > 0) { s.pause -= dt; s.ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: 'look', steer: 0 }); continue; }
        if (dd < 0.2) { s.i = (s.i + 1) % s.path.length; if (Math.random() < 0.5) s.pause = 2 + Math.random() * 2; continue; }
        r.position.x += (dx / dd) * Math.min(dd, s.speed * dt); r.position.z += (dz / dd) * Math.min(dd, s.speed * dt);
        r.rotation.y = Math.atan2(dx, dz);
        s.ch.animate({ dt, speed: s.speed, grounded: true, crouch: false, action: null, steer: 0 });
      }
    });
    for (const s of shoppers) s.ch.root.position.set(s.path[0].x, y, s.path[0].z);
    out.storeCentre = centre;
  }

  // ======================= Quick Stop ===========================================================
  {
    const ch = makeChunk('quick-stop'), inside = makeChunk('quick-stop-inside');
    const W = 18, D = 13, H = 3.8;
    const F = frame(395, ROW_Z.south, 0, -1, y);
    shell(ch, F, { w: W, d: D, h: H, wall: '#e9e4d8', doorX: 3.5, doorW: 1.9 });
    for (const x of [-6.5, -2.5, 7.2]) ch.box(F, 2.8, 1.8, 0.1, x, 0.8, 0.05, '#5a7183', { glassy: true });
    ch.box(F, W + 0.3, 0.5, D + 0.3, 0, H, -D / 2, '#c4473a');
    ch.box(F, W - 0.6, 0.05, D - 0.6, 0, H + 0.5, -D / 2, C.roofFlat);
    ch.box(F, W, 0.9, 0.12, 0, H - 0.95, 0.06, '#e2c25a');
    atlas.sign(F, atlas.row('QUICK STOP  24/7', '#e2c25a', '#b8322a', 'bold 44px Arial'), 11, 0.8, 0, H - 0.5, 0.13);
    // Counter + register, shelves, back-wall fridges (glass doors).
    inside.block(F, 4.2, 1.0, 1.0, -5, 0.05, -3, '#8a6446');
    inside.box(F, 0.5, 0.35, 0.4, -6, 1.05, -3, '#2b2b2e');
    inside.box(F, 1.6, 0.6, 0.6, -3.6, 1.05, -3.1, '#e2c25a'); // snack display
    for (const z of [-6.5, -9.2]) {
      inside.block(F, 7, 1.7, 1.0, 2.5, 0.05, z, '#efe9dd');
      for (let k = 0; k < 3; k++) for (const s of [-1, 1]) inside.box(F, 6.6, 0.3, 0.08, 2.5, 0.35 + k * 0.45, z + s * 0.52, PRODUCTS[(k * 2 + (s > 0 ? 1 : 0)) % PRODUCTS.length]);
    }
    inside.block(F, 10, 2.3, 0.9, 1.5, 0.05, -D + 0.8, '#d9d4c8');
    for (let x = -3; x <= 6; x += 1.5) inside.box(F, 1.3, 1.9, 0.06, x, 0.25, -D + 1.28, '#9fc4d6', { glassy: true });
    for (let x = -6; x <= 6; x += 4) inside.box(F, 2.4, 0.06, 0.6, x, H - 0.12, -6, '#fffbe8');
    const people = new THREE.Group();
    const cp = F.toW(-5, -4.3);
    const cashier = npc(people, rng, cp.x, cp.z, F.rot, y);
    out.people.push({ role: 'cashier', ch: cashier });
    const insideChunk = inside.finish(parent);
    insideChunk.group.add(people);
    out.chunks.push(ch.finish(parent));
    out.colliders.push(...ch.colliders, ...inside.colliders);
    const door = buildSwingDoor({ id: 'qsDoor', ...F.toW(3.5, -0.15), y, w: 1.8, h: 2.4, rot: F.rot, color: '#c4473a' });
    parent.add(door.group);
    out.doors.push(door);
    out.toggles.push(...door.toggles);
    out.targets.push(door.target);
    const counter = F.toW(-5, -2.05);
    out.counters.quickStop = { x: counter.x, y, z: counter.z };
    const centre = F.toW(0, -D / 2);
    out.updaters.push((dt, { focus }) => {
      door.update(dt);
      const near = Math.hypot(focus.x - centre.x, focus.z - centre.z) < SHOW + D / 2;
      insideChunk.group.visible = near;
      if (near) cashier.animate({ dt, speed: 0, grounded: true, crouch: false, action: null, steer: 0 });
    });
    out.quickStopCentre = centre;
  }
  void MAT;
  return out;
}
