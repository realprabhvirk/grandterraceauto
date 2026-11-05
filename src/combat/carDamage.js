// Per-car damage (player, parked, traffic, police): health 0-100 with visuals.
//   < 70  loose front bumper (tilted trim bar)        < 50  hood popped up, grey smoke
//   < 25  black smoke                                  < 20  flames (emissive cones, no light)
//   0     engine dead, dark wreck; non-hero wrecks despawn after 3 min.
// Works on any car object with { cfg, model, paintMesh, health? } (+ body for Rapier cars).
import * as THREE from 'three';
import { box } from '../utils/geom.js';
import { MAT } from '../art/materials.js';
import { PALETTE } from '../art/palette.js';

const FLAME = new THREE.MeshBasicMaterial({ color: '#ff7a2a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

function ensure(car) {
  if (car.dmg) return car.dmg;
  const c = car.cfg, zf = c.wheelBase / 2 + c.frontOverhang;
  const col = car.paintMesh.geometry.attributes.color;
  const d = car.dmg = { orig: col.array.slice(), shade: 1, smokeT: 0, wreckT: 0, burnT: 0, parts: new THREE.Group(), zf };
  const bumper = new THREE.Mesh(box(c.W - 0.1, 0.12, 0.12, 0, 0, 0, PALETTE.cars.trim), MAT.solid);
  bumper.position.set(0, c.clearance + 0.08, zf + 0.06);
  bumper.rotation.z = 0.22;
  const hood = new THREE.Mesh(box(c.W - 0.3, 0.04, 0.7, 0, 0, 0, '#6a6a68'), MAT.solid);
  hood.position.set(0, c.belt + 0.03, zf - 0.55);
  hood.rotation.x = -0.32;
  const flames = new THREE.Group();
  for (const dx of [-0.25, 0.2]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6).translate(0, 0.3, 0), FLAME);
    f.position.set(dx, c.belt + 0.02, zf - 0.6);
    flames.add(f);
  }
  bumper.visible = hood.visible = flames.visible = false;
  d.parts.add(bumper, hood, flames);
  Object.assign(d, { bumper, hood, flames });
  car.model.add(d.parts);
  return d;
}

/** Damage a car. Returns the health left. */
export function damageCar(car, amount) {
  if (amount <= 0 || car.health <= 0) return car.health ?? 100;
  car.health = Math.max(0, (car.health ?? 100) - amount);
  ensure(car);
  if (car.health <= 0) {
    car.dead = true;
    if (car.body) car.body.dead = true;
  }
  return car.health;
}

/** Repair (respawned hero car). */
export function repairCar(car) {
  car.health = 100; car.dead = false;
  if (car.body) car.body.dead = false;
  if (!car.dmg) return;
  car.paintMesh.geometry.attributes.color.array.set(car.dmg.orig);
  car.paintMesh.geometry.attributes.color.needsUpdate = true;
  car.dmg.shade = 1;
  car.dmg.bumper.visible = car.dmg.hood.visible = car.dmg.flames.visible = false;
  car.dmg.wreckT = 0; car.dmg.burnT = 0;
}

/** Destroyed cars burn for this long (flames + black smoke), then smoulder. */
export const BURN_TIME = 5;

/** Per-frame visuals (smoke/flames/darkening) + wreck timer. */
export function updateCarDamage(car, dt, particles) {
  const h = car.health ?? 100;
  if (h >= 100 || !car.dmg) return;
  const d = car.dmg;
  // Darken panels (only when the band changes - avoids re-uploading every frame).
  const shade = h <= 0 ? 0.32 : Math.round((0.55 + 0.45 * (h / 100)) * 10) / 10;
  if (shade !== d.shade) {
    const col = car.paintMesh.geometry.attributes.color;
    for (let i = 0; i < col.array.length; i++) col.array[i] = d.orig[i] * shade;
    col.needsUpdate = true;
    d.shade = shade;
  }
  d.bumper.visible = h < 70;
  d.hood.visible = h < 50;
  if (h <= 0) d.burnT += dt;
  const burning = h <= 0 && d.burnT < BURN_TIME;
  d.flames.visible = (h > 0 && h < 20) || burning;
  if (burning) d.flames.children.forEach((f) => { f.scale.y = 1.6; });
  if (d.flames.visible) d.flames.children.forEach((f, i) => f.scale.setScalar(0.8 + 0.35 * Math.sin(performance.now() * 0.02 + i * 2)));
  if (h < 50 && (h > 0 || d.burnT < BURN_TIME + 6)) {
    d.smokeT -= dt;
    if (d.smokeT <= 0 && particles) {
      d.smokeT = burning ? 0.06 : h < 25 ? 0.09 : 0.18;
      car.model.updateMatrixWorld(true);
      particles.smoke(new THREE.Vector3(0, car.cfg.belt + 0.1, d.zf - 0.6).applyMatrix4(car.model.matrixWorld), h < 25);
    }
  }
  if (h <= 0) d.wreckT += dt;
}
