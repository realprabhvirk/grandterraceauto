// Left-side music card. Progress is sampled at 4 Hz; state changes render on the next update.
import { UI, injectStyles } from './uiStyle.js';
import { PALETTE } from '../art/palette.js';
import { MUSIC } from '../audio/musicConfig.js';

const time = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const attr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, value); };
const style = (el, key, value) => { if (el.style[key] !== value) el.style[key] = value; };

export function createMusicPlayerUi(music) {
  injectStyles();
  const css = document.createElement('style');
  css.textContent = `
    .gta-music {left:12px;top:80px;width:min(280px,calc(20vw - 24px));box-sizing:border-box;padding:8px;
      font:500 11px/1.3 system-ui,sans-serif;opacity:.85;transition:opacity .25s;pointer-events:auto;display:none}
    .gta-music * {box-sizing:border-box}
    .gta-music-head {display:flex;gap:7px;align-items:center;min-width:0;margin-bottom:4px}
    .gta-music-cover {width:28px;height:28px;flex:none;border-radius:4px}
    .gta-music-info {min-width:0;flex:1}
    .gta-music-title,.gta-music-artist {white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gta-music-title {font-weight:750;font-size:12px}
    .gta-music-artist {color:${UI.dim};font-size:10px}
    .gta-music-row {display:flex;align-items:center;gap:3px;margin-top:4px;min-width:0}
    .gta-music button {border:1px solid ${UI.dim};border-radius:4px;background:transparent;color:${UI.text};
      font:600 10px/1.2 system-ui,sans-serif;padding:3px;min-height:23px;cursor:pointer;min-width:0}
    .gta-music button:hover,.gta-music button:focus-visible {background:${PALETTE.hero.trim};outline:1px solid ${UI.accent2}}
    .gta-music button[aria-pressed="true"] {color:${UI.accent2};border-color:${UI.accent2}}
    .gta-music button:disabled {opacity:.4;cursor:default}
    .gta-music-transport button {flex:1}
    .gta-music input[type="range"] {accent-color:${UI.accent2};height:12px;margin:0;min-width:0;cursor:pointer}
    .gta-music-seek {width:100%;display:block}
    .gta-music-volume {flex:1;width:40px}
    .gta-music-status {display:flex;justify-content:space-between;color:${UI.dim};font-size:9px;gap:3px;margin:2px 0}
    .gta-music-options button {flex:1;font-size:9px;padding:3px 1px}
    .gta-music-list {display:none;max-height:96px;overflow:auto;margin-top:5px;overscroll-behavior:contain}
    .gta-music-list button {width:100%;text-align:left;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gta-music-note {font-size:9px;color:${UI.accent2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:12px;margin-top:3px}
    .gta-music-toast {left:12px;top:80px;width:min(280px,calc(20vw - 24px));padding:8px;box-sizing:border-box;
      pointer-events:none;font:600 11px/1.4 system-ui,sans-serif;display:none}
    .gta-music-toast div {white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;
  document.head.appendChild(css);
  const card = document.createElement('section'); card.className = 'gta-panel gta-music'; card.dataset.music = 'card';
  card.setAttribute('aria-label', 'Music player');
  const button = (action, label, glyph) => `<button type="button" data-action="${action}" aria-label="${label}" title="${label}">${glyph}</button>`;
  card.innerHTML = `<div class="gta-music-head">
    <svg class="gta-music-cover" viewBox="0 0 32 32" role="img" aria-label="Terrace road placeholder cover">
      <path fill="${PALETTE.sky.duskHorizon}" d="M0 0h32v32H0z"/><circle cx="23" cy="9" r="5" fill="${PALETTE.light.sun}"/>
      <path fill="${PALETTE.ground.grassDark}" d="M0 15l9-5 13 9 10-5v18H0z"/>
      <path fill="${PALETTE.road.asphalt}" d="M14 15h3l11 17H3z"/>
      <path stroke="${PALETTE.road.signText}" stroke-width="1.5" d="M15.5 18v3m0 3v6"/>
    </svg><div class="gta-music-info"><div class="gta-music-title" data-m="title"></div><div class="gta-music-artist" data-m="artist"></div></div>
    ${button('hide','Hide music player (T)','×')}</div>
    <div class="gta-music-status"><span data-m="time">0:00 / 0:00</span><span data-m="count">0/0</span></div>
    <input class="gta-music-seek" data-m="seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="Seek music">
    <div class="gta-music-row gta-music-transport">${button('previous','Previous track (,)','|‹')}${button('back','Rewind 10 seconds ([)','−10')}${button('play','Play or pause (/)','▶')}${button('forward','Forward 10 seconds (])','+10')}${button('next','Next track (.)','›|')}</div>
    <div class="gta-music-row">${button('mute','Mute music','♪')}<input class="gta-music-volume" data-m="volume" type="range" min="0" max="1" step="0.01" aria-label="Music volume"><span data-m="volumeText"></span></div>
    <div class="gta-music-row gta-music-options">${button('shuffle','Shuffle','Mix')}${button('repeat','Repeat mode','All')}${button('carOnly','Play only in a car','Car')}${button('expand','Show track list','List')}</div>
    <div class="gta-music-note" data-m="note" aria-live="polite"></div><div class="gta-music-list" data-m="list"></div>`;
  document.body.appendChild(card);
  const toast = document.createElement('div'); toast.className = 'gta-panel gta-music-toast'; toast.dataset.music = 'toast'; toast.setAttribute('role','status');
  toast.innerHTML = '<div data-m="toastLabel"></div><div data-m="toastText"></div>'; document.body.appendChild(toast);
  const fields = Object.fromEntries([...card.querySelectorAll('[data-m]'), ...toast.querySelectorAll('[data-m]')].map(e => [e.dataset.m, e]));
  const buttons = Object.fromEntries([...card.querySelectorAll('[data-action]')].map(e => [e.dataset.action, e]));
  let expanded = false, idle = 0, toastTime = 0, note = '', dirty = true, acc = 0, dragging = false;
  let wasPlaying = false, lastTracks = null, lastContext = -1, disposed = false;
  const st = { visible:false, expanded:false, renders:0 };
  const touch = () => {idle=0;dirty=true;};
  const unsubscribe = music.subscribe((kind, message) => {
    dirty = true;
    if (kind === 'notice') { note=message;toastTime=MUSIC.toastDuration; }
    else if (kind === 'track' || (!wasPlaying && music.state.playing)) {
      note = music.track ? `${music.track.title} · ${music.track.artist}` : '';
      toastTime = MUSIC.toastDuration;
    }
    wasPlaying = music.state.playing;
  });
  card.addEventListener('pointerdown', e => {e.stopPropagation();dragging=e.target === fields.seek;touch();});
  card.addEventListener('mousedown', e => e.stopPropagation());
  card.addEventListener('keydown', e => {e.stopPropagation();touch();});
  card.addEventListener('wheel', e => {e.stopPropagation();if(e.ctrlKey || !fields.list.contains(e.target)) e.preventDefault();touch();}, {passive:false});
  card.addEventListener('click', e => {
    e.stopPropagation();touch();
    const target=e.target.closest('button');if(!target) return;
    if(target.dataset.track != null) {music.select(Number(target.dataset.track));music.play();return;}
    switch(target.dataset.action) {
      case 'hide': music.setVisible(false);break;
      case 'previous': music.previous();break;
      case 'back': music.skip(-MUSIC.seekStep);break;
      case 'play': music.toggle();break;
      case 'forward': music.skip(MUSIC.seekStep);break;
      case 'next': music.next();break;
      case 'mute': music.setMuted(!music.state.muted);break;
      case 'shuffle': music.setShuffle(!music.state.shuffle);break;
      case 'repeat': {const modes=['off','all','one'];music.setRepeat(modes[(modes.indexOf(music.state.repeat)+1)%modes.length]);break;}
      case 'carOnly': music.setCarOnly(!music.state.carOnly);break;
      case 'expand': expanded=!expanded;st.expanded=expanded;break;
    }
  });
  fields.seek.addEventListener('input', () => {music.seek(Number(fields.seek.value));touch();});
  fields.volume.addEventListener('input', () => {music.setVolume(Number(fields.volume.value));touch();});
  function release() {dragging=false;}
  function pointerLock() {style(card,'pointerEvents',document.pointerLockElement ? 'none' : 'auto');}
  window.addEventListener('pointerup',release); window.addEventListener('blur',release);
  document.addEventListener('pointerlockchange',pointerLock);
  pointerLock();

  function render(driving, locked, cinematic, cutscene, menu) {
    st.renders++;
    const s=music.state, t=music.track, show=s.visible && !cinematic && !cutscene && !menu;
    st.visible=show;
    style(card,'display',show ? 'block' : 'none');
    style(card,'pointerEvents',locked ? 'none' : 'auto');
    style(card,'opacity',driving && idle >= MUSIC.idleAfter ? '0.45' : '0.85');
    style(toast,'display',!show && toastTime>0 && !cutscene && !menu ? 'block' : 'none');
    text(fields.toastLabel,s.playing ? 'Now playing' : 'Music');text(fields.toastText,note);attr(fields.toastText,'title',note);
    if (!show) return;
    text(fields.title,t?.title || (s.ready ? 'No music found' : 'Loading music…'));text(fields.artist,t?.artist || 'Terrace radio');
    attr(fields.title,'title',t?.title || '');attr(fields.artist,'title',t?.artist || '');
    text(fields.count,`${s.index+1}/${s.tracks.length}`);text(fields.time,`${time(music.currentTime)} / ${time(music.duration)}`);
    attr(fields.seek,'max',music.duration || 1);attr(fields.seek,'aria-valuetext',`${time(music.currentTime)} of ${time(music.duration)}`);
    if (!dragging && Number(fields.seek.value)!==music.currentTime) fields.seek.value=music.currentTime;
    if (Number(fields.volume.value)!==s.volume) fields.volume.value=s.volume;
    text(fields.volumeText,`${Math.round(s.volume*100)}%`);
    text(buttons.play,s.requested ? 'Ⅱ' : '▶');attr(buttons.play,'aria-pressed',s.requested);
    text(buttons.mute,s.muted ? '×♪' : '♪');attr(buttons.mute,'aria-pressed',s.muted);
    attr(buttons.shuffle,'aria-pressed',s.shuffle);attr(buttons.carOnly,'aria-pressed',s.carOnly);
    text(buttons.repeat,{off:'Off',all:'All',one:'One'}[s.repeat]);attr(buttons.repeat,'title',`Repeat: ${s.repeat}`);attr(buttons.repeat,'aria-label',`Repeat: ${s.repeat}`);
    attr(buttons.repeat,'aria-pressed',s.repeat!=='off');attr(buttons.expand,'aria-expanded',expanded);
    for(const key of ['previous','back','play','forward','next']) if(buttons[key].disabled !== !t) buttons[key].disabled=!t;
    if(fields.seek.disabled !== !t) fields.seek.disabled=!t;
    text(fields.note,toastTime>0 ? note : s.requested && s.carOnly && !driving ? 'Resumes in a car' : 'T hide · / play');
    if(lastTracks!==s.tracks) {
      lastTracks=s.tracks;fields.list.replaceChildren();
      s.tracks.forEach((track,index) => {const b=document.createElement('button');b.type='button';b.dataset.track=index;b.textContent=`${index+1}. ${track.title}`;b.title=`${track.title} · ${track.artist}`;fields.list.appendChild(b);});
    }
    style(fields.list,'display',expanded ? 'block' : 'none');
    for (const b of fields.list.children) attr(b,'aria-pressed',Number(b.dataset.track)===s.index);
  }
  return {
    card,toast,state:st,touch,
    update(dt,driving=false,locked=false,cinematic=false,cutscene=false,menu=false) {
      if(disposed) return;
      idle+=dt;toastTime=Math.max(0,toastTime-dt);acc+=dt;
      // Primitive bit mask avoids per-frame objects/strings and catches immediate mode transitions.
      const context=(driving?1:0)|(locked?2:0)|(cinematic?4:0)|(cutscene?8:0)|(menu?16:0);
      if(dirty || acc>=MUSIC.progressInterval || context!==lastContext) {render(driving,locked,cinematic,cutscene,menu);acc=0;dirty=false;lastContext=context;}
    },
    dispose() {disposed=true;unsubscribe();window.removeEventListener('pointerup',release);window.removeEventListener('blur',release);document.removeEventListener('pointerlockchange',pointerLock);card.remove();toast.remove();css.remove();},
  };
}
