// Interaction system: anything the player can use registers a target with a position,
// range, prompt label and action. Each frame the nearest enabled target in range shows
// the prompt; F fires it. Cars use it now; doors etc. can register the same way later.

export function createInteractions(prompt) {
  const targets = [];
  let current = null;
  return {
    /** t = { id, position() -> {x,y,z}, range, key, label, enabled() -> bool, action() } */
    register(t) { targets.push({ key: 'F', range: 2.5, enabled: () => true, ...t }); },
    get current() { return current; },
    /**
     * Find the best target near `p` and update the prompt.
     * mode: 'walk' (everything) | 'car' (only targets with inCar: true) | false (none).
     */
    update(p, mode) {
      current = null;
      if (mode) {
        let best = Infinity;
        for (const t of targets) {
          if (!t.enabled()) continue;
          if (mode === 'car' && !t.inCar) continue;
          const q = t.position();
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < t.range && Math.abs(q.y - p.y) < 2.2 && d < best) { best = d; current = t; }
        }
      }
      if (current) prompt.show(current.key, typeof current.label === 'function' ? current.label() : current.label); else prompt.hide();
      return current;
    },
    /** Call on F: runs the current target's action. */
    fire() { if (current) { const t = current; current = null; prompt.hide(); t.action(); return true; } return false; },
  };
}
