// Generated served copies only. Original files in Car Music are never changed.
import { readdir, mkdir, copyFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const AUDIO = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.webm']);
const KNOWN = [
  { title: 'Kaali Hoodie', artist: 'Sidhu Moose Wala feat. Bohemia' },
  { title: 'GTA Mohali', artist: 'Sultaan' },
  { title: 'Bexley. Road', artist: 'SMG' },
];
const key = s => s.toLowerCase().replace(/[.\s]+/g, ' ').trim();

export function trackMetadata(file) {
  const stem = basename(file, extname(file));
  const split = stem.indexOf(' - ');
  const title = (split < 0 ? stem : stem.slice(0, split)).trim();
  const known = KNOWN.find(t => key(t.title) === key(title));
  return {
    file: encodeURIComponent(file),
    title: known?.title || title || stem,
    artist: known?.artist || (split < 0 ? '' : stem.slice(split + 3).trim()),
  };
}

export async function buildMusicIndex({ source = resolve(ROOT, 'Car Music'), output = resolve(ROOT, 'public/music') } = {}) {
  // Reject overlapping directories even when called by another script.
  const src = resolve(source), out = resolve(output);
  const a = src.toLowerCase(), b = out.toLowerCase();
  if (a === b || a.startsWith(b + '/') || b.startsWith(a + '/') || a.startsWith(b + '\\') || b.startsWith(a + '\\')) throw new Error('Music source and output must be separate directories');
  let entries;
  try { entries = await readdir(src, { withFileTypes: true }); }
  catch (e) { if (e.code !== 'ENOENT') throw e; entries = []; }
  const files = entries.filter(e => e.isFile() && AUDIO.has(extname(e.name).toLowerCase())).map(e => e.name);
  const rank = name => { const i = KNOWN.findIndex(t => t.title === trackMetadata(name).title); return i < 0 ? KNOWN.length : i; };
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en'));
  await mkdir(out, { recursive: true });
  for (const file of files) await copyFile(resolve(src, file), resolve(out, file));
  // Remove obsolete generated audio after copying; leave unrelated files alone.
  for (const entry of await readdir(out, { withFileTypes: true })) {
    if (entry.isFile() && AUDIO.has(extname(entry.name).toLowerCase()) && !files.includes(entry.name)) await unlink(resolve(out, entry.name));
  }
  const playlist = files.map(trackMetadata);
  await writeFile(resolve(out, 'playlist.json'), JSON.stringify(playlist, null, 2) + '\n');
  return playlist;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const playlist = await buildMusicIndex();
  console.log(`Music: ${playlist.length} tracks copied to public/music/`);
  for (const track of playlist) console.log(`  ${track.title}${track.artist ? ' - ' + track.artist : ''}`);
  if (!playlist.length) console.log('Drop audio files in Car Music/ and run npm run music again.');
}
