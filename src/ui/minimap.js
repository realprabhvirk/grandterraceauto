// Tab-toggled minimap: north-up, centred on the player. Roads are pre-rendered once into an
// offscreen canvas (1 px = 1 m); each redraw (~10 fps) blits a window of it and adds the
// player arrow, police cars (blue), the wanted radius and place markers (62, police, hospital,
// shops). Call refresh() after the road network / places change (e.g. the town is added).
import { UI, injectStyles } from './uiStyle.js';
import { ROAD } from '../world/roadNetwork.js';

const SIZE = 190, METRES = 230; // metres across the minimap
const ICON = { home: ['62', '#d86c3d'], police: ['P', '#4f7bd8'], hospital: ['H', '#3d8fd1'], shop: ['$', '#9fd18b'], park: ['*', '#7fbf6a'] };

export function createMinimap(world) {
  injectStyles();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.className = 'gta-panel';
  canvas.style.cssText += `right:12px;top:84px;padding:0;border-radius:50%;opacity:.95;width:${SIZE}px;height:${SIZE}px`;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  let bg = null, half = 0, visible = true, acc = 0;

  function refresh() {
    let maxR = 300;
    const roads = world.network.allRoads || world.network.roads;
    for (const r of roads) for (const s of r.samples) maxR = Math.max(maxR, Math.abs(s.x) + 40, Math.abs(s.z) + 40);
    half = Math.ceil(maxR);
    bg = document.createElement('canvas');
    bg.width = bg.height = half * 2;
    const b = bg.getContext('2d');
    b.fillStyle = '#5d7a43'; b.fillRect(0, 0, half * 2, half * 2);
    b.lineCap = b.lineJoin = 'round';
    for (const [w, col] of [[ROAD.pathOut * 2, '#b9ad95'], [ROAD.halfW * 2 + 1, '#3e3c42']]) {
      b.strokeStyle = col; b.lineWidth = w;
      for (const r of roads) {
        b.lineWidth = r.town ? (w > 9 ? (r.halfW + 9.3) : r.halfW * 2 + 1) : w;
        b.beginPath();
        r.samples.forEach((s, i) => (i ? b.lineTo(s.x + half, s.z + half) : b.moveTo(s.x + half, s.z + half)));
        b.stroke();
      }
      b.fillStyle = col;
      for (const p of world.network.pads) { b.beginPath(); b.arc(p.x + half, p.z + half, p.r + (w > 9 ? 3 : 0.5), 0, Math.PI * 2); b.fill(); }
    }
    for (const a of world.areas || []) { b.fillStyle = a.color; b.fillRect(a.x0 + half, a.z0 + half, a.x1 - a.x0, a.z1 - a.z0); }
  }
  refresh();
  window.addEventListener('keydown', (e) => { if (e.code === 'Tab') { e.preventDefault(); visible = !visible; canvas.style.display = visible ? 'block' : 'none'; } });

  return {
    refresh,
    get visible() { return visible; },
    toggle() { visible = !visible; canvas.style.display = visible ? 'block' : 'none'; },
    update(dt, { player, heading, police = [], stars = 0, lastSeen = null }) {
      if (!visible) return;
      acc += dt;
      if (acc < 0.1) return;
      acc = 0;
      const k = SIZE / METRES;
      g.save();
      g.clearRect(0, 0, SIZE, SIZE);
      g.beginPath(); g.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#4d6838'; g.fillRect(0, 0, SIZE, SIZE);
      const ox = player.x + half - METRES / 2, oz = player.z + half - METRES / 2;
      g.drawImage(bg, ox, oz, METRES, METRES, 0, 0, SIZE, SIZE);
      const P = (x, z) => [(x - player.x) * k + SIZE / 2, (z - player.z) * k + SIZE / 2];
      if (stars > 0) {
        const c = lastSeen || player, [cx, cz] = P(c.x, c.z);
        g.strokeStyle = 'rgba(79,123,216,.85)'; g.fillStyle = 'rgba(79,123,216,.12)'; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cz, (40 + stars * 25) * k, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      g.font = 'bold 11px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const pl of world.places || []) {
        const [x, z] = P(pl.x, pl.z), [t, col] = ICON[pl.kind] || ['?', '#fff'];
        const r = Math.hypot(x - SIZE / 2, z - SIZE / 2), lim = SIZE / 2 - 9;
        const fx = r > lim ? SIZE / 2 + ((x - SIZE / 2) / r) * lim : x, fz = r > lim ? SIZE / 2 + ((z - SIZE / 2) / r) * lim : z;
        g.fillStyle = col; g.beginPath(); g.arc(fx, fz, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.fillText(t, fx, fz + 0.5);
      }
      for (const c of police) { const [x, z] = P(c.x, c.z); g.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#2a6bff' : '#ff3b2f'; g.fillRect(x - 3, z - 3, 6, 6); }
      // Player arrow (heading: yaw with forward = (sin, cos)).
      g.translate(SIZE / 2, SIZE / 2); g.rotate(-heading + Math.PI);
      g.fillStyle = UI.text; g.strokeStyle = '#241e1a'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
      g.restore();
    },
  };
}
