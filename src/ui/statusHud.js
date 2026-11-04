// Status HUD: player health bar (top-left), car health bar (only in a car), wanted stars +
// cash (top-right), big centre messages ("KNOCKED OUT  -$200") and a fade-to-black overlay.
import { injectStyles, UI } from './uiStyle.js';
import { PALETTE } from '../art/palette.js';

export function createStatusHud() {
  injectStyles();
  const left = document.createElement('div');
  left.className = 'gta-panel';
  left.style.cssText += 'left:12px;top:12px;width:190px;padding:8px 10px';
  const bar = (label, color) => `<div style="display:flex;align-items:center;gap:8px;margin:2px 0">
    <span style="width:34px;color:${UI.dim};font-size:11px">${label}</span>
    <div style="flex:1;height:8px;border-radius:4px;background:rgba(246,238,223,.15);overflow:hidden"><div data-b="${label}" style="height:100%;width:100%;background:${color};transition:width .2s"></div></div></div>`;
  left.innerHTML = bar('HP', '#7fbf6a') + `<div data-k="car">${bar('CAR', '#e0b03c')}</div>`;
  document.body.appendChild(left);
  const right = document.createElement('div');
  right.className = 'gta-panel';
  right.style.cssText += 'right:12px;top:12px;text-align:right;padding:8px 12px;min-width:120px';
  right.innerHTML = `<div data-k="stars" style="font-size:18px;letter-spacing:2px;height:22px"></div><div data-k="cash" style="font:700 18px system-ui,sans-serif;color:#9fd18b"></div>`;
  document.body.appendChild(right);
  const msg = document.createElement('div');
  msg.style.cssText = `position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:12;font:800 34px system-ui,sans-serif;color:${PALETTE.player.shirt};text-shadow:0 2px 0 #241e1a,0 0 18px rgba(0,0,0,.4);opacity:0;transition:opacity .3s;pointer-events:none;text-align:center`;
  document.body.appendChild(msg);
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#0d0c0b;opacity:0;transition:opacity .6s;z-index:11;pointer-events:none';
  document.body.appendChild(fade);
  const q = (el, k) => el.querySelector(`[data-${k.includes(':') ? k.split(':')[0] : 'k'}="${k.split(':').pop()}"]`);
  const hpBar = left.querySelector('[data-b="HP"]'), carBar = left.querySelector('[data-b="CAR"]');
  const carRow = q(left, 'car'), starsEl = q(right, 'stars'), cashEl = q(right, 'cash');
  let msgT = 0, flash = 0;
  return {
    update(dt, { health, carHealth, cash, stars = 0, searching = false }) {
      hpBar.style.width = `${Math.max(0, health)}%`;
      hpBar.style.background = health < 30 ? '#d9694f' : '#7fbf6a';
      carRow.style.display = carHealth == null ? 'none' : 'block';
      if (carHealth != null) carBar.style.width = `${Math.max(0, carHealth)}%`;
      cashEl.textContent = `$${cash.toLocaleString('en-AU')}`;
      flash += dt;
      const on = !searching || Math.floor(flash * 3) % 2 === 0;
      starsEl.innerHTML = Array.from({ length: 5 }, (_, i) => `<span style="color:${i < stars && on ? '#f3d27a' : 'rgba(246,238,223,.22)'}">&#9733;</span>`).join('');
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) msg.style.opacity = '0'; }
    },
    message(text, sec = 2.5, color = null) { msg.textContent = text; msg.style.color = color || PALETTE.player.shirt; msg.style.opacity = '1'; msgT = sec; },
    fade(on) { fade.style.opacity = on ? '1' : '0'; },
  };
}
