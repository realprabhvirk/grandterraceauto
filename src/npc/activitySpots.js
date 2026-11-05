// Phase 6: extra NPC activities (static "home" spots, see pedestrians.js): people waiting at
// every bus stop, street dancers + a small crowd at City Plaza, fans at the stadium gate,
// people on the phone on the City Hall steps and window shoppers on Terrace Pde.
import { T } from '../town/townPlan.js';
import { LANDMARKS } from '../city/landmarks.js';

export function activitySpots(world) {
  const out = [], y = T.h + 0.02, Pde = T.Z[1];
  const at = (role, x, z, yaw, action, yy = y) => out.push({ role, x, y: yy, z, yaw, action });
  // Bus stops: one waiting passenger each (alternating phone / looking down the road).
  (world.town?.stops || []).forEach((s, k) => at(k % 3 === 2 ? 'office' : 'walker', s.x + 2.2, s.z, s.z < Pde ? 0 : Math.PI, k % 2 ? 'phone' : 'look'));
  // City Plaza: two street dancers and three people watching.
  const px = 735, pz = 10;
  at('beach', px, pz, Math.PI, 'dance'); at('walker', px + 1.6, pz + 0.4, Math.PI, 'dance');
  at('shopper', px - 1.2, pz - 3.6, 0.2, 'look'); at('office', px + 1.4, pz - 3.9, -0.1, 'look'); at('walker', px + 3.4, pz - 2.6, -0.7, 'phone');
  // Stadium gate (town side): fans hanging around.
  const S = LANDMARKS.stadium, gz = S.z - S.b - 4, gy = S.pad + 0.02;
  at('walker', S.x - 4, gz, Math.PI, 'look', gy); at('jogger', S.x + 2, gz - 1, 0.4, 'wave', gy); at('shopper', S.x + 5, gz + 0.5, -2.6, 'phone', gy);
  // City Hall steps.
  const H = LANDMARKS.cityHall;
  at('office', H.x - 1.4, H.z - 4, -Math.PI / 2, 'phone'); at('office', H.x - 1.6, H.z + 5, -Math.PI / 2 + 0.4, 'look');
  // Window shoppers in front of the electronics shop / bank (south row faces -z).
  const zs = Pde + T.front - 1.3;
  at('shopper', 433, zs, 0, 'look'); at('shopper', 439, zs, 0, 'look'); at('walker', 468, zs, 0, 'phone');
  return out;
}
