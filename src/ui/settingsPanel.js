// Esc settings menu: master volume slider + mute. M also toggles mute from anywhere.
// (Esc first releases pointer lock in the browser; pressing it again opens the menu.)
import { injectStyles, UI } from './uiStyle.js';

export function createSettingsPanel(audio) {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'gta-panel gta-fade';
  el.style.cssText += 'left:50%;top:50%;transform:translate(-50%,-50%);min-width:260px;padding:16px 18px;pointer-events:auto;opacity:0;visibility:hidden;font-size:14px';
  el.innerHTML = `
    <div style="font-weight:700;font-size:16px;margin-bottom:10px">Settings</div>
    <label style="display:block;margin-bottom:10px">Volume
      <input data-k="vol" type="range" min="0" max="100" value="80" style="width:100%;accent-color:${UI.accent}">
    </label>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <input data-k="mute" type="checkbox" style="accent-color:${UI.accent}"> Mute <span class="gta-key" style="margin-left:auto">M</span>
    </label>
    <div style="color:${UI.dim};font-size:12px">Esc closes &middot; click the game to look around</div>`;
  document.body.appendChild(el);
  const vol = el.querySelector('[data-k="vol"]'), mute = el.querySelector('[data-k="mute"]');
  try {
    const saved = JSON.parse(localStorage.getItem('gta-settings') || 'null');
    if (saved) { vol.value = Math.round(saved.volume * 100); mute.checked = !!saved.muted; }
  } catch { /* storage unavailable: defaults */ }
  const save = () => { try { localStorage.setItem('gta-settings', JSON.stringify({ volume: vol.value / 100, muted: mute.checked })); } catch { /* ignore */ } };
  const apply = () => { audio.setVolume(vol.value / 100); audio.setMuted(mute.checked); save(); };
  apply();
  vol.addEventListener('input', apply);
  mute.addEventListener('change', apply);
  // Keep clicks on the panel from reaching the canvas (pointer lock).
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  let open = false;
  const setOpen = (o) => {
    open = o;
    el.style.opacity = o ? '1' : '0';
    el.style.visibility = o ? 'visible' : 'hidden';
    if (o && document.pointerLockElement) document.exitPointerLock();
  };
  return {
    get open() { return open; },
    toggle() { setOpen(!open); },
    close() { setOpen(false); },
    /** Called when M toggles mute elsewhere, to keep the checkbox in sync. */
    syncMute() { mute.checked = audio.muted; save(); },
  };
}
