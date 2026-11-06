// Normal traffic utes: original collision/signal/light/theft paths and the manager's wheel pool.
import { TrafficCar } from '../traffic/trafficCar.js';
import { CAR_TYPES } from '../vehicles/carTypes.js';
import { PALETTE as P } from '../art/palette.js';
import { makeRng } from '../utils/rng.js';
import { FARM_TRAFFIC as C } from './farmTrafficConfig.js';

export function addFarmTraffic({cars,graph,physics,scene,wheels,world,startIndex}){
  const out=[],rng=makeRng(C.seed),lanes=graph.lanes;
  for(const [i,farm] of (world.rural?.farms||[]).entries()){
    let lane=null,s=0,best=Infinity;
    for(const l of lanes)if(l.road?.rural&&l.from&&l.len>C.minLane)for(const p of l.pts){
      const d=(p.x-farm.access.x)**2+(p.z-farm.access.z)**2;
      if(d<best){best=d;lane=l;s=Math.max(C.startMargin,Math.min(l.len-C.startMargin,p.s));}
    }
    if(!lane)throw Error(`No rural traffic access for ${farm.id}`);
    const t=new TrafficCar({id:`farm-ute-${farm.id}`,type:'ute',cfg:CAR_TYPES.ute,paint:P.cars.paints[C.paints[i%C.paints.length]],lane,s,cruise:C.cruise,physics,scene,wheels,wheelOffset:(startIndex+i)*4,terrain:world.terrain,rng:rng.fork(i+1)});
    t.farmId=farm.id;t.extraTarget=()=>C.cruise;
    t.pickExit=exits=>{
      let pick=null,n=0;
      for(const e of exits){const con=lanes[e.lane],next=con.road?con:lanes[con.exits[0]?.lane];if(next?.road?.rural&&t.rng.next()<1/++n)pick=e;}
      return pick; // Ordinary graph selection remains the fallback at constrained junctions.
    };
    cars.push(t);out.push(t);
  }
  return out;
}
