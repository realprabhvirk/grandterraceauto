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
