// Weapon HUD: weapon name + magazine / reserve (bottom-right, flashes when low), a centre
// crosshair whose ticks spread with the weapon spread, and a hit-marker tick on hits.
import { injectStyles, UI } from './uiStyle.js';

export function createWeaponHud() {
  injectStyles();
  const box = document.createElement('div');
  box.className = 'gta-panel';
  box.style.cssText += 'right:12px;bottom:12px;text-align:right;min-width:130px;padding:8px 12px;display:none';
  box.innerHTML = `<div data-k="name" style="color:${UI.dim};font-size:11px;letter-spacing:.08em;text-transform:uppercase"></div>
    <div><span data-k="mag" style="font:800 26px system-ui,sans-serif"></span><span data-k="res" style="font:600 15px system-ui,sans-serif;color:${UI.dim}"></span></div>
    <div data-k="note" style="font-size:11px;color:#ffb35a;height:14px"></div>`;
  document.body.appendChild(box);
  const $ = (k) => box.querySelector(`[data-k="${k}"]`);
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:0;height:0;z-index:9;pointer-events:none;display:none';
  const tick = (rot) => `<div data-t style="position:absolute;left:-1px;top:-1px;width:2px;height:9px;background:#f6eedf;box-shadow:0 0 2px rgba(0,0,0,.8);transform-origin:1px 1px;transform:rotate(${rot}deg) translateY(6px)"></div>`;
  cross.innerHTML = [0, 90, 180, 270].map(tick).join('') + '<div style="position:absolute;left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%;background:#f6eedf"></div>'
    + `<div data-h style="position:absolute;left:-11px;top:-11px;width:22px;height:22px;opacity:0;transition:opacity .12s">
      <svg width="22" height="22" viewBox="0 0 22 22"><g stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"><path d="M3 3 L8 8 M19 3 L14 8 M3 19 L8 14 M19 19 L14 14"/></g></svg></div>`;
  document.body.appendChild(cross);
  const ticks = [...cross.querySelectorAll('[data-t]')], hm = cross.querySelector('[data-h]');
  let hitT = 0, t = 0, lastSpread = -1;
  const st = { visible: false, crosshair: false, hitMarkers: 0, text: '' };

  return {
    get state() { return st; },
    hit(kill = false) { hitT = kill ? 0.35 : 0.2; st.hitMarkers++; hm.querySelector('g').setAttribute('stroke', kill ? '#ff6a4a' : '#ffffff'); },
    /** s = { visible, crosshair, name, mag, reserve, magSize, reloading, spreadPx, note } */
    update(dt, s) {
      t += dt;
      st.visible = !!s.visible; st.crosshair = !!s.crosshair;
      box.style.display = s.visible ? 'block' : 'none';
      cross.style.display = s.crosshair ? 'block' : 'none';
      if (s.visible) {
        $('name').textContent = s.name;
        $('mag').textContent = s.mag;
        $('res').textContent = ` / ${s.reserve}`;
        const low = s.mag <= Math.ceil(s.magSize * 0.25);
        $('mag').style.color = low && Math.floor(t * 4) % 2 === 0 ? '#ff6a4a' : UI.text;
        $('note').textContent = s.reloading ? 'RELOADING' : s.mag === 0 && s.reserve === 0 ? 'NO AMMO' : low ? 'LOW AMMO  (R)' : '';
        st.text = `${s.name} ${s.mag}/${s.reserve}`;
      }
      if (s.crosshair) {
        const px = Math.round(Math.max(2, s.spreadPx));
        if (px !== lastSpread) { lastSpread = px; ticks.forEach((e, i) => { e.style.transform = `rotate(${i * 90}deg) translateY(${px + 4}px)`; }); }
      }
      hitT = Math.max(0, hitT - dt);
      hm.style.opacity = hitT > 0 ? '1' : '0';
    },
  };
}
