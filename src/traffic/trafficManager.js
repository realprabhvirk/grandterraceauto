// Ambient traffic: 6 seeded AI cars on the lane graph. They see each other, the player's
// car, the parked cars (which they swing out around) and the walking player on the road.
import * as THREE from 'three';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { createWheelInstances } from '../vehicles/wheels.js';
import { PALETTE } from '../art/palette.js';
import { buildLaneGraph } from './laneGraph.js';
import { TrafficCar } from './trafficCar.js';
import { makeRng } from '../utils/rng.js';
import { addEmergencyKit } from '../vehicles/emergency.js';
import { buildTrafficLights } from './trafficLights.js';
import { addServiceVehicles, SERVICE_COUNT } from './serviceVehicles.js';
import { addFarmTraffic } from '../rural/farmTraffic.js';
import { FARM_TRAFFIC_COUNT } from '../rural/farmTrafficConfig.js';
export const PATROL_CRUISERS = 2; // traffic cops cruising the motorway / ring road at the limit

const COUNT = 14; // 6 start on Grand Terrace, the rest spread over the town + downtown grid
const TRAFFIC_PAINTS = ['#8a4f3a', '#d8d2c4', '#46566b', '#9aa37a', '#5c5f66', '#b98a4a', '#2f4f6b', '#7c2f2f', '#e9e6dc', '#4f6b3a'];

export function createTraffic({ scene, physics, world, vehicles, audio, count = COUNT }) {
  const rng = makeRng(4646);
  const graph = buildLaneGraph(world.network);
  const lights = world.town ? buildTrafficLights({ scene, plan: world.town.plan, graph, physics, terrain: world.terrain }) : null;
  const wheels = createWheelInstances((count + PATROL_CRUISERS + SERVICE_COUNT + FARM_TRAFFIC_COUNT) * 4).mesh;
  wheels.name = 'traffic-wheels';
  scene.add(wheels);
  const types = ['sedan', 'hatch', 'suv', 'ute', 'hatch', 'sedan'];
  const cars = [];
  // Spread the cars out along both Grand Terrace lanes, away from the hero house.
  const starts = [[graph.fwd, 0.08], [graph.bwd, 0.2], [graph.fwd, 0.55], [graph.bwd, 0.62], [graph.fwd, 0.85], [graph.bwd, 0.9]];
  const townLanes = graph.lanes.filter((l) => l.town && l.from && l.len > 40);
  const northLanes = townLanes.filter((l) => l.pts[0].z < -250); // Northgate gets two of its own
  for (let i = 0; i < count; i++) {
    const [lane, f] = i < starts.length || !townLanes.length ? starts[i % starts.length] : i < starts.length + 2 && northLanes.length ? [northLanes[(i * 5) % northLanes.length], 0.4] : [townLanes[((i - starts.length) * 7) % townLanes.length], 0.4];
    const type = types[i % types.length];
    cars.push(new TrafficCar({
      id: `traffic-${i}`, type, cfg: CAR_TYPES[type], paint: TRAFFIC_PAINTS[i % TRAFFIC_PAINTS.length] || PALETTE.cars.paints[i],
      lane, s: lane.len * f, cruise: rng.range(25, 40) / 3.6,
      physics, scene, wheels, wheelOffset: i * 4, terrain: world.terrain, rng: rng.fork(i + 7),
    }));
  }

  // Patrol cruisers: police livery + light bar (lights only when catching a speeder), not carjackable.
  const hwLane = graph.lanes.find((l) => l.road?.highway && !l.road.ramp);
  const ringLane = graph.lanes.find((l) => l.road?.street === 'Ring Rd North' && l.len > 40);
  [hwLane, ringLane].forEach((lane, k) => {
    if (!lane) return;
    const i = count + k, t = new TrafficCar({ id: `patrol-${k}`, type: 'sedan', cfg: CAR_TYPES.sedan, paint: '#f1f1ec', lane, s: lane.len * 0.3, cruise: 50 / 3.6, physics, scene, wheels, wheelOffset: i * 4, terrain: world.terrain, rng: rng.fork(i + 70) });
    t.isPolice = true; t.trafficCop = true;
    addEmergencyKit(t, 'police');
    cars.push(t);
  });
  const service = world.town ? addServiceVehicles({ cars, graph, physics, scene, wheels, world, rng: rng.fork(500), startIndex: count + PATROL_CRUISERS }) : { buses: [], taxis: [], vans: [] };
  const farmUtes = addFarmTraffic({ cars, graph, physics, scene, wheels, world, startIndex: count + PATROL_CRUISERS + SERVICE_COUNT });
  const honk = (car) => audio.honk?.(car.pos);
  /** Take a traffic car off the road (carjacked: replaced by a drivable copy). */
  function removeCar(c) {
    const i = cars.indexOf(c);
    if (i < 0) return;
    cars.splice(i, 1);
    const fi = farmUtes.indexOf(c); if (fi >= 0) farmUtes.splice(fi, 1);
    c.group.visible = false;
    c.body.setEnabled(false);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < 4; k++) wheels.setMatrixAt(c.wheelOffset + k, zero);
    wheels.instanceMatrix.needsUpdate = true;
  }
  return {
    cars,
    graph,
    lights,
    service,
    farmUtes,
    removeCar,
    honk,
    /** ctx: { player (walker position or null), night } */
    update(dt, { player, night, extra = [] }) {
      lights?.update(dt);
      const obstacles = [];
      for (const c of cars) if (!c.suspended) obstacles.push({ self: c, x: c.pos.x, z: c.pos.z, speed: c.v, len: c.cfg.L });
      for (const c of vehicles.cars) {
        const p = c.position, driven = c === vehicles.active;
        obstacles.push({ x: p.x, z: p.z, speed: Math.abs(c.body.state.speed), len: c.cfg.L, parked: !driven && Math.abs(c.body.state.speed) < 0.5, player: driven });
      }
      if (player) obstacles.push({ x: player.x, z: player.z, speed: 0, len: 0.6, player: true });
      for (const o of extra) obstacles.push(o); // police cars
      const lanes = graph.lanes;
      for (const c of cars) {
        if (c.suspended) continue; // a traffic cop's cruiser handed over to a pull-over pursuit
        if (c.lights !== night) c.setLights(night);
        c.update(dt, { lanes, obstacles, honk });
      }
      wheels.instanceMatrix.needsUpdate = true;
    },
    /** For pedestrians (dodging) and the minimap. */
    movers() { return cars.filter((c) => !c.suspended).map((c) => ({ x: c.pos.x, z: c.pos.z, fx: c.fwd.x, fz: c.fwd.z, speed: c.v, len: c.cfg.L, w: c.cfg.W })); },
  };
}
