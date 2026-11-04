// The single source of colour for the whole game.
// Warm late-afternoon suburban Queensland: sun-bleached render, dry-ish grass,
// charcoal and terracotta roofs, eucalypt greens. Nothing pure grey, nothing neon.

export const PALETTE = {
  sky: {
    zenith: '#6f9cc4',
    mid: '#a9c3d6',
    horizon: '#f0cfa5',
    ground: '#c9a77f',
    duskZenith: '#2c3557',
    duskMid: '#7d5f7a',
    duskHorizon: '#f2925c',
  },
  fog: '#e8cca6',
  fogDusk: '#b97a63',

  light: {
    sun: '#ffd9a8',
    sunDusk: '#ff9a5a',
    hemiSky: '#c7d9e8',
    hemiGround: '#7b6448',
    hemiSkyDusk: '#8a7fa6',
    hemiGroundDusk: '#5e4638',
  },

  ground: {
    grass: '#82975a',
    grassDry: '#a5a067',
    grassDark: '#677f4a',
    lawn: '#86a258',
    verge: '#8ca15f',
    soil: '#8a6a48',
    bank: '#97875a',
    mulch: '#5b4232',
  },

  road: {
    asphalt: '#716e73',
    asphaltPatch: '#67646a',
    curb: '#e6dfd0',
    footpath: '#c8bda8',
    driveway: '#cfc4b0',
    signBlade: '#2f5d4a',
    signText: '#f4f1e8',
    signPole: '#8d8f8a',
  },

  // Regular houses pick from these. Kept warm and slightly desaturated.
  walls: ['#efe3cc', '#e3cfae', '#d8c2a2', '#c9d0bb', '#bfcbcd', '#e9d6c3', '#d7b79a', '#f2ece0'],
  roofs: ['#40444a', '#a9573b', '#5c6772', '#6d4b3b', '#d9d8cf', '#7a3f31', '#4f5a52'],
  trims: ['#f4efe4', '#4a4541', '#6b5a4a'],

  house: {
    frame: '#3a3a3c',
    frameLight: '#efe9dd',
    glass: '#4d6577',
    glow: '#ffc47a',
    door: '#6b4a34',
    garage: '#d9d4c8',
    garageDark: '#a8a296',
    base: '#8d7f70',
    lamp: '#ffe2a8',
  },

  tree: {
    trunk: '#6b5140',
    trunkPale: '#b7a58e',
    leaves: ['#5b7f3c', '#6f8f43', '#4c6e3b', '#879a5a', '#7a9a62'],
  },

  hero: {
    render: '#efe6d6',
    renderShade: '#e2d6c2',
    base: '#6e6862',
    trim: '#3f3d3c',
    roof: '#3b3e42',
    fascia: '#2f3134',
    soffit: '#f1ece2',
    timber: '#9a6b45',
    door: '#4f3a2c',
    garage: '#55585c',
    driveway: '#cdc3af',
    pavers: '#b8a58a',
    letterbox: '#9c5b43',
    hedge: '#567a40',
    lawn: '#90ae60',
    lawnStripe: '#7c9a4e',
    joint: '#9d9483',
    flowers: ['#e7a1b0', '#f3d27a', '#d9694f', '#f6efe3'],
    fence: '#6f7468',
    solar: '#2c3a52',
    solarFrame: '#b9bcbc',
    binBody: '#3d5e45',
    binLidRed: '#b8443a',
    binLidYellow: '#e0b03c',
    clothesline: '#b9bcbc',
    numerals: '#2f2d2c',
    plate: '#f2ede2',
    palmTrunk: '#9b8a72',
    palmLeaf: '#5f8a3e',
    frangipaniLeaf: '#4f7d3a',
    frangipaniFlower: '#f7f0dc',
  },

  player: {
    shirt: '#d86c3d',
    shorts: '#3d4f63',
    skin: '#d9a47e',
    hair: '#3b2a20',
  },
};
