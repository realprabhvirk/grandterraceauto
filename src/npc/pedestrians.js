// Ambient pedestrians: seeded outfits/heights, walking the footpath graph, pausing to look
// around / check a phone / wave at the player, occasional driveway detours, stepping back
// toward the verge when a car comes fast. Arcade-simple: no navmesh, no ragdolls.
// Far NPCs (>120 m) sleep; mid-distance ones animate at a reduced rate.
import * as THREE from 'three';
import { createCharacter } from '../player/character.js';
import { buildFootpaths } from './footpaths.js';
import { randomOutfit } from './outfits.js';
import { G_NPC } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

const COUNT = 20, SLEEP_DIST = 120, NEAR_DIST = 45;
const RADIUS = 0.28, HALF = 0.55;

export function createPedestrians({ scene, physics, world, count = COUNT, townCount = 10 }) {
  const rng = makeRng(3131);
  const graph = buildFootpaths(world.network, world.layout, world.terrain, world.town?.pedLines || []);
  const townRng = makeRng(3232);
  const nTown = graph.lines.length > graph.suburbLines ? townCount : 0;
  const { world: phys, RAPIER } = physics;
  const peds = [];

  for (let i = 0; i < count + nTown; i++) {
    const town = i >= count;
    const li = town ? townRng.int(graph.suburbLines, graph.lines.length - 1) : rng.int(0, graph.suburbLines - 1);
    const line = graph.lines[li];
    const idx = (town ? townRng : rng).int(1, line.length - 2);
    const ch = createCharacter(randomOutfit(rng), { name: `ped-${i}` });
    const scale = rng.range(0.92, 1.08);
    ch.root.scale.setScalar(scale);
    scene.add(ch.root);
    const p = line[idx];
    const body = phys.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + HALF + RADIUS, p.z));
    const collider = phys.createCollider(RAPIER.ColliderDesc.capsule(HALF * scale, RADIUS).setCollisionGroups(G_NPC), body);
    peds.push({
      id: `ped-${i}`, ch, body, collider, scale, flee: 0,
      li, idx, dir: rng.chance(0.5) ? 1 : -1,
      pos: new THREE.Vector3(p.x, p.y, p.z), yaw: 0,
      speed: rng.range(1.05, 1.45), cur: 0,
      state: 'walk', timer: rng.range(4, 12), action: null,
      detour: null, dodge: null, waved: 0, animAcc: 0, frame: i,
      rng: rng.fork(i + 1),
    });
  }

  const target = new THREE.Vector3();
  function lineAt(ped, idx) { return graph.lines[ped.li][idx]; }

  /** At a polyline end: hop onto a linked footpath (crossing the side road) or turn round. */
  function atEnd(ped) {
    const line = graph.lines[ped.li];
    const endName = ped.idx <= 0 ? 'start' : 'end';
    const opts = graph.links[ped.li][endName];
    if (opts.length && ped.rng.chance(0.75)) {
      const o = ped.rng.pick(opts);
      ped.li = o.line;
      ped.idx = o.index;
      const L = graph.lines[o.line].length;
      ped.dir = o.index <= 1 ? 1 : o.index >= L - 2 ? -1 : (ped.rng.chance(0.5) ? 1 : -1);
    } else {
      ped.dir = -ped.dir;
      ped.idx = Math.max(0, Math.min(line.length - 1, ped.idx));
    }
  }

  function stepToward(ped, tx, ty, tz, speed, dt) {
    const dx = tx - ped.pos.x, dz = tz - ped.pos.z;
    const d = Math.hypot(dx, dz);
    ped.cur += (speed - ped.cur) * Math.min(1, dt * 4);
    if (d > 0.05) {
      const step = Math.min(d, ped.cur * dt);
      ped.pos.x += (dx / d) * step;
      ped.pos.z += (dz / d) * step;
      const want = Math.atan2(dx, dz);
      let dy = want - ped.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      ped.yaw += dy * Math.min(1, dt * 8);
    }
    ped.pos.y += (ty - ped.pos.y) * Math.min(1, dt * 10);
    return d;
  }

  function faceToward(ped, x, z, dt) {
    const want = Math.atan2(x - ped.pos.x, z - ped.pos.z);
    let dy = want - ped.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    ped.yaw += dy * Math.min(1, dt * 5);
  }

  const hitListeners = [], scareListeners = [];
  function knockDown(ped, car) {
    ped.state = 'down'; ped.downT = 0; ped.dodge = null; ped.action = null;
    ped.yaw = Math.atan2(-car.fx * Math.sign(car.speed), -car.fz * Math.sign(car.speed)); // falls away from the car
    ped.collider.setEnabled(false);
    ped.pos.x += car.fx * Math.sign(car.speed) * 1.2; ped.pos.z += car.fz * Math.sign(car.speed) * 1.2;
    // Everyone nearby runs off for ~8 s.
    for (const o of peds) if (o !== ped && o.state !== 'down' && o.pos.distanceTo(ped.pos) < 25) { o.flee = 8; o.state = 'walk'; o.action = null; o.fleeFrom = ped.pos.clone();
      const L = graph.lines[o.li], a = L[Math.min(L.length - 1, o.idx + 1)], b = L[Math.max(0, o.idx - 1)];
      o.dir = Math.hypot(a.x - ped.pos.x, a.z - ped.pos.z) > Math.hypot(b.x - ped.pos.x, b.z - ped.pos.z) ? 1 : -1; }
    hitListeners.forEach((f) => f({ ped, car }));
  }

  function update(dt, { focus, player, cars }) {
    for (const ped of peds) {
      const dist = Math.hypot(ped.pos.x - focus.x, ped.pos.z - focus.z);
      const asleep = dist > SLEEP_DIST;
      ped.ch.root.visible = !asleep;
      if (asleep) continue;

      // --- Knocked down by a car: tumble, lie still, stand back up after ~4 s ---------------
      if (ped.state !== 'down') {
        for (const c of cars) {
          if (Math.abs(c.speed) < 3) continue;
          const dx = ped.pos.x - c.x, dz = ped.pos.z - c.z;
          const ahead = Math.abs(dx * c.fx + dz * c.fz), lat = Math.abs(dx * c.fz - dz * c.fx);
          if (ahead < (c.len || 4.5) / 2 + 0.4 && lat < (c.w || 1.8) / 2 + 0.3) { knockDown(ped, c); break; }
        }
      }
      if (ped.state === 'down') {
        ped.downT += dt;
        const k = ped.downT < 0.35 ? ped.downT / 0.35 : ped.downT < 4 ? 1 : Math.max(0, 1 - (ped.downT - 4) / 0.6);
        ped.ch.root.position.copy(ped.pos);
        ped.ch.root.rotation.set(-k * 1.45, ped.yaw, 0);
        ped.ch.root.visible = ped.downT > 0.6 || Math.floor(ped.downT * 12) % 2 === 0; // hurt flash
        ped.ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: null, steer: 0 });
        if (ped.downT > 4.6) { ped.state = 'walk'; ped.ch.root.rotation.set(0, ped.yaw, 0); ped.collider.setEnabled(true); }
        continue;
      }
      if (ped.flee > 0) ped.flee -= dt;

      // --- React to fast cars: step back toward the verge (away from the road) ---------
      const here = lineAt(ped, Math.max(0, Math.min(graph.lines[ped.li].length - 1, ped.idx)));
      if (!ped.dodge) {
        for (const c of cars) {
          const v = c.speed;
          if (Math.abs(v) < 4) continue;
          const dx = ped.pos.x - c.x, dz = ped.pos.z - c.z, d = Math.hypot(dx, dz);
          if (d > 8) continue;
          const closing = (dx * c.fx + dz * c.fz) * Math.sign(v) > 0;
          if (closing) {
            ped.dodge = { x: ped.pos.x + here.ox * 1.7, z: ped.pos.z + here.oz * 1.7, back: { x: ped.pos.x, z: ped.pos.z }, t: 2.2 };
            scareListeners.forEach((f) => f({ ped, car: c }));
            ped.action = null;
            break;
          }
        }
      }

      let speed = 0;
      if (ped.dodge) {
        ped.dodge.t -= dt;
        const tgt = ped.dodge.t > 0.8 ? ped.dodge : ped.dodge.back;
        stepToward(ped, tgt.x, world.terrain.getHeight(tgt.x, tgt.z) + 0.05, tgt.z, 3.2, dt);
        speed = ped.cur;
        if (ped.dodge.t <= 0) ped.dodge = null;
      } else if (ped.state === 'pause') {
        ped.timer -= dt;
        ped.cur += (0 - ped.cur) * Math.min(1, dt * 6);
        // Wave at the player if they're close (once per encounter).
        const pd = player ? Math.hypot(player.x - ped.pos.x, player.z - ped.pos.z) : 99;
        if (pd < 6 && ped.waved <= 0) { ped.action = 'wave'; ped.waved = 12; ped.timer = Math.max(ped.timer, 2.2); }
        if (ped.action === 'wave' && player) faceToward(ped, player.x, player.z, dt);
        if (ped.timer <= 0) { ped.state = ped.detour === 'there' ? 'return' : 'walk'; ped.action = null; ped.timer = ped.rng.range(6, 16); }
      } else if (ped.state === 'detour' || ped.state === 'return') {
        const tgt = ped.state === 'detour' ? ped.detourTarget : lineAt(ped, ped.idx);
        const d = stepToward(ped, tgt.x, tgt.y, tgt.z, ped.speed * 0.9, dt);
        speed = ped.cur;
        if (d < 0.3) {
          if (ped.state === 'detour') { ped.state = 'pause'; ped.detour = 'there'; ped.action = 'look'; ped.timer = ped.rng.range(1.5, 3); }
          else { ped.state = 'walk'; ped.detour = null; }
        }
      } else {
        // --- Walk the polyline -----------------------------------------------------------
        const line = graph.lines[ped.li];
        const nextI = ped.idx + ped.dir;
        if (nextI < 0 || nextI >= line.length) { atEnd(ped); continue; }
        const tgt = line[nextI];
        const d = stepToward(ped, tgt.x, tgt.y, tgt.z, ped.flee > 0 ? 3.4 : ped.speed, dt);
        speed = ped.cur;
        if (d < 0.25) {
          ped.idx = nextI;
          if (tgt.detour && ped.rng.chance(0.12)) { ped.state = 'detour'; ped.detourTarget = tgt.detour; }
        }
        ped.timer -= dt;
        if (ped.timer <= 0 && ped.state === 'walk') {
          ped.state = 'pause';
          ped.timer = ped.rng.range(1.5, 4);
          ped.action = ped.rng.pick(['look', 'phone', null, 'look']);
        }
      }
      ped.waved -= dt;

      // --- Visuals + collider ---------------------------------------------------------------
      ped.ch.root.position.copy(ped.pos);
      ped.ch.root.rotation.y = ped.yaw;
      ped.body.setNextKinematicTranslation({ x: ped.pos.x, y: ped.pos.y + (HALF + RADIUS) * ped.scale, z: ped.pos.z });
      // Animate every frame up close, every 3rd frame further out.
      ped.animAcc += dt;
      ped.frame++;
      if (dist < NEAR_DIST || ped.frame % 3 === 0) {
        ped.ch.animate({ dt: ped.animAcc, speed, grounded: true, crouch: false, action: ped.state === 'pause' ? ped.action : null, steer: 0 });
        ped.animAcc = 0;
      }
    }
  }

  return {
    peds,
    graph,
    update,
    /** Debug: count awake / waving etc. */
    onHit(f) { hitListeners.push(f); },
    onScare(f) { scareListeners.push(f); },
    stats() {
      return { total: peds.length, awake: peds.filter((p) => p.ch.root.visible).length, paused: peds.filter((p) => p.state === 'pause').length, down: peds.filter((p) => p.state === 'down').length, fleeing: peds.filter((p) => p.flee > 0).length };
    },
  };
}
