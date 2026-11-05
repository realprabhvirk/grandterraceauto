// Phase 6: enterable shops from one shared interior kit. 7 Terrace Pde shopfronts (the old
// facades) + 6 downtown corner shops facing the cross streets mid-block. Each shop: hollow shell
// with a hinged door, fittings by style (food / chemist / clothes / barber / mart), a keeper
// behind the counter and an E-target at the counter that opens the shared buy menu
// (ui/shopMenu.js). Interiors only render within ~25 m (like Barrel & Bolt).
import * as THREE from 'three';
import { buildSwingDoor } from '../world/house62Doors.js';
import { frame, makeChunk, createSignAtlas } from './townKit.js';
import { T } from './townPlan.js';
import { ROW_Z, SHOP_X } from './townBuildings.js';
import { shell, npc } from './townInteriors.js';

const SHOW = 25;
const food = (...a) => a.map(([label, price, hp]) => ({ label, price, hp }));
const tees = [['Red tee', '#c8322a'], ['Navy tee', '#2f4f7c'], ['Forest tee', '#3f7a4a'], ['Black tee', '#26262a'], ['Mustard tee', '#d8a33a'], ['Original terracotta', '#d86c3d']];
const hair = [['Jet black', '#16130f'], ['Bleached blonde', '#e2cf8a'], ['Ginger', '#b5542a'], ['Silver', '#b9b9b4'], ['Original brown', '#3b2a20']];

/** Menus by shop kind: food/drinks heal ($8-20, +10..25), chemist $40/+50, clothes $60 outfit colour. */
export const MENUS = {
  cafe: food(['Flat white', 8, 10], ['Toasted sandwich', 14, 18], ['Big breakfast', 20, 25]),
  bakery: food(['Sausage roll', 8, 10], ['Meat pie', 12, 15], ['Vanilla slice', 10, 12]),
  takeaway: food(['Spring rolls', 8, 10], ['Fried rice', 14, 20], ['Family box', 20, 25]),
  bottle: food(['Bottled water', 8, 10], ['Sports drink', 10, 14], ['Iced coffee', 12, 16]),
  noodle: food(['Miso soup', 8, 10], ['Ramen', 16, 22], ['Laksa', 18, 25]),
  diner: food(['Milkshake', 9, 12], ['Burger', 15, 20], ['Diner platter', 20, 25]),
  pizza: food(['Garlic bread', 8, 10], ['Slice', 10, 14], ['Whole pizza', 20, 25]),
  juice: food(['Orange juice', 8, 10], ['Green smoothie', 12, 16], ['Acai bowl', 16, 20]),
  mart: food(['Chips', 8, 10], ['Chocolate bar', 9, 12], ['Sandwich', 14, 18]),
  chemist: [{ label: 'First aid kit', price: 40, hp: 50 }, { label: 'Bandages', price: 20, hp: 20 }],
  fashion: tees.map(([label, c]) => ({ label, price: 60, outfit: { shirt: c } })),
  boutique: tees.map(([label, c]) => ({ label: label.replace('tee', 'polo'), price: 60, outfit: { shirt: c } })),
  barber: hair.map(([label, c]) => ({ label: `Cut + colour: ${label}`, price: 25, outfit: { hair: c } })),
};
const STYLE = { chemist: 'chemist', fashion: 'clothes', boutique: 'clothes', barber: 'barber', mart: 'mart', bottle: 'mart' };
export const MAP_KIND = (kind) => (kind === 'chemist' ? 'chemist' : STYLE[kind] === 'clothes' || kind === 'barber' ? 'clothes' : 'food');

/** Terrace Pde shops (index into townBuildings.SHOPS) that become enterable. */
export const PDE_KIT = { 0: 'cafe', 1: 'bakery', 2: 'chemist', 3: 'barber', 6: 'fashion', 8: 'takeaway', 9: 'bottle' };
const DOWNTOWN_KIT = [
  { i: 3, j: 0, kind: 'noodle', name: 'NOODLE BAR', bg: '#1a1a1e', fg: '#4fe0ff' },
  { i: 3, j: 1, kind: 'diner', name: 'DINER 24H', bg: '#1a1a1e', fg: '#ffd84f' },
  { i: 4, j: 0, kind: 'mart', name: 'CITY MART', bg: '#2f6fc0', fg: '#ffffff' },
  { i: 5, j: 0, kind: 'boutique', name: 'MODA BOUTIQUE', bg: '#26262a', fg: '#f0c8e0' },
  { i: 5, j: 1, kind: 'pizza', name: 'PIZZA NAPOLI', bg: '#c8322a', fg: '#ffffff' },
  { i: 6, j: 0, kind: 'juice', name: 'JUICE BAR', bg: '#4f9a55', fg: '#ffffff' },
];

/** Placement of every kit shop: { id, name, kind, F, w, d, storeys, wall, awning, bg, fg }. */
export function kitShopSpots(SHOPS, walls, awnings) {
  const out = [];
  for (const [k, kind] of Object.entries(PDE_KIT)) {
    const n = Number(k), north = n < 5, s = SHOPS[n];
    out.push({ id: `shop-${kind}`, name: s.name, kind, F: frame(SHOP_X[n % 5], north ? ROW_Z.north : ROW_Z.south, 0, north ? 1 : -1, T.h + 0.06), w: 16.6, d: 14, storeys: 2, wall: walls[n % walls.length], awning: awnings[n % awnings.length], bg: '#f4f1e8', fg: '#2b2b2e' });
  }
  for (const s of DOWNTOWN_KIT) {
    // Mid-block on the block's west building line, facing the cross street (-x); between the
    // Pde tower and the outer tower (a ~37 m gap).
    const bx0 = T.X[s.i] + T.front, z0 = T.Z[s.j] + T.front, z1 = T.Z[s.j + 1] - T.front;
    const zMid = s.j === 0 ? (z0 + 34 + (z1 - 40)) / 2 : (z0 + 40 + (z1 - 34)) / 2;
    out.push({ id: `shop-${s.kind}`, name: s.name, kind: s.kind, F: frame(bx0, zMid, -1, 0, T.h + 0.06), w: 13, d: 12, storeys: 1, wall: '#cfc6b6', awning: s.bg, bg: s.bg, fg: s.fg });
  }
  return out;
}

function fittings(inside, F, { w, d, H, kind, rng }) {
  const style = STYLE[kind] || 'food';
  const cz = -d + 3.0; // counter line (keeper behind it)
  inside.block(F, 5.4, 1.0, 0.9, 1.2, 0.05, cz, '#5a4636');
  inside.box(F, 5.4, 0.06, 0.95, 1.2, 1.05, cz, '#cfc3ab');
  inside.box(F, 0.4, 0.3, 0.35, 0.2, 1.11, cz, '#2b2b2e'); // till
  inside.box(F, w - 1.2, 1.6, 0.06, 0, 1.4, -d + 0.36, '#3a3d42'); // back board
  for (const x of [-w / 4, w / 4]) inside.box(F, 2.4, 0.06, 0.6, x, H - 0.12, -d / 2, '#fffbe8'); // ceiling lights
  const prod = ['#c8553e', '#3f7fc0', '#e2b33a', '#4f9a55', '#8a5aa8', '#e7e1d4', '#d27a3c'];
  if (style === 'food') {
    inside.block(F, 2.6, 0.9, 0.8, -2.8, 0.05, cz, '#5a4636');
    inside.box(F, 2.6, 0.45, 0.8, -2.8, 0.95, cz, '#cfe6ee', { glassy: true }); // display case
    for (let k = 0; k < 5; k++) inside.box(F, 0.35, 0.12, 0.3, -3.8 + k * 0.5, 1.0, cz, prod[k]);
    for (let k = 0; k < 4; k++) inside.box(F, 1.6, 0.35, 0.04, -w / 2 + 2 + k * 1.9, 2.0, -d + 0.4, ['#e2c25a', '#f4f1e8', '#e2c25a', '#f4f1e8'][k]); // menu panels
    for (const [lx, lz] of [[-w / 2 + 2.2, -3.2], [w / 2 - 2.2, -3.2]]) {
      inside.block(F, 1.0, 0.75, 1.0, lx, 0.05, lz, '#8a6446');
      for (const s of [-1, 1]) inside.block(F, 0.45, 0.45, 0.45, lx + s * 0.95, 0.05, lz, '#3d4f63');
    }
  } else if (style === 'mart' || style === 'chemist') {
    const shelf = style === 'chemist' ? '#f2f2ee' : '#c9c2b4';
    for (const s of [-1, 1]) {
      inside.block(F, 0.6, 2.0, d - 5.5, s * (w / 2 - 0.75), 0.05, -d / 2 + 1.2, shelf);
      for (let k = 0; k < 3; k++) inside.box(F, 0.3, 0.28, d - 6, s * (w / 2 - 1.0), 0.5 + k * 0.55, -d / 2 + 1.2, prod[(k + (s > 0 ? 3 : 0)) % prod.length]);
    }
    inside.block(F, 1.0, 1.4, 4.0, -1.8, 0.05, -4.2, shelf); // gondola
    for (let k = 0; k < 2; k++) inside.box(F, 1.06, 0.26, 3.8, -1.8, 0.5 + k * 0.5, -4.2, prod[(k + 2) % prod.length]);
    if (style === 'chemist') inside.box(F, 1.2, 1.2, 0.06, 1.2, 2.2, -d + 0.42, '#3fbf8a'); // green cross board
  } else if (style === 'clothes') {
    for (const lz of [-3.0, -6.0]) for (const s of [-1, 1]) {
      inside.box(F, 2.4, 0.05, 0.05, s * 3.2, 1.55, lz, '#9a9a9e');
      for (let k = 0; k < 6; k++) inside.box(F, 0.08, 0.8, 0.5, s * 3.2 - 1.0 + k * 0.4, 0.7, lz, tees[(k + (s > 0 ? 2 : 0)) % tees.length][1]);
      inside.collide(F, 2.4, 1.6, 0.6, s * 3.2, 0, lz);
    }
    inside.box(F, 1.4, 2.1, 0.05, -w / 2 + 0.36, 0.3, -d / 2, '#cfe6ee', { glassy: true }); // mirror (side wall)
  } else if (style === 'barber') {
    for (const lx of [-3.6, -0.6]) {
      inside.block(F, 0.8, 0.55, 0.8, lx, 0.05, -2.2, '#8a2a2a');
      inside.box(F, 0.8, 0.8, 0.15, lx, 0.6, -2.55, '#8a2a2a');
      inside.box(F, 1.6, 1.2, 0.05, lx, 1.1, -0.45, '#cfe6ee', { glassy: true }); // mirror on the front wall
    }
    inside.box(F, 0.18, 1.2, 0.18, w / 2 - 0.8, 0.9, -0.5, '#e8e4dc'); // barber pole stub
  }
  void rng;
  return { cz };
}

/** Build every kit shop. Returns the same shape as townInteriors (merged in town.js) + shops[]. */
export function buildKitShops({ parent, rng, spots }) {
  const out = { colliders: [], toggles: [], targets: [], updaters: [], chunks: [], doors: [], shops: [], places: [] };
  const atlas = createSignAtlas();
  const extN = makeChunk('kit-shops'), extD = makeChunk('kit-shops-dt');
  spots.forEach((s, k) => {
    const { F, w, d } = s, dt = s.storeys === 1, ch = dt ? extD : extN;
    const H = dt ? 4.2 : 3.8, HT = 7.4;
    const inside = makeChunk(`${s.id}-inside`);
    shell(ch, F, { w, d, h: H, wall: s.wall, doorX: 0, doorW: 1.9, inner: '#e8e2d4', floor: dt ? '#bdb6aa' : '#cdbfa8' });
    if (dt) {
      ch.block(F, w, 0.5, d, 0, H, -d / 2, s.wall);                       // roof slab
      ch.box(F, w + 0.3, 0.7, 0.3, 0, H + 0.5, -0.1, '#e6e2da');          // parapet
    } else {
      ch.block(F, w, HT - H, d, 0, H, -d / 2, s.wall);                    // upper floor (solid)
      ch.box(F, w + 0.2, 0.5, 0.5, 0, HT, -0.15, '#efe9dd');              // cornice
      ch.box(F, w, 1.2, 0.2, 0, HT + 0.5, -0.1, s.wall);
      for (const x of [-w / 3, 0, w / 3]) ch.box(F, 1.8, 1.6, 0.12, x, 4.9, 0.05, '#4d6577', { glassy: true });
    }
    const side = (w - 1.9 - 1.2) / 2;
    for (const sg of [-1, 1]) ch.box(F, side, 2.3, 0.12, sg * (1.9 / 2 + 0.3 + side / 2), 0.55, 0.05, '#5a7183', { glassy: true });
    ch.box(F, w, 0.55, 0.16, 0, 0, 0.06, '#8d7f70');                      // stall riser
    ch.box(F, w - 0.4, 0.18, 2.6, 0, 3.15, 1.3, s.awning);                // awning
    ch.box(F, w - 0.4, 0.45, 0.06, 0, 2.75, 2.58, s.awning);
    ch.box(F, w - 1.2, 1.0, 0.1, 0, 3.45, 0.06, '#2b2b2e');
    atlas.sign(F, atlas.row(s.name, s.bg, s.fg, 'bold 46px Arial'), w - 1.4, 0.82, 0, 3.95, 0.13);
    const { cz } = fittings(inside, F, { w, d, H, kind: s.kind, rng: rng.fork(k + 1) });
    const people = new THREE.Group();
    const kp = F.toW(1.2, cz - 1.0);
    const keeper = npc(people, rng.fork(k + 40), kp.x, kp.z, F.rot, F.y, s.kind === 'chemist' ? 'cashier' : 'shopkeeper');
    const extras = [];
    if (!STYLE[s.kind] && k % 2 === 0) { const c = F.toW(-w / 2 + 2.2 + 0.95, -3.2); extras.push(npc(people, rng.fork(k + 80), c.x, c.z, F.rot + Math.PI / 2, F.y + 0.5, 'shopper')); }
    const insideChunk = inside.finish(parent);
    insideChunk.group.add(people);
    out.colliders.push(...inside.colliders);
    const door = buildSwingDoor({ id: `${s.id}-door`, ...F.toW(0, -0.15), y: F.y, w: 1.8, h: 2.4, rot: F.rot, color: s.awning });
    parent.add(door.group);
    out.doors.push(door);
    out.toggles.push(...door.toggles);
    out.targets.push(door.target);
    const c = F.toW(1.2, cz + 0.75), dp = F.toW(0, 1.5), centre = F.toW(0, -d / 2);
    const label = s.name.replace(/\b\w+/g, (t) => t[0] + t.slice(1).toLowerCase());
    const shop = { id: s.id, name: s.name, label, kind: s.kind, menu: MENUS[s.kind], counter: { x: c.x, y: F.y, z: c.z }, door: dp, centre, inside: insideChunk.group, keeper };
    out.shops.push(shop);
    out.places.push({ kind: MAP_KIND(s.kind), x: dp.x, z: dp.z, label });
    out.updaters.push((dtt, { focus }) => {
      door.update(dtt);
      const near = Math.hypot(focus.x - centre.x, focus.z - centre.z) < SHOW + d / 2;
      insideChunk.group.visible = near;
      if (!near) return;
      keeper.animate({ dt: dtt, speed: 0, grounded: true, crouch: false, action: null, steer: 0 });
      for (const e of extras) e.animate({ dt: dtt, speed: 0, grounded: true, crouch: false, action: 'seated', steer: 0 });
    });
  });
  for (const ch of [extN, extD]) { out.chunks.push(ch.finish(parent)); out.colliders.push(...ch.colliders); }
  parent.add(atlas.mesh());
  // Shop signs glow at dusk (like the downtown neon).
  out.updaters.push((dt, ctx) => { atlas.mat.emissiveIntensity = 0.15 + (ctx.dusk ?? 0) * 1.3; });
  out.atlas = atlas;
  return out;
}
