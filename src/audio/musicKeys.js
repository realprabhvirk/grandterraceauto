// Event-based so play() stays inside the real user gesture, including under pointer lock.
import { MUSIC } from './musicConfig.js';

export function createMusicKeys({ music, ui, input, menuOpen }) {
  function keydown(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || input.locked || menuOpen()) return;
    if (!input.pointerLocked && document.activeElement?.closest('input,textarea,select,button,[contenteditable="true"]')) return;
    // Shift+/ is the existing help key. All music shortcuts use the plain key.
    if (e.shiftKey) return;
    switch (e.code) {
      case 'KeyT': music.setVisible(!music.state.visible); break;
      case 'Slash': music.toggle(); break;
      case 'Comma': music.previous(); break;
      case 'Period': music.next(); break;
      case 'BracketLeft': music.skip(-MUSIC.seekStep); break;
      case 'BracketRight': music.skip(MUSIC.seekStep); break;
      case 'Minus': music.setVolume(music.state.volume-MUSIC.volumeStep); break;
      case 'Equal': music.setVolume(music.state.volume+MUSIC.volumeStep); break;
      case 'Backslash': music.setShuffle(!music.state.shuffle); break;
      case 'Semicolon': { const modes=['off','all','one']; music.setRepeat(modes[(modes.indexOf(music.state.repeat)+1)%modes.length]); break; }
      default: return;
    }
    e.preventDefault(); ui.touch();
  }
  window.addEventListener('keydown',keydown);
  return { dispose() { window.removeEventListener('keydown',keydown); } };
}
