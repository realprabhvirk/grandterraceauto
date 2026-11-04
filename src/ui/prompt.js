// Small centred interaction prompt ("Press F to drive").
import { injectStyles } from './uiStyle.js';

export function createPrompt() {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'gta-panel gta-fade';
  el.style.cssText += 'left:50%;bottom:22%;transform:translate(-50%,6px);opacity:0;font-size:15px;padding:8px 14px';
  document.body.appendChild(el);
  let text = '';
  return {
    show(key, label) {
      const t = `<span class="gta-key">${key}</span>${label}`;
      if (t !== text) { el.innerHTML = t; text = t; }
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,0)';
    },
    hide() {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,6px)';
      text = '';
    },
    el,
  };
}
