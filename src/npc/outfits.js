// Seeded pedestrian outfits mixed from the palette wardrobe.
import { PALETTE } from '../art/palette.js';

const HAIR_STYLES = ['short', 'short', 'long', 'bun', 'cap', 'bald'];

export function randomOutfit(rng) {
  const W = PALETTE.npc;
  const skin = rng.pick(W.skins);
  const longPants = rng.chance(0.35);
  const bottoms = rng.pick(W.bottoms);
  return {
    shirt: rng.pick(W.shirts),
    shirtTrim: rng.pick(W.shirts),
    shorts: bottoms,
    legs: longPants ? bottoms : skin,
    belt: '#4a3a2e',
    skin,
    skinShade: skin,
    hair: rng.pick(W.hairs),
    cap: rng.pick(W.caps),
    hairStyle: rng.pick(HAIR_STYLES),
    eyes: '#2b2420',
    socks: '#efe9de',
    shoes: rng.pick(W.shoes),
    soles: '#6d655c',
  };
}

/** Role outfits (all adults): uniforms and hi-vis over a random base. */
const ROLE = {
  cop: { shirt: '#2d4f7c', shirtTrim: '#e8e6e0', shorts: '#1f2f4a', longPants: true, cap: '#1f2f4a', hairStyle: 'cap', shoes: '#1d1d1f' },
  worker: { shirt: '#f07a1a', shirtTrim: '#e8f04a', shorts: '#3d4f63', longPants: true, cap: '#f2d23a', hairStyle: 'cap', shoes: '#5a4a3c' },
  paramedic: { shirt: '#2f6b5a', shirtTrim: '#e2e2da', shorts: '#2f4a3f', longPants: true, shoes: '#1d1d1f' },
  guard: { shirt: '#26282c', shirtTrim: '#e2c25a', shorts: '#26282c', longPants: true, cap: '#26282c', hairStyle: 'cap', shoes: '#1d1d1f' },
  cashier: { shirt: '#3d5f8a', shirtTrim: '#f4f1e8', longPants: true },
  shopkeeper: { shirt: '#f4f1e8', shirtTrim: '#8a6446', longPants: true },
  jogger: { shirt: ['#e2553e', '#3fb0c0', '#d8e04a', '#f08ab0'], shorts: '#26282c', longPants: false, shoes: '#f4f4f4' },
  office: { shirt: ['#f4f1e8', '#cfdbe8', '#e8e0d0', '#d8e4ec'], shirtTrim: '#2b3a55', shorts: ['#3a3d44', '#2b3a55', '#5c5f66'], longPants: true, shoes: '#1d1d1f' },
  vendor: { shirt: '#c8322a', shirtTrim: '#f4f1e8', longPants: true, cap: '#f4f1e8', hairStyle: 'cap' },
  lifeguard: { shirt: '#e2332a', shirtTrim: '#f2d23a', shorts: '#f2d23a', longPants: false, shoes: '#e8e0d0' },
  beach: { shirt: ['#3fb0c0', '#f08ab0', '#e2c25a', '#f4f1e8'], shorts: ['#2f6fc0', '#e2553e', '#4f9a55'], longPants: false, shoes: '#d9a47e' },
  cyclist: { shirt: ['#e2c25a', '#3f7fc0', '#d8553e'], shorts: '#26282c', longPants: false, cap: '#e8e6e0', hairStyle: 'cap' },
};
export function roleOutfit(role, rng) {
  const o = randomOutfit(rng), r = ROLE[role];
  if (!r) return o;
  for (const [k, v] of Object.entries(r)) if (k !== 'longPants') o[k] = Array.isArray(v) ? rng.pick(v) : v;
  if (r.longPants === true) o.legs = o.shorts;
  if (r.longPants === false) o.legs = o.skin;
  return o;
}
