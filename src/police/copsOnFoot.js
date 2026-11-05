// Police officers on foot. A stopped patrol car near the player deploys an officer who
// steps out of the driver's door and walks / runs up to the player (or to the player's car
// door). Officers go back to their car when the player gets away, and can be shot (150 hp:
// down -> fade out after ~5 s). Movement is simple steering on the terrain (no navmesh).
import * as THREE from 'three';
import { createCharacter } from '../player/character.js';
import { roleOutfit } from '../npc/outfits.js';
import { carLocalToWorld } from '../vehicles/exitSpot.js';
import { makeRng } from '../utils/rng.js';

export const OFFICER_HP = 150;
const MAX_OFFICERS = 5, WALK = 2.4, RUN = 5.6, FADE_AFTER = 5, FADE_TIME = 1.2;

export function createCopsOnFoot({ scene, world }) {
  const rng = makeRng(4242);
  const officers = [];
  let nextId = 0;
  const outfits = [0, 1, 2].map((i) => roleOutfit('cop', rng.fork(i + 7)));

  function spawn(car, { x, z, yaw } = {}) {
    if (officers.filter((o) => o.state !== 'dead').length >= MAX_OFFICERS) return null;
    const ch = createCharacter(outfits[nextId % outfits.length], { name: `officer-${nextId}` });
    const door = car ? carLocalToWorld(car, -(car.cfg.W / 2 + 0.7), 0, car.cfg.seat[2]) : { x, z };
    const o = {
      id: nextId++, ch, car, pos: new THREE.Vector3(door.x, world.terrain.getHeight(door.x, door.z), door.z),
      yaw: yaw ?? (car ? Math.atan2(car.fwd.x, car.fwd.z) - Math.PI / 2 : 0), speed: 0,
      state: 'exit', t: 0, hp: OFFICER_HP, goal: null, action: null, gun: null, fadeMat: null, nearT: 0, cutscene: false,
    };
    ch.root.position.copy(o.pos);
    scene.add(ch.root);
    officers.push(o);
    if (car) car.crewOut = (car.crewOut || 0) + 1;
    return o;
  }

  function remove(o) {
    scene.remove(o.ch.root);
    if (o.fadeMat) o.fadeMat.dispose();
    if (o.car && o.state !== 'dead') o.car.crewOut = Math.max(0, (o.car.crewOut || 1) - 1);
    officers.splice(officers.indexOf(o), 1);
  }

  /** Steer toward (x, z) at speed; returns the distance left. */
  function stepToward(o, x, z, speed, dt, stopAt = 0.3) {
    const dx = x - o.pos.x, dz = z - o.pos.z, d = Math.hypot(dx, dz);
    if (d > stopAt) {
      const step = Math.min(d - stopAt * 0.5, speed * dt);
      o.pos.x += (dx / d) * step; o.pos.z += (dz / d) * step;
      o.speed = speed;
      let dy = Math.atan2(dx, dz) - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      o.yaw += dy * Math.min(1, dt * 9);
    } else o.speed = 0;
    o.pos.y += (world.terrain.getHeight(o.pos.x, o.pos.z) - o.pos.y) * Math.min(1, dt * 12);
    return d;
  }

  /** Shot / knocked: hp down; at 0 the officer drops and fades. Returns true if killed. */
  function damage(o, n) {
    if (o.state === 'dead') return false;
    o.hp -= n;
    if (o.hp > 0) return false;
    o.state = 'dead'; o.t = 0; o.action = 'dead';
    if (o.car) o.car.crewOut = Math.max(0, (o.car.crewOut || 1) - 1);
    return true;
  }

  return {
    officers, spawn, remove, damage, stepToward,
    get alive() { return officers.filter((x) => x.state !== 'dead'); },
    clear() { for (const o of [...officers]) remove(o); },
    /**
     * ctx = { target: {x,y,z}, doorTarget: {x,z} | null (player's car door), playerSpeed, standDown }
     * Per-officer goals are set by the police manager (o.goal / o.state).
     */
    update(dt, ctx) {
      for (const o of [...officers]) {
        o.t += dt;
        if (o.cutscene) { o.ch.root.position.copy(o.pos); o.ch.root.rotation.set(0, o.yaw, 0); o.ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: o.action, steer: 0 }); continue; }
        switch (o.state) {
          case 'exit': {
            // Step out beside the car door, then go.
            o.speed = 1.2;
            if (o.t > 0.6) { o.state = 'approach'; o.t = 0; }
            break;
          }
          case 'approach': {
            const g = o.goal || ctx.target;
            const d = Math.hypot(g.x - o.pos.x, g.z - o.pos.z);
            stepToward(o, g.x, g.z, d > 10 ? RUN : WALK, dt, o.goalStop ?? 1.2);
            break;
          }
          case 'hold': { o.speed = 0; const g = ctx.target; let dy = Math.atan2(g.x - o.pos.x, g.z - o.pos.z) - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 6); break; }
          case 'return': {
            if (!o.car || o.car.dead || !o.car.group.visible) { remove(o); continue; }
            const door = carLocalToWorld(o.car, -(o.car.cfg.W / 2 + 0.6), 0, o.car.cfg.seat[2]);
            if (stepToward(o, door.x, door.z, RUN, dt, 0.4) < 0.6) { remove(o); continue; }
            break;
          }
          case 'dead': {
            o.speed = 0;
            if (o.t > FADE_AFTER) {
              // Fade out (own transparent material copy for this one body).
              if (!o.fadeMat) { o.fadeMat = o.ch.mesh.material.clone(); o.fadeMat.transparent = true; o.ch.mesh.material = o.fadeMat; o.ch.mesh.castShadow = false; }
              o.fadeMat.opacity = Math.max(0, 1 - (o.t - FADE_AFTER) / FADE_TIME);
              if (o.t > FADE_AFTER + FADE_TIME) { remove(o); continue; }
            }
            break;
          }
          default: break;
        }
        o.ch.root.position.copy(o.pos);
        o.ch.root.rotation.set(0, o.yaw, 0);
        o.ch.animate({ dt, speed: o.speed, grounded: true, crouch: false, action: o.state === 'dead' ? 'dead' : o.action, steer: 0 });
        o.afterAnimate?.(o, dt);
      }
    },
  };
}
