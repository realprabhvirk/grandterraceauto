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

  // 62 Grand Terrace, matched to the reference photo (reference/house62/).
  hero: {
    render: '#ede5d3',        // ground floor render (warm cream)
    cladding: '#e9e2cf',      // upper weatherboard
    claddingLine: '#cfc6b1',  // board shadow lines
    renderBox: '#cdc2ae',     // rendered box over the garage (greige)
    base: '#d6ccb9',          // subtle plinth
    trim: '#2e2f31',          // window frames (dark charcoal)
    roof: '#3e4145',          // charcoal concrete tiles
    caps: '#33363a',          // ridge / hip capping
    fascia: '#2f3134',
    soffit: '#f1ece2',
    door: '#3a3b3e',
    garage: '#4a4b4f',
    garageLine: '#3b3c40',
    driveway: '#877d73',      // exposed aggregate
    pavers: '#c9c1b1',        // porch tiles / side path
    shutter: '#efe9dd',       // plantation shutters behind the glass
    letterbox: '#cbc7be',     // rendered letterbox pillar
    letterboxCap: '#b7b2a8',
    telecom: '#4e7a52',       // green telecom pillar on the verge
    pit: '#a9a49a',
    lawn: '#79a64a',
    lawnStripe: '#71a046',
    joint: '#6f675e',
    mulch: '#5a4130',
    edging: '#b8afa0',
    cordyline: '#9e2f3a',
    grass: '#7c9a55',
    flowers: ['#e7a1b0', '#f3d27a', '#d9694f', '#f6efe3'],
    fence: '#8a6b50',
    fencePost: '#6f543e',
    pot: '#b0603d',
    gumTrunk: '#c9bda8',
    gumLeaf: ['#4d6b3a', '#5b7a43', '#44603a'],
    antenna: '#9a9d9f',
    binBody: '#3d5e45',
    binLidRed: '#b8443a',
    binLidYellow: '#e0b03c',
    clothesline: '#b9bcbc',
    numerals: '#2f2d2c',
    plate: '#f2ede2',
  },
  // Car paints: warm, slightly chalky, so they sit inside the suburb palette.
  cars: {
    paints: ['#c4473a', '#2f5d8c', '#ece7dc', '#3a3e44', '#c99a2e', '#5f7f5a', '#8fa9bb', '#b4b7b2'],
    hero: '#1f6e73',          // 'Grand Terrace teal' for the hero car in 62's driveway
    trim: '#2a2b2e',          // bumpers, grille, cladding
    chrome: '#c8ccc9',
    glass: '#2b3a46',
    tyre: '#232325',
    rim: '#b9bdbb',
    rimHero: '#d8d4c8',
    hub: '#6d7174',
    head: '#dfe6ea',
    headGlow: '#fff0c8',
    tail: '#8a2420',
    tailGlow: '#ff3a26',
    reverse: '#dcdcd6',
    plate: '#f2efe6',
    beam: '#ffe9b8',
  },

  player: {
    shirt: '#d86c3d',      // terracotta tee
    shirtTrim: '#f2e6cf',
    shorts: '#3d4f63',     // slate shorts
    belt: '#4a3a2e',
    skin: '#d9a47e',
    skinShade: '#c8916c',
    hair: '#3b2a20',
    eyes: '#2b2420',
    socks: '#efe9de',
    shoes: '#e9e4da',
    soles: '#6d655c',
  },
};
