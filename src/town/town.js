// Terrace Town Centre: builds streets, buildings, interiors, props and parks, and returns
// physics shapes + gameplay hooks (places, spawn points, interaction targets, breakables,
// pedestrian loops). Static town meshes are grouped per chunk and hidden beyond ~260 m.
import * as THREE from 'three';
import { buildTownRoads } from './townRoads.js';
import { makeChunk, createSignAtlas } from './townKit.js';
import { buildTownBuildings, staticCar } from './townBuildings.js';
import { buildTownInteriors } from './townInteriors.js';
import { buildTownProps } from './townProps.js';
import { buildCentralGardens, buildWattlePark } from './parks.js';
import { T } from './townPlan.js';
import { makeRng } from '../utils/rng.js';

const HIDE = 260;
const CAR_TYPES_PARKED = ['hatch', 'sedan', 'suv', 'hatch', 'ute', 'sedan'];
const PAINTS = ['#8a4f3a', '#d8d2c4', '#46566b', '#9aa37a', '#5c5f66', '#b98a4a', '#7c2f2f', '#2f4f6b', '#e9e6dc'];

export function buildTown(scene, { plan, terrain, wattleSite }) {
  const rng = makeRng(6262);
  const group = new THREE.Group();
  group.name = 'town';
  scene.add(group);
  group.add(buildTownRoads(plan));
  const atlas = createSignAtlas();
  const chunks = new Map();
  const chunk = (name) => { if (!chunks.has(name)) chunks.set(name, makeChunk(name)); return chunks.get(name); };

  const B = buildTownBuildings({ chunk, atlas, plan, rng: rng.fork(1) });
  const gardens = buildCentralGardens(chunk('b11'), atlas, rng.fork(2));
  // Parked cars in Terrace Central's car park (static, merged).
  B.carpark.forEach((p, i) => staticCar(chunk('b20'), p.x, p.z, p.yaw, CAR_TYPES_PARKED[i % CAR_TYPES_PARKED.length], PAINTS[(i * 5) % PAINTS.length]));
  const avoid = [
    { x0: 381, x1: 413, z0: -96, z1: -88 },   // police car bay mouth
    { x0: 545, x1: 561, z0: -96, z1: -88 },   // Terrace Central entrance
    { x0: 528, x1: 600, z0: -212, z1: -203 }, // car park mouth (ring road)
    { x0: 553, x1: 571, z0: -82, z1: -74 },   // hospital entrance
    { x0: 590, x1: 606, z0: -82, z1: -48 },   // ambulance bay
    { x0: 334, x1: 384, z0: -82, z1: -44 },   // petrol forecourt
    { x0: 386, x1: 398, z0: -82, z1: -74 },   // Quick Stop door
    { x0: 365, x1: 380, z0: -96, z1: -88 }, { x0: 455, x1: 469, z0: -96, z1: -88 }, { x0: 471, x1: 485, z0: -82, z1: -74 }, // bus stops
  ];
  const props = buildTownProps({ plan, rng: rng.fork(3), chunk, atlas, avoid });
  group.add(props.group);
  const inner = buildTownInteriors({ parent: group, atlas, rng: rng.fork(4) });

  const out = {
    group, plan, atlas,
    colliders: [...inner.colliders], trunks: [...gardens.trunks], poles: [], toggles: [...inner.toggles],
    targets: [...inner.targets], places: [...B.places, { kind: 'park', x: gardens.centre.x, z: gardens.centre.z, label: 'Central Gardens' }],
    breakables: props.defs, pedLines: props.lines, benches: gardens.benches, gardens, interiors: inner, stops: props.stops,
    chunks: [...inner.chunks], updaters: [...inner.updaters],
    spawns: {
      police: { position: new THREE.Vector3(B.spawns.police.x, T.h + 0.1, B.spawns.police.z), yaw: B.spawns.police.yaw },
      hospital: { position: new THREE.Vector3(B.spawns.hospital.x, T.h + 0.1, B.spawns.hospital.z), yaw: B.spawns.hospital.yaw },
    },
    hooks: {},
    attach(h) { for (const d of inner.doors) d.attach(h); },
    /** Per frame: chunk visibility + interiors/doors. ctx = { focus } */
    update(dt, ctx) {
      const f = ctx.focus;
      for (const c of out.chunks) c.group.visible = Math.hypot(f.x - c.x, f.z - c.z) < HIDE + c.r;
      for (const u of out.updaters) u(dt, ctx);
    },
  };
  for (const ch of chunks.values()) {
    const c = ch.finish(group);
    out.chunks.push(c);
    out.colliders.push(...ch.colliders);
  }
  // Wattle Park out in the suburb.
  if (wattleSite) {
    const w = buildWattlePark(wattleSite, terrain, atlas, rng.fork(5));
    const wg = new THREE.Group();
    wg.name = 'wattle-park';
    wg.add(w.mesh);
    group.add(wg);
    out.chunks.push({ group: wg, x: w.centre.x, z: w.centre.z, r: 30 });
    out.colliders.push(...w.colliders);
    out.trunks.push(...w.trunks);
    out.benches.push(...w.benches);
    out.wattle = w;
    out.places.push({ kind: 'park', x: w.centre.x, z: w.centre.z, label: 'Wattle Park' });
  }
  group.add(atlas.mesh());
  // Quick Stop counter: E buys a snack ($20, +25 health). main.js wires hooks.buySnack.
  const q = inner.counters.quickStop;
  out.targets.push({ id: 'quickStopCounter', key: 'E', range: 2.0, position: () => q, label: 'Press E to buy a snack ($20)', action: () => out.hooks.buySnack?.() });
  return out;
}
