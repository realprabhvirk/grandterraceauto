import {FARM_AUDIO} from './farmAudioConfig.js';
export const POWER_AUDIO={...FARM_AUDIO,seed:81331,voices:[
  {kind:'power',loop:true,freq:37,freqSpeed:0,filter:320,noise:.35,rate:5,rateSpeed:0,gain:.035,range:120},
  {kind:'forklift',loop:true,freq:70,freqSpeed:10,filter:650,noise:.12,rate:9,rateSpeed:1,gain:.035,range:70},
]};
