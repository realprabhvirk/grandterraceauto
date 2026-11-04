// Shared look for the DOM HUD: warm dark glass panels, cream text, palette accents.
import { PALETTE } from '../art/palette.js';

export const UI = {
  panel: 'rgba(36,30,26,.74)',
  text: '#f6eedf',
  dim: 'rgba(246,238,223,.62)',
  accent: PALETTE.player.shirt,
  accent2: PALETTE.cars.hero,
  font: '600 13px/1.45 system-ui, "Segoe UI", sans-serif',
  mono: '12px/1.45 ui-monospace, Consolas, monospace',
};

let injected = false;
export function injectStyles() {
  if (injected) return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = `
    .gta-panel { position: fixed; z-index: 10; background: ${UI.panel}; color: ${UI.text};
      font: ${UI.font}; border-radius: 8px; padding: 9px 12px; pointer-events: none;
      box-shadow: 0 2px 14px rgba(0,0,0,.18); }
    .gta-key { display: inline-block; min-width: 1.5em; padding: 0 .35em; margin-right: .3em; text-align: center;
      border: 1px solid rgba(246,238,223,.45); border-radius: 4px; font: 600 11px/1.6 ui-monospace, Consolas, monospace; }
    .gta-fade { transition: opacity .25s ease, transform .25s ease; }
  `;
  document.head.appendChild(s);
}
