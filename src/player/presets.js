// Named camera viewpoints (used by ?cam=... for screenshots and the debug camera's
// number keys). All are expressed relative to 62 Grand Terrace so they keep framing
// the hero house even if the layout changes.
import * as THREE from 'three';

export const PRESET_NAMES = ['hero-front', 'hero-34', 'street', 'overview', 'top'];

export function cameraPreset(name, world, spawn) {
  const hero = world.layout.hero;
  const T = world.terrain;
  const f = new THREE.Vector3(hero.fx, 0, hero.fz); // house -> road
  const s = hero.sample;
  const t = new THREE.Vector3(s.tx, 0, s.tz); // along the road
  const H = new THREE.Vector3(hero.x, hero.h, hero.z);
  const at = (v, up) => new THREE.Vector3(v.x, T.getHeight(v.x, v.z) + up, v.z);

  switch (name) {
    case 'top':
      return { position: new THREE.Vector3(0, 520, 0.01), target: new THREE.Vector3(0, 0, 0), noFog: true };
    case 'overview': {
      const p = H.clone().addScaledVector(f, 95).addScaledVector(t, -55);
      p.y = H.y + 62;
      return { position: p, target: H.clone().addScaledVector(f, 10) };
    }
    case 'street': {
      const S = world.network.main.samples;
      const i = Math.max(0, hero.site.i - Math.round(60 / 1.25) * 1);
      const a = S[i];
      const p = at({ x: a.x + a.nx * hero.side * 6.0, z: a.z + a.nz * hero.side * 6.0 }, 1.65);
      return { position: p, target: H.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(f, 4) };
    }
    case 'hero-34': {
      const p = H.clone().addScaledVector(f, 21).addScaledVector(t, 15);
      p.y = T.getHeight(p.x, p.z) + 3.4;
      return { position: p, target: H.clone().add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(t, -1.5) };
    }
    case 'sign': {
      // Close look at the street sign on the corner of Grand Terrace / Banksia Cl.
      const j = world.network.junctions[1];
      const m = j.main.samples[j.mainIndex];
      const sx = m.x + m.tx * (j.branch.halfW + 2.6) + m.nx * j.side * 4.6;
      const sz = m.z + m.tz * (j.branch.halfW + 2.6) + m.nz * j.side * 4.6;
      const p = new THREE.Vector3(sx + m.tx * 6 - m.nx * j.side * 5, m.h + 2.3, sz + m.tz * 6 - m.nz * j.side * 5);
      return { position: p, target: new THREE.Vector3(sx, m.h + 2.6, sz) };
    }
    case 'culdesac': {
      // Standing at the mouth of Banksia Cl's turning circle, looking at the houses around it.
      const pad = world.network.pads[1];
      const p = new THREE.Vector3(pad.x - pad.inX * 16, pad.h + 2.2, pad.z - pad.inZ * 16);
      return { position: p, target: new THREE.Vector3(pad.x + pad.inX * 14, pad.h + 2.5, pad.z + pad.inZ * 14) };
    }
    case 'hero-porch': {
      // Close-up of the entry (good for judging shadow quality and detail).
      const c = Math.cos(hero.rot), sn = Math.sin(hero.rot);
      const L = (lx, ly, lz) => new THREE.Vector3(hero.x + lx * c + lz * sn, hero.h + ly, hero.z - lx * sn + lz * c);
      return { position: L(3.4, 1.9, 11.5), target: L(0.8, 2.1, 5) };
    }
    case 'hero-front': {
      // Standing on the opposite verge, looking straight at 62.
      const p = at({ x: s.x - s.nx * hero.side * 4.6, z: s.z - s.nz * hero.side * 4.6 }, 1.7);
      return { position: p, target: H.clone().add(new THREE.Vector3(0, 2.7, 0)) };
    }
    case 'player':
    default: {
      const p = spawn.position.clone().addScaledVector(f, 2.5);
      p.y += 1.7;
      return { position: p, target: H.clone().add(new THREE.Vector3(0, 2.8, 0)) };
    }
  }
}
