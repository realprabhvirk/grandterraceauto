// Keyboard + mouse state. Click the canvas to capture the mouse (pointer lock, Esc
// releases it); arrow keys also turn the camera so it works without pointer lock.
// Virtual keys let test scripts / the debug autopilot drive the same code paths.
// Mouse buttons are keys too: 'Mouse0' (LMB) and 'Mouse2' (RMB).
// Page zoom is blocked everywhere: every wheel event (trackpad pinch arrives as a wheel event
// with ctrlKey) is preventDefault-ed and turned into camera zoom; Safari gesture events and
// Ctrl +/-/0 are swallowed too.

export function createInput(dom) {
  const keys = new Set();
  const virtual = new Set();
  const pressed = new Set(); // edge-triggered this frame
  let dx = 0, dy = 0, wheel = 0, locked = false;

  const ZOOM_KEYS = ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0'];
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ZOOM_KEYS.includes(e.code)) { e.preventDefault(); return; }
    if (['Tab', 'Space', 'F2', 'F4'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.code === 'Slash' && e.shiftKey) pressed.add('Help');
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  dom.addEventListener('click', () => {
    if (document.pointerLockElement !== dom) dom.requestPointerLock?.()?.catch?.(() => {});
  });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === dom) { dx += e.movementX; dy += e.movementY; }
  });
  dom.addEventListener('mousedown', (e) => { const c = `Mouse${e.button}`; if (!keys.has(c)) pressed.add(c); keys.add(c); });
  window.addEventListener('mouseup', (e) => keys.delete(`Mouse${e.button}`));
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  // Wheel / trackpad scroll / pinch -> camera zoom, never page zoom or scroll.
  const onWheel = (e) => {
    e.preventDefault();
    if (locked) return;
    const k = e.ctrlKey ? 25 : e.deltaMode === 1 ? 3 : 100; // pinch deltas are small; line mode = 3 lines/notch
    wheel += Math.max(-1.5, Math.min(1.5, e.deltaY / k));
  };
  window.addEventListener('wheel', onWheel, { passive: false });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) window.addEventListener(g, (e) => e.preventDefault(), { passive: false });
  window.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  return {
    down: (code) => !locked && (keys.has(code) || virtual.has(code)),
    pressed: (code) => !locked && pressed.has(code),
    /** Raw key state (ignores the cutscene lock). */
    rawDown: (code) => keys.has(code) || virtual.has(code),
    get pointerLocked() { return document.pointerLockElement === dom; },
    /** Cutscene input lock: every query reports nothing held / pressed. */
    get locked() { return locked; },
    setLocked(on) { locked = on; if (on) { dx = dy = 0; wheel = 0; } },
    /** Hold / release a key programmatically (autopilot, tests). */
    setVirtual(code, on) { if (on) { if (!virtual.has(code)) pressed.add(code); virtual.add(code); } else virtual.delete(code); },
    clearVirtual() { virtual.clear(); },
    /** Mouse delta since last call (pixels), plus arrow-key turning. */
    look(dt) {
      let x = dx, y = dy;
      dx = dy = 0;
      if (locked) return { x: 0, y: 0 };
      const k = 520 * dt;
      if (keys.has('ArrowLeft')) x -= k;
      if (keys.has('ArrowRight')) x += k;
      if (keys.has('ArrowUp')) y -= k * 0.6;
      if (keys.has('ArrowDown')) y += k * 0.6;
      return { x, y };
    },
    wheel() { const w = wheel; wheel = 0; return w; },
    /** Peek at accumulated wheel without consuming it. */
    peekWheel() { return wheel; },
    endFrame() { pressed.clear(); },
  };
}
