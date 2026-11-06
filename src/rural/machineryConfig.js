// Autonomous field equipment. These values do not change any drivable car tuning.
export const MACHINERY = {
  seed: 60427, awakeDistance: 220, acceleration: .9, braking: 3, stopGap: 2.5, stopReleaseMargin: 1.5,
  dustCapacity: 60, dustInterval: .12, dustLife: 1.4, dustDistance: 100,
  sampleStep: .5, headerSpeed: 3.5,
  types: {
    tractor: {w:2.3,l:4.4,h:2.85,clearance:.36,axle:2.75,rearRadius:.78,frontRadius:.48,wheelWidth:.48,track:1.9,seatY:.78,seatZ:-.65,speed:2.8},
    harvester: {w:3.1,l:6,h:3.7,clearance:.4,axle:3.3,rearRadius:.65,frontRadius:.92,wheelWidth:.6,track:2.5,seatY:1.5,seatZ:1.15,speed:2.5,header:{w:5.6,d:1.15,z:3.1,y:.8,h:.65}},
  },
  machines: [
    {id:'gumleaf-tractor',farmId:'gumleaf',kind:'tractor',paint:5,points:[[-158,-410],[-88,-410],[-85,-405],[-88,-400],[-158,-400],[-161,-405]]},
    {id:'redbank-tractor',farmId:'redbank',kind:'tractor',paint:0,points:[[-1240,141],[-1010,141],[-1003,150],[-1010,159],[-1240,159],[-1247,150]]},
    {id:'redbank-harvester',farmId:'redbank',kind:'harvester',paint:4,points:[[-1240,101],[-1010,101],[-1003,110],[-1010,119],[-1240,119],[-1247,110]]},
  ],
};
