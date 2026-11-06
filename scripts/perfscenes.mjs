// Per-scene performance log (headless Edge, 960x540): fps + draw calls + triangles.
// Usage (dev server running): .\dev.cmd node scripts/perfscenes.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(new URL('?cam=player', process.env.GTA_URL || 'http://127.0.0.1:5173/').href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  const rows = await page.evaluate(async () => {
    const g = window.__gta, d = g.debug, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const measure = async (name) => {
      await wait(2500);
      const i = g.renderer.info.render;
      return { scene: name, fps: g.stats().fps, calls: i.calls, tris: i.triangles };
    };
    const out = [];
    out.push(await measure('suburb: on foot outside 62'));
    d.teleportLocal(-2, 0.2, 2, Math.PI); out.push(await measure('inside 62 (living room)'));
    d.enter(); await wait(1500);
    const S = g.world.network.main.samples[150];
    g.controls.car.body.teleport(S.x - S.nx * 1.8, S.h, S.z - S.nz * 1.8, Math.atan2(S.tx, S.tz));
    out.push(await measure('driving: chase cam on Grand Terrace'));
    await d.tap('KeyC'); out.push(await measure('driving: cabin cam + mirrors'));
    await d.tap('KeyC'); await d.tap('KeyC');
    g.controls.car.body.teleport(470, g.world.terrain.getHeight(470, -87.2), -87.2, Math.PI / 2);
    out.push(await measure('driving: Terrace Pde (town centre)'));
    await d.tap('KeyF'); await wait(1200);
    d.teleport(470, -92, 0); out.push(await measure('town centre on foot (busiest)'));
    d.teleport(553, -104, Math.PI); out.push(await measure('inside Terrace Central'));
    d.teleport(399.6, -74.1, 0); out.push(await measure('inside Quick Stop'));
    const w = g.world.town.wattle.centre; d.teleport(w.x - 24, w.z, Math.PI / 2); out.push(await measure('Wattle Park'));
    d.teleport(470, -92, 0); g.lighting.setDusk(1); out.push(await measure('town centre at dusk'));
    g.lighting.setDusk(0);
    // Phase 5 scenes.
    d.teleport(745, -92, 0); out.push(await measure('downtown: City Plaza'));
    d.teleport(745, -92, 0); g.lighting.setDusk(1); out.push(await measure('downtown at night (neon)'));
    g.lighting.setDusk(0);
    d.teleport(800, 60, Math.PI); out.push(await measure('beach promenade (water, gulls)'));
    d.teleport(470, -300, 0); out.push(await measure('Northgate (houses, school, plaza)'));
    d.teleport(835, -300, 0); out.push(await measure('industrial estate'));
    d.teleport(520, -545, Math.PI); out.push(await measure('airport terminal (aircraft, apron vehicles)'));
    d.teleport(900, -660, -Math.PI / 2); out.push(await measure('airport airside (runway, lights)'));
    // Task004: real western terrain/road sites, then working content as phases add it.
    if(g.world.rural)for(const [name,x,z] of [
      ['rural: garrison gate',-480,-252],['rural: parade road',-1000,-252],
      ['rural: orchard access',100,-350],['rural: creek farm',535,180],
      ['rural: west farm',-980,180],['rural: works access',-335,-480],
    ]){d.teleport(x,z,0);out.push(await measure(name));}
    d.teleport(470, -92, Math.PI);
    g.weapons.arsenal.give('smg', 200); g.weapons.arsenal.select('smg');
    g.controls.input.setVirtual('Mouse0', true);
    out.push(await measure('town: firing the SMG (third person)'));
    g.controls.input.setVirtual('Mouse0', false);
    await d.tap('KeyC');
    g.controls.input.setVirtual('Mouse0', true);
    out.push(await measure('town: firing the SMG (first person viewmodel)'));
    g.controls.input.setVirtual('Mouse0', false);
    await d.tap('KeyC');
    return out;
  });
  for (const r of rows) console.log(`${r.scene.padEnd(40)} fps ${String(r.fps).padStart(3)}  calls ${String(r.calls).padStart(4)}  tris ${r.tris}`);
  console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
} finally {
  await context.close();
  await browser.close();
}
