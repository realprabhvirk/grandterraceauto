// Seeded farm layouts. Bounds are built content footprints, never the whole grading pad.
export const FARM = {
  seed: 74062, plantStep: 2.8, fenceStep: 4, pumpSpeed: .7, pondDepth: .9, workerSpeed: 1.15, workTime: 1.8,
  farms: [
    {id:'gumleaf',label:'Gumleaf Orchard Farm',x:-50,z:-390,hw:130,hd:95,access:{x:100,z:-350},
      house:{x:-120,z:-335,variant:2,rot:-.12},barn:{x:-40,z:-350,w:24,d:16},shed:{x:-125,z:-385,w:22,d:14},
      silo:{x:20,z:-340,r:4.2,h:12},tank:{x:48,z:-352,r:3,h:3.5},pump:{x:65,z:-455,s:1},
      dam:{x:15,z:-461,r:11},hay:{x:-80,z:-370},scarecrow:{x:-105,z:-408},
      orchard:{x0:-40,x1:60,z0:-405,z1:-375,step:11},
      fields:[{x0:-165,x1:-80,z0:-415,z1:-395,kind:'wheat'},{x0:-60,x1:20,z0:-327,z1:-300,kind:'vegetables'}],
      paddocks:[{x0:-175,x1:-70,z0:-478,z1:-445},{x0:-55,x1:52,z0:-478,z1:-445}],
      track:[[100,-335],[45,-335],[45,-325]],shop:{x:55,z:-310},
      workers:[[[-168,-419],[-77,-419],[-77,-393],[-168,-393]],[[5,-331],[35,-331],[35,-305],[5,-305]]]},
    {id:'redbank',label:'Redbank Fields',x:-980,z:170,hw:300,hd:85,access:{x:-980,z:180},
      house:{x:-760,z:220,variant:3,rot:.2},barn:{x:-820,z:220,w:26,d:18},shed:{x:-725,z:135,w:28,d:16},
      silo:{x:-790,z:120,r:5,h:15},tank:{x:-730,z:220,r:3.5,h:4},pump:{x:-700,z:110,s:1.2},
      dam:{x:-890,z:224,r:13},hay:{x:-855,z:220},scarecrow:{x:-1100,z:145},
      orchard:{x0:-960,x1:-910,z0:95,z1:155,step:11},
      fields:[{x0:-1250,x1:-1000,z0:95,z1:125,kind:'maize'},{x0:-1250,x1:-1000,z0:135,z1:165,kind:'wheat'}],
      paddocks:[{x0:-1250,x1:-1135,z0:200,z1:245},{x0:-1115,x1:-1000,z0:200,z1:245}],
      track:[[-980,180],[-905,180],[-905,198]],
      workers:[[[-1253,91],[-997,91],[-997,128],[-1253,128]],[[-972,93],[-905,93],[-905,163],[-972,163]]]},
    {id:'springbank',label:'Springbank Smallholding',x:535,z:225,hw:40,hd:35,access:{x:535,z:180},
      house:{x:511,z:207,variant:2,rot:.1},barn:{x:545,z:210,w:16,d:12},shed:{x:551,z:238,w:14,d:10},
      silo:{x:528,z:244,r:2.8,h:8},tank:{x:500,z:244,r:2,h:2.6},pump:{x:567,z:248,s:.65},
      dam:{x:569,z:225,r:3.2},hay:{x:529,z:199},scarecrow:{x:539,z:253},
      orchard:{x0:500,x1:520,z0:223,z1:237,step:8},
      fields:[{x0:533,x1:565,z0:252,z1:257,kind:'vegetables'},{x0:531,x1:548,z0:225,z1:231,kind:'wheat'}],
      paddocks:[{x0:500,x1:520,z0:249,z1:257}],track:[[535,180],[535,195]],
      workers:[[[535,195],[521,195],[521,218],[535,218]],[[532,222],[548,222],[548,232],[532,232]]]},
  ],
};

export function farmPonds(height) {
  return FARM.farms.map(f=>({x:f.dam.x,z:f.dam.z,hw:f.dam.r*.6,hd:f.dam.r*.45,h:height-FARM.pondDepth,fall:4}));
}

// Private yard access is a graded driveway, not a through street for ambient traffic.
export function farmTracks(height) {
  const out=[];
  for(const f of FARM.farms)for(let k=1;k<f.track.length;k++){
    const [ax,az]=f.track[k-1],[bx,bz]=f.track[k],length=Math.hypot(bx-ax,bz-az),n=Math.ceil(length/1.25),samples=[];
    for(let i=0;i<=n;i++)samples.push({x:ax+(bx-ax)*i/n,z:az+(bz-az)*i/n,h:height});
    out.push({name:`${f.id} yard ${k}`,halfW:2.25,samples});
  }
  return out;
}
