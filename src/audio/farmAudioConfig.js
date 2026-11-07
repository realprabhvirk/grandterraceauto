export const FARM_AUDIO = {
  seed:62681,noiseSeconds:1,brownMix:.02,brownDivisor:1.02,brownGain:3.5,fade:.12,frequencyFade:.08,epsilon:.0001,duck:.4,ampBase:.65,ampDepth:.22,callPitchMin:.95,callPitchMax:1.05,callPeakPitch:1.1,callEndPitch:.9,envelopeFloor:.0001,envelopeTail:.01,
  voices:[
    {kind:'tractor',loop:true,freq:48,freqSpeed:8,filter:450,noise:.14,rate:7,rateSpeed:.8,gain:.05,range:90},
    {kind:'harvester',loop:true,freq:67,freqSpeed:10,filter:800,noise:.3,rate:10,rateSpeed:.8,gain:.045,range:90},
    {kind:'cow',freq:115,filter:520,noise:.03,rate:5,gain:.055,range:65,initial:.7,intervalMin:6,intervalMax:12,attack:.12,duration:1.2},
    {kind:'sheep',freq:340,filter:1300,noise:.05,rate:19,gain:.035,range:55,initial:1.7,intervalMin:7,intervalMax:13,attack:.05,duration:.55},
    {kind:'dog',freq:180,filter:900,noise:.7,rate:12,gain:.045,range:55,initial:2.7,intervalMin:7,intervalMax:14,attack:.025,duration:.2},
  ],
};
export const FARM_NIGHT={housingW:.45,housingH:.3,housingD:.26,headW:.3,headH:.16,headD:.04,barnHeight:3,shedHeight:3.2,barnInset:.3,wallOffset:.12,poolRadius:3,poolLift:.015};
