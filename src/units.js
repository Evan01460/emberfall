// Player & enemy stat derivation for real-time combat, plus loot rules.
import { CLASSES, ENEMIES, ITEMS, AFFIXES, qualityStatMult, MAX_LEVEL, FIT_BONUS, fits, HP_SCALE } from './data.js';
import { clamp } from './rng.js';
import { modsOf, statusOf } from './loadout.js';
import { sumGearFx } from './custom.js';

export { MAX_LEVEL, HP_SCALE };
// Beyond level 30 each level takes progressively longer, so the road to 100 is a real journey.
export const xpForLevel = (lvl) => Math.round(40 * Math.pow(lvl, 1.55) * (lvl > 30 ? 1 + (lvl - 30) * 0.12 : 1));

export function gearBonuses(gearList, classId = null) {
  const b = { atk: 0, def: 0, hp: 0, mp: 0, spd: 0, dmg: 0, power: 0, wtype: null, crit: 0, ls: 0, thorns: 0, regen: 0, mpOnHit: 0, slowOnHit: 0, stun: 0 };
  for (const g of gearList) {
    if (!g) continue;
    const it = ITEMS[g.id], m = qualityStatMult(g.q);
    const f = classId && fits(g.id, classId) ? 1 + FIT_BONUS : 1;                // gear made for your class is 10% stronger
    b.atk += (it.atk ?? 0) * m * f; b.def += (it.def ?? 0) * m * f; b.hp += (it.hp ?? 0) * m * f; b.crit += it.crit ?? 0;
    b.mp += (it.mp ?? 0) * m * f; b.spd += Math.floor((it.spd ?? 0) * m);
    if (it.wtype) b.wtype = it.wtype;
    sumGearFx(g.fx, b); sumGearFx(g.ench, b);
    const af = g.affix && AFFIXES.find((a) => a.id === g.affix);
    if (af) { b.dmg += af.dmg ?? 0; b.mp += af.mp ?? 0; b.power += af.power ?? 0; b.def += af.def ?? 0; b.hp += af.hp ?? 0; }
  }
  return b;
}
export const equippedGear = (P) => ['weapon', 'armor', 'charm'].map((s) => P.gear.find((g) => g.uid === P.equip[s]) ?? null);

// Everything the real-time simulation needs to know about a player's combat strength.
export function rtStats(P) {
  const cls = CLASSES[P.classId], b = gearBonuses(equippedGear(P), P.classId), L = P.level, m = modsOf(P), st = statusOf(P);
  return {
    maxHp: Math.round((cls.hp + (L - 1) * cls.hpPer + b.hp) * m.hp * HP_SCALE),
    maxMp: Math.round((60 + 6 * (L - 1) + b.mp) * m.mp),
    atk: (cls.atk + 2 * (L - 1) + b.atk) * m.atk,
    def: (cls.def + 1.5 * (L - 1) + b.def) * m.def,
    dmgMult: (1 + b.dmg + b.power * 0.08) * m.dmg * (1 + Math.max(0, L - 30) * 0.03),   // past level 30 you hit harder with every level, keeping fights a sensible length against the tougher monsters
    wtype: b.wtype, move: ((cls.move ?? 1) + b.spd * 0.04) * m.move,
    mpRegen: (cls.mpRegen ?? 1.2) * m.mpRegen, taintImmune: !!cls.taintImmune,
    passives: cls.passives ?? [], status: st, lifesteal: b.ls, crit: b.crit, thorns: b.thorns, regen: b.regen, mpOnHit: b.mpOnHit, slowOnHit: Math.round(b.slowOnHit), stunChance: b.stun,
  };
}

export function calcDamage(power, atk, def, res = 1, mult = 1) {
  return Math.max(1, Math.round(power * clamp(1 + (atk - def) * 0.03, 0.4, 2.2) * res * mult));
}

// Stats for an enemy of a given level. Shades (mirror enemies) copy the target player's class strength.
export function enemyStats(key, level) {
  const d = ENEMIES[key];
  const s = (2.1 + 0.3 * (Math.min(level, 33) - 1) + 0.08 * Math.max(0, level - 33)) * (d.tough ?? 1), t = d.tough ? 4 : 0;   // health grows more slowly past level 33
  return { maxHp: Math.round(d.hp * s), atk: d.atk + level + t, def: d.def + 0.7 * (level - 1) + t, speed: d.speed };
}
export function shadeStats(P, level) {
  const st = rtStats(P), cls = CLASSES[P.classId];
  return { maxHp: Math.round((st.maxHp / HP_SCALE + 20) * 1.35), atk: st.atk + 6, def: st.def + 4, speed: 2.6 + (cls.move ?? 1) * 0.5 };
}

export const enemyLevel = (zone, playerLevel) => Math.max(zone.lvl, Math.min(playerLevel, zone.lvl + 3));

// Rewards for one player for killing one enemy ({key, level}).
export function computeRewards(enemies, playerLevel, rng) {
  let xp = 0, gold = 0; const drops = {}; let pages = 0, ichor = 0, shades = 0;
  for (const e of enemies) {
    const d = ENEMIES[e.key], over = playerLevel - e.level;
    xp += Math.round(d.xp * (1 + 0.12 * (e.level - 1)) * Math.max(0.25, 1 - 0.12 * Math.max(0, over)));
    gold += rng.int(d.gold[0], d.gold[1]) + e.level * 2;
    for (const [id, p, a, b] of d.drops) if (rng.chance(p)) drops[id] = (drops[id] ?? 0) + rng.int(a, b);
    if (d.torn && rng.chance(d.torn)) { drops.torn_page = (drops.torn_page ?? 0) + 1; pages++; }
    if (d.ichor && rng.chance(d.ichor)) { drops.hollow_ichor = (drops.hollow_ichor ?? 0) + 1; ichor++; }
    if (d.mirror) shades++;
  }
  return { xp, gold, drops, pages, ichor, reflections: shades };
}
