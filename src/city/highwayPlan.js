// Terrace Motorway: a divided highway (2 lanes each way + median barrier) running east-west
// between the town's north ring road and Northgate / the industrial estate. It rises on
// embankments and crosses Northgate Rd and King St North on overpasses, and joins the network at
// both ends through ramps (Motorway West Ramp: Ring Rd West <-> Waratah St; Motorway East Ramp:
// Ring Rd East <-> Crane St). Everything about its shape lives here.
import { TOWN } from '../world/terrain.js';

export const HWY = {
  z: -252,               // centreline
  x0: 330, x1: 970,      // ends (ramp junction nodes)
  halfW: 10.5,           // shoulder to shoulder half width
  lane: 3.5,             // lane width
  median: 1.2,           // half width of the median strip (barrier in the middle)
  ground: TOWN.h,
  deckY: TOWN.h + 5.2,   // road level on the overpasses (5.2 m over the street below)
  crossings: [420, 790], // Northgate Rd, King St North pass underneath
  deckHalf: 11,          // half length of each bridge deck (along x)
  ramp: 130,             // embankment length each side of a bridge (grade ~4%)
  rampWest: 74,          // ...except west of Northgate Rd, where the west junction is only 90 m away
  streetHalf: 7.5,       // half width of the street corridor kept at ground level under a bridge
};

const smooth = (t) => t * t * (3 - 2 * t);
/** Road surface height of the highway at x (embankment profile). */
export function highwayY(x) {
  let k = 0;
  for (const c of HWY.crossings) {
    const d = Math.abs(x - c) - HWY.deckHalf, len = x < c && c === HWY.crossings[0] ? HWY.rampWest : HWY.ramp;
    k = Math.max(k, d <= 0 ? 1 : smooth(Math.max(0, 1 - d / len)));
  }
  return HWY.ground + (HWY.deckY - HWY.ground) * k;
}
/** Bridge decks (static colliders + driveHeight). */
export const BRIDGES = HWY.crossings.map((c) => ({ x0: c - HWY.deckHalf, x1: c + HWY.deckHalf, z0: HWY.z - HWY.halfW, z1: HWY.z + HWY.halfW, y: HWY.deckY, cx: c }));
/** Is (x, z) inside the ground-level street corridor under a bridge? */
export const underBridge = (x, z) => HWY.crossings.some((c) => Math.abs(x - c) < HWY.streetHalf) && Math.abs(z - HWY.z) < HWY.halfW + 14;
