// Cleared works-pad station; configuration also drives the native ground and content tests.
export const POWER = {
  id:'stoneleaf-energy',label:'Stoneleaf Energy Works',seed:81327,x:-337.5,z:-560,
  bounds:{x0:-425,x1:-250,z0:-595,z1:-525},gate:{x:-335,z:-525,w:10},fenceStep:4,
  hall:{x:-370,z:-551,w:62,d:18,h:9},store:{x:-267,z:-542,w:18,d:14,h:5},office:{x:-348,z:-532,w:10,d:7,h:3.3},
  towers:[{x:-408,z:-579,h:24,profile:[[0,10],[12,6.5],[24,7.8]]},{x:-381,z:-580,h:22,profile:[[0,9],[11,5.8],[22,7]]}],
  towerSegments:12,towerWall:.35,
  basin:{x:-281,z:-578,hw:12,hd:7,fall:3,depth:1.6,waterDrop:.35,wallHalfW:15,wallHalfD:10},
  transformers:[{x:-317,z:-548},{x:-304,z:-548},{x:-291,z:-548}],
  sign:{x:-347,z:-525,w:7,h:.8,y:2.2,rot:Math.atan2(12,5)},
  apron:{x0:-340,x1:-330,z0:-527.5,z1:-520},
  workerSpeed:1.15,workTime:1.8,
  workers:[{route:[[-354,-541],[-370,-541],[-379,-541],[-370,-541]],workYaw:Math.PI},{route:[[-304,-543.4],[-317,-543.4],[-304,-543.4],[-291,-543.4]],workYaw:Math.PI}],
  workPanels:[{x:-354,z:-542},{x:-370,z:-542},{x:-379,z:-542},{x:-317,z:-544.5},{x:-304,z:-544.5},{x:-291,z:-544.5}],
  steam:{capacity:64,life:3.4,interval:.12,rise:2,drift:.35,radius:.7,growth:.7,mouthSpread:1.5,fade:.5},
  lamps:[{x:-390,z:-541.9,h:3.2,host:'hall'},{x:-350,z:-541.9,h:3.2,host:'hall'},{x:-267,z:-534.9,h:3.4,host:'store'},{x:-340.3,z:-524.8,h:2.7,host:'gate'}],
  // Edges align to the actual height grid; every triangle follows its physical anti-diagonal.
  paving:[{x0:-422.5,x1:-297.5,z0:-592.5,z1:-527.5},{x0:-265,x1:-252.5,z0:-592.5,z1:-527.5},{x0:-297.5,x1:-265,z0:-592.5,z1:-590},{x0:-297.5,x1:-265,z0:-567.5,z1:-527.5}],
};
export function powerPonds(height){const b=POWER.basin;return [{x:b.x,z:b.z,hw:b.hw,hd:b.hd,fall:b.fall,h:height-b.depth}];}
