// Phase 6: shared buy menu for the kit shops (food / drinks / chemist heal, clothes + barber
// change the player's outfit colours). Same HUD style + behaviour as the Barrel & Bolt menu:
// opens at the counter (E), pauses game input, 1-9 or click to buy, Esc / E to leave.
import { injectStyles, UI } from './uiStyle.js';

export function createShopMenu({ wallet, input, audio, hud, combat, character }) {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'gta-panel';
  el.style.cssText += `left:50%;top:50%;transform:translate(-50%,-50%);width:360px;max-width:calc(100vw - 32px);padding:16px 18px;display:none;pointer-events:auto;z-index:20`;
  document.body.appendChild(el);
  let open = false, shop = null;
  const st = { opens: 0, bought: [], outfit: {} };

  function blocked(it) {
    if (it.hp && combat.hp >= 100) return 'full health';
    if (it.outfit && Object.entries(it.outfit).every(([k, v]) => st.outfit[k] === v)) return 'wearing';
    if (wallet.cash < it.price) return 'cash';
    return '';
  }
  const effect = (it) => (it.hp ? `+${it.hp} health` : it.outfit?.hair ? 'new hair' : 'new outfit');
  function render() {
    const rows = shop.menu.map((it, i) => {
      const b = blocked(it);
      const note = b === 'cash' ? 'not enough cash' : b ? b.toUpperCase() : effect(it);
      const sw = it.outfit ? `<span style="display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:${it.outfit.shirt || it.outfit.hair}"></span>` : '';
      return `<button data-i="${i}" ${b ? 'disabled' : ''} style="display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;margin:4px 0;padding:7px 10px;border-radius:6px;border:1px solid rgba(246,238,223,.25);background:${b ? 'rgba(246,238,223,.05)' : 'rgba(246,238,223,.12)'};color:${b ? UI.dim : UI.text};font:${UI.font};cursor:${b ? 'default' : 'pointer'};text-align:left">
        <span><span class="gta-key">${i + 1}</span>${sw}${it.label}</span><span style="white-space:nowrap"><span style="color:${UI.dim};font-size:11px;margin-right:8px">${note}</span><b style="color:#9fd18b">$${it.price}</b></span></button>`;
    }).join('');
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;gap:10px">
      <div style="font:800 17px system-ui,sans-serif;letter-spacing:.05em;color:#e2c25a">${shop.name.replace(/&/g, '&amp;')}</div><div style="color:#9fd18b;font-weight:700">$${wallet.cash}</div></div>
      <div style="color:${UI.dim};font-size:11px;margin-bottom:4px">Health ${Math.round(combat.hp)}/100</div>
      ${rows}<div style="margin-top:10px;color:${UI.dim};font-size:11px">Click or press 1-${shop.menu.length} to buy. <span class="gta-key">Esc</span>/<span class="gta-key">E</span> to leave.</div>`;
    el.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => api.buy(Number(b.dataset.i))));
  }
  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); api.close(); return; }
    const n = Number(e.code.replace('Digit', ''));
    if (n >= 1 && n <= shop.menu.length) { e.preventDefault(); e.stopPropagation(); api.buy(n - 1); }
  }
  window.addEventListener('keydown', onKey, true);

  const api = {
    get open() { return open; },
    get shop() { return shop; },
    get state() { return st; },
    openMenu(s) {
      if (open || !s?.menu) return;
      open = true; shop = s; st.opens++;
      input.setLocked(true);
      document.exitPointerLock?.();
      render();
      el.style.display = 'block';
    },
    close() {
      if (!open) return;
      open = false;
      el.style.display = 'none';
      setTimeout(() => input.setLocked(false), 0);
    },
    /** Buy menu item i of the open shop. Returns true if bought. */
    buy(i) {
      const it = shop?.menu[i];
      if (!it || blocked(it)) { audio.gunClick?.('dry', 0.6); return false; }
      wallet.add(-it.price);
      if (it.hp) combat.setHp(Math.min(100, combat.hp + it.hp));
      if (it.outfit) { Object.assign(st.outfit, it.outfit); character.setOutfit(st.outfit); }
      st.bought.push(`${shop.id}:${i}`);
      hud?.message?.(`${it.label}  ${effect(it)}  -$${it.price}`, 2.2, '#9fd18b');
      audio.ding?.(it.hp ? 880 : 660);
      if (open) render();
      return true;
    },
  };
  return api;
}
