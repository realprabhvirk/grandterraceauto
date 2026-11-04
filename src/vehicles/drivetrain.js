// Simulated 5-speed gearbox for gauges / sound: gear from speed bands, RPM within the band.
const SHIFT = [0, 22, 45, 72, 105]; // km/h where gears 1..5 start
const IDLE = 850, REDLINE = 6300;

export function simGearRpm(kmh, throttle = 0) {
  const v = Math.abs(kmh);
  let gear = 1;
  for (let g = SHIFT.length - 1; g >= 0; g--) if (v >= SHIFT[g]) { gear = g + 1; break; }
  const lo = SHIFT[gear - 1], hi = SHIFT[gear] ?? lo + 45;
  const frac = Math.min(1, (v - lo) / (hi - lo));
  const base = gear === 1 ? IDLE + frac * (REDLINE - 1600 - IDLE) : 2600 + frac * (REDLINE - 2600 - 400);
  const rpm = Math.min(REDLINE, base + throttle * 500);
  return { gear: kmh < -0.5 ? 'R' : gear, rpm };
}
export const REDLINE_RPM = REDLINE;
