// Map icon registry (minimap + full map): one entry per POI type - glyph, colour, legend label and
// label priority (higher wins when two labels collide). The legend is generated from the types
// actually in use. Also shared drawing helpers: icons, labels with collision culling, the route
// (part already driven fades out) and street names along roads.
export const ICON = {
  home: { t: '62', c: '#d86c3d', label: 'House 62', pri: 10 },
  police: { t: 'P', c: '#4f7bd8', label: 'Police station', pri: 9 },
  hospital: { t: 'H', c: '#3d8fd1', label: 'Hospital', pri: 9 },
  guns: { t: '', c: '#9a4fd0', label: 'Gun shop', pri: 9, crosshair: true },
  store: { t: '$', c: '#2f9a6a', label: 'Enterable shop', pri: 7 },
  shop: { t: '$', c: '#5fa84a', label: 'Shops', pri: 4 },
  food: { t: 'E', c: '#e0703a', label: 'Food & drink (enter)', pri: 6 },
  chemist: { t: '+', c: '#3fbf8a', label: 'Chemist (enter)', pri: 6 },
  clothes: { t: 'T', c: '#c05a9a', label: 'Clothes / barber (enter)', pri: 6 },
  petrol: { t: 'F', c: '#c4473a', label: 'Petrol station', pri: 6 },
  park: { t: '*', c: '#7fbf6a', label: 'Parks', pri: 5 },
  landmark: { t: '^', c: '#e2a83a', label: 'Landmarks', pri: 6 },
  beach: { t: '~', c: '#3fa8d0', label: 'Beach', pri: 7 },
  school: { t: 'S', c: '#e08a30', label: 'School', pri: 7 },
  industry: { t: 'I', c: '#9a8a78', label: 'Industrial', pri: 6 },
  camera: { t: 'C', c: '#e2c22a', label: 'Speed camera', pri: 3, fullOnly: true },
  ramp: { t: 'M', c: '#3a8a4a', label: 'Highway on/off ramp', pri: 5 },
};
/** Draw order: low priority first, the gun shop last (on top). */
export const sortPlaces = (places) => [...places].sort((a, b) => (a.kind === 'guns') - (b.kind === 'guns') || (ICON[a.kind]?.pri || 0) - (ICON[b.kind]?.pri || 0));

export function drawIcon(g, kind, x, y, r = 8) {
  const I = ICON[kind] || { t: '?', c: '#ffffff' };
  g.fillStyle = I.c; g.strokeStyle = 'rgba(20,17,15,.75)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, I.crosshair ? r + 1.5 : r, 0, Math.PI * 2); g.fill(); g.stroke();
  if (I.crosshair) {
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.85, y); g.lineTo(x - r * 0.25, y); g.moveTo(x + r * 0.25, y); g.lineTo(x + r * 0.85, y);
    g.moveTo(x, y - r * 0.85); g.lineTo(x, y - r * 0.25); g.moveTo(x, y + r * 0.25); g.lineTo(x, y + r * 0.85); g.stroke();
    return;
  }
  g.fillStyle = kind === 'camera' ? '#1f1f22' : '#fff';
  g.font = `bold ${Math.round(r * 1.35)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(I.t, x, y + 0.5);
}

/** Text with a dark halo. */
export function haloText(g, text, x, y, color = '#f6eedf', font = 'bold 12px system-ui,sans-serif') {
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3.5; g.strokeStyle = 'rgba(20,17,15,.85)'; g.lineJoin = 'round';
  g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
}

/**
 * Labels for markers with collision culling: markers = [{ kind, label, x, y }] in screen space.
 * Returns the labels drawn ([{ label, kind, rect }]).
 */
export function drawLabels(g, markers) {
  const placed = [], out = [];
  g.font = 'bold 12px system-ui,sans-serif';
  const order = [...markers].filter((m) => m.label).sort((a, b) => (ICON[b.kind]?.pri || 0) - (ICON[a.kind]?.pri || 0));
  for (const m of order) {
    const w = g.measureText(m.label).width + 6, h = 15, r = { x0: m.x - w / 2, x1: m.x + w / 2, y0: m.y + 10, y1: m.y + 10 + h };
    if (placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0)) { m.labelHidden = true; continue; }
    placed.push(r); m.labelHidden = false;
    haloText(g, m.label, m.x, m.y + 17, m.kind === 'guns' ? '#e6d2ff' : '#f6eedf');
    out.push({ label: m.label, kind: m.kind, rect: r });
  }
  return out;
}

/** Route polyline: the part already driven (behind nav.progress) fades out over nav.FADE metres. */
export function drawRoute(g, route, nav, toScreen, width = 3) {
  const cum = nav?.cum || [], prog = nav?.progress || 0, fade = nav?.FADE || 60;
  g.lineJoin = g.lineCap = 'round'; g.lineWidth = width;
  for (let i = 0; i + 1 < route.length; i++) {
    const sEnd = cum[i + 1] ?? Infinity;
    const a = sEnd >= prog ? 1 : Math.max(0, 1 - (prog - sEnd) / fade);
    if (a <= 0.01) continue;
    const [x0, y0] = toScreen(route[i].x, route[i].z), [x1, y1] = toScreen(route[i + 1].x, route[i + 1].z);
    g.strokeStyle = `rgba(255,207,74,${a.toFixed(2)})`;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
}

/**
 * Street names along roads (rotated to follow the road, haloed). major: only arterials / highway /
 * the main road. Picks the sample nearest the screen centre-ish for each road; skips collisions.
 */
export function drawStreetNames(g, roads, toScreen, { major = false, w, h, scale = 1, placed = [] } = {}) {
  const drawn = [];
  g.font = 'bold 11px system-ui,sans-serif';
  for (const r of roads) {
    const isMajor = r.highway || r.arterial || r.main || r.linkRoad;
    if (major && !isMajor) continue;
    if (!isMajor && scale < 0.9) continue;      // minor streets appear as you zoom in
    const S = r.samples, name = r.street || r.name;
    if (!S?.length || !name) continue;
    // Candidate: middle sample that is on screen.
    let best = null;
    for (let k = Math.floor(S.length * 0.25); k < S.length * 0.75; k += Math.max(1, Math.floor(S.length / 12))) {
      const [x, y] = toScreen(S[k].x, S[k].z);
      if (x < 30 || y < 20 || x > w - 30 || y > h - 20) continue;
      best = { k, x, y }; break;
    }
    if (!best) continue;
    const s = S[best.k];
    let ang = Math.atan2(s.tz, s.tx);
    if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    const tw = g.measureText(name).width, R = { x0: best.x - tw / 2 - 4, x1: best.x + tw / 2 + 4, y0: best.y - 9, y1: best.y + 9 };
    if (placed.some((p) => R.x0 < p.x1 && R.x1 > p.x0 && R.y0 < p.y1 && R.y1 > p.y0)) continue;
    placed.push(R);
    g.save(); g.translate(best.x, best.y); g.rotate(ang);
    haloText(g, name, 0, 0, isMajor ? '#ffffff' : '#e8e0cc', isMajor ? 'bold 12px system-ui,sans-serif' : '600 11px system-ui,sans-serif');
    g.restore();
    drawn.push(name);
  }
  return drawn;
}

/** Legend HTML for the icon types in use. */
export function legendHTML(kinds = Object.keys(ICON)) {
  return kinds.filter((k) => ICON[k]).map((k) => { const I = ICON[k]; return `<div data-kind="${k}" style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="display:inline-flex;width:16px;height:16px;border-radius:50%;background:${I.c};color:${k === 'camera' ? '#1f1f22' : '#fff'};font:bold 10px system-ui;align-items:center;justify-content:center">${I.crosshair ? '&#8982;' : I.t}</span>${I.label}</div>`; }).join('');
}
