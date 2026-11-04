// Synthesised car audio (WebAudio, no files): engine tone following speed/throttle,
// horn, tyre screech, collision thud. The AudioContext is only created after the first
// click/keypress (browser autoplay rule); before that every call is a no-op.

export function createCarAudio() {
  let ctx = null, master = null, listener = null;
  let engine = null, horn = null, screech = null;
  let muted = false, volume = 0.8;
  const level = () => (muted ? 0 : 0.55 * volume);

  function noiseBuffer(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
    return b;
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);

    // Engine: detuned saw + square an octave down, through a lowpass, into a gain.
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(); o2.start();
    engine = { o1, o2, lp, g };

    // Horn: two square tones (a classic dual-note horn).
    const h1 = ctx.createOscillator(), h2 = ctx.createOscillator();
    h1.type = h2.type = 'square'; h1.frequency.value = 392; h2.frequency.value = 494;
    const hb = ctx.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 900; hb.Q.value = 0.8;
    const hg = ctx.createGain(); hg.gain.value = 0;
    h1.connect(hb); h2.connect(hb); hb.connect(hg); hg.connect(master);
    h1.start(); h2.start();
    horn = { g: hg };

    // Screech: looped noise through a resonant bandpass.
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    const sb = ctx.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 2100; sb.Q.value = 6;
    const sg = ctx.createGain(); sg.gain.value = 0;
    src.connect(sb); sb.connect(sg); sg.connect(master); src.start();
    screech = { g: sg, f: sb };
  }

  const unlock = () => { init(); ctx?.resume?.(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  const set = (param, v, tc = 0.05) => param.setTargetAtTime(v, ctx.currentTime, tc);

  return {
    get ready() { return !!ctx; },
    get muted() { return muted; },
    get volume() { return volume; },
    /** Shared output node so other sound modules (ambience) follow the same volume/mute. */
    get master() { return master; },
    get ctx() { return ctx; },
    toggleMute() { muted = !muted; if (master) set(master.gain, level(), 0.05); return muted; },
    setMuted(m) { muted = !!m; if (master) set(master.gain, level(), 0.05); },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) set(master.gain, level(), 0.05); },
    /** Per frame while a car is driven. speed m/s, throttle 0..1, top m/s. */
    engine(on, speed, throttle, top) {
      if (!ctx) return;
      const s = Math.min(1, Math.abs(speed) / top);
      // Fake gears: pitch climbs, drops at "shift points", climbs again.
      const gear = Math.min(4, Math.floor(s * 5));
      const inGear = s * 5 - gear;
      const rpm = 0.25 + 0.75 * (gear === 0 ? s * 5 : 0.35 + 0.65 * inGear);
      const f = 48 + rpm * 120 + throttle * 18;
      set(engine.o1.frequency, f, 0.04);
      set(engine.o2.frequency, f * 0.5 * 1.006, 0.04);
      set(engine.lp.frequency, 380 + rpm * 900 + throttle * 600, 0.06);
      set(engine.g.gain, on ? (0.11 + throttle * 0.1 + rpm * 0.05) * 0.7 : 0, on ? 0.08 : 0.25); // -30% (untested by ear)
    },
    horn(on) { if (ctx) set(horn.g.gain, on ? 0.16 : 0, 0.015); },
    screech(amount) {
      if (!ctx) return;
      set(screech.g.gain, Math.max(0, amount) * 0.084, 0.06);
      set(screech.f.frequency, 1800 + amount * 900, 0.1);
    },
    /** One-shot short double-toot from an AI car (volume falls off with distance to the listener). */
    honk(pos) {
      if (!ctx) return;
      const d = listener ? Math.hypot(pos.x - listener.x, pos.z - listener.z) : 10;
      const vol = Math.max(0, 0.14 * (1 - d / 70));
      if (vol <= 0.005) return;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      for (const [f, t0] of [[440, 0], [440, 0.22]]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 1.26;
        o.connect(g); o2.connect(g);
        o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + 0.16);
        o2.start(ctx.currentTime + t0); o2.stop(ctx.currentTime + t0 + 0.16);
        g.gain.setValueAtTime(vol, ctx.currentTime + t0); g.gain.setValueAtTime(0, ctx.currentTime + t0 + 0.16);
      }
    },
    setListener(p) { listener = p; },
    /** One-shot low thud, strength 0..1. */
    thud(strength) {
      if (!ctx || strength <= 0.05) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + strength * 200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.5 * strength + 0.05, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(); src.stop(ctx.currentTime + 0.4);
    },
  };
}
