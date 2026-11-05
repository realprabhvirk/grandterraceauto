// One media element, no UI and no extra AudioContext. update uses real (not game) time.
import { MUSIC } from './musicConfig.js';
import { makeRng } from '../utils/rng.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const approach = (n, target, step) => n < target ? Math.min(target, n + step) : Math.max(target, n - step);
const repeats = ['off', 'all', 'one'];

export function createMusicPlayer({ master, playlistUrl = '/music/playlist.json' } = {}) {
  const audio = new Audio(); audio.preload = 'metadata';
  const listeners = new Set(), failed = new Set(), history = [], bag = [];
  const rng = makeRng(MUSIC.shuffleSeed), abort = new AbortController();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(MUSIC.storageKey) || '{}') || {}; } catch { /* optional storage */ }
  const st = {
    tracks: [], index: -1, ready: false, requested: false, unlocked: false, playing: false,
    volume: Number.isFinite(saved.volume) ? clamp(saved.volume, 0, 1) : MUSIC.volume,
    muted: saved.muted === true, shuffle: saved.shuffle === true,
    repeat: repeats.includes(saved.repeat) ? saved.repeat : 'all',
    carOnly: typeof saved.carOnly === 'boolean' ? saved.carOnly : MUSIC.CAR_ONLY,
    visible: typeof saved.visible === 'boolean' ? saved.visible : false,
    error: '', blocked: false,
  };
  let driving = false, carGain = st.carOnly ? 0 : 1, duckGain = 1;
  let disposed = false, version = 0, pending = false, seekPending = null, loadTimer = null;
  const emit = (kind, message = '') => { for (const fn of listeners) fn(kind, message); };
  const track = () => st.tracks[st.index] || null;
  const duration = () => Number.isFinite(audio.duration) ? audio.duration : 0;
  const allowed = () => !st.carOnly || driving;
  function save() {
    try { localStorage.setItem(MUSIC.storageKey, JSON.stringify({ volume: st.volume, muted: st.muted, track: track()?.file || saved.track, shuffle: st.shuffle, repeat: st.repeat, carOnly: st.carOnly, visible: st.visible })); } catch { /* private/disabled storage */ }
  }
  function mix() {
    const volume = Number.isFinite(master?.volume) ? clamp(master.volume, 0, 1) : 1;
    const value = st.volume * volume * carGain * duckGain;
    if (audio.volume !== value) audio.volume = value;
    const muted = st.muted || !!master?.muted;
    if (audio.muted !== muted) audio.muted = muted;
  }
  function clearLoadTimer() { clearTimeout(loadTimer); loadTimer = null; }
  function refillBag() {
    bag.length = 0;
    for (let i = 0; i < st.tracks.length; i++) if (i !== st.index && !failed.has(i)) bag.push(i);
    for (let i = bag.length - 1; i > 0; i--) { const j = rng.int(0, i); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  }
  function pause() {
    st.requested = false; clearLoadTimer(); audio.pause(); emit('change');
  }
  function fail(v) {
    if (disposed || v !== version || st.index < 0 || failed.has(st.index)) return;
    clearLoadTimer(); failed.add(st.index);
    st.error = `Could not play ${track().title}`; emit('notice', st.error);
    for (let step = 1; step < st.tracks.length; step++) {
      const i = (st.index + step) % st.tracks.length;
      if (!failed.has(i)) { select(i, false); return; }
    }
    pause(); st.error = 'No playable music tracks'; emit('notice', st.error);
  }
  function attempt() {
    if (disposed || pending || !st.unlocked || !st.requested || !allowed() || st.blocked || st.index < 0 || failed.has(st.index) || !audio.paused) return;
    pending = true;
    const v = version;
    mix();
    if (!loadTimer) loadTimer = setTimeout(() => fail(v), MUSIC.loadTimeout * 1000);
    audio.play().catch(e => {
      if (disposed || v !== version || e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') {
        st.blocked = true; st.unlocked = false; clearLoadTimer(); emit('notice', 'Press play to start music');
      } else fail(v);
    }).finally(() => { if (v === version) pending = false; });
  }
  function select(index, remember = true) {
    if (!Number.isInteger(index) || index < 0 || index >= st.tracks.length || disposed) return;
    if (remember && st.index >= 0 && index !== st.index) {
      history.push(st.index); if (history.length > MUSIC.historyLimit) history.shift();
    }
    version++; pending = false; clearLoadTimer(); audio.pause();
    st.index = index; st.error = ''; seekPending = null;
    audio.src = '/music/' + track().file;
    save(); emit('track'); attempt();
  }
  function seek(seconds) {
    if (!Number.isFinite(seconds) || st.index < 0) return;
    if (!duration()) { seekPending = Math.max(0, seconds); return; }
    audio.currentTime = clamp(seconds, 0, duration()); emit('change');
  }
  function next(ended = false) {
    if (!st.tracks.length) return;
    if (ended && st.repeat === 'one') { seek(0); attempt(); return; }
    let index;
    if (st.shuffle) {
      while (bag.length && failed.has(bag[bag.length - 1])) bag.pop();
      if (!bag.length) {
        if (ended && st.repeat === 'off') { pause(); return; }
        refillBag();
      }
      index = bag.length ? bag.pop() : st.index;
    } else {
      index = st.index + 1;
      if (index >= st.tracks.length) {
        if (ended && st.repeat === 'off') { pause(); return; }
        index = 0;
      }
      for (let n = 0; n < st.tracks.length && failed.has(index); n++) index = (index + 1) % st.tracks.length;
    }
    select(index);
  }
  function gesture(e) {
    if (!e.isTrusted || disposed) return;
    st.unlocked = true; st.blocked = false; attempt();
  }
  function playing() { clearLoadTimer(); st.playing = true; st.error = ''; emit('change'); }
  function paused() { st.playing = false; emit('change'); }
  function ended() { st.playing = false; next(true); }
  function error() { fail(version); }
  function metadata() { if (seekPending != null) { const s = seekPending; seekPending = null; seek(s); } emit('change'); }
  window.addEventListener('pointerdown', gesture, true);
  window.addEventListener('keydown', gesture, true);
  audio.addEventListener('playing', playing);
  audio.addEventListener('pause', paused);
  audio.addEventListener('ended', ended);
  audio.addEventListener('error', error);
  audio.addEventListener('loadedmetadata', metadata);
  mix();

  const api = {
    get state() { return st; },
    get track() { return track(); },
    get currentTime() { return audio.currentTime || 0; },
    get duration() { return duration(); },
    get effectiveVolume() { return audio.muted ? 0 : audio.volume; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    play() {
      if (st.ready && !st.tracks.length) return;
      failed.clear(); st.error = ''; st.requested = true;
      // A user retry must reload a failed resource, not reuse its cached media error.
      if (audio.error) select(st.index, false); else attempt();
      emit('change');
    },
    pause,
    toggle() { if (st.requested) pause(); else api.play(); },
    select(index) { failed.clear(); select(index); refillBag(); },
    next() { next(); },
    previous() {
      if (audio.currentTime > MUSIC.previousRestart) { seek(0); return; }
      if (!st.tracks.length) return;
      const index = st.shuffle && history.length ? history.pop() : (st.index + st.tracks.length - 1) % st.tracks.length;
      select(index, false); refillBag();
    },
    seek,
    skip(seconds) { seek((seekPending ?? audio.currentTime) + seconds); },
    setVolume(value) { if (!Number.isFinite(value)) return; st.volume = clamp(value, 0, 1); mix(); save(); emit('change'); },
    setMuted(value) { st.muted = !!value; mix(); save(); emit('change'); },
    setShuffle(value) { st.shuffle = !!value; history.length = 0; refillBag(); save(); emit('change'); },
    setRepeat(value) { if (!repeats.includes(value)) return; st.repeat = value; save(); emit('change'); },
    setCarOnly(value) { st.carOnly = !!value; save(); emit('change'); },
    setVisible(value) { st.visible = !!value; save(); emit('change'); },
    update(dt, inCar, cutscene) {
      if (disposed) return;
      driving = !!inCar;
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      carGain = approach(carGain, allowed() ? 1 : 0, elapsed / MUSIC.carFade);
      duckGain = approach(duckGain, cutscene ? MUSIC.duckGain : 1, elapsed / MUSIC.duckFade);
      mix();
      if (!allowed() && carGain === 0) { if (!audio.paused) audio.pause(); clearLoadTimer(); }
      else attempt();
    },
    dispose() {
      disposed = true; version++; abort.abort(); clearLoadTimer();
      window.removeEventListener('pointerdown', gesture, true); window.removeEventListener('keydown', gesture, true);
      audio.removeEventListener('playing', playing); audio.removeEventListener('pause', paused);
      audio.removeEventListener('ended', ended); audio.removeEventListener('error', error); audio.removeEventListener('loadedmetadata', metadata);
      audio.pause(); audio.removeAttribute('src'); audio.load(); listeners.clear(); st.playing = false;
    },
  };
  api.ready = (async () => {
    try {
      const response = await fetch(playlistUrl, { signal: abort.signal });
      if (!response.ok) throw new Error('Playlist unavailable');
      const list = await response.json();
      if (!Array.isArray(list)) throw new Error('Invalid playlist');
      st.tracks = list.filter(t => {
        if (typeof t?.file !== 'string' || typeof t.title !== 'string' || typeof t.artist !== 'string') return false;
        try { const file = decodeURIComponent(t.file); return !!file && file !== '.' && file !== '..' && !/[\\/]/.test(file) && encodeURIComponent(file) === t.file; } catch { return false; }
      });
      if (disposed) return;
      if (st.tracks.length) {
        const index = st.tracks.findIndex(t => t.file === saved.track);
        select(index < 0 ? 0 : index, false); refillBag();
      } else emit('notice', 'No music found. Add songs and run npm run music.');
    } catch (e) {
      if (!disposed && e.name !== 'AbortError') { st.error = 'Music playlist unavailable'; emit('notice', st.error); }
    } finally { if (!disposed) { st.ready = true; emit('change'); } }
  })();
  return api;
}
