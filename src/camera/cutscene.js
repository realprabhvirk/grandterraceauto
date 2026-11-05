// Short non-skippable cutscenes (KNOCKED OUT / BUSTED): input locked, optional slow motion,
// the camera rises and slowly orbits the player, big title + sub-line, optional desaturate +
// vignette, then fade to black -> onEnd() (respawn) -> fade back in.
import * as THREE from 'three';

export function createCutscene({ camera, input, canvas }) {
  const st = { active: false, kind: null, t: 0, dur: 0, timeScale: 1, ended: 0 };
  let opts = null;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12;display:none;font-family:system-ui,sans-serif;text-align:center';
  wrap.innerHTML = `<div data-v style="position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.72) 100%)"></div>
    <div data-t style="position:absolute;left:0;right:0;top:34%;font-size:64px;font-weight:900;letter-spacing:.08em;text-shadow:0 4px 0 rgba(0,0,0,.45);opacity:0;transform:scale(1.15);transition:opacity .5s, transform .5s"></div>
    <div data-s style="position:absolute;left:0;right:0;top:calc(34% + 80px);font-size:22px;font-weight:700;color:#f1e6d2;text-shadow:0 2px 0 rgba(0,0,0,.5);opacity:0;transition:opacity .6s .4s"></div>
    <div data-b style="position:absolute;inset:0;background:#0d0c0b;opacity:0;transition:opacity .55s"></div>`;
  document.body.appendChild(wrap);
  const $ = (k) => wrap.querySelector(`[data-${k}]`);
  const vign = $('v'), title = $('t'), sub = $('s'), black = $('b');
  const focus = new THREE.Vector3(), look = new THREE.Vector3();
  let angle = 0;

  function finish() {
    const o = opts;
    st.active = false; st.kind = null; st.timeScale = 1; st.ended++;
    o.onEnd?.();
    input.setLocked(false);
    canvas.style.filter = '';
    title.style.opacity = sub.style.opacity = '0'; title.style.transform = 'scale(1.15)';
    setTimeout(() => { black.style.opacity = '0'; }, 120);
    setTimeout(() => { if (!st.active) wrap.style.display = 'none'; }, 800);
  }

  return {
    get active() { return st.active; },
    get kind() { return st.kind; },
    get timeScale() { return st.active ? st.timeScale : 1; },
    get state() { return st; },
    /**
     * kind: 'ko' | 'busted'; o = { dur, timeScale, title, sub, color, desat, focus: () => Vector3, startAngle, onEnd }
     */
    play(kind, o) {
      opts = o;
      Object.assign(st, { active: true, kind, t: 0, dur: o.dur, timeScale: o.timeScale ?? 1 });
      input.setLocked(true);
      angle = o.startAngle ?? 0;
      wrap.style.display = 'block';
      vign.style.opacity = o.desat ? '1' : '0.55';
      black.style.opacity = '0';
      title.textContent = o.title; title.style.color = o.color || '#ff6a3a';
      sub.textContent = o.sub || '';
      canvas.style.filter = o.desat ? 'grayscale(0.85) contrast(1.05)' : '';
      requestAnimationFrame(() => { title.style.opacity = '1'; title.style.transform = 'scale(1)'; sub.style.opacity = '1'; });
    },
    /** Real (unscaled) dt. Call after the controls so the cutscene camera wins. */
    update(dt) {
      if (!st.active) return;
      st.t += dt;
      const k = Math.min(1, st.t / st.dur);
      focus.copy(opts.focus());
      angle += dt * 0.38;
      const r = 3.2 + k * 2.6, h = 1.2 + k * 3.4;
      camera.position.set(focus.x + Math.sin(angle) * r, focus.y + h, focus.z + Math.cos(angle) * r);
      look.set(focus.x, focus.y + 0.5, focus.z);
      camera.lookAt(look);
      if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
      if (st.t > st.dur - 0.65) black.style.opacity = '1';
      if (st.t >= st.dur) finish();
    },
  };
}
