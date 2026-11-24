// WHAT A PLAYER LOOKS LIKE. Helmet, chestplate, leggings and boots change the character's sprite: the cloth, leather or metal of each piece (its style and
// its metal tier) is sent along with the player as a short string, and the client draws it. Pure, shared by server and client.
import { ITEMS, ARCH, archOf, tierOf, TIERS } from './data.js';

const STYLE_CODE = { robe: 'r', coat: 'c', mail: 'm', plate: 'p' }, CODE_STYLE = { r: 'robe', c: 'coat', m: 'mail', p: 'plate' };
export const LOOK_SLOTS = ['head', 'chest', 'legs', 'feet'];
const tierIndex = (id) => Math.max(0, TIERS.findIndex((t) => t.id === tierOf(id)));
// "p14|r3||c0": head = plate/tier 14, chest = robe/tier 3, legs = nothing, feet = coat(leather)/tier 0
export function lookOf(P) {
  return LOOK_SLOTS.map((slot) => {
    const g = P.gear?.find((x) => x.uid === P.equip?.[slot]); if (!g) return ''; const it = ITEMS[g.id], A = ARCH[archOf(g.id)];
    const style = A?.style ?? (['robe', 'coat', 'mail', 'plate'].includes(archOf(g.id)) ? archOf(g.id) : /robe/.test(g.id) ? 'robe' : /plate|aegis/.test(g.id) ? 'plate' : /mail/.test(g.id) ? 'mail' : 'coat');
    return it ? `${STYLE_CODE[style] ?? 'c'}${tierIndex(g.id)}` : '';
  }).join('|');
}
export function parseLook(str) {
  const out = {}; if (!str) return out;
  str.split('|').forEach((part, i) => { const m = /^([rcmp])(\d+)$/.exec(part); if (m) out[LOOK_SLOTS[i]] = { s: CODE_STYLE[m[1]], t: TIERS[+m[2]]?.id ?? 'iron' }; });
  return out;
}
