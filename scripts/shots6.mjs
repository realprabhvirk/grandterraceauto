// Phase 6 Step 7: exactly three 1280x720 screenshots into shots/phase6/.
//   1 aerial over the motorway and the city, 2 street level on Terrace Pde (shops, signs,
//   lights, NPCs), 3 full map (labels, street names, legend, a route).
// Usage: .\dev.cmd node scripts/shots6.mjs   (dev server must be running on :5173)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'shots', 'phase6');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(cam) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5173/?cam=${cam}&shot=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  await wait(1500);
  return page;
}
try {
  // 1. Aerial: motorway in front, Northgate/industry either side, town + downtown + stadium beyond.
  {
    const page = await open('overview');
    await page.evaluate(() => {
      const g = window.__gta;
      g.camera.position.set(470, 95, -380); g.camera.lookAt(700, -10, -120); g.controls.syncFly();
    });
    await wait(3500);
    await page.screenshot({ path: path.join(out, '1-aerial-highway.png') });
    await page.close();
  }
  // 2. Street level on Terrace Pde looking east: kit shops, signs, traffic lights, people, bus.
  {
    const page = await open('player');
    await page.evaluate(async () => {
      const g = window.__gta;
      g.debug.teleport(436, -89.6, Math.PI / 2 - 0.12);
      const bus = g.traffic.service.buses[0];
      const lane = g.traffic.graph.lanes.find((l) => l.town && l.from && l.from.z === -85 && l.to?.z === -85 && l.from.x === 420 && l.to.x === 520);
      if (bus && lane) { bus.lane = lane; bus.s = 40; bus.v = 0; bus.dwell = 0; }
    });
    await wait(4000);
    await page.screenshot({ path: path.join(out, '2-street-terrace-pde.png') });
    await page.close();
  }
  // 3. Full map with a route to the stadium.
  {
    const page = await open('player');
    await page.evaluate(() => { const g = window.__gta, s = g.world.places.find((p) => p.label === 'Terrace Stadium'); g.debug.teleport(560, -92, 0); g.nav.set(s.x, s.z, s.label); });
    await wait(800);
    await page.keyboard.press('Tab'); await wait(900);
    await page.screenshot({ path: path.join(out, '3-full-map.png') });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(errors.length ? `ERRORS: ${errors.slice(0, 3).join(' | ')}` : 'shots ok, no page errors');
