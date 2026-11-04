// Screenshot harness: reuses (or starts) the Vite dev server, opens the game in the
// installed Microsoft Edge via Playwright, captures each camera preset into ./shots/,
// and exits non-zero if the page logged any console errors.
//
// Usage: .\dev.cmd node scripts/shot.mjs [preset ...]   (no presets = all)
//        set SHOT_EXTRA=&hud to append URL flags (e.g. the F3 overlay)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = 'http://127.0.0.1:5173/';
const ALL = ['player', 'hero-front', 'hero-34', 'hero-34-dusk', 'street', 'overview', 'top'];
const presets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const outDir = path.join(root, 'shots');
mkdirSync(outDir, { recursive: true });

async function serverUp() {
  try { return (await fetch(URL_BASE)).ok; } catch { return false; }
}

let server = null;
if (!(await serverUp())) {
  console.log('[shot] starting dev server');
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await serverUp())) { console.error('[shot] dev server did not start'); process.exit(2); }
}

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const errors = [];
try {
  for (const preset of presets) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${preset}] console: ${m.text()}`);
      else if (process.env.SHOT_VERBOSE) console.log(`[${preset}] ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${preset}] pageerror: ${e.message}`));
    const t0 = Date.now();
    await page.goto(`${URL_BASE}?cam=${preset}&shot=1${process.env.SHOT_EXTRA || ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gta && window.__gta.ready === true, null, { timeout: 90000 });
    // Let a few frames settle (shadows, sign textures).
    await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n > 20 ? r() : requestAnimationFrame(f)); f(); }));
    // Optional keys to press before the capture, e.g. SHOT_KEYS=F4 (collider view).
    for (const key of (process.env.SHOT_KEYS || '').split(',').filter(Boolean)) {
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
    }
    if (process.env.SHOT_KEYS) await page.waitForTimeout(300);
    const stats = await page.evaluate(() => (window.__gta.stats ? window.__gta.stats() : null));
    const file = path.join(outDir, `${preset}.png`);
    await page.screenshot({ path: file });
    console.log(`[shot] ${preset} -> shots/${preset}.png (${Date.now() - t0} ms)${stats ? ' ' + JSON.stringify(stats) : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

if (errors.length) {
  console.error('\n[shot] BROWSER ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('[shot] OK, no console errors');
