// Traffic cops (speed enforcement - not hostile while you're not wanted):
//  (a) radar posts: a parked patrol car (lights off) on the verge with an officer holding a radar gun;
//  (b) two patrol cars cruising the motorway / main roads at the limit (they live in the traffic
//      system, flagged trafficCop, and can't be carjacked).
// They catch you only if: over limit + 10, within 60 m, clear line of sight, and inside the
// officer's forward ~120 deg (patrol cars: front or rear arc). Catch = radar gun up / lights flash
// for 2 s + a $200 fine (speeding.js). Never heat, never a chase. While wanted they don't fine
// (the regular police response handles you).
import * as THREE from 'three';
import { RADAR_SPOTS, resolveSpot } from '../city/cameraPlan.js';
import { buildCarGeometry } from '../vehicles/carModels.js';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { createCharacter } from '../player/character.js';
import { roleOutfit } from '../npc/outfits.js';
import { MAT } from '../art/materials.js';
import { paint, merge } from '../utils/geom.js';
import { groups, GROUP } from '../physics/physicsWorld.js';
import { makeRng } from '../utils/rng.js';

export const RADAR = { range: 60, cone: 120, flash: 2 };
const STATIC_ONLY = groups(GROUP.PLAYER, GROUP.STATIC);

export function createTrafficCops({ scene, world, physics, traffic, speeding }) {
  const rng = makeRng(6060);
  const posts = [];
  const cosHalf = Math.cos((RADAR.cone / 2) * Math.PI / 180);
  const cfg = CAR_TYPES.sedan;
  const g = buildCarGeometry('sedan', cfg, '#f1f1ec');
  const carGeo = merge([g.paint.clone(), paint(new THREE.BoxGeometry(1.1, 0.12, 0.3).translate(0, cfg.roof + 0.06, -0.1), '#2a2a2e', 0.02), paint(new THREE.BoxGeometry(cfg.W + 0.02, 0.12, cfg.L * 0.7).translate(0, cfg.belt - 0.15, 0), '#2d4f7c', 0.02)]);
  const RED = new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), BLUE = new THREE.MeshBasicMaterial({ color: '#2a6bff' }), OFF = new THREE.MeshBasicMaterial({ color: '#2a2a2e' });
  for (const spot of RADAR_SPOTS) {
    const s = resolveSpot(world.network.allRoads, spot, 4.5);
    if (!s) continue;
    const y = world.terrain.driveHeight ? world.terrain.driveHeight(s.x, s.z, 50) : world.terrain.getHeight(s.x, s.z);
    // Patrol car parked along the verge (nose with the traffic), officer beside it facing traffic.
    const carG = new THREE.Group();
    const mesh = new THREE.Mesh(carGeo, MAT.solid); mesh.castShadow = true; carG.add(mesh);
    const glass = new THREE.Mesh(g.glass, MAT.glass); carG.add(glass);
    const lamps = [new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.24), OFF), new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.24), OFF)];
    lamps[0].position.set(0.25, cfg.roof + 0.17, -0.1); lamps[1].position.set(-0.25, cfg.roof + 0.17, -0.1); carG.add(...lamps);
    const carX = s.x - s.tx * 4 - s.tz * 0.0, carZ = s.z - s.tz * 4;
    carG.position.set(carX, y + 0.15, carZ); carG.rotation.y = Math.atan2(s.tx, s.tz);
    scene.add(carG);
    const col = physics.world.createCollider(physics.RAPIER.ColliderDesc.cuboid(cfg.W / 2, 0.7, cfg.L / 2).setTranslation(carX, y + 0.85, carZ).setRotation({ x: 0, y: Math.sin(carG.rotation.y / 2), z: 0, w: Math.cos(carG.rotation.y / 2) }));
    physics.tag?.(col, 'traffic cop', spot.id);
    const ch = createCharacter(roleOutfit('cop', rng.fork(posts.length + 3)), { name: `radar-${spot.id}` });
    ch.root.position.set(s.x, y, s.z); ch.root.rotation.y = s.yaw;
    scene.add(ch.root);
    // Radar gun in the right hand.
    const gun = new THREE.Mesh(paint(new THREE.BoxGeometry(0.08, 0.1, 0.22).translate(0, -0.3, 0.08), '#2b2b2e', 0.02), MAT.solid);
    ch.bones.rElbow.add(gun);
    const post = { id: spot.id, x: s.x, y, z: s.z, yaw: s.yaw, ch, lamps, flashT: 0, catches: 0, carG, col, away: false };
    post.catcher = { id: spot.id, kind: 'post', pose: { x: carX, y, z: carZ, yaw: carG.rotation.y },
      hide() { post.away = true; carG.visible = false; col.setEnabled(false); ch.root.visible = false; },
      restore() { post.away = false; carG.visible = true; col.setEnabled(true); ch.root.visible = true; } };
    posts.push(post);
    world.places?.push({ kind: 'radar', x: s.x, z: s.z, label: 'Radar cop' });
  }
  // Two cruising patrol cars in the traffic system.
  const cruisers = traffic.cars.filter((c) => c.trafficCop);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const c of cruisers) c.catcher = { id: c.id, kind: 'cruiser', get pose() { return { x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: Math.atan2(c.fwd.x, c.fwd.z) }; },
    hide() { c.suspended = true; c.group.visible = false; c.body.setEnabled(false); for (let k = 0; k < 4; k++) c.wheels.setMatrixAt(c.wheelOffset + k, ZERO); c.wheels.instanceMatrix.needsUpdate = true; },
    restore() { c.suspended = false; c.group.visible = true; c.body.setEnabled(true); } };
  const hooks = { spot: null }; // set by main.js: pull-over pursuit (Phase 6.1)

  const los = (a, b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d < 0.5) return true;
    const hit = physics.world.castRay(new physics.RAPIER.Ray(a, { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d }), d, true, undefined, STATIC_ONLY);
    return !hit || hit.timeOfImpact > d - 0.8;
  };
  const st = { catches: 0, last: null };
  /** Can catcher at (x, y, z) facing yaw see the player's car (front arc, or both arcs for cars)? */
  function sees(x, y, z, yaw, p, bothArcs) {
    const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
    if (d > RADAR.range) return false;
    const f = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / (d || 1);
    if (!(f > cosHalf || (bothArcs && f < -cosHalf))) return false;
    return los({ x, y: y + 1.5, z }, { x: p.x, y: p.y + 1, z: p.z });
  }
  function caught(catcher, onCatch) {
    const s = speeding.status();
    if (speeding.blocked(s, catcher.id)) return false;
    const ok = hooks.spot ? hooks.spot(catcher) : speeding.tryFine(catcher.id, 'traffic cop');
    if (ok) { st.catches++; st.last = catcher.id; onCatch(); }
    return ok;
  }

  return {
    posts, cruisers, st, sees, hooks,
    update(dt) {
      const s = speeding.status();
      for (const p of posts) {
        p.flashT = Math.max(0, p.flashT - dt);
        // Radar gun up while catching, otherwise relaxed.
        p.ch.animate({ dt, speed: 0, grounded: true, crouch: false, action: p.flashT > 0 ? 'point' : 'look', steer: 0 });
        const on = p.flashT > 0 && Math.floor(p.flashT * 6) % 2 === 0;
        p.lamps[0].material = p.flashT > 0 ? (on ? RED : OFF) : OFF; p.lamps[1].material = p.flashT > 0 ? (on ? OFF : BLUE) : OFF;
        if (!p.away && s && s.over && sees(p.x, p.y, p.z, p.yaw, s.car.position, false)) caught(p.catcher, () => { p.flashT = RADAR.flash; p.catches++; });
      }
      for (const c of cruisers) {
        if (!traffic.cars.includes(c) || c.suspended) continue;
        c.copFlashT = Math.max(0, (c.copFlashT || 0) - dt);
        if (c.emergency) { c.emergency.on = c.copFlashT > 0; c.emergency.update(dt); }
        if (s && s.over && sees(c.pos.x, c.pos.y, c.pos.z, Math.atan2(c.fwd.x, c.fwd.z), s.car.position, true)) caught(c.catcher, () => { c.copFlashT = RADAR.flash; });
      }
    },
  };
}
