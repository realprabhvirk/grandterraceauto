// TERRACE AIRPORT - static part (built with the town districts, see town.js): runway 09/27 with
// centre line, piano-key thresholds, numbers, edge / threshold / approach lights; parallel taxiway
// with connectors + hold bars; apron with gate lines and jet bridges; terminal (exterior), drop-off
// canopy, car park of stealable cars; control tower; 2 hangars; fuel tanks; perimeter fence with a
// service gate; a waving windsock; ground crew, passengers and a gate guard (NPC spots).
// Runway / taxiway / apron are flat meshes on the graded ground: no colliders, you can drive on.
// Moving things (aircraft, tugs, fuel truck, shuttle) live in airportOps.js.
import * as THREE from 'three';
import { frame, makeChunk, createSignAtlas } from '../town/townKit.js';
import { staticCar } from '../town/townBuildings.js';
import { paint, merge } from '../utils/geom.js';
import { MAT } from '../art/materials.js';
import { AP } from './airportPlan.js';

const W = '#f4f1e8', Y = '#e8c23a';

function numberTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d'); g.clearRect(0, 0, 256, 256);
  g.fillStyle = W; g.font = '900 200px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildAirport({ parent, rng }) {
  const out = { chunks: [], colliders: [], places: [], npcSpots: [], updaters: [], propChunks: [], lights: null };
  const y = AP.h, F = frame(0, 0, 0, 1, y); // identity frame: local = world
  const R = AP.rwy, TW = AP.twy, A = AP.apron;
  const chunks = new Map(), chunk = (n) => { if (!chunks.has(n)) chunks.set(n, makeChunk(n)); return chunks.get(n); };
  const atlas = createSignAtlas();

  // ---- Runway (two halves = two chunks for culling) ---------------------------------------------
  const mid = (R.x0 + R.x1) / 2;
  for (const [n, x0, x1] of [['ap-rwy-w', R.x0, mid], ['ap-rwy-e', mid, R.x1]]) {
    const ch = chunk(n);
    ch.box(F, x1 - x0, 0.06, R.halfW * 2, (x0 + x1) / 2, 0.02, R.z, '#3a393e');
    for (let x = x0 + 60; x < x1 - 10; x += 50) if (x > R.x0 + 70 && x < R.x1 - 70) ch.box(F, 30, 0.02, 0.9, x, 0.085, R.z, W); // centre line
    for (const s of [-1, 1]) ch.box(F, x1 - x0, 0.02, 0.6, (x0 + x1) / 2, 0.085, R.z + s * (R.halfW - 1.2), W); // edge lines
  }
  {
    const ch = chunk('ap-rwy-w');
    for (const [xt, dir] of [[R.x0, 1], [R.x1, -1]]) {
      const c2 = xt === R.x0 ? ch : chunk('ap-rwy-e');
      for (let k = -5; k <= 5; k++) if (k) c2.box(F, 30, 0.02, 1.8, xt + dir * 22, 0.085, R.z + k * 3.6 - Math.sign(k) * 0.8, W); // piano keys
      c2.box(F, 1.2, 0.02, R.halfW * 2 - 2, xt + dir * 4, 0.085, R.z, W);                                       // threshold bar
      c2.box(F, 22, 0.02, 1.5, xt + dir * 160, 0.085, R.z - 7, W); c2.box(F, 22, 0.02, 1.5, xt + dir * 160, 0.085, R.z + 7, W); // aiming points
    }
    // Blast pads (chevrons) beyond each end.
    for (const [xt, dir] of [[R.x0, -1], [R.x1, 1]]) chunk(xt === R.x0 ? 'ap-rwy-w' : 'ap-rwy-e').box(F, 30, 0.05, R.halfW * 2, xt + dir * 15, 0.01, R.z, '#4a484e');
  }
  // Runway numbers (flat textured quads): "27" at the east threshold reads for westbound arrivals.
  for (const [txt, x, rot] of [['27', R.x1 - 70, Math.PI / 2], ['09', R.x0 + 70, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshLambertMaterial({ map: numberTex(txt), transparent: true, depthWrite: false }));
    m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, y + 0.1, R.z); m.name = `rwy-${txt}`;
    chunk(x < mid ? 'ap-rwy-w' : 'ap-rwy-e').extra = (chunk(x < mid ? 'ap-rwy-w' : 'ap-rwy-e').extra || []).concat(m);
  }

  // ---- Taxiway + connectors + hold bars ---------------------------------------------------------
  {
    const ch = chunk('ap-twy');
    ch.box(F, TW.x1 - TW.x0, 0.05, TW.halfW * 2, (TW.x0 + TW.x1) / 2, 0.015, TW.z, '#46454b');
    for (let x = TW.x0 + 2; x < TW.x1 - 2; x += 6) ch.box(F, 4, 0.02, 0.3, x, 0.075, TW.z, Y);
    for (const x of AP.connectors) {
      const z0 = R.z + R.halfW - 0.5, z1 = TW.z - TW.halfW + 0.5;
      ch.box(F, 18, 0.05, z1 - z0, x, 0.015, (z0 + z1) / 2, '#46454b');
      ch.box(F, 0.3, 0.02, z1 - z0, x, 0.075, (z0 + z1) / 2, Y);
      for (let k = 0; k < 4; k++) ch.box(F, 16, 0.02, 0.25, x, 0.075, z0 + 8 + k * 0.55, Y); // hold-short bars
    }
  }

  // ---- Apron, gate lines, terminal, jet bridges, drop-off ---------------------------------------
  {
    const ch = chunk('ap-terminal'), Tm = AP.terminal;
    ch.box(F, A.x1 - A.x0, 0.05, A.z1 - A.z0, (A.x0 + A.x1) / 2, 0.012, (A.z0 + A.z1) / 2, '#7c7a7f');
    // Apron link to the taxiway.
    ch.box(F, A.x1 - A.x0, 0.05, 2, (A.x0 + A.x1) / 2, 0.012, A.z0 - 0.5, '#7c7a7f');
    for (const gx of AP.gates) {
      ch.box(F, 0.3, 0.02, A.z1 - A.z0 - 6, gx, 0.07, (A.z0 + A.z1) / 2 - 2, Y); // lead-in line
      ch.box(F, 3, 0.02, 0.3, gx, 0.07, AP.gateNoseZ + 1.5, Y);                 // stop bar
      // Jet bridge: a boxy tunnel from the terminal face to beside the nose, on a support.
      ch.box(F, 3.0, 2.8, 12, gx - 5.5, 3.2, Tm.z0 - 6, '#c9c4b8');
      ch.box(F, 3.2, 0.2, 12.2, gx - 5.5, 6.0, Tm.z0 - 6, '#8d9196');
      ch.block(F, 0.6, 3.2, 0.6, gx - 5.5, 0, Tm.z0 - 11.5, '#5c5f66'); // support beside the nose, clear of the tug lane
    }
    // Terminal: long low hall, glass front (landside) + airside glazing, roof, sign.
    const tx = (Tm.x0 + Tm.x1) / 2, tz = (Tm.z0 + Tm.z1) / 2, tw = Tm.x1 - Tm.x0, td = Tm.z1 - Tm.z0;
    ch.block(F, tw, 9, td, tx, 0, tz, '#d9d4c8');
    ch.box(F, tw + 4, 0.8, td + 4, tx, 9, tz, '#efe9dd');
    for (const z of [Tm.z1 + 0.06, Tm.z0 - 0.06]) for (let x = Tm.x0 + 4; x < Tm.x1 - 2; x += 6) ch.box(F, 5.2, 6.4, 0.1, x + 1, 1.2, z, '#4d6577', { glassy: true });
    ch.box(F, tw - 20, 0.4, 5.5, tx, 4.6, Tm.z1 + 2.6, '#efe9dd');               // drop-off canopy (over the footpath + kerb lane)
    for (let x = Tm.x0 + 12; x <= Tm.x1 - 12; x += 22) ch.block(F, 0.4, 4.6, 0.4, x, 0, Tm.z1 + 2.2, '#8d9196');
    atlas.sign(frame(tx, Tm.z1 + 0.2, 0, 1, y), atlas.row('TERRACE AIRPORT', '#2f6fc0', '#ffffff', 'bold 46px Arial'), 40, 3.2, 0, 10.2, 0);
    atlas.sign(frame(tx, Tm.z0 - 0.2, 0, -1, y), atlas.row('TERRACE AIRPORT  GATES 1-4', '#2f6fc0', '#ffffff', 'bold 40px Arial'), 30, 2.2, 0, 10.0, 0);
    // Car park (stealable cars) west of the terminal.
    const P = AP.carpark;
    ch.box(F, P.x1 - P.x0, 0.05, P.z1 - P.z0, (P.x0 + P.x1) / 2, 0.02, (P.z0 + P.z1) / 2, '#5c5d60');
    const cols = ['#8a4f3a', '#46566b', '#d8d2c4', '#2f4f6b', '#9aa37a', '#5c5f66', '#b98a4a'];
    let n = 0;
    for (let x = P.x0 + 4; x < P.x1 - 3; x += 3.3) {
      ch.box(F, 0.12, 0.02, 5.2, x - 1.65, 0.08, P.z0 + 4, W);
      if ((n++ % 3) !== 1) staticCar(ch, x, P.z0 + 4, Math.PI, ['sedan', 'hatch', 'suv', 'ute'][n % 4], cols[n % cols.length]);
    }
    atlas.sign(frame(P.x0 + 8, P.z1 + 0.5, 0, 1, y), atlas.row('P  AIRPORT PARKING', '#2f6fc0', '#ffffff'), 8, 0.9, 0, 3.0, 0);
    // Passengers at the drop-off, a guard at the service gate.
    out.npcSpots.push({ role: 'shopper', x: tx - 20, y, z: Tm.z1 + 1.6, yaw: Math.PI, action: 'phone' });
    out.npcSpots.push({ role: 'office', x: tx + 14, y, z: Tm.z1 + 1.8, yaw: 0, action: 'look' });
    for (const [gx, a] of [[AP.gates[1] - 8, 'point'], [AP.gates[3] + 9, 'look']]) out.npcSpots.push({ role: 'worker', x: gx, y, z: AP.gateNoseZ - 4, yaw: Math.PI, action: a }); // hi-vis ground crew
    out.npcSpots.push({ role: 'cop', x: AP.fence.gate.x + 6.5, y, z: AP.fence.z + 2.2, yaw: Math.PI, action: 'look' });
  }

  // ---- Control tower, hangars, fuel tanks --------------------------------------------------------
  {
    const ch = chunk('ap-landside'), Tw = AP.tower;
    ch.box(F, 9, 0.6, 9, Tw.x, 0, Tw.z, '#cfc3ab'); // plinth (also gives the chunk its bounds for culling)
    ch.solid.push(paint(new THREE.CylinderGeometry(2.6, 3.4, 30, 12).translate(Tw.x, y + 15, Tw.z), '#d9d4c8', 0.02));
    ch.solid.push(paint(new THREE.CylinderGeometry(6.2, 4.8, 1.2, 12).translate(Tw.x, y + 30.6, Tw.z), '#efe9dd', 0.02));
    ch.glass.push(paint(new THREE.CylinderGeometry(6.4, 5.6, 4, 12).translate(Tw.x, y + 33.2, Tw.z), '#4d6577', 0.02));
    ch.solid.push(paint(new THREE.CylinderGeometry(6.8, 6.6, 0.8, 12).translate(Tw.x, y + 35.6, Tw.z), '#efe9dd', 0.02));
    ch.solid.push(paint(new THREE.CylinderGeometry(0.15, 0.15, 6, 6).translate(Tw.x + 2, y + 39, Tw.z), '#8d9196', 0.02));
    ch.collide(F, 6.4, 36, 6.4, Tw.x, 0, Tw.z);
  }
  {
    const ch = chunk('ap-hangars');
    for (const H of AP.hangars) {
      // Arched roof (half cylinder along z), back wall, side walls; open door side faces the taxiway (-z).
      const w = 60, d = 40;
      ch.solid.push(paint(new THREE.CylinderGeometry(w / 2, w / 2, d, 16, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(1, 0.45, 1).translate(H.x, y + 6, H.z), '#b8bcc0', 0.03));
      ch.block(F, w, 6, 0.4, H.x, 0, H.z + d / 2, '#a8a196');
      for (const s of [-1, 1]) ch.block(F, 0.4, 6, d, H.x + s * w / 2, 0, H.z, '#a8a196');
      ch.box(F, w - 2, 0.04, d - 1, H.x, 0.02, H.z, '#8a8890');
    }
    for (const T of AP.tanks) {
      ch.solid.push(paint(new THREE.CylinderGeometry(8, 8, 10, 16).translate(T.x, y + 5, T.z), '#e6e2da', 0.02));
      ch.solid.push(paint(new THREE.CylinderGeometry(8.2, 8.2, 0.6, 16).translate(T.x, y + 7, T.z), '#c8322a', 0.02));
      ch.collide(F, 15, 10, 15, T.x, 0, T.z);
    }
  }

  // ---- Perimeter fence (instanced posts, merged mesh panels) + service gate ---------------------
  const posts = [], Fz = AP.fence;
  {
    const ch = chunk('ap-fence'), g = Fz.gate;
    const segs = [[Fz.x0, Fz.north, Fz.x1, Fz.north], [Fz.x0, Fz.north, Fz.x0, Fz.z], [Fz.x1, Fz.north, Fz.x1, Fz.z],
      [Fz.x0, Fz.z, AP.terminal.x0, Fz.z], [AP.terminal.x1, Fz.z, g.x - g.w / 2, Fz.z], [g.x + g.w / 2, Fz.z, Fz.x1, Fz.z]];
    for (const [ax, az, bx, bz] of segs) {
      const len = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, along = Math.abs(bx - ax) > Math.abs(bz - az);
      ch.box(F, along ? len : 0.06, 1.9, along ? 0.06 : len, cx, 0.1, cz, '#7d8186');
      ch.box(F, along ? len : 0.08, 0.08, along ? 0.08 : len, cx, 2.0, cz, '#5c5f66');
      ch.collide(F, along ? len : 0.2, 2.1, along ? 0.2 : len, cx, 0, cz);
      for (let s = 0; s <= len; s += 4) posts.push([ax + (bx - ax) * s / len, az + (bz - az) * s / len]);
    }
    // Gate: two posts, a raised boom, a guard hut.
    ch.block(F, 2.4, 2.6, 2.4, g.x + g.w / 2 + 2.2, 0, Fz.z + 2.2, '#d9d4c8');
    ch.box(F, 0.12, 0.12, g.w, g.x - g.w / 2 + 0.2, 1.1, Fz.z, '#c8322a');
    // Service road from Terminal Dr to the gate.
    ch.box(F, g.w, 0.05, AP.roadZ - Fz.z - 4, g.x, 0.02, (AP.roadZ - 4 + Fz.z) / 2, '#4a484e');
  }
  const postMesh = new THREE.InstancedMesh(paint(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5).translate(0, 1.1, 0), '#5c5f66', 0.02), MAT.solid, posts.length);
  posts.forEach(([x, z], i) => postMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  postMesh.name = 'ap-fence-posts'; postMesh.receiveShadow = true;

  // ---- Lights (one InstancedMesh): runway edge (white), thresholds (green / red), taxiway edge
  // (blue), approach (white, sequenced strobe). Brighter at dusk.
  const L = [];
  for (let x = R.x0; x <= R.x1; x += 60) for (const s of [-1, 1]) L.push({ x, z: R.z + s * (R.halfW + 1), c: '#fff4d6', k: 'edge' });
  for (let k = -5; k <= 5; k++) { L.push({ x: R.x1 + 1.5, z: R.z + k * 4, c: '#3dff7a', k: 'thr' }); L.push({ x: R.x0 - 1.5, z: R.z + k * 4, c: '#ff3b2a', k: 'thr' }); }
  for (let x = TW.x0; x <= TW.x1; x += 40) for (const s of [-1, 1]) L.push({ x, z: TW.z + s * (TW.halfW + 0.8), c: '#3b6bff', k: 'twy' });
  const app = [];
  for (let x = R.x1 + 8; x < 1012; x += 8) { app.push(L.length); L.push({ x, z: R.z, c: '#ffffff', k: 'app' }); }
  for (let x = R.x0 - 40; x > -240; x -= 30) for (const s of [-1, 0, 1]) L.push({ x, z: R.z + s * 6, c: '#fff4d6', k: 'app2' });
  const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.35, 0.5).translate(0, 0.25, 0), lampMat, L.length);
  const col = new THREE.Color();
  L.forEach((l, i) => { lamps.setMatrixAt(i, new THREE.Matrix4().makeTranslation(l.x, y, l.z)); lamps.setColorAt(i, col.set(l.c)); });
  lamps.name = 'ap-lights';
  out.lights = { count: L.length, approach: app.length, lamps };

  // ---- Windsock: pole + cone that swings with the (seeded) gusts --------------------------------
  const sock = new THREE.Group();
  {
    const pole = new THREE.Mesh(paint(new THREE.CylinderGeometry(0.08, 0.1, 7, 6).translate(0, 3.5, 0), '#8d9196', 0.02), MAT.solid);
    const cone = new THREE.Mesh(merge([paint(new THREE.CylinderGeometry(0.55, 0.25, 1.4, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.7), '#ff6a1a', 0.02), paint(new THREE.CylinderGeometry(0.25, 0.12, 1.4, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 2.1), '#f4f1e8', 0.02)]), MAT.solid);
    cone.position.y = 6.8; cone.name = 'windsock';
    sock.add(pole, cone); sock.position.set(R.x1 - 120, y, R.z + R.halfW + 18);
    out.windsock = cone;
  }
  const wind = { dir: 0.9 + rng.next() * 0.4, t: rng.next() * 10 };

  // ---- Finish: chunks + instanced meshes in a group that hides beyond ~600 m --------------------
  const group = new THREE.Group(); group.name = 'airport';
  parent.add(group);
  for (const ch of chunks.values()) {
    const c = ch.finish(group);
    c.r += 340; // town chunks hide beyond ~260 m + r: keep the airport drawn out to ~600 m
    for (const m of ch.extra || []) c.group.add(m);
    out.chunks.push(c);
    out.colliders.push(...ch.colliders);
    if (ch.props.length) out.propChunks.push(ch);
  }
  group.add(postMesh, lamps, sock, atlas.mesh());
  const cx = (AP.site.x0 + AP.site.x1) / 2, cz = (AP.site.z0 + AP.site.z1) / 2;
  const st = { visible: true, blinks: 0 };
  out.st = st;
  let t = 0, lastStep = -1;
  out.updaters.push((dt, ctx) => {
    const f = ctx.focus, dx = Math.max(AP.site.x0 - f.x, 0, f.x - AP.site.x1), dz = Math.max(AP.site.z0 - f.z, 0, f.z - AP.site.z1);
    const vis = Math.hypot(dx, dz) < 600;
    if (vis !== st.visible) { st.visible = vis; postMesh.visible = lamps.visible = sock.visible = vis; }
    if (!vis) return;
    t += dt; wind.t += dt;
    // Night: lamps full bright; day: dimmer.
    lampMat.color.setScalar(0.55 + (ctx.dusk ?? 0) * 0.45);
    // Approach strobe: a light runs toward the threshold twice a second.
    const step = Math.floor(t * 12) % (app.length + 4);
    if (step !== lastStep) {
      lastStep = step; st.blinks++;
      app.forEach((i, k) => lamps.setColorAt(i, col.set(app.length - 1 - k === step ? '#ffffff' : '#3a3a3a')));
      lamps.instanceColor.needsUpdate = true;
    }
    const sockC = out.windsock;
    sockC.rotation.y = wind.dir + Math.sin(wind.t * 0.7) * 0.25 + Math.sin(wind.t * 2.3) * 0.08;
    sockC.rotation.x = 0.25 + Math.sin(wind.t * 1.3) * 0.12; // droops in lulls
  });
  void cx; void cz;
  out.places.push({ kind: 'airport', x: (AP.terminal.x0 + AP.terminal.x1) / 2, z: AP.terminal.z1 + 6, label: 'Airport' });
  return out;
}
