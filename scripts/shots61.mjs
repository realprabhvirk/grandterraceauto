// Phase 6.1 Step 3: exactly two 1280x720 screenshots into shots/phase6_1/.
//   1 aerial of the whole airport with an aircraft on the runway, 2 an aircraft taking off.
// Usage: .\dev.cmd node scripts/shots61.mjs   (dev server must be running on :5173)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'shots', 'phase6_1');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?cam=overview&shot=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  await wait(1500);
  // Fast-forward until an aircraft is lining up / rolling on the runway, then an aerial over the field.
  const ok1 = await page.evaluate(() => {
    const g = window.__gta, A = g.airport;
    g.camera.position.set(470, 260, -330); g.camera.lookAt(470, -4, -640); g.controls.syncFly();
    for (let t = 0; t < 600; t += 0.1) { A.update(0.1); if (A.planes.some((p) => p.state === 'takeoff' && p.alt < 1 && p.pos.x < 700 && p.pos.x > 450)) return true; }
    return false;
  });
  await wait(400);
  await page.screenshot({ path: path.join(out, '1-airport-aerial.png') });
  // Fast-forward to the next departure just after rotation and frame it from beside the runway.
  const ok2 = await page.evaluate(() => {
    const g = window.__gta, A = g.airport;
    for (let t = 0; t < 600; t += 0.05) {
      A.update(0.05);
      const p = A.planes.find((q) => q.state === 'takeoff' && q.alt > 6 && q.alt < 14);
      if (p) { const x = p.pos.x - 70; g.camera.position.set(x - 60, -1.5, -705 + 55); g.camera.lookAt(x, -4.4 + p.alt + 4, -705); g.controls.syncFly(); return p.type; }
    }
    return false;
  });
  await wait(150);
  await page.screenshot({ path: path.join(out, '2-takeoff.png') });
  console.log(`aerial: plane on runway ${ok1}; takeoff: ${ok2}`);
  await page.close();
} finally {
  await browser.close();
}
console.log(errors.length ? `ERRORS: ${errors.slice(0, 3).join(' | ')}` : 'shots ok, no page errors');
