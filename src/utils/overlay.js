// F3 debug overlay: FPS, frame time, draw calls, triangles, mode, position.

export function createOverlay(renderer, { visible = false } = {}) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:10px', 'left:10px', 'padding:8px 10px', 'z-index:10',
    'font:12px/1.45 ui-monospace,Consolas,monospace', 'color:#f6eedf',
    'background:rgba(36,30,26,.72)', 'border-radius:6px', 'pointer-events:none', 'white-space:pre',
  ].join(';');
  el.style.display = visible ? 'block' : 'none';
  document.body.appendChild(el);

  let frames = 0, acc = 0, fps = 0, ms = 0;
  const last = { calls: 0, triangles: 0 };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
  });

  return {
    /** Call once per frame after render(). */
    update(dt, extra = '') {
      last.calls = renderer.info.render.calls;
      last.triangles = renderer.info.render.triangles;
      frames++;
      acc += dt;
      if (acc >= 0.5) {
        fps = frames / acc;
        ms = (acc / frames) * 1000;
        frames = 0;
        acc = 0;
      }
      if (el.style.display === 'none') return;
      el.textContent =
        `FPS ${fps.toFixed(0).padStart(3)}  ${ms.toFixed(1)} ms\n` +
        `draw calls ${last.calls}\n` +
        `triangles  ${(last.triangles / 1000).toFixed(1)}k\n` +
        `geometries ${renderer.info.memory.geometries}  textures ${renderer.info.memory.textures}\n` +
        extra;
    },
    stats: () => ({ fps: Math.round(fps), calls: last.calls, triangles: last.triangles }),
  };
}
