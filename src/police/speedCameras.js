// Fixed speed cameras (yellow/grey pole + box, seen from far). A camera checks your speed when
// you pass through its detection zone travelling toward it (the direction it faces). Over the
// limit + 10: white flash, shutter click and a $200 fine (police/speeding.js, 20 s cooldown).
// Not breakable; shown on the full map only.
import * as THREE from 'three';
import { CAMERA_SPOTS, resolveSpot } from '../city/cameraPlan.js';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';

export const CAMERA_ZONE = { ahead: 30, behind: 2, lateral: 9 };

export function createSpeedCameras({ scene, world, physics, controls, speeding, audio }) {
  const cams = CAMERA_SPOTS.map((s) => resolveSpot(world.network.allRoads, s)).filter(Boolean);
  const parts = [];
  for (const c of cams) {
    const y = world.terrain.driveHeight ? world.terrain.driveHeight(c.x, c.z, 50) : world.terrain.getHeight(c.x, c.z);
    c.y = y;
    const m = new THREE.Matrix4().makeRotationY(c.yaw).setPosition(c.x, y, c.z);
    parts.push(paint(new THREE.CylinderGeometry(0.11, 0.13, 4.2, 8).translate(0, 2.1, 0), '#8d9196', 0.03).applyMatrix4(m));
    parts.push(paint(new THREE.BoxGeometry(0.75, 0.6, 0.55).translate(0, 4.3, 0), '#f2c41a', 0.03).applyMatrix4(m));
    parts.push(paint(new THREE.BoxGeometry(0.76, 0.12, 0.56).translate(0, 4.66, 0), '#3a3d42', 0.03).applyMatrix4(m));
    parts.push(paint(new THREE.BoxGeometry(0.34, 0.26, 0.06).translate(0, 4.3, 0.29), '#1c1d20', 0.02).applyMatrix4(m)); // lens window
    parts.push(paint(new THREE.BoxGeometry(0.5, 0.25, 0.04).translate(0, 3.4, 0.0), '#f4f4ee', 0.02).applyMatrix4(m));
    const col = physics.world.createCollider(physics.RAPIER.ColliderDesc.cylinder(2.1, 0.14).setTranslation(c.x, y + 2.1, c.z));
    physics.tag?.(col, 'camera', c.id);
    world.places?.push({ kind: 'camera', x: c.x, z: c.z, label: 'Speed camera' });
  }
  const mesh = new THREE.Mesh(merge(parts), MAT.solid);
  mesh.name = 'speed-cameras'; mesh.castShadow = true;
  scene.add(mesh);
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:#ffffff;opacity:0;pointer-events:none;z-index:13;transition:opacity .15s ease-out';
  document.body.appendChild(flash);
  const st = { flashes: 0, checks: 0, inside: new Set() };

  return {
    cams, st,
    update() {
      const s = speeding.status();
      if (!s) { st.inside.clear(); return; }
      const p = s.car.position, f = s.car.body.forward();
      for (const c of cams) {
        const dx = p.x - c.x, dz = p.z - c.z;
        // In front of the camera (toward the traffic it watches), within the zone, driving toward it.
        const ahead = dx * -c.tx + dz * -c.tz, lat = Math.abs(dx * c.tz - dz * c.tx);
        const inZone = ahead > -CAMERA_ZONE.behind && ahead < CAMERA_ZONE.ahead && lat < CAMERA_ZONE.lateral && f.x * c.tx + f.z * c.tz > 0.5 && Math.abs(p.y - c.y) < 4;
        if (!inZone) { st.inside.delete(c.id); continue; }
        if (st.inside.has(c.id)) continue; // one fine per pass
        st.checks++;
        if (!s.over || world.wanted?.stars) continue; // measured, not speeding (keeps measuring while in the zone)
        st.inside.add(c.id);
        if (speeding.blocked(s, c.id)) continue;
        st.flashes++;
        flash.style.transition = 'none'; flash.style.opacity = '0.85';
        requestAnimationFrame(() => { flash.style.transition = 'opacity .15s ease-out'; flash.style.opacity = '0'; });
        audio.gunClick?.('mag', 1);
        speeding.tryFine(c.id, 'camera');
      }
    },
  };
}
