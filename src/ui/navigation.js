// Waypoint + route: A* over the traffic lane graph from the lane point nearest the player to
// the lane point nearest the waypoint (then a straight bit to the pin). Re-routes every ~2 s if
// the player is >30 m off the route, clears itself within 15 m. Shows a tall translucent beacon
// in the world and a HUD chip with the distance (pinned to the screen edge when off-screen).
// The waypoint persists in localStorage.
import * as THREE from 'three';
import { injectStyles, UI } from './uiStyle.js';

const KEY = 'gta-waypoint';
export const NAV = { reroute: 30, check: 2, arrive: 15 };

export function createNavigation({ scene, camera, traffic, terrain }) {
  injectStyles();
  const lanes = traffic.graph.lanes;
  const pts = [];
  for (const L of lanes) L.pts.forEach((p, i) => pts.push({ L, i, x: p.x, z: p.z }));
  const nearest = (x, z) => { let b = null, bd = Infinity; for (const p of pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = p; } } return b; };
  const st = { wp: null, route: [], checkT: 0, reroutes: 0, arrived: 0 };

  // Beacon (no shadow, additive, visible from far away).
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 140, 12, 1, true).translate(0, 70, 0), new THREE.MeshBasicMaterial({ color: '#ffcf4a', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  beacon.visible = false; beacon.name = 'waypoint-beacon'; beacon.frustumCulled = false;
  scene.add(beacon);
  const chip = document.createElement('div');
  chip.className = 'gta-panel';
  chip.style.cssText += 'padding:3px 8px;font-size:12px;display:none;transform:translate(-50%,-50%);white-space:nowrap;border:1px solid #ffcf4a';
  document.body.appendChild(chip);

  /** A* over lanes. Returns a polyline [{x,z}] (empty if no route). */
  function astar(from, to) {
    const a = nearest(from.x, from.z), b = nearest(to.x, to.z);
    if (!a || !b) return [];
    if (a.L === b.L && b.i >= a.i) return [...a.L.pts.slice(a.i, b.i + 1).map((p) => ({ x: p.x, z: p.z })), { x: to.x, z: to.z }];
    const goalL = b.L, h = (L) => { const e = L.pts[L.pts.length - 1]; return Math.hypot(e.x - b.x, e.z - b.z); };
    const g = new Map([[a.L.id, 0]]), prev = new Map(), enter = new Map([[a.L.id, a.i]]), open = [{ id: a.L.id, f: h(a.L) }], closed = new Set();
    while (open.length) {
      open.sort((p, q) => p.f - q.f);
      const { id } = open.shift();
      if (closed.has(id)) continue;
      closed.add(id);
      if (id === goalL.id) break;
      const L = lanes[id], from0 = enter.get(id) || 0;
      const edges = [...L.exits.map((e) => ({ lane: e.lane, at: L.pts.length - 1 })), ...L.branches.map((br) => ({ lane: br.lane, at: Math.max(0, L.pts.findIndex((p) => p.s >= br.atS)) }))];
      for (const e of edges) {
        if (e.at < from0) continue; // can't take a turn-off we've already passed
        const seg = (L.pts[e.at].s ?? e.at) - (L.pts[from0].s ?? from0);
        const nd = g.get(id) + Math.max(0.1, seg);
        if (nd < (g.get(e.lane) ?? Infinity)) { g.set(e.lane, nd); prev.set(e.lane, { id, at: e.at }); enter.set(e.lane, 0); open.push({ id: e.lane, f: nd + h(lanes[e.lane]) }); }
      }
    }
    if (!g.has(goalL.id)) return [];
    const seq = [];
    for (let id = goalL.id, guard = 0; guard < 5000; guard++) { const p = prev.get(id); seq.unshift({ id, p }); if (!p) break; id = p.id; }
    const out = [];
    for (let k = 0; k < seq.length; k++) {
      const L = lanes[seq[k].id], s0 = k === 0 ? a.i : 0, s1 = k + 1 < seq.length ? seq[k + 1].p.at : b.i;
      for (let i = s0; i <= Math.min(s1, L.pts.length - 1); i++) out.push({ x: L.pts[i].x, z: L.pts[i].z });
    }
    out.push({ x: to.x, z: to.z });
    return out;
  }

  function offRoute(p) {
    let bd = Infinity;
    for (let i = 0; i + 1 < st.route.length; i++) {
      const a = st.route[i], b = st.route[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
      bd = Math.min(bd, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
    }
    return bd;
  }
  const save = () => { try { if (st.wp) localStorage.setItem(KEY, JSON.stringify(st.wp)); else localStorage.removeItem(KEY); } catch { /* ignore */ } };

  const api = {
    st,
    get waypoint() { return st.wp; },
    get route() { return st.route; },
    astar,
    set(x, z, label = null, from = null) {
      st.wp = { x, z, label };
      beacon.position.set(x, terrain.getHeight(x, z), z);
      beacon.visible = true;
      st.route = from ? astar(from, st.wp) : [];
      st.checkT = from ? NAV.check : 0;
      save();
    },
    clear() { st.wp = null; st.route = []; beacon.visible = false; chip.style.display = 'none'; save(); },
    /** Per frame: p = player position. */
    update(dt, p, hidden = false) {
      if (!st.wp) { chip.style.display = 'none'; return; }
      const d = Math.hypot(st.wp.x - p.x, st.wp.z - p.z);
      if (d < NAV.arrive) { st.arrived++; api.clear(); return; }
      st.checkT -= dt;
      if (st.checkT <= 0) {
        st.checkT = NAV.check;
        if (!st.route.length || offRoute(p) > NAV.reroute) { st.route = astar(p, st.wp); st.reroutes++; }
      }
      beacon.material.opacity = 0.22 + 0.1 * Math.sin(performance.now() * 0.004);
      if (hidden) { chip.style.display = 'none'; return; }
      // HUD chip at the beacon's screen position (clamped to the edges when off-screen / behind).
      const v = new THREE.Vector3(st.wp.x, beacon.position.y + 3, st.wp.z).project(camera);
      let sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      if (v.z > 1) { sx = window.innerWidth - sx; sy = window.innerHeight - 30; }
      const m = 40;
      sx = Math.max(m, Math.min(window.innerWidth - m, sx)); sy = Math.max(m, Math.min(window.innerHeight - m, sy));
      chip.style.left = `${sx}px`; chip.style.top = `${sy}px`;
      chip.style.display = 'block';
      chip.innerHTML = `<span style="color:#ffcf4a">&#9679;</span> ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}${st.wp.label ? ` <span style="color:${UI.dim}">${st.wp.label}</span>` : ''}`;
    },
    /** Restore a saved waypoint (route is computed on the first update). */
    load() { try { const w = JSON.parse(localStorage.getItem(KEY) || 'null'); if (w && Number.isFinite(w.x)) api.set(w.x, w.z, w.label); } catch { /* ignore */ } },
  };
  return api;
}
