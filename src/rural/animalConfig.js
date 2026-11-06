export const ANIMALS = {
  seed:9362,sleepDistance:120,scatterDistance:6,scatterTime:3.2,downTime:3.2,hitCooldown:4,
  carHitSpeed:2.5,carLookAhead:.08,paddockInset:1.3,targetTries:64,grazeMin:1.5,grazeMax:4,turnRate:5,
  pathStep:.5,separation:.4,spawnTries:200,spawnMarginX:3,spawnMarginZ:2.5,scaleMin:.92,scaleMax:1.08,obstacleMargin:5,
  scatterAngle:1.2,scatterMin:4,scatterMax:9,scatterGain:.5,scatterRefresh:.5,gunfireRadius:40,
  carMovingMin:1,carAwareness:14,carScatterDistance:10,targetReach:.15,targetRetry:.2,playerClearance:.5,
  fallTime:.2,riseTime:.6,downAngle:1.45,trotRate:6,idleRate:1,bob:.02,legSwing:.55,
  types:{
    cow:{w:.9,h:1.6,l:2.5,hitY:.85,leg:.7,legW:.14,legX:.3,legZ:.7,walk:.65,run:2.6},
    sheep:{w:.8,h:1.05,l:1.5,hitY:.58,leg:.35,legW:.09,legX:.22,legZ:.4,walk:.7,run:3},
    dog:{w:.3,h:.8,l:1.1,hitY:.4,leg:.32,legW:.07,legX:.09,legZ:.22,walk:1,run:3.5},
  },
  farms:{gumleaf:[{kind:'cow',count:4,paddock:0},{kind:'sheep',count:8,paddock:1},{kind:'dog',count:1,paddock:0}],redbank:[{kind:'cow',count:6,paddock:0},{kind:'sheep',count:10,paddock:1},{kind:'dog',count:1,paddock:0}],springbank:[{kind:'sheep',count:2,paddock:0},{kind:'dog',count:1,paddock:0}]},
};
