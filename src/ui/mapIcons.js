// Map marker icons shared by the minimap and the full map. The gun shop gets its own icon
// (a white crosshair in a purple circle - clear of police blue, hospital blue, shop green,
// park green and 62's terracotta) and is always drawn on top.
export const ICON = {
  home: { t: '62', c: '#d86c3d', label: 'House 62' },
  police: { t: 'P', c: '#4f7bd8', label: 'Police station' },
  hospital: { t: 'H', c: '#3d8fd1', label: 'Hospital' },
  guns: { t: '', c: '#9a4fd0', label: 'Gun shop (Barrel & Bolt)', crosshair: true },
  shop: { t: '$', c: '#5fa84a', label: 'Shops' },
  park: { t: '*', c: '#7fbf6a', label: 'Parks' },
  landmark: { t: '^', c: '#e2a83a', label: 'Landmarks' },
  beach: { t: '~', c: '#3fa8d0', label: 'Beach' },
  school: { t: 'S', c: '#e08a30', label: 'School' },
  industry: { t: 'I', c: '#9a8a78', label: 'Industrial' },
};
/** Draw order: everything else first, the gun shop last (on top). */
export const sortPlaces = (places) => [...places].sort((a, b) => (a.kind === 'guns') - (b.kind === 'guns'));

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
  g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * 1.35)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(I.t, x, y + 0.5);
}

/** Legend HTML (full map). */
export function legendHTML() {
  return Object.entries(ICON).map(([, I]) => `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="display:inline-flex;width:16px;height:16px;border-radius:50%;background:${I.c};color:#fff;font:bold 10px system-ui;align-items:center;justify-content:center">${I.crosshair ? '&#8982;' : I.t}</span>${I.label}</div>`).join('');
}
