// Round speed-limit sign next to the speedometer (flashes red when over limit + margin) and a
// chip with the current street name. Only while driving.
import { injectStyles } from './uiStyle.js';

export function createSpeedLimitHud() {
  injectStyles();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;right:206px;bottom:22px;z-index:10;display:none;align-items:center;gap:8px;pointer-events:none';
  wrap.innerHTML = `<div data-k="chip" class="gta-panel" style="position:static;padding:4px 9px;font-size:12px;white-space:nowrap"></div>
    <div data-k="sign" style="width:46px;height:46px;border-radius:50%;background:#fff;border:6px solid #d8322a;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:900 17px system-ui,sans-serif;color:#1f1f22;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`;
  document.body.appendChild(wrap);
  const chip = wrap.querySelector('[data-k="chip"]'), sign = wrap.querySelector('[data-k="sign"]');
  let t = 0;
  const st = { visible: false, limit: null, street: null, flashing: false };
  return {
    st,
    update(dt, s) {
      t += dt;
      st.visible = !!s; wrap.style.display = s ? 'flex' : 'none';
      if (!s) return;
      st.limit = s.limit; st.street = s.street; st.flashing = !!s.over;
      chip.textContent = s.street || '';
      chip.style.display = s.street ? 'block' : 'none';
      sign.textContent = s.limit ?? '--';
      const red = s.over && Math.floor(t * 4) % 2 === 0;
      sign.style.background = red ? '#d8322a' : '#fff';
      sign.style.color = red ? '#fff' : '#1f1f22';
    },
  };
}
