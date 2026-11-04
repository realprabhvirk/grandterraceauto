// Keyboard + mouse state. Click the canvas to capture the mouse (pointer lock);
// arrow keys also turn the camera so it works without pointer lock.

export function createInput(dom) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered this frame
  let dx = 0, dy = 0, wheel = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  dom.addEventListener('click', () => {
    if (document.pointerLockElement !== dom) dom.requestPointerLock?.();
  });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === dom) { dx += e.movementX; dy += e.movementY; }
  });
  window.addEventListener('wheel', (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });

  return {
    down: (code) => keys.has(code),
    pressed: (code) => pressed.has(code),
    get locked() { return document.pointerLockElement === dom; },
    /** Mouse delta since last call (pixels), plus arrow-key turning. */
    look(dt) {
      let x = dx, y = dy;
      dx = dy = 0;
      const k = 520 * dt;
      if (keys.has('ArrowLeft')) x -= k;
      if (keys.has('ArrowRight')) x += k;
      if (keys.has('ArrowUp')) y -= k * 0.6;
      if (keys.has('ArrowDown')) y += k * 0.6;
      return { x, y };
    },
    wheel() { const w = wheel; wheel = 0; return w; },
    endFrame() { pressed.clear(); },
  };
}
