// Serial filesystem checks; fixtures stay under ignored .tools, never in Car Music.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildMusicIndex, trackMetadata } from './musicIndex.mjs';

export async function testMusicIndex() {
  const root = fileURLToPath(new URL('../', import.meta.url)), tools = resolve(root, '.tools');
  await mkdir(tools, { recursive: true });
  const temp = await mkdtemp(resolve(tools, 'music-test-'));
  const source = resolve(temp, 'input'), output = resolve(temp, 'output');
  let checks = 0;
  const pass = label => { checks++; console.log('PASS index: ' + label); };
  try {
    assert.deepEqual(await buildMusicIndex({ source, output }), []);
    assert.deepEqual(JSON.parse(await readFile(resolve(output, 'playlist.json'), 'utf8')), []);
    pass('missing folder generates empty manifest');
    await mkdir(source);
    assert.deepEqual(await buildMusicIndex({ source, output }), []);
    pass('empty folder');
    const names = ['Bexley .Road - Baggh-E SMG.mp3', 'GTA Mohali - Sultaan.mp3', 'Kaali Hoodie - Sidhu Moose Wala.mp3', 'Night #1% - Someone.MP3', 'Unknown. Title.wav'];
    for (const name of names) await writeFile(resolve(source, name), Buffer.from('fixture:' + name));
    await writeFile(resolve(source, 'notes.txt'), 'not audio');
    await mkdir(resolve(source, 'folder.mp3'));
    const list = await buildMusicIndex({ source, output });
    assert.deepEqual(list.slice(0, 3).map(t => [t.title, t.artist]), [['Kaali Hoodie','Sidhu Moose Wala feat. Bohemia'], ['GTA Mohali','Sultaan'], ['Bexley. Road','SMG']]);
    assert.equal(list.length, 5);
    pass('canonical aliases/order, uppercase extension, ignores non-audio and directories');
    assert.deepEqual(trackMetadata('Night #1% - Someone.MP3'), { file:'Night%20%231%25%20-%20Someone.MP3',title:'Night #1%',artist:'Someone' });
    assert.deepEqual(trackMetadata('Unknown. Title.wav'), { file:'Unknown.%20Title.wav',title:'Unknown. Title',artist:'' });
    pass('normal metadata, filename fallback and URL encoding');
    for (const name of names) assert.deepEqual(await readFile(resolve(source, name)), await readFile(resolve(output, name)));
    pass('copies byte-for-byte without changing sources');
    await rm(resolve(source, names[0]));
    await writeFile(resolve(output, 'keep.txt'), 'unrelated');
    assert.equal((await buildMusicIndex({ source, output })).length, 4);
    assert.equal((await readdir(output)).includes(names[0]), false);
    assert.equal(await readFile(resolve(output,'keep.txt'),'utf8'), 'unrelated');
    pass('removed track leaves neither stale audio nor stale manifest entry');
    await assert.rejects(buildMusicIndex({source,output:source}), /separate/);
    await assert.rejects(buildMusicIndex({source,output:resolve(source,'child')}), /separate/);
    pass('rejects source/output overlap');
    const actual = await buildMusicIndex();
    assert.equal(actual.length, 3, 'owner playlist must have exactly three tracks');
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    for (const track of actual) {
      const name = decodeURIComponent(track.file);
      assert.equal(hash(await readFile(resolve(root,'Car Music',name))), hash(await readFile(resolve(root,'public/music',name))));
    }
    pass('real three-track generated copy hashes match originals');
    return checks;
  } finally {
    assert.equal(dirname(resolve(temp)), tools, 'cleanup must stay inside project .tools');
    await rm(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`${await testMusicIndex()}/8 index checks passed`);
