// Automated walk test in real Edge: spawn outside 62, hold W, check that the player
// walks up the front path, climbs onto the porch and is stopped by the house.
// Also strafes into the hedge to check it blocks. Exits non-zero on failure.
//
// Usage (dev server running): .\dev.cmd node scripts/walktest.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173/?cam=player&shot=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
await page.waitForTimeout(800);

// Player position in hero-lot space (x across, z toward street, y above pad).
const local = () => page.evaluate(() => {
  const g = window.__gta, p = g.controls.player.position, lot = g.world.layout.hero;
  const dx = p.x - lot.x, dz = p.z - lot.z, c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  return { x: dx * c - dz * s, z: dx * s + dz * c, y: p.y - lot.h, grounded: g.controls.player.state.grounded };
});
const fmt = (p) => `x=${p.x.toFixed(2)} z=${p.z.toFixed(2)} y=${p.y.toFixed(2)}`;
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(250); };

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

const start = await local();
console.log('spawn  ', fmt(start));
check('spawn on footpath outside 62', start.z > 14 && start.z < 16 && Math.abs(start.y) < 0.4, fmt(start));

await hold('KeyW', 4500);
const atDoor = await local();
console.log('after W', fmt(atDoor));
check('walked up the path to the house', atDoor.z < 8, fmt(atDoor));
check('stopped by the house wall (no clipping)', atDoor.z > 3.3, fmt(atDoor)); // front door is recessed at z = 3.2
check('standing on the porch slab', atDoor.y > 0.1 && atDoor.y < 0.35, fmt(atDoor));
await page.screenshot({ path: 'shots/walk-porch.png' });

// Walk back out to the footpath, then strafe left along the hedge line.
await hold('KeyS', 2600);
const back = await local();
console.log('after S', fmt(back));
await hold('KeyA', 1800);
const side = await local();
console.log('after A', fmt(side));
check('back-pedalled toward the street', back.z > 11, fmt(back));

// Jump.
await page.keyboard.press('Space');
await page.waitForTimeout(180);
const air = await local();
await page.waitForTimeout(1200);
const landed = await local();
check('jump leaves the ground and lands again', air.y > side.y + 0.3 && Math.abs(landed.y - side.y) < 0.3, `air ${air.y.toFixed(2)} landed ${landed.y.toFixed(2)}`);

// Debug fly toggle (F2).
await page.keyboard.press('F2');
await page.waitForTimeout(200);
const mode = await page.evaluate(() => window.__gta.controls.mode);
check('F2 toggles debug fly cam', mode === 'fly', mode);

await browser.close();
if (errors.length) { console.error('BROWSER ERRORS:\n' + errors.join('\n')); process.exit(1); }
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} check(s) FAILED` : '\nAll walk checks passed');
process.exit(failed.length ? 1 : 0);
