// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// RAID ENGINE — the multi-boss raids described in src/raids.js. Mixed into GameServer.
//
// A raid is entered from an NPC in the Far Reaches by a party standing together (a solo world lets one player try). The party is carried
// through the raid's wings one after another: each wing is a walled arena holding one encounter. Phases trigger as a boss's health falls;
// when every boss of a wing is dead the survivors are rewarded, healed and carried to the next wing. A raider who dies is returned to
// town (as everywhere in Emberfall); when nobody is left standing the raid resets and has to be started again.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { RAIDS } from '../raids.js';
import { ENEMIES, ZONES, ITEMS, AFFIXES, TOMES, tierOf, fitsOf } from '../data.js';
import { eligibleTomes } from '../loadout.js';
import { GEAR_FX } from '../custom.js';
import { xpForLevel } from '../units.js';
import { getMap, dist } from '../world.js';
import * as R from '../rules.js';

const RAID_LIFE = 40 * 60000, INTERMISSION = 9000;

export const raidMethods = {
  initRaids() { this.raids = {}; },

  // what the gate shows
  raid2Status(S, id) {
    const R0 = RAIDS[id]; if (!R0) return null; const run = this.raids[id], pt = this.parties.get(S.partyId), solo = this.sessions.size === 1;
    return { id, name: R0.name, blurb: R0.blurb, color: R0.color, minLevel: R0.minLevel, size: R0.size, solo, need: solo ? 1 : 2, partySize: pt ? pt.members.length : 1, busy: !!run && !run.over, by: run?.byName ?? null, wing: run ? run.wing + 1 : 0, title: R0.title,
      wings: R0.wings.map((w) => ({ name: w.name, bosses: w.bosses.map((b) => ENEMIES[b.key].name), link: w.link ?? null, lvl: w.lvl })) };
  },
  raidCrew(run) { const R0 = run.raid, arenas = new Set(R0.wings.map((w) => w.id)); return [...run.members].map((id) => this.sessions.get(id)).filter((o) => o && arenas.has(o.map)); },
  raidSay(crew, title, text) { for (const o of crew) o.conn.send({ t: 'announce', title, text }); },

  on_raid2_enter(S, m) {
    const R0 = RAIDS[m?.raid]; if (!R0 || S.dead) return;
    const npc = getMap(S.map).points.find((p) => p.role === 'raid2' && p.raid === R0.id);
    if (!npc || dist(S.x, S.y, npc.x, npc.y) > 5) return this.toast(S, `Find the ${R0.entry.npc}.`, 'bad');
    if (S.P.level < R0.minLevel) return this.toast(S, `${R0.name} is for level ${R0.minLevel}+.`, 'bad');
    const cur = this.raids[R0.id]; if (cur && !cur.over) return this.toast(S, `${R0.name} is occupied by ${cur.byName}'s raid. Wait for them to finish.`, 'bad');
    const pt = this.parties.get(S.partyId), solo = this.sessions.size === 1;
    const crew = pt ? pt.members.map((id) => this.sessions.get(id)).filter((o) => o && o.map === S.map && !o.dead && dist(o.x, o.y, S.x, S.y) < 12 && o.P.level >= R0.minLevel) : [S];
    if (!solo && crew.length < 2) return this.toast(S, 'A raid needs at least 2 players in a party, standing close together.', 'bad');
    if (crew.length > R0.size) return this.toast(S, `${R0.name} takes at most ${R0.size} raiders.`, 'bad');
    const run = { raid: R0, byName: S.P.name, members: new Set(crew.map((o) => o.id)), start: this.now(), wing: -1, k: Math.min(3.5, 1 + 0.5 * (crew.length - 1)), over: false, exit: [getMap(R0.entry.map).raidExit?.x ?? npc.x, getMap(R0.entry.map).raidExit?.y ?? npc.y + 1.5], cleared: 0 };
    this.raids[R0.id] = run; this.startWing(run, 0, crew);
  },

  startWing(run, idx, crew) {
    const R0 = run.raid, W = R0.wings[idx], arena = W.id, nw = this.now();
    this.mobs = this.mobs.filter((x) => !(x.map === arena && x.temp));
    Object.assign(run, { wing: idx, wingStart: nw, intermission: false, bossIds: [], triggered: new Set(), spawners: [], meteorSpecs: [], pending: [], twinEnraged: false, softEnraged: false, shieldOn: false, shielded: false });
    const n = W.bosses.length, bs = getMap(arena).bossSpawn;
    W.bosses.forEach((b, i) => {
      const x = bs.x + (i - (n - 1) / 2) * 9, y = bs.y, mob = this.newMob(arena, ZONES[arena], x, y, true, false, { forceKey: b.key, forceLevel: W.lvl, temp: true, raidBoss: true });
      mob.maxHp = mob.hp = Math.round(mob.maxHp * run.k * (b.hpMult ?? 1)); mob.fresh = true; this.mobs.push(mob); run.bossIds.push(mob.id);
    });
    const sp = getMap(arena).spawn;
    for (const o of crew) { this.travel(o, arena, sp.x + (Math.random() - 0.5) * 4, sp.y); o.hp = o.rt.maxHp; o.mp = o.rt.maxMp; o.shield = 0; this.touch(o); }
    this.raidSay(crew, W.intro[0], W.intro[1]);
  },

  tickRaids2(nw) { for (const id of Object.keys(this.raids)) { const run = this.raids[id]; if (run) this.tickRaid2(run, nw); } },
  clearRaid(run, crew, exit = true) {
    const R0 = run.raid; this.mobs = this.mobs.filter((x) => !(R0.wings.some((w) => w.id === x.map) && x.temp)); delete this.raids[R0.id];
    if (exit) for (const o of crew) if (!o.dead) { this.travel(o, R0.entry.map, run.exit[0], run.exit[1]); o.hp = o.rt.maxHp; }
  },
  tickRaid2(run, nw) {
    const R0 = run.raid, crew = this.raidCrew(run), alive = crew.filter((o) => !o.dead);
    if (run.over) { if (nw > run.endAt) this.clearRaid(run, crew); return; }
    if (!crew.length || nw - run.start > RAID_LIFE) { this.raidSay(crew, `${R0.name.toUpperCase()}`, 'The raid has ended.'); return this.clearRaid(run, crew); }
    if (run.intermission) { if (nw >= run.nextAt) this.startWing(run, run.wing + 1, alive); return; }
    if (!alive.length && nw - run.wingStart > 4000) return this.clearRaid(run, crew, false);
    const W = R0.wings[run.wing], arena = W.id, bosses = run.bossIds.map((id) => this.mobs.find((x) => x.id === id)), live = bosses.filter((b) => b && !b.deadUntil && b.hp > 0);

    // the encounter is won
    if (!live.length) {
      run.cleared++; for (const o of alive) this.raidLoot2(o, run, run.wing, run.wing === R0.wings.length - 1);
      this.mobs = this.mobs.filter((x) => !(x.map === arena && x.temp && !x.raidBoss)); for (const x of this.mobs) if (x.map === arena && x.temp) x.hp = 0;
      if (run.wing === R0.wings.length - 1) { run.over = true; run.endAt = nw + 60000; this.announceAll(`${R0.name} has fallen!`, `${run.byName}'s raid cleared ${R0.name}.`); for (const o of alive) this.raidFinal(o, run); }
      else { run.intermission = true; run.nextAt = nw + INTERMISSION; this.raidSay(alive, `WING ${run.wing + 1} CLEARED`, `Catch your breath. The next wing opens in ${Math.round(INTERMISSION / 1000)} seconds.`); }
      return;
    }
    // linked bosses: when one falls the other is driven wild and heals
    if (W.link === 'twin' && bosses.length > 1 && live.length === 1 && !run.twinEnraged) { run.twinEnraged = true; const b = live[0]; b.speed *= 1.35; b.atk = Math.round(b.atk * 1.25); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.25); this.emit(arena, { t: 'aura', x: b.x, y: b.y, r: 4, c: 'rage' }); this.raidSay(alive, 'THE SURVIVOR AVENGES ITS KIN', 'It heals and fights twice as hard. End it quickly!'); }
    // a soft enrage so a fight cannot be stalled forever
    if (!run.softEnraged && nw - run.wingStart > 8 * 60000) { run.softEnraged = true; for (const b of live) { b.speed *= 1.3; b.atk = Math.round(b.atk * 1.3); } this.raidSay(alive, 'ENRAGE', 'The bosses have lost patience.'); }
    // phases
    for (const b of live) {
      const ratio = b.hp / b.maxHp;
      W.phases.forEach((p, pi) => {
        const key = `${b.id}:${pi}`; if (run.triggered.has(key) || ratio > p.at) return; run.triggered.add(key);
        if (p.say) this.raidSay(alive, p.say[0], p.say[1]);
        if (p.enrage) { b.speed *= p.enrage.speed ?? 1; b.atk = Math.round(b.atk * (p.enrage.atk ?? 1)); this.emit(arena, { t: 'aura', x: b.x, y: b.y, r: 4, c: 'rage' }); }
        if (p.heal) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * p.heal);
        if (p.adds) run.spawners.push({ ...p.adds, next: nw + 1500, boss: b.id });
        if (p.meteors) run.meteorSpecs.push({ ...p.meteors, next: nw + 2500 });
        if (p.shield) run.shieldOn = true;
      });
    }
    // adds
    const liveAdds = this.mobs.filter((x) => x.map === arena && x.raidAdd && !x.deadUntil && x.hp > 0).length;
    for (const sp of run.spawners) {
      if (nw < sp.next) continue; sp.next = nw + sp.every; const owner = bosses.find((x) => x && x.id === sp.boss && !x.deadUntil) ?? live[0]; let have = liveAdds;
      for (let i = 0; i < sp.n && have < sp.cap; i++, have++) { const a = (i / sp.n) * Math.PI * 2 + Math.random(), add = this.newMob(arena, ZONES[arena], owner.x + Math.cos(a) * 3, owner.y + Math.sin(a) * 3, false, false, { forceKey: sp.key, forceLevel: W.lvl, temp: true, raidAdd: true }); add.target = alive[i % alive.length]?.id ?? null; this.mobs.push(add); }
    }
    // a shield that holds while the boss's servants live
    if (run.shieldOn) { const now2 = this.mobs.some((x) => x.map === arena && x.raidAdd && !x.deadUntil && x.hp > 0); for (const b of live) b.immune = now2; if (now2 !== run.shielded) { run.shielded = now2; this.raidSay(alive, now2 ? 'SHIELDED' : 'THE SHIELD FALLS', now2 ? 'Kill the servants — the boss takes almost no damage.' : 'It is exposed. Burn it down!'); } }
    // meteors: a red ring where a raider stands, detonating 1.5 s later
    for (const mt of run.meteorSpecs) if (nw >= mt.next && alive.length) { mt.next = nw + mt.every; const n = Math.min(alive.length, 1 + Math.floor(alive.length / 3)); for (let i = 0; i < n; i++) { const t = alive[Math.floor(Math.random() * alive.length)]; run.pending.push({ at: nw + 1500, x: t.x, y: t.y, r: mt.radius, pct: mt.pct }); this.emit(arena, { t: 'aura', x: t.x, y: t.y, r: mt.radius, c: 'rage' }); } }
    run.pending = run.pending.filter((mt) => { if (nw < mt.at) return true; this.emit(arena, { t: 'boom', x: mt.x, y: mt.y, r: mt.r, ty: 'blunt', who: 'm0', g: 'flame' }); for (const o of alive) if (!o.dead && dist(o.x, o.y, mt.x, mt.y) < mt.r + 0.4) this.hurtPlayer(o, Math.round(o.rt.maxHp * mt.pct), { hpUnits: true }); return false; });
  },

  // rewards: gilt, XP, usually a piece of raid-forged gear with a powerful effect, sometimes a tome or starmetal
  raidLoot2(S, run, idx, final) {
    const R0 = run.raid, P = S.P, got = [], L = R0.lootLevel, mult = final ? 2.4 : 1 + idx * 0.25;
    const gilt = Math.round(L * 40 * mult); P.gilt += gilt; got.push(`${gilt}g`);
    const xp = Math.round(xpForLevel(Math.max(1, Math.min(P.level, L))) * 0.12 * mult); if (xp > 0) { const ups = R.gainXp(P, xp); if (ups.length) this.toast(S, `* Level ${ups.at(-1)}!`, 'good'); }
    if (final || this.rng.chance(0.5)) {
      const tiers = final ? R0.tier.slice(-2) : R0.tier;
      const pool = Object.keys(ITEMS).filter((id) => ITEMS[id].k === 'gear' && tiers.includes(tierOf(id))), mine = pool.filter((id) => fitsOf(id).includes(P.classId)), gearId = this.rng.pick(mine.length && this.rng.chance(0.7) ? mine : pool);
      if (gearId) {
        const slot = ITEMS[gearId].slot, fxTier = final ? 4 : 3, ok = Object.entries(GEAR_FX).filter(([, f]) => f.tier === fxTier && f.slots.includes(slot)).map(([id]) => id);
        const g = R.addGear(P, { id: gearId, q: this.rng.range(final ? 0.88 : 0.8, 0.99), affix: this.rng.pick(AFFIXES).id, fx: ok.length ? [{ id: this.rng.pick(ok), k: final ? 1.25 : 1.12 }] : [], cname: `${R0.short.replace(/^the /i, '')}-forged ${ITEMS[gearId].n}` }); got.push(R.gearName(g));
      }
    }
    if (this.rng.chance(final ? 0.9 : 0.35)) { R.addItem(P, 'starmetal', 1); got.push('Starmetal Shard'); }
    const tm = eligibleTomes(P, TOMES).filter((id) => !R.count(P, `tome_${id}`)); if (tm.length && this.rng.chance(final ? 0.8 : 0.3)) { const id = this.rng.pick(tm); R.addItem(P, `tome_${id}`, 1); got.push(ITEMS[`tome_${id}`].n); }
    P.stats.raidBosses = (P.stats.raidBosses ?? 0) + 1;
    S.conn.send({ t: 'secret.done', name: `${R0.wings[idx].name}: cleared`, msg: `Spoils: ${got.join(' · ')}` }); this.afterChange(S);
  },
  raidFinal(S, run) { const R0 = run.raid, P = S.P; (P.stats.rc ??= {})[R0.id] = (P.stats.rc[R0.id] ?? 0) + 1; this.toast(S, `* ${R0.name} cleared!`, 'secret'); this.afterChange(S); },
};
