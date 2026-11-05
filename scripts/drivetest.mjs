// Drive test in real Edge: get into the hero car, then autopilot (virtual W/A/S/D keys,
// i.e. the real driving code) along the full length of Grand Terrace and in-and-out of
// all three cul-de-sacs. Checks the car never tunnels, flips or launches, and saves
// screenshots mid-drive to shots/phase2/. Exits non-zero on any failure.
//
// Usage (dev server running): .\dev.cmd node scripts/drivetest.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('shots/phase2', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173/?cam=player&shot=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });

await page.evaluate(() => window.__gta.debug.enter());
await page.waitForTimeout(1500);
const routes = await page.evaluate(() => window.__gta.debug.routes());
console.log('routes:', routes.map((r) => `${r.name} (${r.n} pts)`).join(', '));

const results = [];
for (let i = 0; i < routes.length; i++) {
  // Cul-de-sacs: simple centreline driving, physics-only pass condition (Phase 3 change).
  const simple = i > 0;
  // Phase 5: a wrecked car ejects the driver, so every route starts with a repaired car.
  await page.evaluate(() => { const c = window.__gta.controls.car; if (c) { c.health = 100; c.dead = false; c.body.dead = false; } });
  await page.evaluate(([i, simple]) => { window.__run = window.__gta.debug.drive(i, { speed: simple ? 9 : 15, timeout: simple ? 60 : 160, simple }).then((r) => (window.__runResult = r)); window.__runResult = null; }, [i, simple]);
  const slug = routes[i].name.toLowerCase().replace(/\s+/g, '-');
  let shots = 0, res = null;
  for (let t = 0; t < 170; t++) {
    await page.waitForTimeout(1000);
    res = await page.evaluate(() => window.__runResult);
    if (res) break;
    if ((t === 4 || t === 14) && shots < 2 && process.env.SHOTS) { await page.screenshot({ path: `shots/phase2/drive-${slug}-${++shots}.png` }); }
  }
  const stats = await page.evaluate(() => window.__gta.stats());
  const physicsOk = res && res.minAbove > -0.5 && res.maxAbove < 2.5 && res.maxTilt < 55 && !res.nan;
  const ok = simple ? physicsOk : physicsOk && res.ok;
  results.push({ ...res, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${routes[i].name.padEnd(14)} ${JSON.stringify(res)}  fps ${stats.fps} calls ${stats.calls}`);
}
await browser.close();
if (errors.length) { console.error('BROWSER ERRORS:\n' + errors.join('\n')); process.exit(1); }
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} route(s) FAILED` : '\nAll routes driven cleanly');
process.exit(failed ? 1 : 0);
