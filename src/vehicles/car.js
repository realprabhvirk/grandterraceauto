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

    // Headlight wash: a soft additive patch on the road ahead (a cone read as a ghost disc
    // from behind). The real lighting comes from the single headlight SpotLight rig.
    const a = g.anchors;
    this.beams = new THREE.Group();
    const wash = new THREE.PlaneGeometry(4.2, 11).rotateX(-Math.PI / 2).translate(0, 0.08, a.headZ + 6.2);
    const washMesh = new THREE.Mesh(wash, CAR_MAT.beam);
    washMesh.renderOrder = 5;
    this.beams.add(washMesh);
    this.beams.visible = false;
    this.model.add(this.beams);
    this.anchors = a;
    scene.add(this.group);

    this.lights = false;
    this.health = 100;
    this.driver = null; // set while the player drives
    this.sync();
  }

  /** Rendered (interpolated) position - what the camera and the rest of the game see. */
  get position() { return this.renderPos || this.body.position; }

  /** Physics pose before a fixed step (for render interpolation). */
  capturePrev() {
    const t = this.body.body.translation(), r = this.body.body.rotation();
    if (!this.prevPos) { this.prevPos = new THREE.Vector3(); this.prevQuat = new THREE.Quaternion(); }
    this.prevPos.set(t.x, t.y, t.z); this.prevQuat.set(r.x, r.y, r.z, r.w);
    this.hasPrev = true;
  }

  setLights(on) {
    this.lights = on;
    this.headMesh.material = on ? CAR_MAT.headOn : CAR_MAT.headOff;
    this.beams.visible = on;
  }

  /** Copy physics transform to the meshes + wheels, update light states. */
  sync(alpha = 1) {
    const b = this.body.body;
    const t = b.translation(), r = b.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    // Fixed 60 Hz physics, any-rate rendering: blend the last two physics poses so motion is
    // smooth even when a frame runs 0 or 2 physics steps (that stutter read as random shaking).
    if (this.body.snapRender) { this.body.snapRender = false; this.hasPrev = false; }
    if (this.hasPrev && alpha < 1) {
      this.group.position.lerpVectors(this.prevPos, this.group.position, alpha);
      _q.set(r.x, r.y, r.z, r.w);
      this.group.quaternion.copy(this.prevQuat).slerp(_q, alpha);
    }
    if (!this.renderPos) this.renderPos = new THREE.Vector3();
    this.renderPos.copy(this.group.position);
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
