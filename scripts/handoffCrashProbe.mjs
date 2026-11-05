// Read-only task 000 diagnostic: reproduce phantomtest's wall fixture without changing game code.
// No screenshots. One headless Edge browser, always closed.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto(new URL('?cam=player', process.env.GTA_URL || 'http://127.0.0.1:5173/').href);
  await page.waitForFunction(() => window.__gta?.ready, null, { timeout: 90000 });
  console.log(JSON.stringify(await page.evaluate(async () => {
    const g = window.__gta, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(800);
    g.debug.enter(g.vehicles.cars.findIndex((c) => !c.dead && !c.impounded && !c.stolen && c.type === 'sedan'));
    await wait(1400);
    for (const t of [...g.traffic.cars]) g.traffic.removeCar(t);
    const c = g.controls.car, body = c.body.body;
    c.body.teleport(553, g.world.terrain.getHeight(553, -82), -82, Math.PI);
    await wait(400);
    const before = { pos: body.translation(), velocity: body.linvel(), mode: g.controls.mode, health: c.health };
    const samples = [];
    let recording = true;
    g.physics.onStep(() => {
      if (!recording) return;
      const contacts = [];
      for (const col of c.body.colliders) g.physics.world.contactPairsWith(col, (other) => {
        g.physics.world.contactPair(col, other, (m) => {
          if (m.numContacts()) contacts.push({ tag: g.physics.tagOf(other.handle), normal: m.normal(), depth: m.contactDist(0) });
        });
      });
      samples.push({ pos: body.translation(), velocity: body.linvel(), contacts, dv: c.body.impactDv, crash: { open: c.crash?.open, cd: c.crash?.cd }, trace: g.debug.carTrace().at(-1) });
    });
    const v = { x: 0, y: 0, z: -25 };
    body.setLinvel(v, true); c.body.lastVel = { ...v };
    await wait(1800); recording = false;
    return { before, after: { pos: body.translation(), velocity: body.linvel(), health: c.health }, damage: g.debug.damageEvents(), ignored: g.debug.ignoredImpacts(), samples };
  }), null, 2));
} finally {
  await browser.close();
}
