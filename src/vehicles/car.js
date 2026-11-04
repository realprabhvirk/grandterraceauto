// A car = physics (VehicleBody) + visuals (body/glass/light meshes + 4 wheel instances).
import * as THREE from 'three';
import { MAT } from '../art/materials.js';
import { CAR_MAT } from './carMaterials.js';
import { buildCarGeometry } from './carModels.js';
import { VehicleBody } from './vehicleBody.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

export class Car {
  /**
   * @param spawn { type, cfg, paint, hero, x, y, z, yaw }
   * @param wheels { mesh, offset } instanced mesh + first instance index for this car
   */
  constructor(physics, scene, spawn, wheels, opts) {
    this.spawn = spawn;
    this.type = spawn.type;
    this.cfg = spawn.cfg;
    this.hero = !!spawn.hero;
    this.body = new VehicleBody(physics, spawn.cfg, spawn, opts);
    this.wheels = wheels;

    const g = buildCarGeometry(spawn.type, spawn.cfg, spawn.paint, { hero: this.hero });
    this.group = new THREE.Group();
    this.group.name = `car-${spawn.type}`;
    // The body origin sits below the ground by the suspension sag, and physics wheels are
    // 4 cm bigger than the visual tyres: lift the visual body so arches centre on the wheels.
    this.model = new THREE.Group();
    this.model.position.y = 0.04 + 9.81 / (4 * spawn.cfg.stiffness);
    this.group.add(this.model);
    const mk = (geo, mat, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.model.add(m);
      return m;
    };
    this.paintMesh = mk(g.paint, MAT.solid);
    this.glassMesh = mk(g.glass, CAR_MAT.glass, false);
    this.headMesh = mk(g.head, CAR_MAT.headOff, false);
    this.tailMesh = mk(g.tail, CAR_MAT.tailOff, false);
    this.revMesh = mk(g.reverse, CAR_MAT.revOff, false);

    // Soft additive beams in front of the headlights (visible when lights are on).
    const a = g.anchors;
    this.beams = new THREE.Group();
    for (const s of [1, -1]) {
      const cone = new THREE.ConeGeometry(2.2, 11, 12, 1, true);
      cone.translate(0, -5.5, 0);
      cone.rotateX(-Math.PI / 2 - 0.06);
      const m = new THREE.Mesh(cone, CAR_MAT.beam);
      m.position.set(s * a.headX, a.headY, a.headZ);
      m.renderOrder = 5;
      this.beams.add(m);
    }
    this.beams.visible = false;
    this.model.add(this.beams);
    this.anchors = a;
    scene.add(this.group);

    this.lights = false;
    this.driver = null; // set while the player drives
    this.sync();
  }

  get position() { return this.body.position; }

  setLights(on) {
    this.lights = on;
    this.headMesh.material = on ? CAR_MAT.headOn : CAR_MAT.headOff;
    this.beams.visible = on;
  }

  /** Copy physics transform to the meshes + wheels, update light states. */
  sync() {
    const b = this.body.body;
    const t = b.translation(), r = b.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    this.group.updateMatrixWorld(true);
    const st = this.body.state;
    this.tailMesh.material = st.braking || this.body.parked && this.driver ? CAR_MAT.tailBrake : this.lights ? CAR_MAT.tailRun : CAR_MAT.tailOff;
    this.revMesh.material = st.reversing ? CAR_MAT.revOn : CAR_MAT.revOff;

    const cfg = this.cfg;
    for (let i = 0; i < 4; i++) {
      const w = this.body.wheel(i);
      const [cx, cy, cz] = w.conn;
      _p.set(cx, cy - w.susp, cz).applyMatrix4(this.group.matrixWorld); // wheel centre
      const right = cx < 0;
      _q.copy(this.group.quaternion).multiply(_q2.setFromAxisAngle(Y, w.steer));
      if (right) _q.multiply(_q2.setFromAxisAngle(Y, Math.PI));
      _q.multiply(_q2.setFromAxisAngle(X, right ? w.spin : -w.spin));
      _s.set(cfg.wheelW, cfg.wheelR, cfg.wheelR);
      _m.compose(_p, _q, _s);
      this.wheels.mesh.setMatrixAt(this.wheels.offset + i, _m);
    }
    this.wheels.mesh.instanceMatrix.needsUpdate = true;
  }
}
