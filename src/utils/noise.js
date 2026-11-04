// Seeded 2D value noise + fBm. Cheap and good enough for gentle suburban hills.
import { hash2 } from './rng.js';

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v; // 0..1
}

export function fbm(x, y, octaves = 4, seed = 0) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise(x * freq, y * freq, seed + i * 17) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm; // -1..1
}
