// Car theft + crime reporting. The hero car is owned; any other car is stolen.
//  - Parked car: hold F 1.2 s; it's a crime only if WITNESSED (a non-police pedestrian within
//    30 m with line of sight, or a police car within 60 m).
//  - Traffic car: carjack (always witnessed) - the driver is pulled out and stumbles away,
//    the traffic car is swapped for a drivable copy you get straight into.
// Also turns combat events (people hit, props broken, police damaged, footpath scares) into heat.
import * as THREE from 'three';
import { createCharacter } from '../player/character.js';
import { randomOutfit } from '../npc/outfits.js';
import { carLocalToWorld } from '../vehicles/exitSpot.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);

export function createTheft({ scene, controls, vehicles, traffic, peds, police, wanted, physics, combat, world }) {
  const rng = makeRng(5150);
  const ejected = [];
  const los = (a, b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d < 0.5) return true;
    const hit = physics.world.castRay(new physics.RAPIER.Ray(a, { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d }), d, true, undefined, STATIC_ONLY);
    return !hit || hit.timeOfImpact > d - 0.6;
  };
  function witnessed(pos) {
    const at = { x: pos.x, y: pos.y + 1, z: pos.z };
    if (police.cars.some((c) => Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < 60)) return true;
    return peds.peds.some((p) => p.ch.root.visible && p.state !== 'down' && Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < 30 && los({ x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z }, at));
  }

  // Witnessed theft: police vehicle +60, ambulance +30, anything else +25.
  controls.hooks.onTheft = (car) => { if (witnessed(car.position)) wanted.add(car.emergency?.kind === 'police' ? 'theftPolice' : car.emergency?.kind === 'ambulance' ? 'theftAmbulance' : 'theft'); };
  controls.hooks.onCarjack = (t) => {
    const p = t.pos, yaw = Math.atan2(t.fwd.x, t.fwd.z);
    const door = carLocalToWorld(t, -(t.cfg.W / 2 + 0.5), 0, t.cfg.seat[2]);
    traffic.removeCar(t);
    const car = vehicles.spawn({ type: t.type, cfg: t.cfg, paint: t.paint || '#8a8f96', x: p.x, z: p.z, yaw });
    if (!car) return;
    car.unlocked = car.stolen = true;
    // The driver is pulled out and stumbles away.
    const ch = createCharacter(randomOutfit(rng), { name: 'ejected' });
    ch.root.position.set(door.x, door.y, door.z);
    ch.root.rotation.y = yaw + Math.PI / 2;
    scene.add(ch.root);
    ejected.push({ ch, t: 0, dir: new THREE.Vector3(-t.fwd.z, 0, t.fwd.x).multiplyScalar(-1) });
    wanted.add('carjack');
    controls.enterCar(car);
  };
  for (const t of traffic.cars) controls.registerTraffic(t, traffic.cars);

  combat.on('pedHit', (e) => { if (e.car?.player) wanted.add('pedHit'); });
  combat.on('propBroken', (e) => { if (e.byPlayer && witnessed({ x: e.x, y: e.item.y, z: e.z })) wanted.add('prop'); });
  combat.on('policeDamaged', () => wanted.add('policeDamage'));
  // Only when the player's car is OFF the road (on a footpath / verge / lawn).
  peds.onScare?.((e) => { if (e.car?.player && !world.network.index.nearest(e.car.x, e.car.z, 4.6)) wanted.add('footpathScare'); });

  return {
    witnessed,
    update(dt, terrain) {
      for (const e of [...ejected]) {
        e.t += dt;
        const r = e.ch.root;
        r.position.addScaledVector(e.dir, dt * (e.t < 1 ? 1.2 : 2.6));
        r.position.y = terrain.getHeight(r.position.x, r.position.z);
        r.rotation.y = Math.atan2(e.dir.x, e.dir.z);
        e.ch.animate({ dt, speed: e.t < 1 ? 1.5 : 4, grounded: true, crouch: false, action: null, steer: 0 });
        if (e.t > 7) { scene.remove(r); ejected.splice(ejected.indexOf(e), 1); }
      }
    },
  };
}
