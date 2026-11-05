// Phase 2 end-to-end test in real Edge with real key presses:
// spawn -> walk to the hero car -> F -> drive out of the driveway and along Grand
// Terrace -> stop -> F (get out) -> emotes + crouch -> N (night) -> back in, lights,
// look-behind. Screenshots of every stage go to shots/phase2/. Also checks FPS and
// draw calls, and fails on any console error.
//
// Usage (dev server running): .\dev.cmd node scripts/phase2test.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('shots/phase2', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(new URL('?cam=player', process.env.GTA_URL || 'http://127.0.0.1:5173/').href, { waitUntil: 'load' });
await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
await page.waitForTimeout(800);

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const state = () => page.evaluate(() => window.__gta.debug.state());
const local = () => page.evaluate(() => window.__gta.debug.heroLocal());
const stats = () => page.evaluate(() => window.__gta.stats());
const shot = async (name) => { if (!process.env.SHOTS) return; await page.screenshot({ path: `shots/phase2/${name}.png` }); console.log(`      shot shots/phase2/${name}.png`); };
const holdUntil = async (key, cond, maxMs) => {
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { if (await cond()) break; await page.waitForTimeout(40); }
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
};

// 1. Spawn.
await page.mouse.click(640, 360); // unlocks audio (pointer lock is refused headless, that's fine)
await shot('01-spawn');
let s = await state();
check('spawns walking outside 62', s.mode === 'walk');

// 2. Walk to the hero car (real keys): up the lawn, then right toward the driver's door.
await holdUntil('KeyW', async () => (await local()).z < 9.0, 5000);
await holdUntil('KeyD', async () => (await local()).x > 4.6, 4000);
s = await state();
check('prompt appears near the hero car', !!s.prompt && s.prompt.includes('hero'), `prompt="${s.prompt}" at ${JSON.stringify(await local())}`);
await shot('02-prompt');

// 3. Get in.
await page.keyboard.press('KeyF');
await page.waitForTimeout(450);
await shot('03-entering');
await page.waitForTimeout(1000);
s = await state();
check('F gets into the car', s.mode === 'drive' && s.car?.type === 'sedan', JSON.stringify(s.car));
await shot('04-seated');

// 4. Drive out of the driveway and along Grand Terrace (autopilot = virtual keys).
const drive = await page.evaluate(() => window.__gta.debug.driveOut(30));
check('drove out of the driveway and down Grand Terrace', drive.ok, JSON.stringify(drive));
await shot('05-driving');
let st = await stats();
check('fps >= 50 while driving (headless)', st.fps >= 50, `fps ${st.fps}`);
check('draw calls < 350', st.calls < 350, `calls ${st.calls}`);
// Horn + look behind.
await page.keyboard.down('KeyH'); await page.waitForTimeout(300); await page.keyboard.up('KeyH');
await page.keyboard.down('KeyB'); await page.waitForTimeout(500); await shot('06-look-behind'); await page.keyboard.up('KeyB');

// 5. Stop and get out.
await page.keyboard.down('KeyS'); await page.waitForTimeout(2500); await page.keyboard.up('KeyS');
await page.waitForTimeout(400);
await page.keyboard.press('KeyF');
await page.waitForTimeout(350);
await shot('07-exiting');
await page.waitForTimeout(900);
s = await state();
check('F gets out on foot', s.mode === 'walk', JSON.stringify(s));
const carPos = await page.evaluate(() => { const c = window.__gta.vehicles.cars.find((x) => x.hero).position; return [c.x, c.z]; });
const d = Math.hypot(carPos[0] - s.player[0], carPos[1] - s.player[2]);
check('placed beside the car, not inside it', d > 1.2 && d < 4.5, `distance ${d.toFixed(2)} m`);
await page.waitForTimeout(600);
const parked = await page.evaluate(() => Math.abs(window.__gta.vehicles.cars.find((x) => x.hero).body.state.speed));
check('car brakes to a stop when left', parked < 0.5, `speed ${parked.toFixed(2)} m/s`);
await shot('08-out');

// 6. Emotes + crouch.
for (const [key, name] of [['Digit1', 'wave'], ['Digit2', 'dance'], ['Digit3', 'sit'], ['Digit4', 'point']]) {
  await page.keyboard.down('KeyG'); await page.waitForTimeout(60); await page.keyboard.press(key); await page.waitForTimeout(60); await page.keyboard.up('KeyG'); // Phase 5: emotes = hold G + 1-4
  await page.waitForTimeout(900);
  s = await state();
  check(`emote ${name}`, s.action === name, `action=${s.action}`);
  await shot(`09-emote-${name}`);
}
await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW'); await page.waitForTimeout(100);
s = await state();
check('moving interrupts the emote', s.action === null, `action=${s.action}`);
await page.keyboard.down('ControlLeft'); await page.waitForTimeout(700); await shot('10-crouch'); await page.keyboard.up('ControlLeft');

// 7. Night, back in the car, headlights.
await page.keyboard.press('KeyN');
await page.waitForTimeout(2600);
await shot('11-night-on-foot');
const near = await page.evaluate(() => window.__gta.debug.state().prompt);
if (near) await page.keyboard.press('KeyF'); else await page.evaluate(() => window.__gta.debug.enter());
await page.waitForTimeout(1500);
s = await state();
check('headlights come on at night', s.car && s.car.lights === true, JSON.stringify(s.car));
await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
await shot('12-night-driving');
st = await stats();
check('fps >= 50 at night (headless)', st.fps >= 50, `fps ${st.fps} calls ${st.calls} tris ${st.triangles}`);

await browser.close();
if (errors.length) { console.error('BROWSER ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} Phase 2 checks passed`);
process.exit(failed ? 1 : 0);
