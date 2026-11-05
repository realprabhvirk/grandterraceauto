// Ambient pedestrians: seeded outfits/heights, walking the footpath graph, pausing to look
// around / check a phone / wave at the player, occasional driveway detours, stepping back
// toward the verge when a car comes fast. Arcade-simple: no navmesh, no ragdolls.
// Far NPCs (>120 m) sleep; mid-distance ones animate at a reduced rate.
import * as THREE from 'three';
import { createCharacter } from '../player/character.js';
import { buildFootpaths } from './footpaths.js';
import { randomOutfit, roleOutfit } from './outfits.js';
import { buildDog } from './dog.js';
import { MAT } from '../art/materials.js';
import { boxB, merge, paint } from '../utils/geom.js';
import { G_NPC } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

const COUNT = 10, SLEEP_DIST = 120, NEAR_DIST = 45; // Phase 5: ~60 people in total across all districts
const DEAD_FADE = 5, DEAD_RESPAWN = 30; // shot: lie ~5 s, fade 1.2 s, back ~30 s later (out of sight)
const RADIUS = 0.28, HALF = 0.55;
// Roles: walker, jogger, dogWalker, shopper (bags) walk lines; sitter, picnic, cop, worker,
// paramedic, shopkeeper stay at a spot (and walk back to it after being knocked down).
const UNIFORM = new Set(['cop', 'worker', 'paramedic', 'shopkeeper', 'jogger', 'office', 'vendor', 'lifeguard', 'beach', 'teacher']);
const BAG_COLORS = ['#f4f1e8', '#c8553e', '#3d5f8a', '#e2c25a', '#4f9a55'];

export function createPedestrians({ scene, physics, world, count = COUNT, townCount = 6, downtownCount = 7 }) {
  const rng = makeRng(3131);
  const parkLines = world.town?.parkLines || [];
  const graph = buildFootpaths(world.network, world.layout, world.terrain, [...(world.town?.pedLines || []), ...parkLines]);
  const parkStart = graph.lines.length - parkLines.length;
  const townRng = makeRng(3232);
  const { world: phys, RAPIER } = physics;
  const peds = [];

  const specs = [];
  for (let i = 0; i < count; i++) specs.push({ role: i >= count - 3 ? 'jogger' : i >= count - 6 ? 'dogWalker' : 'walker', area: 'suburb' });
  const townRoles = ['shopper', 'shopper', 'walker', 'shopper', 'shopper', 'walker', 'shopper', 'walker', 'jogger'];
  if (parkStart > graph.suburbLines) for (let i = 0; i < townCount; i++) specs.push({ role: townRoles[i % townRoles.length], area: 'town' });
  if (parkLines.length) specs.push({ role: 'jogger', area: 'park' }, { role: 'dogWalker', area: 'park' });
  // Old town centre lines only for the town shoppers (the grid now also covers downtown / Northgate).
  const oldTown = [];
  for (let k = graph.suburbLines; k < parkStart; k++) { const p = graph.lines[k][0]; if (p.x > 320 && p.x < 612 && p.z > -225 && p.z < 52) oldTown.push(k); }
  // Downtown crowds: office workers with briefcases (lines whose start is east of Station St).
  const dtLines = [];
  for (let k = graph.suburbLines; k < parkStart; k++) if (graph.lines[k][0].x > 612 && graph.lines[k][0].x < 1000) dtLines.push(k);
  if (dtLines.length) for (let i = 0; i < downtownCount; i++) specs.push({ role: i % 4 === 3 ? 'walker' : 'office', area: 'downtown' });
  // Promenade walkers (the beach line runs along z ~60, x > 620).
  const beachLines = [];
  for (let k = graph.suburbLines; k < parkStart; k++) if (graph.lines[k][0].z > 55 && graph.lines[k][0].x > 620) beachLines.push(k);
  // Northgate residents (block loops north of the ring road).
  const ngLines = [];
  for (let k = graph.suburbLines; k < parkStart; k++) if (graph.lines[k][0].z < -250) ngLines.push(k);
  if (ngLines.length) specs.push({ role: 'walker', area: 'north' }, { role: 'dogWalker', area: 'north' }, { role: 'jogger', area: 'north' }, { role: 'walker', area: 'north' });
  if (beachLines.length) specs.push({ role: 'beach', area: 'beach' }, { role: 'jogger', area: 'beach' });
  for (const sp of world.town?.npcSpots || []) specs.push({ role: sp.role, spot: sp });
  const bagGeo = merge([boxB(0.3, 0.32, 0.12, 0, -0.36, 0, '#ffffff'), boxB(0.02, 0.12, 0.02, 0, -0.06, 0, '#3a3a3c')]);

  specs.forEach((spec, i) => {
    const r = spec.area === 'suburb' ? rng : townRng;
    let li = -1, idx = 0, p = spec.spot;
    if (!p) {
      li = spec.area === 'suburb' ? rng.int(0, graph.suburbLines - 1) : spec.area === 'town' ? (oldTown.length ? oldTown[townRng.int(0, oldTown.length - 1)] : townRng.int(graph.suburbLines, parkStart - 1)) : spec.area === 'downtown' ? dtLines[townRng.int(0, dtLines.length - 1)] : spec.area === 'beach' ? beachLines[townRng.int(0, beachLines.length - 1)] : spec.area === 'north' ? ngLines[townRng.int(0, ngLines.length - 1)] : townRng.int(parkStart, graph.lines.length - 1);
      const line = graph.lines[li];
      idx = r.int(1, line.length - 2);
      p = line[idx];
    }
    const ch = createCharacter(UNIFORM.has(spec.role) ? roleOutfit(spec.role, r) : randomOutfit(r), { name: `ped-${i}` });
    const scale = r.range(0.92, 1.08);
    ch.root.scale.setScalar(scale);
    scene.add(ch.root);
    const body = phys.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + HALF + RADIUS, p.z));
    const collider = phys.createCollider(RAPIER.ColliderDesc.capsule(HALF * scale, RADIUS).setCollisionGroups(G_NPC), body);
    const jog = spec.role === 'jogger';
    const ped = {
      id: `ped-${i}`, role: spec.role, home: spec.spot || null, ch, body, collider, scale, flee: 0,
      li, idx, dir: r.chance(0.5) ? 1 : -1,
      pos: new THREE.Vector3(p.x, p.y, p.z), yaw: spec.spot ? spec.spot.yaw : 0,
      speed: jog ? r.range(4.6, 5.3) : r.range(1.05, 1.45), cur: 0,
      state: spec.spot ? 'home' : 'walk', timer: jog ? 1e9 : r.range(4, 12), action: null,
      detour: null, dodge: null, waved: 0, animAcc: 0, frame: i, hp: 100, cower: 0, gone: false,
      rng: r.fork(i + 1),
    };
    if (spec.role === 'shopper') {
      for (const [bone, k] of [['rElbow', 0], ['lElbow', 1]]) {
        if (k && !r.chance(0.6)) continue;
        const bag = new THREE.Mesh(paint(bagGeo.clone(), r.pick(BAG_COLORS), 0.04), MAT.solid);
        ch.bones[bone].add(bag);
      }
    }
    if (spec.role === 'office') {
      const bc = new THREE.Mesh(paint(new THREE.BoxGeometry(0.36, 0.26, 0.09).translate(0, -0.42, 0.02), r.pick(['#3a2a20', '#1f1f22', '#5a3a28']), 0.04), MAT.solid);
      ch.bones.rElbow.add(bc);
    }
    if (spec.role === 'dogWalker') { ped.dog = buildDog(r); scene.add(ped.dog.group, ped.dog.leash); ped.speed *= 0.9; }
    peds.push(ped);
  });
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
  /** Run away from a point (walkers pick the line direction away from it). */
  function fleeFrom(o, from, sec = 8) {
    o.flee = sec; o.action = null; o.fleeFrom = from.clone ? from.clone() : new THREE.Vector3(from.x, from.y || 0, from.z);
    if (o.home) { o.flee = Math.min(sec, 5); o.state = 'home'; return; }
    o.state = 'walk';
    const L = graph.lines[o.li], a = L[Math.min(L.length - 1, o.idx + 1)], b = L[Math.max(0, o.idx - 1)];
    o.dir = Math.hypot(a.x - from.x, a.z - from.z) > Math.hypot(b.x - from.x, b.z - from.z) ? 1 : -1;
  }
  /** Gunfire nearby: people within radius cower (some) or run (most). */
  function alarm(pos, radius = 40) {
    for (const o of peds) {
      if (o.state === 'dead' || o.state === 'down' || o.gone) continue;
      if (Math.hypot(o.pos.x - pos.x, o.pos.z - pos.z) > radius) continue;
      if (o.flee > 2 || o.cower > 0) continue;
      if (o.rng.next() < 0.3) { o.cower = 3 + o.rng.next() * 2; o.action = null; }
      else fleeFrom(o, pos);
    }
  }
  /** Shot by the player: hp down; at 0 they drop (no gore) and fade out later. Returns true if killed. */
  function shoot(ped, dmg, from) {
    if (ped.state === 'dead') return false;
    ped.hp -= dmg;
    if (ped.hp > 0) { ped.cower = 0; fleeFrom(ped, from); alarm(ped.pos, 25); return false; }
    ped.state = 'dead'; ped.downT = 0; ped.dodge = null; ped.action = null; ped.cower = 0; ped.flee = 0;
    ped.collider.setEnabled(false);
    alarm(ped.pos, 30);
    return true;
  }
  function revive(ped) {
    ped.hp = 100; ped.gone = false; ped.state = ped.home ? 'home' : 'walk'; ped.downT = 0;
    if (ped.fadeMat) { ped.ch.mesh.material = MAT.solid; ped.fadeMat.dispose(); ped.fadeMat = null; ped.ch.mesh.castShadow = true; }
    if (ped.home) ped.pos.set(ped.home.x, ped.home.y, ped.home.z);
    else { const L = graph.lines[ped.li]; ped.idx = ped.rng.int(1, L.length - 2); const p = L[ped.idx]; ped.pos.set(p.x, p.y, p.z); }
    ped.collider.setEnabled(true);
    ped.ch.root.rotation.set(0, ped.yaw, 0);
  }
  function knockDown(ped, car) {
    ped.state = 'down'; ped.downT = 0; ped.dodge = null; ped.action = null;
    ped.yaw = Math.atan2(-car.fx * Math.sign(car.speed), -car.fz * Math.sign(car.speed)); // falls away from the car
    ped.collider.setEnabled(false);
    ped.pos.x += car.fx * Math.sign(car.speed) * 1.2; ped.pos.z += car.fz * Math.sign(car.speed) * 1.2;
    // Everyone nearby runs off for ~8 s.
    for (const o of peds) if (o !== ped && o.state !== 'down' && o.state !== 'dead' && o.pos.distanceTo(ped.pos) < 25) { o.flee = 8; o.action = null; o.fleeFrom = ped.pos.clone();
      if (o.home) { o.flee = 5; o.state = 'home'; continue; }
      o.state = 'walk';
      const L = graph.lines[o.li], a = L[Math.min(L.length - 1, o.idx + 1)], b = L[Math.max(0, o.idx - 1)];
      o.dir = Math.hypot(a.x - ped.pos.x, a.z - ped.pos.z) > Math.hypot(b.x - ped.pos.x, b.z - ped.pos.z) ? 1 : -1; }
    hitListeners.forEach((f) => f({ ped, car }));
  }

  function update(dt, { focus, player, cars }) {
    for (const ped of peds) {
      const dist = Math.hypot(ped.pos.x - focus.x, ped.pos.z - focus.z);
      const asleep = dist > SLEEP_DIST;
      ped.ch.root.visible = !asleep && !ped.gone;
      if (ped.dog) ped.dog.group.visible = ped.dog.leash.visible = !asleep;
      if (asleep) continue;

      // --- Shot: drop, lie still ~5 s, fade out; back (somewhere) ~30 s later ----------------
      if (ped.state === 'dead') {
        ped.downT += dt;
        if (ped.downT > DEAD_FADE && !ped.gone) {
          if (!ped.fadeMat) { ped.fadeMat = ped.ch.mesh.material.clone(); ped.fadeMat.transparent = true; ped.ch.mesh.material = ped.fadeMat; ped.ch.mesh.castShadow = false; }
          ped.fadeMat.opacity = Math.max(0, 1 - (ped.downT - DEAD_FADE) / 1.2);
          if (ped.downT > DEAD_FADE + 1.2) { ped.gone = true; ped.ch.root.visible = false; if (ped.dog) ped.dog.group.visible = ped.dog.leash.visible = false; }
        }
        if (ped.gone && ped.downT > DEAD_RESPAWN && dist > 50) revive(ped);
        if (!ped.gone) finishPed(ped, dt, dist, 0, 'dead');
        continue;
      }
      if (ped.cower > 0) { ped.cower -= dt; finishPed(ped, dt, dist, 0, 'cower'); continue; }
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
        if (ped.downT > 4.6) { ped.state = ped.home ? 'home' : 'walk'; ped.ch.root.rotation.set(0, ped.yaw, 0); ped.collider.setEnabled(true); }
        continue;
      }
      if (ped.flee > 0) ped.flee -= dt;

      // --- Stationary roles: hold the spot (sit / stand / chat); run off when scared, walk back.
      if (ped.home) {
        const h = ped.home;
        let speed = 0, action = null;
        if (ped.flee > 0 && ped.fleeFrom) {
          const ax = ped.pos.x - ped.fleeFrom.x, az = ped.pos.z - ped.fleeFrom.z, al = Math.hypot(ax, az) || 1;
          const tx = ped.pos.x + (ax / al) * 3, tz = ped.pos.z + (az / al) * 3;
          stepToward(ped, tx, world.terrain.getHeight(tx, tz) + 0.05, tz, 3.4, dt);
          speed = ped.cur;
        } else {
          const d = stepToward(ped, h.x, h.y, h.z, 1.3, dt);
          if (d < 0.2) {
            ped.cur = 0; ped.pos.set(h.x, h.y, h.z);
            let dy = h.yaw - ped.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ped.yaw += dy * Math.min(1, dt * 5);
            action = h.action;
          } else speed = ped.cur;
        }
        finishPed(ped, dt, dist, speed, action);
        continue;
      }

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

      finishPed(ped, dt, dist, speed, ped.state === 'pause' ? ped.action : null);
    }
  }

  /** Visuals + collider (+ the dog). Animate every frame up close, every 3rd frame further out. */
  function finishPed(ped, dt, dist, speed, action) {
    ped.ch.root.position.copy(ped.pos);
    ped.ch.root.rotation.y = ped.yaw;
    ped.body.setNextKinematicTranslation({ x: ped.pos.x, y: ped.pos.y + (HALF + RADIUS) * ped.scale, z: ped.pos.z });
    ped.animAcc += dt;
    ped.frame++;
    if (dist < NEAR_DIST || ped.frame % 3 === 0) {
      ped.ch.animate({ dt: ped.animAcc, speed, grounded: true, crouch: false, action, steer: 0 });
      ped.animAcc = 0;
    }
    ped.dog?.update(dt, { x: ped.pos.x, y: ped.pos.y, z: ped.pos.z, yaw: ped.yaw, speed, hand: ped.ch.bones.rElbow, visible: true });
  }

  return {
    peds,
    graph,
    update,
    /** Debug: count awake / waving etc. */
    onHit(f) { hitListeners.push(f); },
    shoot, alarm, revive,
    onScare(f) { scareListeners.push(f); },
    stats() {
      const roles = {};
      for (const p of peds) roles[p.role] = (roles[p.role] || 0) + 1;
      return { roles, total: peds.length, awake: peds.filter((p) => p.ch.root.visible).length, paused: peds.filter((p) => p.state === 'pause').length, down: peds.filter((p) => p.state === 'down').length, fleeing: peds.filter((p) => p.flee > 0).length };
    },
  };
}
