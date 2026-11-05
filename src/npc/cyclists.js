// Cyclists on the road: ride the traffic lane graph near the kerb (keep left), slow behind
// cars, and get knocked off by a fast car (bike + rider tip over, get up after ~4.5 s and
// ride on). Riders are adults in cycling kit. Far cyclists sleep (hidden, frozen).
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { box, merge, painted } from '../utils/geom.js';
import { createCharacter } from '../player/character.js';
import { roleOutfit } from './outfits.js';
import { sampleLane } from '../traffic/laneGraph.js';
import { makeRng } from '../utils/rng.js';

const SLEEP = 150, KERB = 1.1; // metres further left than the lane centre
const P = {};

function bikeGeometry(color) {
  const wheel = (z) => painted(new THREE.TorusGeometry(0.33, 0.035, 5, 14).rotateY(Math.PI / 2), '#26262a', 0, 0.35, z, 0.02);
  const tube = (len, x, y, z, rx) => painted(new THREE.BoxGeometry(0.04, 0.04, len).rotateX(rx), color, x, y, z, 0.02);
  return merge([
    wheel(0.52), wheel(-0.52),
    tube(0.72, 0, 0.62, 0.05, 0.2), tube(0.62, 0, 0.5, -0.24, -0.9), tube(0.55, 0, 0.42, 0.3, 0.75),
    tube(0.5, 0, 0.36, -0.36, 0), box(0.05, 0.42, 0.05, 0, 0.55, 0.45, color),
    box(0.5, 0.04, 0.04, 0, 0.98, 0.42, '#2b2b2e'), box(0.14, 0.05, 0.24, 0, 0.84, -0.22, '#2b2b2e'),
  ]);
}

export function createCyclists({ scene, traffic, terrain, count = 3 }) {
  const rng = makeRng(8080);
  const lanes = traffic.graph.lanes;
  const roadLanes = lanes.filter((l) => !l.slow && l.len > 60);
  const riders = [];
  for (let i = 0; i < count; i++) {
    // Phase 5: the grid grew (downtown), so two riders start in the old town centre on purpose.
    const oldTown = roadLanes.filter((l) => l.town && l.pts[0].x > 330 && l.pts[0].x < 600);
    const lane = i > 0 && oldTown.length ? oldTown[(i * 7) % oldTown.length] : roadLanes[(i * 11 + 3) % roadLanes.length];
    const group = new THREE.Group();
    group.name = `cyclist-${i}`;
    const bike = new THREE.Mesh(bikeGeometry(rng.pick(['#c8322a', '#2f6fc0', '#3a8a4a', '#e2c25a'])), MAT.solid);
    bike.castShadow = true;
    group.add(bike);
    const ch = createCharacter(roleOutfit('cyclist', rng), { name: `cyclist-rider-${i}` });
    ch.root.position.set(0, 0, -0.16);
    group.add(ch.root);
    scene.add(group);
    riders.push({ id: `cyclist-${i}`, group, bike, ch, lane, s: lane.len * rng.range(0.2, 0.7), v: 5, cruise: rng.range(5, 6.5), rng: rng.fork(i + 1),
      pos: new THREE.Vector3(), yaw: 0, state: 'ride', downT: 0, fx: 0, fz: 1 });
  }

  const hitListeners = [];
  function knock(c, car) {
    c.state = 'down'; c.downT = 0; c.v = 0;
    c.fallSide = Math.sign((c.pos.x - car.x) * car.fz - (c.pos.z - car.z) * car.fx) || 1;
    hitListeners.forEach((f) => f({ ped: c, car, cyclist: true }));
  }

  return {
    riders,
    onHit(f) { hitListeners.push(f); },
    /** For traffic + pedestrians: cyclists are slow movers on the road. */
    movers() { return riders.filter((c) => c.state === 'ride').map((c) => ({ x: c.pos.x, z: c.pos.z, speed: c.v, len: 1.8 })); },
    stats() { return { total: riders.length, riding: riders.filter((c) => c.state === 'ride' && c.group.visible).length, down: riders.filter((c) => c.state === 'down').length }; },
    update(dt, { focus, cars }) {
      for (const c of riders) {
        const asleep = Math.hypot(c.pos.x - focus.x, c.pos.z - focus.z) > SLEEP && c.pos.lengthSq() > 0;
        c.group.visible = !asleep;
        if (asleep) continue;
        if (c.state === 'down') {
          c.downT += dt;
          const k = c.downT < 0.4 ? c.downT / 0.4 : c.downT < 4 ? 1 : Math.max(0, 1 - (c.downT - 4) / 0.5);
          c.group.rotation.set(0, c.yaw, c.fallSide * k * 1.35);
          c.ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: 'cycle', steer: 0 });
          if (c.downT > 4.5) { c.state = 'ride'; c.group.rotation.set(0, c.yaw, 0); }
          continue;
        }
        // Knocked off by a fast car?
        for (const car of cars) {
          if (Math.abs(car.speed) < 3) continue;
          const dx = c.pos.x - car.x, dz = c.pos.z - car.z;
          if (Math.abs(dx * car.fx + dz * car.fz) < (car.len || 4.5) / 2 + 0.5 && Math.abs(dx * car.fz - dz * car.fx) < (car.w || 1.8) / 2 + 0.35) { knock(c, car); break; }
        }
        if (c.state === 'down') continue;
        // Slow down behind cars in the same lane.
        sampleLane(c.lane, c.s, P);
        let target = c.cruise * (c.lane.slow ? 0.7 : 1);
        for (const o of cars) {
          const dx = o.x - P.x, dz = o.z - P.z, ahead = dx * P.tx + dz * P.tz, lat = Math.abs(dx * P.tz - dz * P.tx);
          if (ahead > 0 && ahead < 9 && lat < 2.4) target = Math.min(target, Math.max(0, (ahead - 4) * 0.8));
        }
        c.v += Math.max(-6 * dt, Math.min(1.5 * dt, target - c.v));
        c.s += c.v * dt;
        while (c.s > c.lane.len) {
          const over = c.s - c.lane.len, ex = c.lane.exits;
          let pick = ex[0], r = c.rng.next();
          for (const e of ex) { if (r < e.prob) { pick = e; break; } r -= e.prob; }
          c.lane = lanes[pick.lane]; c.s = pick.s + over;
        }
        sampleLane(c.lane, c.s, P);
        c.pos.set(P.x + P.tz * KERB, 0, P.z - P.tx * KERB);
        c.pos.y = terrain.getHeight(c.pos.x, c.pos.z) + 0.02;
        c.yaw = Math.atan2(P.tx, P.tz); c.fx = P.tx; c.fz = P.tz;
        c.group.position.copy(c.pos);
        c.group.rotation.set(0, c.yaw, 0);
        c.ch.animate({ dt, speed: c.v, grounded: true, crouch: false, action: 'cycle', steer: 0 });
      }
    },
  };
}
