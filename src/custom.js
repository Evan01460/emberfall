// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM CRAFTING — instead of only fixed recipes, smiths and alchemists attach EFFECTS to what they make.
//   • A Blacksmith forges any gear recipe and may attach effects to it (each costs materials).
//   • An Alchemist brews custom Draughts (drunk), Flasks (thrown) and Essences (used to ENCHANT gear at a forge).
//   • How many effects, and how powerful, depends on the crafter's level and mastery — low-level crafters cannot do it at all.
//   • A Blacksmith's own enchant slots can only be filled with Essences brewed by an Alchemist: the two classes need each other.
// Pure data + pure helpers; shared by server and client.
// ─────────────────────────────────────────────────────────────────────────────
import { masteryOf, pathOf, isMythic } from './loadout.js';

// mods: per-unit stats added to gear. keys: atk def hp mp spd dmg(+fraction) power crit(+chance) ls(lifesteal) thorns regen(hp frac/s) mpOnHit slowOnHit(ms) stun(+chance)
export const GEAR_FX = {
  // tier 1 — level 5+
  keen: { name: 'Keen', tier: 1, slots: ['weapon', 'charm', 'ring'], cost: { coal: 2 }, mods: { dmg: 0.06 }, text: '+6% damage' },
  honed: { name: 'Honed', tier: 1, slots: ['weapon'], cost: { iron_ingot: 1 }, mods: { atk: 2.5 }, text: '+2.5 attack' },
  sturdy: { name: 'Sturdy', tier: 1, slots: ['head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { iron_ingot: 1 }, mods: { def: 2.5 }, text: '+2.5 defence' },
  vital: { name: 'Vital', tier: 1, slots: ['weapon', 'head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { herb: 3 }, mods: { hp: 16 }, text: '+160 max HP' },
  wellspring: { name: 'Wellspring', tier: 1, slots: ['weapon', 'head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { ink: 2 }, mods: { mp: 14 }, text: '+14 max mana' },
  fleet: { name: 'Fleet', tier: 1, slots: ['head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { hide: 3 }, mods: { spd: 1 }, text: '+1 speed' },
  // tier 2 — level 12+
  vampiric: { name: 'Vampiric', tier: 2, slots: ['weapon'], cost: { ink: 3, herb: 3 }, mods: { ls: 0.03 }, text: '3% lifesteal' },
  precise: { name: 'Precise', tier: 2, slots: ['weapon', 'charm', 'ring'], cost: { steel_ingot: 1 }, mods: { crit: 0.05 }, text: '+5% crit chance' },
  thorned: { name: 'Thorned', tier: 2, slots: ['head', 'chest', 'legs', 'feet'], cost: { steel_ingot: 1 }, mods: { thorns: 0.08 }, text: 'reflect 8% of damage taken' },
  regenerative: { name: 'Regenerative', tier: 2, slots: ['head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { herb: 6 }, mods: { regen: 0.006 }, text: 'regenerate 0.6% HP per second' },
  siphoning: { name: 'Siphoning', tier: 2, slots: ['weapon', 'charm', 'ring'], cost: { ink: 4 }, mods: { mpOnHit: 1 }, text: '+1 mana per hit' },
  chilling: { name: 'Chilling', tier: 2, slots: ['weapon'], cost: { frostbloom: 2 }, mods: { slowOnHit: 1200 }, text: 'hits slow enemies' },
  stunning: { name: 'Stunning', tier: 2, slots: ['weapon'], cost: { sunsteel_ore: 2 }, mods: { stun: 0.05 }, text: '5% chance to stun on hit' },
  warding: { name: 'Warding', tier: 2, slots: ['head', 'chest', 'legs', 'feet'], cost: { steel_ingot: 2 }, mods: { def: 5 }, text: '+5 defence' },
  // tier 3 — level 20+
  soulthirst: { name: 'Soulthirst', tier: 3, slots: ['weapon'], cost: { hollow_ingot: 1, echo_shard: 1 }, mods: { ls: 0.06 }, text: '6% lifesteal' },
  vorpal: { name: 'Vorpal', tier: 3, slots: ['weapon'], cost: { sunsteel_ingot: 1 }, mods: { crit: 0.1, dmg: 0.08 }, text: '+10% crit, +8% damage' },
  dragonhide: { name: 'Dragonhide', tier: 3, slots: ['head', 'chest', 'legs', 'feet'], cost: { sunsteel_ingot: 2 }, mods: { def: 9, hp: 50 }, text: '+9 defence, +500 HP' },
  titanic: { name: 'Titanic', tier: 3, slots: ['weapon'], cost: { hollow_ingot: 2 }, mods: { atk: 8 }, text: '+8 attack' },
  archmage: { name: 'Archmage', tier: 3, slots: ['weapon', 'charm', 'ring'], cost: { echo_shard: 3 }, mods: { mp: 50, mpOnHit: 2 }, text: '+50 mana, +2 mana per hit' },
  evergreen: { name: 'Evergreen', tier: 3, slots: ['head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { ghostbloom: 3 }, mods: { regen: 0.012 }, text: 'regenerate 1.2% HP per second' },
  // tier 4 — only with a Mastery (or a mythic class), level 20+
  starforged: { name: 'Starforged', tier: 4, slots: ['weapon', 'head', 'chest', 'legs', 'feet', 'charm', 'ring'], cost: { starmetal: 1, sunsteel_ingot: 2 }, mods: { atk: 8, def: 6, hp: 40, dmg: 0.08 }, text: '+8 ATK, +6 DEF, +400 HP, +8% damage' },
  oathkeeper: { name: 'Oathkeeper', tier: 4, slots: ['head', 'chest', 'legs', 'feet'], cost: { starmetal: 1, hollow_ingot: 2 }, mods: { thorns: 0.15, ls: 0.05 }, text: 'reflect 15%, 5% lifesteal' },
  worldbreaker: { name: 'Worldbreaker', tier: 4, slots: ['weapon'], cost: { starmetal: 2 }, mods: { dmg: 0.18, stun: 0.08 }, text: '+18% damage, 8% stun chance' },
};

// Alchemy: Draughts are drunk (hotkey 7), Flasks are thrown at the cursor (hotkey 7), Essences go into gear at a forge.
export const FORMS = {
  draught: { name: 'Draught', note: 'Drink for an instant effect or a timed buff.' },
  flask: { name: 'Flask', note: 'Throw at the cursor: area effects on enemies.' },
  essence: { name: 'Essence', note: 'Hand to a Blacksmith: they pour it into a weapon, armour or charm at the forge.' },
};
// buff keys: dmg red ls crit regen mpRegen shield(frac of max HP) heal(frac) mana(frac) · flask keys: power radius dot(k,ticks) slow stun
export const DRAUGHT_FX = {
  mend: { name: 'Mending', tier: 1, cost: { herb: 2 }, fx: { heal: 0.18 }, text: 'instantly restore 18% HP' },
  clarity: { name: 'Clarity', tier: 1, cost: { ink: 1 }, fx: { mana: 0.25 }, text: 'instantly restore 25% mana' },
  ironskin: { name: 'Iron Skin', tier: 1, cost: { hide: 2 }, fx: { buff: { red: 0.1, ms: 20000 } }, text: '-10% damage taken for 20s' },
  renewal: { name: 'Renewal', tier: 2, cost: { herb: 4 }, fx: { buff: { regen: 0.012, ms: 20000 } }, text: 'regenerate 1.2% HP/s for 20s' },
  might: { name: 'Might', tier: 2, cost: { coal: 4 }, fx: { buff: { dmg: 0.12, ms: 20000 } }, text: '+12% damage for 20s' },
  focus: { name: 'Focus', tier: 2, cost: { ink: 3 }, fx: { buff: { crit: 0.12, ms: 20000 } }, text: '+12% crit chance for 20s' },
  bloodlust: { name: 'Bloodlust', tier: 2, cost: { ink: 2, herb: 3 }, fx: { buff: { ls: 0.05, ms: 20000 } }, text: '5% lifesteal for 20s' },
  bulwark: { name: 'Bulwark', tier: 3, cost: { frostbloom: 2 }, fx: { shield: 0.25, buff: { ms: 15000 } }, text: 'absorb 25% of max HP' },
  berserk: { name: 'Berserk', tier: 3, cost: { sunsteel_ore: 2 }, fx: { buff: { dmg: 0.25, red: -0.1, ms: 15000 } }, text: '+25% damage, take 10% more, 15s' },
  arcane_surge: { name: 'Arcane Surge', tier: 3, cost: { echo_shard: 2 }, fx: { buff: { mpRegen: 4, ms: 15000 } }, text: 'mana regenerates 4× faster for 15s' },
  lifeblood: { name: 'Lifeblood', tier: 4, cost: { hollow_ichor: 1, ghostbloom: 2 }, fx: { heal: 0.5, buff: { regen: 0.012, ms: 20000 } }, text: 'restore 50% HP and regenerate' },
};
export const FLASK_FX = {
  blast: { name: 'Blast', tier: 1, cost: { coal: 3 }, fx: { power: 30 }, text: 'explodes for damage' },
  frost: { name: 'Frost', tier: 1, cost: { frostbloom: 1 }, fx: { slow: 3000 }, text: 'slows enemies for 3s' },
  burn: { name: 'Burning', tier: 2, cost: { coal: 4, herb: 2 }, fx: { dot: { k: 'fire', ticks: 8, power: 8 } }, text: 'leaves burning ground' },
  venom: { name: 'Venom', tier: 2, cost: { herb: 5 }, fx: { dot: { k: 'poison', ticks: 8, power: 7 }, slow: 1500 }, text: 'poison cloud that also slows' },
  thunder: { name: 'Thunder', tier: 2, cost: { sunsteel_ore: 2 }, fx: { stun: 1400, power: 14 }, text: 'stuns enemies for 1.4s' },
  mist: { name: 'Healing Mist', tier: 3, cost: { herb: 6, frostbloom: 1 }, fx: { field: 0.05 }, text: 'heals allies standing in the cloud' },
  plague: { name: 'Plague', tier: 3, cost: { ghostbloom: 3 }, fx: { dot: { k: 'poison', ticks: 12, power: 12 }, slow: 2500 }, text: 'a long, hungry cloud' },
  cataclysm: { name: 'Cataclysm', tier: 4, cost: { hollow_ichor: 1, starmetal: 1 }, fx: { power: 120, stun: 1800 }, text: 'a vast explosion that stuns' },
};
export const FX_BY_FORM = { draught: DRAUGHT_FX, flask: FLASK_FX, essence: GEAR_FX };

// ── gating: level and mastery decide how many effects, and which tiers ──────
const LV_SLOTS = (L) => (L < 5 ? 0 : L < 10 ? 1 : L < 15 ? 2 : L < 20 ? 3 : L < 25 ? 4 : 5);
export function craftTier(P) { const L = P.level; const base = L < 5 ? 0 : L < 12 ? 1 : L < 20 ? 2 : 3; return (masteryOf(P) || isMythic(P)) && L >= 20 ? 4 : base; }
export function craftSlots(P) { return LV_SLOTS(P.level) + (masteryOf(P) ? 1 : 0) + (isMythic(P) ? 1 : 0) + (pathOf(P) && P.level >= 8 ? 0 : 0); }
export const enchantSlots = (P) => Math.max(0, Math.ceil(craftSlots(P) / 2));          // a smith's enchant capacity (filled with alchemists' essences)
export const canCustomise = (P) => craftSlots(P) > 0;
export const effectUnlocked = (P, fx) => fx.tier <= craftTier(P);
// Strength of an effect comes from the crafting quality (0..1) and, a little, from the crafter's level.
export const fxStrength = (q, P) => Math.round((0.75 + 0.55 * q + Math.min(0.1, P.level * 0.003)) * 100) / 100;
// Extra forging/brewing difficulty for each effect attached.
export const customDiff = (ids, table) => ids.reduce((d, id) => d + 0.035 + 0.03 * (table[id]?.tier ?? 1), 0);

export function effectText(id, table = GEAR_FX) { return table[id]?.text ?? ''; }

// Sum an effect list into stat bonuses (used for gear).
export function sumGearFx(list, into, flat = 1) {
  for (const e of list ?? []) {
    const d = GEAR_FX[e.id]; if (!d) continue;
    for (const [k, v] of Object.entries(d.mods)) into[k] = (into[k] ?? 0) + v * (k === 'spd' || k === 'slowOnHit' ? 1 : e.k ?? 1) * (k === 'atk' || k === 'def' || k === 'hp' || k === 'mp' ? flat : 1);
  }
}
export function customName(base, fx, cname) {
  if (cname) return cname;
  const first = fx?.[0] && GEAR_FX[fx[0].id]?.name;
  return `${first ? first + ' ' : ''}${base}`;
}

// Validate a custom request. Returns { ok, msg, ids, cost } — `have` = (item id) => count.
export function checkCustom(P, form, ids, have, slotFilter = null) {
  const table = FX_BY_FORM[form]; if (!table) return { ok: false, msg: 'Unknown form.' };
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => table[id]);
  if (!canCustomise(P)) return { ok: false, msg: 'You are not skilled enough to craft custom items yet (level 5).' };
  const max = form === 'essence' ? 1 : craftSlots(P);
  if (list.length > max) return { ok: false, msg: `You can attach at most ${max} effect${max === 1 ? '' : 's'}.` };
  const cost = {};
  for (const id of list) {
    const fx = table[id];
    if (!effectUnlocked(P, fx)) return { ok: false, msg: `${fx.name} needs a ${['', 'novice', 'journeyman', 'expert', 'master'][fx.tier] ?? 'higher'} crafter.` };
    if (slotFilter && fx.slots && !fx.slots.includes(slotFilter)) return { ok: false, msg: `${fx.name} cannot go on ${slotFilter}s.` };
    for (const [item, n] of Object.entries(fx.cost)) cost[item] = (cost[item] ?? 0) + n;
  }
  for (const [item, n] of Object.entries(cost)) if (have(item) < n) return { ok: false, msg: 'You lack the materials.' };
  return { ok: true, ids: list, cost };
}
