// ADVENTURES (server): progress on each region's goals, discoveries as you walk, rewards, mastery. Also two conveniences that belong with
// getting around: RECALL (channel for five seconds, return to Lanternfall) and EQUIP BEST.
import { ZONES, ITEMS, TOMES, fits } from '../data.js';
import { getMap, dist, regionOf, WORLD_POS } from '../world.js';
import { adventureGoals, POI_KINDS } from '../adventure.js';
import { eligibleTomes } from '../loadout.js';
import { upMult } from '../upgrade.js';
import { qualityStatMult, FIT_BONUS } from '../data.js';
import { RAID_ARENA_IDS } from '../raids.js';
import * as R from '../rules.js';

const RECALL = { channel: 5000, cooldown: 10 * 60000 };
const NO_RECALL = new Set(['raid_bastion', 'guild_raid', ...RAID_ARENA_IDS]);
const adv = (P) => (P.adv ??= { prog: {}, claimed: {}, disc: {}, mastered: {} });

export const adventureMethods = {
  advView(P, regionId) {
    const a = adv(P), A = adventureGoals(regionId); if (!A) return null; const pr = a.prog[regionId] ?? {}, cl = a.claimed[regionId] ?? {};
    return { id: regionId, name: A.name, lvl: A.lvl, mastered: !!a.mastered[regionId], mastery: A.mastery, goals: A.goals.map((g) => ({ id: g.id, text: g.text, need: g.need, have: Math.min(g.need, pr[g.id] ?? 0), done: !!cl[g.id], gilt: g.gilt, xp: g.xp })) };
  },
  on_adv_open(S) { const seen = new Set(Object.keys(S.P.seen ?? {})), here = regionOf(S.map); if (here) seen.add(here); const list = [...seen].map((id) => this.advView(S.P, id)).filter(Boolean).sort((x, y) => x.lvl - y.lvl); S.conn.send({ t: 'adv', list, mastered: Object.keys(adv(S.P).mastered).length }); },
  // the compact list for the current region (the on-screen tracker)
  advPush(S) { const id = regionOf(S.map); S.conn.send({ t: 'adv.cur', cur: id ? this.advView(S.P, id) : null }); },
  advBump(S, regionId, goalId, n = 1) {
    const A = adventureGoals(regionId); if (!A) return; const g = A.goals.find((x) => x.id === goalId); if (!g) return;
    const a = adv(S.P), pr = (a.prog[regionId] ??= {}), cl = (a.claimed[regionId] ??= {}); if (pr[goalId] >= g.need) return;
    pr[goalId] = Math.min(g.need, (pr[goalId] ?? 0) + n);
    if (pr[goalId] >= g.need && !cl[goalId]) {
      cl[goalId] = 1; S.P.gilt += g.gilt; const ups = R.gainXp(S.P, g.xp); S.P.stats.advGoals = (S.P.stats.advGoals ?? 0) + 1;
      this.toast(S, `* Goal complete in ${A.name}: ${g.text.split(' (')[0]} — +${g.gilt}g, +${g.xp} XP${ups.length ? `, LEVEL ${ups.at(-1)}!` : ''}`, 'secret');
      if (A.goals.every((x) => cl[x.id]) && !a.mastered[regionId]) {
        a.mastered[regionId] = 1; S.P.gilt += A.mastery.gilt; const u2 = R.gainXp(S.P, A.mastery.xp); const parts = [`+${A.mastery.gilt}g`, `+${A.mastery.xp} XP`];
        const tm = eligibleTomes(S.P, TOMES).filter((id) => !R.count(S.P, `tome_${id}`)); if (tm.length && this.rng.chance(0.4)) { const id = this.rng.pick(tm); R.addItem(S.P, `tome_${id}`, 1); parts.push(ITEMS[`tome_${id}`].n); }
        S.P.stats.regionsMastered = Object.keys(a.mastered).length; this.toast(S, `* ${A.name} MASTERED! ${parts.join(', ')}${u2.length ? ` — LEVEL ${u2.at(-1)}!` : ''}`, 'secret'); this.systemChat(` ${S.P.name} mastered ${A.name}!`);
      }
      this.afterChange(S);
    }
    this.touch(S); if (regionOf(S.map) === regionId) this.advPush(S);
  },
  // kills, gathering and dungeon clears call these
  advKill(S, mob) {
    const region = regionOf(mob.map); if (!region || !adventureGoals(region)) return; const z = ZONES[mob.map];
    if (z?.dungeon) { if (mob.boss) this.advBump(S, region, 'dungeon'); return; }
    if (mob.boss && mob.key === z.boss) this.advBump(S, region, 'boss'); else if (mob.elite && mob.key === z.elite) this.advBump(S, region, 'elite'); else if (!mob.boss) this.advBump(S, region, 'cull');
  },
  advGather(S, n) { const region = S.map in WORLD_POS ? S.map : null; if (region) this.advBump(S, region, 'gather', n); },
  // walking near a camp, ruin, shrine, sign or waystone discovers it
  tickAdventure(nw) {
    for (const S of this.sessions.values()) {
      if (S.dead || !(S.map in WORLD_POS) || nw - (S.advAt ?? 0) < 450) continue; S.advAt = nw; const A = adventureGoals(S.map); if (!A) continue;
      const a = adv(S.P), found = (a.disc[S.map] ??= []);
      for (const p of getMap(S.map).points) { if (!POI_KINDS.has(p.kind) || p.hidden || found.includes(p.id) || dist(S.x, S.y, p.x, p.y) > 4.5) continue; found.push(p.id);
        const have = found.length; this.toast(S, `Discovered: ${p.name ?? (p.kind === 'waystone' ? 'a waystone' : 'a landmark')} (${have} found here)`, 'good'); this.advBump(S, S.map, 'discover'); }
    }
    this.tickRecalls(nw);
  },

  // ── recall: five seconds of standing still, then home ──
  on_recall(S) {
    const P = S.P, nw = this.now(); if (S.dead || S.duel || this.inCombat(S) || NO_RECALL.has(S.map)) return this.toast(S, 'You cannot recall right now.', 'bad');
    if (S.recall) { S.recall = null; S.conn.send({ t: 'recall', state: 'cancel' }); return this.toast(S, 'Recall cancelled.'); }
    if ((P.recallAt ?? 0) > nw) return this.toast(S, `Recall is cooling down (${Math.ceil(((P.recallAt ?? 0) - nw) / 1000)}s).`, 'bad');
    if (S.map === 'town') return this.toast(S, 'You are already in Lanternfall.');
    S.recall = { until: nw + RECALL.channel, x: S.x, y: S.y, hurt: S.lastHurt }; S.conn.send({ t: 'recall', state: 'start', ms: RECALL.channel }); this.toast(S, 'Recalling to Lanternfall… stand still for 5 seconds.', 'good');
  },
  tickRecalls(nw) {
    for (const S of this.sessions.values()) { const r = S.recall; if (!r) continue;
      if (S.dead || S.lastHurt > r.hurt || dist(S.x, S.y, r.x, r.y) > 0.8) { S.recall = null; S.conn.send({ t: 'recall', state: 'cancel' }); this.toast(S, 'Recall interrupted.', 'bad'); continue; }
      if (nw >= r.until) { S.recall = null; S.P.recallAt = nw + RECALL.cooldown; this.travel(S, 'town', 26.5, 19.5); S.conn.send({ t: 'recall', state: 'done', cd: RECALL.cooldown }); this.toast(S, 'You are back in Lanternfall.', 'good'); } }
  },

  // ── equip the best piece in every slot ──
  on_inv_best(S) {
    if (S.dead || this.inCombat(S)) return this.toast(S, 'Not in the heat of battle.', 'bad'); const P = S.P, changed = [];
    const score = (g) => { const it = ITEMS[g.id], f = fits(g.id, P.classId) ? 1 + FIT_BONUS : 1, m = qualityStatMult(g.q) * upMult(g.up) * f; return (it.atk ?? 0) * m + (it.def ?? 0) * m * 1.2 + (it.hp ?? 0) * m * 0.2 + ((it.mp ?? 0) * qualityStatMult(g.q) * f) * 0.2 + (it.crit ?? 0) * 100 + (g.fx?.length ?? 0) * 3; };
    for (const slot of ['weapon', 'armor', 'charm']) {
      const cands = P.gear.filter((g) => ITEMS[g.id].slot === slot); if (!cands.length) continue; const best = cands.reduce((a, b) => (score(b) > score(a) ? b : a)), cur = P.gear.find((g) => g.uid === P.equip[slot]);
      if (best.uid !== P.equip[slot] && (!cur || score(best) > score(cur) + 1e-6)) { R.equip(P, best.uid); changed.push(R.gearName(best)); }
    }
    this.recalc(S); this.touch(S); this.toast(S, changed.length ? `Equipped: ${changed.join(', ')}.` : 'You already wear your best gear.', changed.length ? 'good' : '');
  },
};
