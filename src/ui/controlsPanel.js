// Controls help panel (bottom-left). Content switches between on-foot and driving.
// Toggle with ? (or H on foot - H is the horn in a car). Auto-dims after a while.
import { injectStyles } from './uiStyle.js';

const k = (key) => `<span class="gta-key">${key}</span>`;
const PAGES = {
  walk: `<b>On foot</b><br>
    ${k('WASD')}move ${k('Shift')}run ${k('Space')}jump ${k('Ctrl')}crouch<br>
    ${k('1')}wave ${k('2')}dance ${k('3')}sit ${k('4')}point<br>
    ${k('F')}get in car ${k('N')}day / night ${k('M')}mute<br>
    ${k('F2')}debug fly cam ${k('F3')}stats ${k('F4')}colliders ${k('?')}hide`,
  drive: `<b>Driving</b><br>
    ${k('W')}accelerate ${k('S')}brake / reverse ${k('A D')}steer<br>
    ${k('Space')}handbrake ${k('Shift')}boost ${k('H')}horn ${k('L')}lights<br>
    ${k('B')}look behind ${k('R')}flip upright ${k('F')}get out<br>
    ${k('N')}day / night ${k('M')}mute ${k('?')}hide`,
  fly: `<b>Debug fly</b><br>
    ${k('WASD')}fly ${k('Space/E')}up ${k('Ctrl/Q')}down ${k('Shift')}fast<br>
    ${k('1-7')}camera presets ${k('F2')}back ${k('F4')}colliders`,
};

export function createControlsPanel() {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'gta-panel gta-fade';
  el.style.cssText += 'left:12px;bottom:12px;font-weight:500;font-size:12px;line-height:1.85';
  document.body.appendChild(el);
  let page = '', shown = true, timer = 0;
  const render = () => { el.style.opacity = shown ? (timer > 14 ? '0.45' : '1') : '0'; };
  return {
    el,
    setPage(p) { if (p !== page) { page = p; el.innerHTML = PAGES[p] || ''; timer = 0; render(); } },
    toggle() { shown = !shown; timer = 0; render(); },
    hide() { shown = false; render(); },
    update(dt) { if (shown && timer <= 14) { timer += dt; if (timer > 14) render(); } },
  };
}
