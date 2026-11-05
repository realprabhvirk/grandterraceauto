// Ambient sound by zone (WebAudio, no files, same master volume / mute as the car audio):
//   suburb: wind + birdsong by day; beach: waves; downtown / town: traffic hum;
//   night: crickets. Levels ease toward the targets for the player's position each frame.
// Zones are measured from the district rectangles (cheap), see zoneLevels().

/** Target levels 0..1 for a position + time of day. */
export function zoneLevels(p, dusk = 0) {
  const inRect = (x0, x1, z0, z1, m) => {
    const dx = Math.max(x0 - p.x, 0, p.x - x1), dz = Math.max(z0 - p.z, 0, p.z - z1);
    return Math.max(0, 1 - Math.hypot(dx, dz) / m);
  };
  const beach = inRect(600, 1010, 55, 300, 90);
  const city = Math.max(inRect(320, 980, -230, 50, 60) * (p.x > 610 ? 1 : 0.6), inRect(330, 630, -480, -280, 40) * 0.35, inRect(690, 980, -480, -280, 40) * 0.9); // industrial machinery hum
  const suburb = Math.max(0, inRect(-230, 230, -230, 230, 60) - city * 0.5);
  const day = 1 - dusk;
  return {
    wind: Math.max(0.25, suburb) * 0.8,
    birds: suburb * day * (1 - beach),
    waves: beach,
    traffic: city * (1 - beach * 0.6),
    crickets: dusk * Math.max(suburb, 0.3) * (1 - city * 0.7),
  };
}

export function createAmbience(audio) {
  let nodes = null;
  const cur = { wind: 0, birds: 0, waves: 0, traffic: 0, crickets: 0 };
  let chirpT = 0, t = 0;

  function noise(ctx, sec, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let s = 987654, last = 0;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const w = (s / 0x7fffffff) * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function init() {
    const ctx = audio.ctx, master = audio.master;
    if (!ctx || !master) return false;
    const out = ctx.createGain(); out.gain.value = 0.9; out.connect(master);
    const loop = (buf, filterType, freq, q = 0.7) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(out); src.start();
      return { src, f, g };
    };
    const white = noise(ctx, 3), brown = noise(ctx, 4, true);
    nodes = {
      ctx, out,
      wind: loop(brown, 'lowpass', 420),
      waves: loop(white, 'lowpass', 700),
      traffic: loop(brown, 'lowpass', 180, 1.2),
      crickets: (() => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4300;
        const am = ctx.createGain(); am.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 22; const lg = ctx.createGain(); lg.gain.value = 0.5;
        lfo.connect(lg); lg.connect(am.gain);
        const g = ctx.createGain(); g.gain.value = 0;
        o.connect(am); am.connect(g); g.connect(out); o.start(); lfo.start();
        return { g, am };
      })(),
    };
    return true;
  }
  function chirp(level) {
    const { ctx, out } = nodes, now = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3), base = 2200 + Math.random() * 1800;
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const s = now + k * 0.11;
      o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.07);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.035 * level, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.1);
    }
  }

  return {
    get levels() { return { ...cur }; },
    /** p = listener position, dusk 0..1. */
    update(dt, p, dusk) {
      const want = zoneLevels(p, dusk);
      for (const k in cur) cur[k] += (want[k] - cur[k]) * Math.min(1, dt * 0.8);
      if (!audio.ready) return;
      if (!nodes && !init()) return;
      t += dt;
      const now = nodes.ctx.currentTime, set = (param, v) => param.setTargetAtTime(v, now, 0.3);
      // Wind gusts (slow wobble), waves swell (8 s period), city hum, crickets.
      set(nodes.wind.g.gain, cur.wind * (0.05 + 0.03 * Math.sin(t * 0.37) * Math.sin(t * 0.13)));
      nodes.wind.f.frequency.setTargetAtTime(380 + 140 * Math.sin(t * 0.21), now, 0.5);
      set(nodes.waves.g.gain, cur.waves * (0.05 + 0.06 * Math.max(0, Math.sin(t * 0.78))));
      set(nodes.traffic.g.gain, cur.traffic * 0.09);
      set(nodes.crickets.g.gain, cur.crickets * 0.012);
      chirpT -= dt;
      if (cur.birds > 0.15 && chirpT <= 0) { chirp(cur.birds); chirpT = 0.8 + Math.random() * 2.6; }
    },
  };
}
