// Waypoint + route: A* over the traffic lane graph from the lane point nearest the player to
// the lane point nearest the waypoint (then a straight bit to the pin). Shown ONLY on the maps
// (Phase 6: no world beacon, no on-screen chip). Progress along the route is tracked: the part
// behind you fades out over FADE m and is then dropped. Re-routes every ~2 s if you're >30 m off
// it, clears within 15 m. The waypoint persists in localStorage.
import * as THREE from 'three';
import { injectStyles, UI } from './uiStyle.js';

const KEY = 'gta-waypoint';
export const NAV = { reroute: 30, check: 2, arrive: 15, fade: 60 };

export function createNavigation({ scene, camera, traffic, terrain }) {
  injectStyles();
  const lanes = traffic.graph.lanes;
  const pts = [];
  for (const L of lanes) L.pts.forEach((p, i) => pts.push({ L, i, x: p.x, z: p.z }));
  const nearest = (x, z) => { let b = null, bd = Infinity; for (const p of pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = p; } } return b; };
  const st = { wp: null, route: [], checkT: 0, reroutes: 0, arrived: 0 };

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

  /** Cumulative distance along the route + progress (metres along it nearest to p). */
  function measure() { st.cum = [0]; for (let i = 1; i < st.route.length; i++) st.cum.push(st.cum[i - 1] + Math.hypot(st.route[i].x - st.route[i - 1].x, st.route[i].z - st.route[i - 1].z)); st.progress = 0; }
  function project(p) {
    let best = Infinity, sAt = 0;
    for (let i = 0; i + 1 < st.route.length; i++) {
      const A = st.route[i], B = st.route[i + 1], dx = B.x - A.x, dz = B.z - A.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.z - A.z) * dz) / l2));
      const dd = Math.hypot(A.x + dx * t - p.x, A.z + dz * t - p.z);
      if (dd < best) { best = dd; sAt = st.cum[i] + t * Math.sqrt(l2); }
    }
    return { dist: best, s: sAt };
  }
  const api = {
    st,
    get waypoint() { return st.wp; },
    get route() { return st.route; },
    /** Metres along the route already driven (the maps fade the part behind this). */
    get progress() { return st.progress || 0; },
    /** Cumulative distance per route point. */
    get cum() { return st.cum || []; },
    /** Straight-line metres to the pin. */
    get distance() { return st.dist ?? null; },
    FADE: NAV.fade,
    astar,
    set(x, z, label = null, from = null) {
      st.wp = { x, z, label };
      st.route = from ? astar(from, st.wp) : [];
      measure();
      st.checkT = from ? NAV.check : 0;
      save();
    },
    clear() { st.wp = null; st.route = []; st.cum = []; st.progress = 0; st.dist = null; save(); },
    /** Per frame: p = player position. */
    update(dt, p) {
      if (!st.wp) return;
      const d = Math.hypot(st.wp.x - p.x, st.wp.z - p.z);
      st.dist = d;
      if (d < NAV.arrive) { st.arrived++; api.clear(); return; }
      st.checkT -= dt;
      if (st.checkT <= 0) {
        st.checkT = NAV.check;
        if (!st.route.length || offRoute(p) > NAV.reroute) { st.route = astar(p, st.wp); measure(); st.reroutes++; }
      }
      if (st.route.length > 1) {
        const pr = project(p);
        if (pr.dist < NAV.reroute) st.progress = Math.max(st.progress || 0, pr.s);
        // Drop everything more than FADE m behind (keep one point before the fade zone).
        let k = 0;
        while (k + 2 < st.route.length && st.cum[k + 1] < st.progress - NAV.fade) k++;
        if (k > 0) { st.route = st.route.slice(k); st.cum = st.cum.slice(k); st.trimmed = (st.trimmed || 0) + k; }
      }
    },
    /** Restore a saved waypoint (route is computed on the first update). */
    load() { try { const w = JSON.parse(localStorage.getItem(KEY) || 'null'); if (w && Number.isFinite(w.x)) api.set(w.x, w.z, w.label); } catch { /* ignore */ } },
  };
  return api;
}
