// RUNES for the engraving step of the upgrade minigame. Every kind of gear has its own rune — a single stroke that sketches the piece
// (a dagger for blades, an arrowhead for spears, a crown for helmets, a shield for chestplates ...). Pure data, shared by server and client.
import { ITEMS, archOf } from './data.js';

const circle = (cx, cy, r, n = 18, a0 = -Math.PI / 2) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + (i / n) * Math.PI * 2) * r, cy + Math.sin(a0 + (i / n) * Math.PI * 2) * r]);
const arc = (cx, cy, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + ((a1 - a0) * i) / n) * r, cy + Math.sin(a0 + ((a1 - a0) * i) / n) * r]);
const wave = (x0, x1, y, amp, n = 16) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + Math.sin((i / n) * Math.PI * 3) * amp]);

export const RUNES = {
  sword: { name: 'Rune of the Blade', pts: [[0.5, 0.06], [0.5, 0.94], [0.5, 0.64], [0.2, 0.64], [0.8, 0.64]] },
  spear: { name: 'Rune of the Spear', pts: [[0.5, 0.95], [0.5, 0.06], [0.2, 0.4], [0.5, 0.06], [0.8, 0.4]] },
  mace: { name: 'Rune of the Maul', pts: [[0.5, 0.95], [0.5, 0.66], ...circle(0.5, 0.38, 0.28, 16, Math.PI / 2).slice(0)] },
  hammer: { name: 'Rune of the Forge', pts: [[0.14, 0.14], [0.86, 0.14], [0.86, 0.42], [0.14, 0.42], [0.14, 0.14], [0.5, 0.42], [0.5, 0.93]] },
  staff: { name: 'Rune of the Staff', pts: [[0.5, 0.95], [0.5, 0.5], ...circle(0.5, 0.31, 0.19, 14, Math.PI / 2)] },
  wand: { name: 'Rune of the Wand', pts: [[0.5, 0.05], [0.5, 0.95], [0.5, 0.5], [0.06, 0.5], [0.94, 0.5], [0.5, 0.5], [0.22, 0.24], [0.78, 0.76]] },
  bow: { name: 'Rune of the Bow', pts: [[0.62, 0.06], [0.34, 0.2], [0.2, 0.5], [0.34, 0.8], [0.62, 0.94], [0.62, 0.06], [0.92, 0.5], [0.62, 0.94]] },
  rapier: { name: 'Rune of the Rapier', pts: [[0.5, 0.05], [0.5, 0.95], [0.5, 0.7], ...wave(0.16, 0.84, 0.7, 0.07, 14)] },
  pistol: { name: 'Rune of the Wager', pts: [...circle(0.5, 0.5, 0.32, 16), [0.5, 0.06], [0.5, 0.94], [0.5, 0.5], [0.08, 0.5], [0.92, 0.5]] },
  head: { name: 'Rune of the Crown', pts: [[0.12, 0.84], [0.88, 0.84], [0.88, 0.3], [0.69, 0.56], [0.5, 0.14], [0.31, 0.56], [0.12, 0.3]] },
  chest: { name: 'Rune of the Bulwark', pts: [[0.2, 0.12], [0.8, 0.12], [0.8, 0.5], [0.5, 0.92], [0.2, 0.5], [0.2, 0.12], [0.5, 0.3], [0.8, 0.12]] },
  legs: { name: 'Rune of the Stride', pts: [[0.24, 0.1], [0.76, 0.1], [0.76, 0.9], [0.55, 0.9], [0.52, 0.36], [0.48, 0.36], [0.45, 0.9], [0.24, 0.9]] },
  feet: { name: 'Rune of the Road', pts: [[0.3, 0.08], [0.3, 0.62], [0.88, 0.74], [0.88, 0.92], [0.12, 0.92], [0.12, 0.62], [0.3, 0.62], [0.3, 0.08], [0.55, 0.08]] },
  ring: { name: 'Rune of the Bond', pts: [...circle(0.5, 0.58, 0.32, 18, Math.PI / 2), [0.5, 0.26], [0.36, 0.14], [0.5, 0.04], [0.64, 0.14], [0.5, 0.26]] },
  charm: { name: 'Rune of the Ward', pts: [[0.5, 0.06], [0.9, 0.5], [0.5, 0.94], [0.1, 0.5], [0.5, 0.06], [0.5, 0.94]] },
};
const BY_ARCH = { sword: 'sword', spear: 'spear', mace: 'mace', hammer: 'hammer', staff: 'staff', wand: 'wand', bow: 'bow', rapier: 'rapier', pistol: 'pistol' };

// the rune key for a piece: its weapon shape, or the slot it is worn in
export function runeKey(itemId) {
  const it = ITEMS[itemId]; if (!it) return 'sword';
  if (it.slot === 'weapon') return BY_ARCH[archOf(itemId)] ?? (it.wtype === 'slash' ? 'sword' : it.wtype === 'pierce' ? 'spear' : it.wtype === 'blunt' ? 'mace' : 'staff');
  return RUNES[it.slot] ? it.slot : 'charm';
}
// the points of this piece's rune, a little different each time (mirrored, nudged) but always the same drawing
export function runePoints(itemId, rng) {
  const key = runeKey(itemId), flip = rng?.chance?.(0.5) ?? false;
  return { key, name: RUNES[key].name, pts: RUNES[key].pts.map(([x, y]) => [+(flip ? 1 - x : x).toFixed(3), +(0.04 + y * 0.92).toFixed(3)]) };
}
