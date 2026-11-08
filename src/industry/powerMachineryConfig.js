import {MACHINERY} from '../rural/machineryConfig.js';
export const POWER_MACHINERY={
  ...MACHINERY,seed:81329,awakeDistance:180,dustCapacity:0,colliderTag:'industry machinery',
  types:{forklift:{w:1.6,l:2.8,h:2.55,clearance:.18,axle:1.6,track:1.3,rearRadius:.32,frontRadius:.38,wheelWidth:.24,seatY:.35,seatZ:-.35,speed:1.7,header:{w:1.3,d:1.8,z:1.9,h:1.05,y:.65},
    load:[{x:-.43,y:.18,z:1.9,w:.14,h:.1,d:1.8},{x:.43,y:.18,z:1.9,w:.14,h:.1,d:1.8},{x:0,y:.325,z:1.9,w:1.2,h:.15,d:1.1},{x:0,y:.775,z:1.9,w:1.1,h:.75,d:1}] }},
  machines:[{id:'power-forklift',siteId:'stoneleaf-energy',kind:'forklift',paint:4,points:[[-331,-533],[-288,-533],[-283,-536],[-288,-539],[-331,-539],[-337,-536]]}],
};
