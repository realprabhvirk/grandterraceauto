// Pure-logic weapon tests (no browser): damage + hit zones, falloff, ammo / reload, auto fire,
// pump, spread, holster/draw, ammo caps, save/load. Usage: .\dev.cmd node scripts/weaponsUnit.mjs
import { WEAPONS, hitDamage, falloff, HEADSHOT } from '../src/weapons/weaponStats.js';
import { createArsenal } from '../src/weapons/arsenal.js';

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// --- damage maths -------------------------------------------------------------------------
check('pistol body 25 / head 50 (x2)', hitDamage(WEAPONS.pistol, 'body', 10) === 25 && hitDamage(WEAPONS.pistol, 'head', 10) === 25 * HEADSHOT);
check('SMG 14, rifle 35', hitDamage(WEAPONS.smg, 'body', 30) === 14 && hitDamage(WEAPONS.rifle, 'body', 80) === 35);
check('shotgun: full damage inside 10 m', falloff(WEAPONS.shotgun, 5) === 1 && hitDamage(WEAPONS.shotgun, 'body', 9.9) === 8);
check('shotgun: falls off beyond 10 m', near(falloff(WEAPONS.shotgun, 22.5), 0.6) && near(falloff(WEAPONS.shotgun, 100), 0.2), { f22: falloff(WEAPONS.shotgun, 22.5), f100: falloff(WEAPONS.shotgun, 100) });
check('only the shotgun has falloff', falloff(WEAPONS.rifle, 140) === 1);
check('3 rifle body shots kill a 100 hp civilian, 2 headshots too', 3 * 35 >= 100 && 2 * 35 * HEADSHOT >= 100 && 2 * 35 < 100);
check('cop (150 hp) takes 6 pistol body shots', 5 * 25 < 150 && 6 * 25 >= 150);

// --- arsenal ------------------------------------------------------------------------------
const s1 = mem();
const A = createArsenal({ storage: s1 });
check('starts with pistol + SMG, holstered', A.owns('pistol') && A.owns('smg') && !A.owns('shotgun') && !A.armed);
check('fire while holstered does nothing', A.update(0.1, { trigger: true, triggerPressed: true }).fired === 0);
A.select(1);
check('select 1 draws the pistol', A.armed && A.weapon.id === 'pistol');
let fired = 0, dry = 0;
const step = (dt, inp) => { const e = A.update(dt, inp); fired += e.fired; dry += e.dry ? 1 : 0; return e; };
step(0.4, {}); // draw time
for (let i = 0; i < 12; i++) step(0.2, { trigger: true, triggerPressed: true });
check('pistol: 12 rounds then empty', fired === 12 && A.ammo.mag === 0, { fired, mag: A.ammo.mag });
A.state.autoReload = 0; // test the manual path
step(0.3, { trigger: true, triggerPressed: true });
check('empty: dry fire click', dry === 1 && A.state.reloading, { dry, reloading: A.state.reloading });
const res0 = A.ammo.reserve;
for (let t = 0; t < 1.5; t += 0.1) step(0.1, {});
check('reload refills the magazine from the reserve', A.ammo.mag === 12 && A.ammo.reserve === res0 - 12, { mag: A.ammo.mag, reserve: A.ammo.reserve, res0 });
// Semi-auto: holding the trigger fires once.
fired = 0;
for (let i = 0; i < 10; i++) step(0.05, { trigger: true, triggerPressed: i === 0 });
check('pistol is semi-auto (hold = 1 shot)', fired === 1, { fired });
// SMG full auto ~11/s.
A.select('smg'); step(0.4, {}); fired = 0;
for (let i = 0; i < 60; i++) step(1 / 60, { trigger: true, triggerPressed: i === 0 });
check('SMG full auto ~11 rounds/s', fired >= 10 && fired <= 12, { fired });
// Spread blooms while firing and recovers.
const bloomed = A.spread(0);
for (let i = 0; i < 60; i++) step(1 / 60, {});
check('spread grows with fire, recovers over time', bloomed > WEAPONS.smg.spread.base + 0.03 && A.spread(0) < bloomed, { bloomed, after: A.spread(0) });
check('spread grows while moving', A.spread(1) > A.spread(0));
// Shotgun: buy, pump between shots, 8 pellets, shell-by-shell reload.
A.give('shotgun', 12); A.select(3); step(0.4, {});
fired = 0;
const e1 = step(0.01, { trigger: true, triggerPressed: true });
const e2 = step(0.2, { trigger: true, triggerPressed: true });
check('shotgun: 8 pellets per shot, pump blocks the next one', e1.fired === 8 && e2.fired === 0, { e1: e1.fired, e2: e2.fired });
for (let t = 0; t < 0.8; t += 0.1) step(0.1, {});
const e3 = step(0.01, { trigger: true, triggerPressed: true });
check('shotgun fires again after the pump', e3.fired === 8);
A.reload();
const magBefore = A.ammo.mag;
step(0.5, {});
check('shotgun reloads one shell at a time', A.ammo.mag === magBefore + 1 && A.state.reloading, { magBefore, mag: A.ammo.mag });
// Holster / draw.
A.toggleHolster();
check('Q holsters (no reload, not armed)', !A.armed && !A.state.reloading);
A.toggleHolster();
check('Q draws again', A.armed);
// Ammo caps.
const room = A.roomFor('pistol');
const added = A.addAmmo('pistol', 999);
check('reserve ammo capped per weapon', added === room && A.ammo.reserve <= WEAPONS[A.weapon.id].reserveCap && A.roomFor('pistol') === 0, { room, added });
check('no ammo for guns you do not own', A.addAmmo('rifle', 10) === 0 && !A.select('rifle'));
// Save / load round trip.
A.save();
const B = createArsenal({ storage: s1 });
check('owned weapons + ammo saved and loaded', B.owns('shotgun') && B.state.ammo.pistol.reserve === WEAPONS.pistol.reserveCap, { owned: [...B.state.owned] });
// No NaNs anywhere.
const nums = JSON.stringify(A.state.ammo) + A.spread(0.5) + A.state.bloom + A.state.cooldown;
check('no NaN', !/NaN/.test(nums));

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} weapon unit checks passed`);
process.exit(failed ? 1 : 0);
