// Combat/damage orchestrator: player health (car impacts, falls, being hit by cars, regen,
// knock-out -> hospital respawn -$200), car damage for every car, breakable props, people
// knocked down by cars. Emits events (pedHit, propBroken, policeDamaged) for the wanted system.
import * as THREE from 'three';
import { damageCar, repairCar, updateCarDamage, BURN_TIME } from './carDamage.js';
import { DAMAGE, impactDamage, propDamage } from './damageConfig.js';

const REGEN_DELAY = 20, REGEN_RATE = 0.5;

export const KO_TIME = 4.5;

export function createCombat({ controls, vehicles, traffic, peds, breakables, particles, audio, wallet, hud, spawns, world, cutscene = null }) {
  const st = { hp: 100, lastHit: -999, t: 0, ko: false, koT: 0, airTop: null, hitCd: 0, burn: null, blocked: 0 };
  /** In (or getting into / out of) any vehicle: the car soaks all damage, never the player. */
  const inVehicle = () => controls.mode === 'drive' || controls.mode === 'enter' || controls.mode === 'exit';
  const listeners = {};
  const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));
  const allCars = () => [...vehicles.cars, ...traffic.cars, ...(world.police ? world.police.cars : [])];
  const heroCar = () => vehicles.cars.find((c) => c.hero);

  function damagePlayer(n, why = '') {
    if (st.ko || n <= 0) return;
    if (inVehicle()) { st.blocked += n; return; }
    st.hp = Math.max(0, st.hp - n);
    st.lastHit = st.t;
    if (st.hp <= 0) knockOut(why);
  }

  function knockOut() {
    st.ko = true; st.koT = 0;
    if (!cutscene) { hud.fade(true); return; }
    // Slow-mo collapse, camera rises + orbits, desaturated: KNOCKED OUT -> hospital.
    const ps = controls.player.state;
    ps.action = 'collapse'; ps.lockT = 99;
    cutscene.play('ko', { dur: KO_TIME, timeScale: 0.3, title: 'KNOCKED OUT', sub: 'Hospital bill  -$200', color: '#ff6a3a', desat: true, focus: () => controls.player.position, startAngle: ps.facing + 2.4, onEnd: respawn });
  }

  function respawn() {
    const sp = spawns.hospital();
    controls.respawnAt(sp.position, sp.yaw);
    wallet.add(-200);
    st.hp = 100; st.ko = false; st.lastHit = st.t;
    controls.player.state.action = null; controls.player.state.lockT = 0;
    hud.fade(false);
    if (!cutscene) hud.message('KNOCKED OUT  -$200', 3);
    restoreHeroCar();
    emit('respawn', { reason: 'ko' });
  }

  /** Wrecked hero car comes back in 62's driveway at the next respawn. */
  function restoreHeroCar() {
    const h = heroCar();
    if (!h || !h.dead) return;
    repairCar(h);
    const s = h.spawn;
    h.body.teleport(s.x, world.terrain.getHeight(s.x, s.z), s.z, s.yaw);
  }

  return {
    get hp() { return st.hp; },
    get ko() { return st.ko; },
    get burning() { return st.burn; },
    get state() { return st; },
    damagePlayer, respawn, restoreHeroCar, damageCar,
    on(e, f) { (listeners[e] = listeners[e] || []).push(f); },
    emit,
    setHp(v) { st.hp = v; },

    update(dt) {
      st.t += dt;
      st.hitCd -= dt;
      if (st.ko) { st.koT += dt; if (!cutscene && st.koT > 1.1) respawn(); return; }
      const mode = controls.mode, active = mode === 'drive' ? controls.car : null;

      // --- Destroyed car: burns ~5 s; F gets out any time, else ejected with a stumble ---------
      if (active && active.dead && (!st.burn || st.burn.car !== active)) {
        st.burn = { car: active, t: active.dmg?.burnT || 0 };
        hud.message('Car on fire - get out!', BURN_TIME, '#ff8a3a');
        emit('carOnFire', { car: active });
      }
      if (st.burn) {
        st.burn.t += dt;
        if (mode !== 'drive' || controls.car !== st.burn.car) st.burn = null;
        else if (st.burn.t >= BURN_TIME) { controls.eject?.(); st.burn = null; }
      }

      // --- Car impacts: every Rapier car (player, parked) -----------------------------------
      // One damage event per collision: open a short window at the first hard impact, take
      // the peak impact speed over it, apply once, then a cooldown (see damageConfig.js).
      for (const c of vehicles.cars) {
        const dv = c.body.impactDv || 0;
        c.body.impactDv = 0;
        const k = c.crash || (c.crash = { open: false, t: 0, peak: 0, cd: 0, events: 0, last: 0, other: null, rel: 0, prev: { x: 0, y: 0, z: 0 } });
        k.cd -= dt;
        if (k.cd > 0 && dv >= DAMAGE.minSpeed * 0.5) k.cd = DAMAGE.cooldown; // still grinding along: same collision
        if (!k.open && k.cd <= 0 && dv >= DAMAGE.minSpeed) {
          k.open = true; k.t = 0; k.peak = 0;
          // Another car right here? Then it's car-vs-car: relative speed, half damage.
          const p = c.position;
          k.other = null; let bd = DAMAGE.carNear;
          for (const o of allCars()) {
            if (o === c || o.impounded) continue;
            const q = o.position || o.pos, d = Math.hypot(q.x - p.x, q.z - p.z);
            if (d < bd) { bd = d; k.other = o; }
          }
          if (k.other) {
            const o = k.other, ov = o.body?.body ? o.body.body.linvel() : { x: o.fwd.x * o.v, y: 0, z: o.fwd.z * o.v };
            k.rel = Math.hypot(k.prev.x - ov.x, k.prev.z - ov.z);
          }
        }
        if (k.open) {
          k.peak = Math.max(k.peak, dv);
          k.t += dt;
          if (k.t >= DAMAGE.window) {
            k.open = false; k.cd = DAMAGE.cooldown; k.events++;
            const carHit = !!k.other, speed = carHit ? Math.max(DAMAGE.minSpeed, Math.min(k.rel || k.peak, k.peak * 2)) : k.peak;
            const dmg = impactDamage(speed, carHit ? DAMAGE.carVsCar : 1);
            k.last = dmg;
            damageCar(c, dmg);
            if (carHit && !k.other.body?.body) { damageCar(k.other, dmg); if (k.other.isPolice && c === active) emit('policeDamaged', { car: k.other }); }
            if (c === active) audio.crash(Math.min(1, (speed - 3) / 18));
          }
        }
        const v = c.body.body.linvel(); k.prev.x = v.x; k.prev.y = v.y; k.prev.z = v.z;
      }

      // --- Breakables: the driven car (and anything else fast) ------------------------------
      for (const c of [...vehicles.cars.filter((v) => Math.abs(v.body.state.speed) > 2)]) {
        const p = c.position, f = c.body.forward();
        const broken = breakables.hitTest({ x: p.x, z: p.z, fx: f.x, fz: f.z, speed: c.body.state.speed, halfLen: c.cfg.L / 2, halfW: c.cfg.W / 2 });
        for (const it of broken) {
          const v = c.body.body.linvel();
          c.body.body.setLinvel({ x: v.x * 0.82, y: v.y, z: v.z * 0.82 }, true); // lose some speed ploughing through
          damageCar(c, propDamage(it.set, c.body.state.speed));
          if (it.set.sparks) particles.sparks(new THREE.Vector3(it.x, it.y + it.set.h * 0.85, it.z));
          audio.snap();
          if (c === active) {
            audio.crash(Math.min(1, it.set.carDamage / 30));
          }
          emit('propBroken', { item: it, byPlayer: c === active, x: it.x, z: it.z });
        }
      }

      // --- On foot: falls and being hit by moving cars -----------------------------------------
      if (mode === 'walk') {
        const pl = controls.player, ps = pl.state, pos = pl.position;
        if (!ps.grounded) st.airTop = Math.max(st.airTop ?? pos.y, pos.y);
        else if (st.airTop != null) { const drop = st.airTop - pos.y; st.airTop = null; if (drop > 4) damagePlayer((drop - 4) * 12, 'fall'); }
        if (st.hitCd <= 0) {
          for (const c of allCars()) {
            const p = c.position, v = c.body?.state ? c.body.state.speed : c.v;
            if (Math.abs(v) < 4) continue;
            const f = c.body?.state ? c.body.forward() : c.fwd;
            const dx = pos.x - p.x, dz = pos.z - p.z;
            const ahead = Math.abs(dx * f.x + dz * f.z), lat = Math.abs(dx * f.z - dz * f.x);
            if (ahead < c.cfg.L / 2 + 0.45 && lat < c.cfg.W / 2 + 0.4 && Math.abs(pos.y - p.y) < 2) {
              damagePlayer(Math.abs(v) * 2.2, 'hit');
              ps.vel.set(f.x * Math.sign(v) * 6, 0, f.z * Math.sign(v) * 6); // knocked back
              st.hitCd = 1;
              audio.crash(0.4);
              break;
            }
          }
        }
      }

      // --- Regen + damage visuals ---------------------------------------------------------------
      if (st.t - st.lastHit > REGEN_DELAY) st.hp = Math.min(100, st.hp + REGEN_RATE * dt);
      for (const c of allCars()) updateCarDamage(c, dt, particles);
      // Non-hero wrecks are towed away (hidden) after 3 minutes.
      for (const c of allCars()) {
        if (c.dead && !c.hero && c.dmg && c.dmg.wreckT > 180 && c.group.visible) {
          c.group.visible = false;
          if (c.body?.colliders) c.body.colliders.forEach((k) => k.setEnabled(false));
        }
      }
    },
  };
}
