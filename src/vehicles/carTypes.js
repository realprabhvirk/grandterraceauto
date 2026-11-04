// Per-type car configuration: proportions (metres) for the procedural model and the
// arcade physics tuning. Car-local space: +Z forward, +Y up, +X = left side,
// origin on the ground midway between the axles.
//
// Physics notes (Rapier raycast vehicle, Bullet-style):
//   stiffness   suspension spring per unit mass (static sag = 9.81 / (4 * stiffness))
//   engine      N per driven wheel at full throttle
//   grip        wheel friction slip (higher = more grip)
//   steer       max steering angle at standstill (rad), reduced at speed
//   top         top speed m/s (boost adds ~15%)

export const CAR_TYPES = {
  hatch: {
    label: 'Hatchback',
    L: 3.95, W: 1.74, wheelBase: 2.5, track: 1.5, wheelR: 0.31, wheelW: 0.2, frontOverhang: 0.78,
    clearance: 0.17, belt: 0.92, roof: 1.47, cabin: [-1.55, 0.72], roofSpan: [-1.35, 0.05],
    seat: [-0.36, 0.38, -0.1],
    mass: 1050, engine: 3500, drive: 'front', brake: 34, steer: 0.62, top: 41,
    stiffness: 34, compression: 2.6, relaxation: 3.4, rest: 0.26, travel: 0.2, grip: 2.4,
  },
  sedan: {
    label: 'Sedan',
    L: 4.7, W: 1.82, wheelBase: 2.8, track: 1.56, wheelR: 0.33, wheelW: 0.22, frontOverhang: 0.92,
    clearance: 0.16, belt: 0.9, roof: 1.43, cabin: [-1.05, 0.95], roofSpan: [-0.75, 0.28],
    seat: [-0.38, 0.36, 0.02],
    mass: 1350, engine: 4700, drive: 'rear', brake: 40, steer: 0.58, top: 46,
    stiffness: 32, compression: 2.6, relaxation: 3.3, rest: 0.25, travel: 0.2, grip: 2.5,
  },
  ute: {
    label: 'Ute',
    L: 5.1, W: 1.86, wheelBase: 3.05, track: 1.58, wheelR: 0.36, wheelW: 0.24, frontOverhang: 0.95,
    clearance: 0.24, belt: 1.02, roof: 1.7, cabin: [-0.35, 1.05], roofSpan: [-0.3, 0.42],
    seat: [-0.38, 0.47, 0.3], tray: [-2.1, -0.45],
    mass: 1650, engine: 5400, drive: 'rear', brake: 60, steer: 0.55, top: 42,
    stiffness: 30, compression: 2.5, relaxation: 3.1, rest: 0.3, travel: 0.24, grip: 2.4,
  },
  suv: {
    label: '4WD',
    L: 4.75, W: 1.92, wheelBase: 2.82, track: 1.62, wheelR: 0.38, wheelW: 0.26, frontOverhang: 0.88,
    clearance: 0.27, belt: 1.08, roof: 1.84, cabin: [-1.75, 0.82], roofSpan: [-1.68, 0.2],
    seat: [-0.4, 0.56, 0.05],
    mass: 1850, engine: 4100, drive: 'all', brake: 52, steer: 0.56, top: 40,
    stiffness: 28, compression: 2.4, relaxation: 3.0, rest: 0.32, travel: 0.26, grip: 2.5,
  },
};

export const TYPE_NAMES = Object.keys(CAR_TYPES);
