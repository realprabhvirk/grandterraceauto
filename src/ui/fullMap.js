// Map UI. Tab cycles: hidden -> minimap -> FULL MAP -> hidden (Esc also closes the full map).
// The full map is an ~85% overlay: the pointer lock is released, the game is paused (main.js
// reads `open`), drag pans, wheel / pinch zooms (never the page). It shows roads, district
// labels, every place marker, the player arrow, police cars, the wanted radius, the waypoint
// and its route. Click = set a waypoint (clicking near a marker snaps to it), right-click clears.
// Closing resumes and re-captures the mouse; if the browser refuses, "Click to resume" shows.
import { injectStyles, UI } from './uiStyle.js';
import { drawIcon, sortPlaces, legendHTML, drawRoute, drawLabels, drawStreetNames, ICON } from './mapIcons.js';

export const DISTRICTS = [
  { name: 'GRAND TERRACE', x: 0, z: 30 }, { name: 'TERRACE TOWN CENTRE', x: 470, z: -150 }, { name: 'DOWNTOWN', x: 790, z: -150 },
  { name: 'TERRACE BEACH', x: 810, z: 105 }, { name: 'NORTHGATE', x: 480, z: -430 }, { name: 'INDUSTRIAL ESTATE', x: 835, z: -430 },
];

export function createMapUI({ world, minimap, nav, input, canvas: gameCanvas, getState }) {
  injectStyles();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;background:rgba(20,17,15,.55)';
  const box = document.createElement('div');
  box.className = 'gta-panel';
  box.style.cssText += 'position:absolute;left:7.5vw;top:7.5vh;width:85vw;height:85vh;padding:0;overflow:hidden;pointer-events:auto;touch-action:none;cursor:crosshair';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  const help = document.createElement('div');
  help.style.cssText = `position:absolute;left:12px;bottom:10px;font:${UI.font};color:${UI.text};text-shadow:0 1px 2px #000;pointer-events:none`;
  help.innerHTML = 'Click: set waypoint &nbsp; Right-click: clear &nbsp; Drag: pan &nbsp; Wheel / pinch: zoom &nbsp; <span class="gta-key">Tab</span>/<span class="gta-key">Esc</span>: close';
  const legend = document.createElement('div');
  legend.style.cssText = `position:absolute;right:10px;top:10px;padding:8px 10px;border-radius:6px;background:rgba(36,30,26,.78);font:${UI.font};font-size:12px;color:${UI.text};pointer-events:none`;
  legend.innerHTML = '<div style="font-weight:800;margin-bottom:4px">LEGEND</div>' + legendHTML();
  box.append(cv, help, legend); wrap.append(box); document.body.appendChild(wrap);
  const resume = document.createElement('div');
  resume.className = 'gta-panel';
  resume.style.cssText += 'left:50%;top:60%;transform:translateX(-50%);display:none;font-size:15px';
  resume.textContent = 'Click to resume';
  document.body.appendChild(resume);
  const g = cv.getContext('2d');
  const st = { mode: 1, open: false, cx: 0, cz: 0, scale: 0.6, drag: null, clicks: 0, draws: 0 };

  function size() { const r = cv.getBoundingClientRect(); const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { w, h, r }; }
  const toScreen = (x, z) => { const { w, h } = { w: cv.width, h: cv.height }; return [(x - st.cx) * st.scale + w / 2, (z - st.cz) * st.scale + h / 2]; };
  const toWorld = (sx, sy) => ({ x: (sx - cv.width / 2) / st.scale + st.cx, z: (sy - cv.height / 2) / st.scale + st.cz });

  function draw() {
    if (!st.open) return;
    st.draws++;
    const { w, h } = size(), s = getState();
    g.fillStyle = '#4d6838'; g.fillRect(0, 0, w, h);
    const bg = minimap.bg, bounds = minimap.bounds;
    if (bg) { const [x0, y0] = toScreen(bounds.x0, bounds.z0); g.imageSmoothingEnabled = true; g.drawImage(bg, x0, y0, (bounds.x1 - bounds.x0) * st.scale, (bounds.z1 - bounds.z0) * st.scale); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(Math.max(11, Math.min(18, 14 * st.scale / 0.6)))}px system-ui,sans-serif`;
    for (const d of DISTRICTS) { const [x, y] = toScreen(d.x, d.z); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(d.name, x + 1, y + 1); g.fillStyle = 'rgba(246,238,223,.9)'; g.fillText(d.name, x, y); }
    if (s.stars > 0) { const c = s.lastSeen || s.player, [cx, cy] = toScreen(c.x, c.z); g.strokeStyle = 'rgba(79,123,216,.9)'; g.fillStyle = 'rgba(79,123,216,.14)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, (40 + s.stars * 25) * st.scale, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (nav.route.length > 1) drawRoute(g, nav.route, nav, toScreen, 4);
    g.font = 'bold 12px system-ui,sans-serif';
    st.markers = [];
    for (const pl of sortPlaces(world.places || [])) {
      const [x, y] = toScreen(pl.x, pl.z);
      drawIcon(g, pl.kind, x, y, 9);
      st.markers.push({ kind: pl.kind, label: pl.label, x, y, inView: x >= 0 && y >= 0 && x <= cv.width && y <= cv.height });
    }
    // Street names (major roads always, minor ones once zoomed in), then marker labels (collision-culled).
    st.streetNames = drawStreetNames(g, world.network.allRoads, toScreen, { w, h, scale: st.scale });
    st.labels = drawLabels(g, st.markers.filter((m) => m.inView));
    if (nav.waypoint && nav.distance != null) { const [x, y] = toScreen(nav.waypoint.x, nav.waypoint.z); g.font = 'bold 12px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#241e1a'; const t = nav.distance >= 1000 ? (nav.distance / 1000).toFixed(1) + ' km' : Math.round(nav.distance) + ' m'; g.strokeText(t, x, y - 32); g.fillStyle = '#ffcf4a'; g.fillText(t, x, y - 32); }
    for (const c of s.police) { const [x, y] = toScreen(c.x, c.z); g.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#2a6bff' : '#ff3b2f'; g.fillRect(x - 4, y - 4, 8, 8); }
    if (nav.waypoint) { const [x, y] = toScreen(nav.waypoint.x, nav.waypoint.z); g.fillStyle = '#ffcf4a'; g.strokeStyle = '#241e1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7, y - 16); g.arc(x, y - 18, 7, Math.PI * 0.85, Math.PI * 0.15); g.closePath(); g.fill(); g.stroke(); }
    const [px, py] = toScreen(s.player.x, s.player.z);
    g.save(); g.translate(px, py); g.rotate(-s.heading + Math.PI); g.fillStyle = UI.text; g.strokeStyle = '#241e1a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  function setMode(m) {
    const was = st.open;
    st.mode = m;
    minimap.setVisible(m === 1);
    st.open = m === 2;
    wrap.style.display = st.open ? 'block' : 'none';
    if (st.open && !was) {
      const s = getState(); st.cx = s.player.x; st.cz = s.player.z; st.scale = 0.6; // default zoom every time it opens
      // Legend = the icon types actually on the map.
      st.legendKinds = Object.keys(ICON).filter((k) => (world.places || []).some((p) => p.kind === k));
      legend.innerHTML = '<div style="font-weight:800;margin-bottom:4px">LEGEND</div>' + legendHTML(st.legendKinds);
      input.setLocked(true);
      document.exitPointerLock?.();
      draw();
    } else if (!st.open && was) {
      input.setLocked(false);
      // Re-capture the mouse; browsers may refuse without a click gesture.
      let ok = false;
      try { const p = gameCanvas.requestPointerLock?.(); if (p?.then) p.then(() => { ok = true; }).catch(() => {}); } catch { /* ignore */ }
      setTimeout(() => { if (!ok && document.pointerLockElement !== gameCanvas) resume.style.display = 'block'; }, 250);
    }
  }
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === gameCanvas) resume.style.display = 'none'; });
  gameCanvas.addEventListener('click', () => { resume.style.display = 'none'; });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') { e.preventDefault(); setMode((st.mode + 1) % 3 === 0 ? 0 : st.mode === 0 ? 1 : 2); return; }
    if (st.open && e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); setMode(0); }
  }, true);

  // Pan / zoom / click.
  box.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; st.drag = { x: e.clientX, y: e.clientY, cx: st.cx, cz: st.cz, moved: 0 }; box.setPointerCapture?.(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (!st.drag) return; const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y; st.drag.moved = Math.max(st.drag.moved, Math.hypot(dx, dy)); st.cx = st.drag.cx - dx / st.scale; st.cz = st.drag.cz - dy / st.scale; draw(); });
  box.addEventListener('pointerup', (e) => { if (!st.drag) return; const d = st.drag; st.drag = null; if (d.moved < 5) api.clickAt(e.clientX, e.clientY); });
  box.addEventListener('contextmenu', (e) => { e.preventDefault(); nav.clear(); draw(); });
  box.addEventListener('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, before = toWorld(mx, my);
    const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    st.scale = Math.max(0.12, Math.min(4, st.scale * k));
    const after = toWorld(mx, my); st.cx += before.x - after.x; st.cz += before.z - after.z;
    draw();
  }, { passive: false });

  const api = {
    st,
    get open() { return st.open; },
    get mode() { return st.mode; },
    setMode, toWorld, toScreen, draw,
    /** Set the waypoint for a click at client coordinates (snaps to a marker within 14 px). */
    clickAt(clientX, clientY) {
      const r = cv.getBoundingClientRect(), sx = clientX - r.left, sy = clientY - r.top;
      let target = toWorld(sx, sy), label = null, bd = 14;
      for (const pl of world.places || []) { const [x, y] = toScreen(pl.x, pl.z), d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; target = { x: pl.x, z: pl.z }; label = pl.label; } }
      st.clicks++;
      nav.set(target.x, target.z, label, getState().player);
      draw();
      return target;
    },
    update() { if (st.open) draw(); },
  };
  return api;
}
