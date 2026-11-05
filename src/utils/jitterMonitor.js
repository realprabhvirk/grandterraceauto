// Camera jitter monitor (debug, cheap fixed-size arrays; only records while enabled):
// per frame dt, physics steps, camera position + rotation, focus position, shake amplitudes.
// Jitter = change of the camera's per-frame velocity, dt-normalised and expressed in metres per
// 60 Hz frame (so a long frame that moves further in proportion is NOT jitter, a stutter is).
import * as THREE from 'three';

const N = 900;

export function createJitterMonitor() {
  const P = new Float32Array(N * 3), A = new Float32Array(N), DT = new Float32Array(N), S = new Uint8Array(N), SH = new Float32Array(N), F = new Float32Array(N * 3);
  const q0 = new THREE.Quaternion();
  let n = 0, enabled = false, last = null;
  const tags = [];
  return {
    get enabled() { return enabled; },
    start() { enabled = true; n = 0; tags.length = 0; last = null; },
    stop() { enabled = false; },
    /** Call once per frame after the camera is final. */
    record(camera, { dt, steps, focus, shake = 0, tag = '' }) {
      if (!enabled || n >= N) return;
      P[n * 3] = camera.position.x; P[n * 3 + 1] = camera.position.y; P[n * 3 + 2] = camera.position.z;
      // Rotation: angle between this frame's and the previous frame's orientation.
      A[n] = last ? camera.quaternion.angleTo(q0) : 0;
      q0.copy(camera.quaternion); last = true;
      DT[n] = dt; S[n] = steps; SH[n] = shake;
      F[n * 3] = focus.x; F[n * 3 + 1] = focus.y; F[n * 3 + 2] = focus.z;
      tags[n] = tag;
      n++;
    },
    stats(skip = 10) {
      const pj = [], fj = [], rj = [], steps = {};
      for (let i = Math.max(2, skip); i < n; i++) {
        const j = (k) => Math.hypot(P[i * 3 + k] - 2 * P[(i - 1) * 3 + k] + P[(i - 2) * 3 + k], 0);
        const a = Math.max(1e-3, DT[i]), b = Math.max(1e-3, DT[i - 1]);
        const jit = (X) => Math.hypot(...[0, 1, 2].map((k) => ((X[i * 3 + k] - X[(i - 1) * 3 + k]) / a - (X[(i - 1) * 3 + k] - X[(i - 2) * 3 + k]) / b) / 60));
        pj.push(jit(P)); fj.push(jit(F));
        rj.push(Math.abs(A[i] - A[i - 1]));
        steps[S[i]] = (steps[S[i]] || 0) + 1;
        void j;
      }
      const rms = (a) => (a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : 0);
      const max = (a) => (a.length ? Math.max(...a) : 0);
      let shakeMax = 0; for (let i = skip; i < n; i++) shakeMax = Math.max(shakeMax, SH[i]);
      const spikes = [];
      const lim = 0.15; // m per 60 Hz frame (smooth flat walking/running peaks ~0.06-0.11 headless)
      for (let k = 0; k < pj.length; k++) if (pj[k] > lim) spikes.push({ frame: k + skip, j: +pj[k].toFixed(3), steps: S[k + skip], dt: +DT[k + skip].toFixed(4), tag: tags[k + skip] });
      return { frames: n, posRMS: +rms(pj).toFixed(4), posMax: +max(pj).toFixed(4), focusRMS: +rms(fj).toFixed(4), focusMax: +max(fj).toFixed(4), rotRMS: +rms(rj).toFixed(5), rotMax: +max(rj).toFixed(5), shakeMax: +shakeMax.toFixed(3), steps, spikes: spikes.slice(0, 8), spikeCount: spikes.length };
    },
  };
}
