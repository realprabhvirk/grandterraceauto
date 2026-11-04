// Cash: starts at $10,000, persisted in localStorage ('gta-save'). Never below 0.
const KEY = 'gta-save';

export function createWallet() {
  let cash = 10000;
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Number.isFinite(s.cash)) cash = s.cash; } catch { /* defaults */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ cash })); } catch { /* ignore */ } };
  const listeners = [];
  return {
    get cash() { return cash; },
    add(n) { cash = Math.max(0, Math.round(cash + n)); save(); listeners.forEach((f) => f(cash, n)); },
    set(n) { cash = Math.max(0, Math.round(n)); save(); listeners.forEach((f) => f(cash, 0)); },
    onChange(f) { listeners.push(f); },
  };
}
