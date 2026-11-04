// Road meshes generated from the network splines: asphalt ribbons, kerbs (inner face,
// top, outer face), footpaths, cul-de-sac pads with kerb rings. Kerbs and footpaths
// break automatically at junction mouths, cul-de-sac openings and driveway crossovers.
// Everything is merged into a single vertex-coloured mesh (1 draw call).
import * as THREE from 'three';
import { ROAD } from './roadNetwork.js';
import { PALETTE } from '../art/palette.js';
import { MAT } from '../art/materials.js';
import { paint, merge } from '../utils/geom.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();

/** Push a quad (two triangles) into tris, wound so its normal points along `want`. */
function quad(tris, p0, p1, p2, p3, want) {
  _a.subVectors(p1, p0); _b.subVectors(p2, p0); _n.crossVectors(_a, _b);
  if (_n.dot(want) >= 0) { tris.push(p0, p1, p2, p0, p2, p3); }
  else { tris.push(p0, p2, p1, p0, p3, p2); }
}

function trisToGeo(tris, color, jitter) {
  if (!tris.length) return null;
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, color, jitter, Math.floor(pos.length));
}

const UP = new THREE.Vector3(0, 1, 0);
const P = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Ribbon between lateral offsets a and b (signed; + is left), at heights ya/yb above
 * the profile. keep(i, side) can drop individual quads.
 */
function ribbon(tris, samples, a, b, ya, yb, want, keep) {
  for (let i = 0; i < samples.length - 1; i++) {
    if (keep && !keep(i)) continue;
    const s0 = samples[i], s1 = samples[i + 1];
    const p0 = P(s0.x + s0.nx * a, s0.h + ya, s0.z + s0.nz * a);
    const p1 = P(s1.x + s1.nx * a, s1.h + ya, s1.z + s1.nz * a);
    const p2 = P(s1.x + s1.nx * b, s1.h + yb, s1.z + s1.nz * b);
    const p3 = P(s0.x + s0.nx * b, s0.h + yb, s0.z + s0.nz * b);
    let w = want;
    if (w === 'out') w = _n.set(s0.nx * Math.sign(b || a), 0, s0.nz * Math.sign(b || a)).clone();
    else if (w === 'in') w = _n.set(-s0.nx * Math.sign(b || a), 0, -s0.nz * Math.sign(b || a)).clone();
    quad(tris, p0, p1, p2, p3, w);
  }
}

const FILLET_R = 5; // fillet radius at the kerb's road face

/**
 * Local frame of a cul-de-sac mouth. u runs along the approach (toward the pad centre),
 * v across it. Fillet centres sit at (uf, +-vf); the straight kerb ends at u = uf.
 */
function filletFrame(pad) {
  if (pad._fillet) return pad._fillet;
  const vf = ROAD.halfW + FILLET_R, dist = pad.r + FILLET_R;
  const uf = -Math.sqrt(dist * dist - vf * vf);
  pad._fillet = { uf, vf, px: -pad.inZ, pz: pad.inX };
  return pad._fillet;
}

/** Fillet kerbs, footpaths and asphalt infill on both sides of a cul-de-sac mouth. */
function buildFillets(pad, F, index, out, liftBranch) {
  const toW = (u, v) => ({ x: pad.x + u * pad.inX + v * F.px, z: pad.z + u * pad.inZ + v * F.pz });
  const hAt = (w) => {
    const n = index.nearest(w.x, w.z, 20, (r) => r === pad.road);
    return n ? n.sample.h : pad.h;
  };
  const N = 12;
  for (const side of [-1, 1]) {
    const cu = F.uf, cv = side * F.vf; // fillet centre (local)
    const phi0 = -side * Math.PI / 2; // pointing from the centre back to the straight kerb line
    const phi1 = Math.atan2(-cv, -cu); // pointing at the pad centre (tangent with the circle)
    const pt = (phi, r, dy) => {
      const w = toW(cu + Math.cos(phi) * r, cv + Math.sin(phi) * r);
      return P(w.x, hAt(w) + dy, w.z);
    };
    const radial = (phi, sign) => { const w = toW(Math.cos(phi), Math.sin(phi)); const o = toW(0, 0); return P((w.x - o.x) * sign, 0, (w.z - o.z) * sign); };
    // Lateral offset L from the centreline -> radius around the fillet centre.
    const R = (lat) => F.vf - lat;
    const fan = [];
    for (let k = 0; k < N; k++) {
      const a = phi0 + ((phi1 - phi0) * k) / N, b = phi0 + ((phi1 - phi0) * (k + 1)) / N, m = (a + b) / 2;
      const rr = R(ROAD.halfW), ro = R(ROAD.curbOut);
      // Kerb: road face (normal away from the fillet centre), top, back face.
      quad(out.curb, pt(a, rr, liftBranch - 0.04), pt(b, rr, liftBranch - 0.04), pt(b, rr, ROAD.curbH), pt(a, rr, ROAD.curbH), radial(m, 1));
      quad(out.curb, pt(a, rr, ROAD.curbH), pt(b, rr, ROAD.curbH), pt(b, ro, ROAD.curbH), pt(a, ro, ROAD.curbH), UP);
      quad(out.curb, pt(a, ro, ROAD.curbH), pt(b, ro, ROAD.curbH), pt(b, ro, -0.05), pt(a, ro, -0.05), radial(m, -1));
      // Footpath.
      const pi = R(ROAD.pathIn), po = R(ROAD.pathOut);
      quad(out.path, pt(a, pi, 0.05), pt(b, pi, 0.05), pt(b, po, 0.05), pt(a, po, 0.05), UP);
      quad(out.path, pt(a, po, 0.05), pt(b, po, 0.05), pt(b, po, -0.06), pt(a, po, -0.06), radial(m, -1));
      quad(out.path, pt(a, pi, -0.06), pt(b, pi, -0.06), pt(b, pi, 0.05), pt(a, pi, 0.05), radial(m, 1));
      fan.push([a, b]);
    }
    // Asphalt infill: fan from the pad centre to the kerb's road-face arc (sits just under
    // the road ribbon and pad disc, so it only shows in the flare).
    const o = toW(0, 0), oc = P(o.x, pad.h + liftBranch - 0.008, o.z);
    for (const [a, b] of fan) {
      const pa = pt(a, R(ROAD.halfW), liftBranch - 0.008), pb = pt(b, R(ROAD.halfW), liftBranch - 0.008);
      const tri = [oc, pa, pb];
      _a.subVectors(tri[1], tri[0]); _b.subVectors(tri[2], tri[0]); _n.crossVectors(_a, _b);
      if (_n.y < 0) out.asphalt.push(oc, pb, pa); else out.asphalt.push(oc, pa, pb);
    }
  }
}

/**
 * @param network from buildRoadNetwork()
 * @param cuts    [{x, z, r}] driveway crossovers where kerbs/footpaths are removed
 */
export function buildRoads(network, cuts = []) {
  const C = PALETTE.road;
  const asphalt = [], curb = [], path = [];
  const { roads, index } = network;
  const lift = { main: 0.06, branch: 0.05 };

  const inCut = (x, z, extra = 0) => cuts.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + extra);

  for (const road of roads) {
    const S = road.samples;
    const y0 = road.main ? lift.main : lift.branch;
    // Does a point at lateral offset `lat` collide with another road's corridor?
    const blocked = (i, lat, clearOther) => {
      const s = S[i], s1 = S[Math.min(i + 1, S.length - 1)];
      const x = (s.x + s1.x) / 2 + s.nx * lat, z = (s.z + s1.z) / 2 + s.nz * lat;
      // Other roads: only consider their samples that are outside THIS road's asphalt.
      const hit = index.nearest(x, z, clearOther + 0.01, (r, os) => {
        if (r === road) return false;
        const own = index.nearest(os.x, os.z, road.halfW + 0.5, (rr) => rr === road);
        return !own;
      });
      if (hit) return true;
      // Branch roads: suppress kerbs/paths while still inside the main road's corridor.
      if (!road.main) {
        const m = index.nearest(x, z, Math.abs(lat) + 0.2, (r) => r.main);
        if (m) return true;
      }
      // Approaching this road's own cul-de-sac: the fillet + ring take over once the quad
      // starts past the fillet tangent point (u_f along the approach direction).
      if (road.pad) {
        const pd = road.pad, px = s.x + s.nx * lat - pd.x, pz = s.z + s.nz * lat - pd.z;
        if (Math.hypot(px, pz) < 32 && px * pd.inX + pz * pd.inZ > filletFrame(pd).uf) return true;
      }
      return inCut(x, z);
    };

    // Asphalt.
    ribbon(asphalt, S, -road.halfW, road.halfW, y0, y0, UP);

    for (const side of [-1, 1]) {
      const sg = (v) => v * side;
      const curbMask = S.map((_, i) => !blocked(i, sg(ROAD.halfW + ROAD.curbW / 2), road.halfW + ROAD.curbW));
      const pathMask = S.map((_, i) => !blocked(i, sg(ROAD.pathIn + ROAD.pathW / 2), road.main ? road.halfW + ROAD.curbW : ROAD.pathIn));
      const keepCurb = (i) => curbMask[i];
      const keepPath = (i) => pathMask[i];
      const ci = sg(ROAD.halfW), co = sg(ROAD.curbOut);
      ribbon(curb, S, ci, ci, y0 - 0.04, ROAD.curbH, 'in', keepCurb);
      ribbon(curb, S, ci, co, ROAD.curbH, ROAD.curbH, UP, keepCurb);
      ribbon(curb, S, co, co, ROAD.curbH, -0.05, 'out', keepCurb);
      const pi = sg(ROAD.pathIn), po = sg(ROAD.pathOut);
      ribbon(path, S, pi, po, 0.05, 0.05, UP, keepPath);
      ribbon(path, S, po, po, 0.05, -0.06, 'out', keepPath);
      ribbon(path, S, pi, pi, -0.06, 0.05, 'in', keepPath);
    }
  }

  // Cul-de-sac pads: asphalt disc + kerb ring + footpath ring, joined to the straight road
  // by curved fillets (5 m radius, tangent to both the straight kerb and the circle).
  for (const pad of network.pads) {
    const seg = 64, y = pad.h + lift.branch - 0.005;
    const ringPt = (ang, r, dy) => P(pad.x + Math.cos(ang) * r, pad.h + dy, pad.z + Math.sin(ang) * r);
    const F = filletFrame(pad);
    // Ring open inside the wedge spanned by the two fillet centres (the road mouth).
    const open = (ang) => {
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const u = dx * pad.inX + dz * pad.inZ, v = dx * F.px + dz * F.pz;
      return u < 0 && Math.abs(v) * -F.uf < F.vf * -u;
    };
    buildFillets(pad, F, index, { asphalt, curb, path }, lift.branch);
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      asphalt.push(P(pad.x, y, pad.z), ringPt(a1, pad.r, y - pad.h), ringPt(a0, pad.r, y - pad.h));
      const cutHere = inCut(pad.x + Math.cos(am) * (pad.r + 0.15), pad.z + Math.sin(am) * (pad.r + 0.15));
      if (!open(am) && !cutHere) {
        const r0 = pad.r, r1 = pad.r + ROAD.curbW, out = P(Math.cos(am), 0, Math.sin(am));
        quad(curb, ringPt(a0, r0, lift.branch - 0.04), ringPt(a1, r0, lift.branch - 0.04), ringPt(a1, r0, ROAD.curbH), ringPt(a0, r0, ROAD.curbH), out.clone().negate());
        quad(curb, ringPt(a0, r0, ROAD.curbH), ringPt(a1, r0, ROAD.curbH), ringPt(a1, r1, ROAD.curbH), ringPt(a0, r1, ROAD.curbH), UP);
        quad(curb, ringPt(a0, r1, ROAD.curbH), ringPt(a1, r1, ROAD.curbH), ringPt(a1, r1, -0.05), ringPt(a0, r1, -0.05), out);
      }
      const pathCut = inCut(pad.x + Math.cos(am) * (pad.r + 3.2), pad.z + Math.sin(am) * (pad.r + 3.2));
      if (!open(am) && !pathCut) {
        const r0 = pad.r + (ROAD.pathIn - ROAD.halfW), r1 = r0 + ROAD.pathW;
        quad(path, ringPt(a0, r0, 0.05), ringPt(a1, r0, 0.05), ringPt(a1, r1, 0.05), ringPt(a0, r1, 0.05), UP);
        quad(path, ringPt(a0, r1, 0.05), ringPt(a1, r1, 0.05), ringPt(a1, r1, -0.06), ringPt(a0, r1, -0.06), P(Math.cos(am), 0, Math.sin(am)));
      }
    }
  }

  const geo = merge([
    trisToGeo(asphalt, C.asphalt, 0.035),
    trisToGeo(curb, C.curb, 0.03),
    trisToGeo(path, C.footpath, 0.04),
  ]);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, MAT.decal);
  mesh.receiveShadow = true;
  mesh.name = 'roads';
  return mesh;
}
