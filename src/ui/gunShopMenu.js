// Barrel & Bolt buy menu: HTML overlay in the HUD style. Opens at the counter (E); game
// input is paused while it is open (mouse released). Ammo packs per weapon ($30-$80, never
// past the reserve cap) and the shotgun ($600) / rifle ($1,200). Esc or E closes it.
import { injectStyles, UI } from './uiStyle.js';
import { WEAPONS, ORDER } from '../weapons/weaponStats.js';

export function createGunShopMenu({ arsenal, wallet, input, audio, hud }) {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'gta-panel';
  el.style.cssText += `left:50%;top:50%;transform:translate(-50%,-50%);width:380px;max-width:calc(100vw - 32px);padding:16px 18px;display:none;pointer-events:auto;z-index:20`;
  document.body.appendChild(el);
  let open = false;
  const st = { opens: 0, bought: [] };

  const items = () => [
    ...ORDER.map((id) => ({ key: `ammo:${id}`, label: `${WEAPONS[id].name} ammo  x${WEAPONS[id].price.pack}`, price: WEAPONS[id].price.ammo, id, kind: 'ammo' })),
    { key: 'gun:shotgun', label: 'Pump Shotgun', price: WEAPONS.shotgun.price.gun, id: 'shotgun', kind: 'gun' },
    { key: 'gun:rifle', label: 'Rifle', price: WEAPONS.rifle.price.gun, id: 'rifle', kind: 'gun' },
  ];
  /** Why an item can't be bought right now ('' = it can). */
  function blocked(it) {
    if (it.kind === 'gun' && arsenal.owns(it.id)) return 'owned';
    if (it.kind === 'ammo' && !arsenal.owns(it.id)) return 'no gun';
    if (it.kind === 'ammo' && arsenal.roomFor(it.id) <= 0) return 'full';
    if (wallet.cash < it.price) return 'cash';
    return '';
  }
  function render() {
    const rows = items().map((it, i) => {
      const b = blocked(it), a = it.kind === 'ammo' && arsenal.owns(it.id) ? arsenal.state.ammo[it.id] : null;
      const note = b === 'owned' ? 'OWNED' : b === 'no gun' ? 'need the gun' : b === 'full' ? 'FULL' : b === 'cash' ? 'not enough cash' : a ? `${a.reserve}/${WEAPONS[it.id].reserveCap}` : '';
      return `<button data-k="${it.key}" ${b ? 'disabled' : ''} style="display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;margin:4px 0;padding:7px 10px;border-radius:6px;border:1px solid rgba(246,238,223,.25);background:${b ? 'rgba(246,238,223,.05)' : 'rgba(246,238,223,.12)'};color:${b ? UI.dim : UI.text};font:${UI.font};cursor:${b ? 'default' : 'pointer'};text-align:left">
        <span><span class="gta-key">${i + 1}</span>${it.label}</span><span style="white-space:nowrap">${note ? `<span style="color:${UI.dim};font-size:11px;margin-right:8px">${note}</span>` : ''}<b style="color:#9fd18b">$${it.price}</b></span></button>`;
    }).join('');
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <div style="font:800 18px system-ui,sans-serif;letter-spacing:.06em;color:#e2c25a">BARREL &amp; BOLT</div><div style="color:#9fd18b;font-weight:700">$${wallet.cash}</div></div>
      ${rows}<div style="margin-top:10px;color:${UI.dim};font-size:11px">Click or press 1-6 to buy. <span class="gta-key">Esc</span>/<span class="gta-key">E</span> to leave.</div>`;
    el.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => api.buy(b.dataset.k)));
  }
  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); api.close(); return; }
    const n = Number(e.code.replace('Digit', ''));
    if (n >= 1 && n <= 6) { e.preventDefault(); e.stopPropagation(); api.buy(items()[n - 1].key); }
  }
  window.addEventListener('keydown', onKey, true);

  const api = {
    get open() { return open; },
    get state() { return st; },
    items,
    openMenu() {
      if (open) return;
      open = true; st.opens++;
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
    /** Buy by key ('ammo:pistol', 'gun:rifle'...). Returns true if bought. */
    buy(key) {
      const it = items().find((x) => x.key === key);
      if (!it || blocked(it)) { audio.gunClick?.('dry', 0.6); return false; }
      wallet.add(-it.price);
      if (it.kind === 'gun') { arsenal.give(it.id, WEAPONS[it.id].price.pack); hud?.message?.(`${it.label} bought  -$${it.price}`, 2.2, '#9fd18b'); }
      else arsenal.addAmmo(it.id, WEAPONS[it.id].price.pack);
      st.bought.push(key);
      audio.ding?.(it.kind === 'gun' ? 660 : 990);
      audio.gunClick?.('mag', 0.7);
      if (open) render();
      return true;
    },
  };
  return api;
}
