// Driving HUD: big km/h readout, gear-less tacho bar, boost / handbrake / lights tags.
import { injectStyles, UI } from './uiStyle.js';

export function createHud() {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'gta-panel gta-fade';
  el.style.cssText += 'right:16px;bottom:16px;width:178px;opacity:0;padding:10px 14px 12px';
  el.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:6px">
      <span data-k="speed" style="font:700 40px/1 system-ui,'Segoe UI',sans-serif;letter-spacing:-1px">0</span>
      <span style="color:${UI.dim}">km/h</span>
      <span data-k="car" style="margin-left:auto;color:${UI.dim};font-size:11px"></span>
    </div>
    <div style="margin-top:8px;height:7px;border-radius:4px;background:rgba(246,238,223,.14);overflow:hidden">
      <div data-k="tacho" style="height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,${UI.accent2},#e0b03c 70%,${UI.accent})"></div>
    </div>
    <div data-k="tags" style="margin-top:7px;font-size:11px;color:${UI.dim};min-height:1.4em"></div>`;
  document.body.appendChild(el);
  const q = (k) => el.querySelector(`[data-k="${k}"]`);
  const speedEl = q('speed'), tachoEl = q('tacho'), tagsEl = q('tags'), carEl = q('car');
  let visible = false, lastTags = '';

  return {
    setVisible(v) {
      if (v === visible) return;
      visible = v;
      el.style.opacity = v ? '1' : '0';
    },
    /** state from VehicleBody, plus car label and lights flag. */
    update(car) {
      if (!visible) return;
      const st = car.body.state;
      const kmh = Math.abs(st.speed) * 3.6;
      speedEl.textContent = kmh.toFixed(0);
      carEl.textContent = car.cfg.label;
      // Gear-less tacho: revs rise with speed in fake gears + throttle blip.
      const s = Math.min(1, Math.abs(st.speed) / car.cfg.top);
      const g = Math.min(4, Math.floor(s * 5)), inGear = s * 5 - g;
      const rpm = Math.min(1, (g === 0 ? s * 5 : 0.35 + 0.65 * inGear) * 0.85 + st.throttle * 0.15);
      tachoEl.style.width = `${(rpm * 100).toFixed(1)}%`;
      const tags = [st.boost ? 'BOOST' : '', st.handbrake ? 'HANDBRAKE' : '', st.reversing ? 'R' : '', car.lights ? 'LIGHTS' : ''].filter(Boolean).join(' · ');
      if (tags !== lastTags) { tagsEl.textContent = tags; lastTags = tags; }
    },
  };
}
