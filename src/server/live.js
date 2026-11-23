// ─────────────────────────────────────────────────────────────────────────────
// LIVE CONTENT — things that make the shared world feel alive: world-boss events, the party raid,
// the daily bounty board, guilds and leaderboards. Mixed into GameServer.
// ─────────────────────────────────────────────────────────────────────────────
import { Rng } from '../rng.js';
import { ENEMIES, ZONES, ITEMS, AFFIXES, TOMES, SKILLS, NODE_TYPES, CLASSES, BASE_CLASSES, PATHS } from '../data.js';
import { rtStats } from '../units.js';
import { valueOf } from '../economy.js';
import { getMap, dist } from '../world.js';
import { eligibleTomes } from '../loadout.js';
import { GEAR_FX } from '../custom.js';
import * as R from '../rules.js';

const DAY_MS = 86400000;
const WB_EVERY = 25 * 60000, WB_LIFE = 12 * 60000, WB_ZONES = ['greenmeadow', 'sunscorch', 'frostpeak', 'emberwaste', 'mistfen'];
const RAID_MAP = 'raid_bastion', RAID_MIN_LVL = 20, RAID_LIFE = 18 * 60000;
export const GUILD_COST = 300, GUILD_PERK = 0.02, GRAID_LOCK = 20 * 3600000, GUILD_MAX = 10;
const SECRET_ZONES = new Set(['root_cellar', 'world_tree', 'sunken_vault', 'void_rift', 'raid_bastion']);
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export const liveMethods = {
  initLive(state) {
    this.guilds = state?.guilds ?? {};
    this.worldBoss = null; this.raid = null; this.graid = null; this.nextWorldBoss = this.now() + 4 * 60000;
  },
  announceAll(title, text) { for (const o of this.sessions.values()) o.conn.send({ t: 'announce', title, text }); this.systemChat(` ${title}: ${text}`); },

  // ═══ world boss ══════════════════════════════════════════════════════════
  spawnWorldBoss(zid = null) {
    zid ??= this.rng.pick(WB_ZONES); const map = getMap(zid), zone = ZONES[zid], sp = this.rng.pick(map.mobSpawns);
    const mob = this.newMob(zid, zone, sp.x + 0.5, sp.y + 0.5, true, false, { forceKey: 'cinder_colossus', forceLevel: zone.lvl + 3, worldBoss: true, temp: true });
    const k = Math.min(4, 1 + 0.4 * Math.max(0, this.sessions.size - 1)); mob.maxHp = mob.hp = Math.round(mob.maxHp * k);
    this.mobs.push(mob); this.worldBoss = { id: mob.id, map: zid, until: this.now() + WB_LIFE };
    this.announceAll('The Cinder Colossus walks!', `A colossus of living slag has risen in ${zone.name}. Fell it together within ${Math.round(WB_LIFE / 60000)} minutes — everyone who fights it is rewarded.`);
    return mob;
  },
  tickLive(nw) {
    if (!this.worldBoss && nw >= this.nextWorldBoss && this.sessions.size > 0) this.spawnWorldBoss();
    if (this.worldBoss) {
      const mob = this.mobs.find((m) => m.id === this.worldBoss.id);
      if (!mob || mob.deadUntil) { this.worldBoss = null; this.nextWorldBoss = nw + WB_EVERY; }
      else if (nw >= this.worldBoss.until) { this.mobs = this.mobs.filter((m) => m !== mob); this.worldBoss = null; this.nextWorldBoss = nw + WB_EVERY; this.announceAll('The Colossus retreats', 'It sinks back into the ground. Another will rise.'); }
    }
    this.tickRaid(nw); this.tickGraid(nw); this.tickWars(nw); this.tickRequests(nw);
  },
  worldBossLoot(S) {
    const P = S.P; P.gilt += 400; R.addItem(P, 'sunsteel_ore', 4); const got = ['400g', '4× Sunsteel Ore'];
    if (this.rng.chance(0.3)) { R.addItem(P, 'starmetal', 1); got.push('Starmetal Shard'); }
    const t = eligibleTomes(P, TOMES).filter((id) => !R.count(P, `tome_${id}`)); if (t.length && this.rng.chance(0.6)) { const id = this.rng.pick(t); R.addItem(P, `tome_${id}`, 1); got.push(ITEMS[`tome_${id}`].n); }
    P.stats.worldBosses = (P.stats.worldBosses ?? 0) + 1; this.toast(S, `* World boss rewards: ${got.join(', ')}`, 'secret');
  },

  // ═══ raid: The Ember Tyrant ═══════════════════════════════════════════════
  raidMembers() { return this.raid ? [...this.raid.members].map((id) => this.sessions.get(id)).filter((s) => s && s.map === RAID_MAP) : []; },
  raidStatus(S) {
    const r = this.raid, pt = this.parties.get(S.partyId), solo = this.sessions.size === 1;
    return { busy: !!r && !r.over, by: r?.byName ?? null, minLevel: RAID_MIN_LVL, partySize: pt ? pt.members.length : 1, solo, need: solo ? 1 : 2, phase: r?.phase ?? 0, boss: this.mobs.find((m) => m.map === RAID_MAP && m.boss)?.hp ?? null };
  },
  on_raid_enter(S) {
    const wd = getMap(S.map).points.find((p) => p.role === 'raid'); if (S.dead || !wd || dist(S.x, S.y, wd.x, wd.y) > 5) return this.toast(S, 'Find the Cinderhold Gatekeeper.', 'bad');
    if (S.P.level < RAID_MIN_LVL) return this.toast(S, `The raid is for level ${RAID_MIN_LVL}+.`, 'bad');
    if (this.raid && !this.raid.over) return this.toast(S, `The Bastion is occupied by ${this.raid.byName}'s raid. Wait for them to finish.`, 'bad');
    const pt = this.parties.get(S.partyId), solo = this.sessions.size === 1;
    const crew = (pt ? pt.members.map((id) => this.sessions.get(id)).filter((o) => o && o.map === S.map && !o.dead && dist(o.x, o.y, S.x, S.y) < 12 && o.P.level >= RAID_MIN_LVL) : [S]);
    if (!solo && crew.length < 2) return this.toast(S, 'A raid needs at least 2 players in a party, standing close together.', 'bad');
    const boss = this.mobs.find((m) => m.map === RAID_MAP && m.boss); if (!boss) return;
    this.rollMob(boss, ZONES[RAID_MAP]); const k = Math.min(3.5, 1 + 0.5 * (crew.length - 1)); boss.maxHp = boss.hp = Math.round(boss.maxHp * k); boss.fresh = true;
    this.mobs = this.mobs.filter((m) => !(m.map === RAID_MAP && m.temp));
    this.raid = { byName: S.P.name, members: new Set(crew.map((o) => o.id)), start: this.now(), phase: 1, lastAdd: 0, over: false, adds: 0 };
    const sp = getMap(RAID_MAP).spawn; for (const o of crew) { this.travel(o, RAID_MAP, sp.x + (Math.random() - 0.5) * 2, sp.y); this.toast(o, '* The gates of Cinderhold Bastion close behind you.', 'secret'); }
  },
  tickRaid(nw) {
    const r = this.raid; if (!r) return;
    const boss = this.mobs.find((m) => m.map === RAID_MAP && m.boss), crew = this.raidMembers();
    if (r.over) { if (nw > r.endAt) { this.raid = null; for (const o of crew) { this.travel(o, 'emberwaste', ...this.raidExit()); } } return; }
    const alive = crew.filter((o) => !o.dead);
    if (!boss || boss.deadUntil) { r.over = true; r.endAt = nw + 90000; for (const o of crew) { this.raidLoot(o); } this.announceAll('The Ember Tyrant has fallen!', `${r.byName}'s raid cleared Cinderhold Bastion.`); return; }
    if (!crew.length || (!alive.length && nw - r.start > 5000) || nw - r.start > RAID_LIFE) { this.raid = null; boss.hp = boss.maxHp; boss.target = null; for (const m of this.mobs) if (m.map === RAID_MAP && m.temp) m.hp = 0; this.mobs = this.mobs.filter((m) => !(m.map === RAID_MAP && m.temp)); return; }
    const ratio = boss.hp / boss.maxHp, ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (ph !== r.phase) {
      r.phase = ph; for (const o of crew) o.conn.send({ t: 'announce', title: ph === 2 ? 'PHASE 2 — THE BROOD' : 'PHASE 3 — THE FURNACE', text: ph === 2 ? 'The Tyrant calls its spawn. Kill the adds or be overwhelmed.' : 'The Tyrant is burning itself down. It is faster and much angrier.' });
      if (ph === 3 && !boss.enraged) { boss.enraged = true; boss.speed *= 1.2; this.emit(RAID_MAP, { t: 'aura', x: boss.x, y: boss.y, r: 4, c: 'rage' }); }
      r.lastAdd = 0;
    }
    const every = ph === 3 ? 9000 : 14000;
    if (ph >= 2 && nw - r.lastAdd > every) {
      r.lastAdd = nw; const liveAdds = this.mobs.filter((m) => m.map === RAID_MAP && m.temp && !m.deadUntil).length;
      for (let i = 0; i < 4 && liveAdds + i < 10; i++) { const a = (i / 4) * Math.PI * 2 + Math.random(), add = this.newMob(RAID_MAP, ZONES[RAID_MAP], boss.x + Math.cos(a) * 3, boss.y + Math.sin(a) * 3, false, false, { forceKey: 'tyrant_spawn', forceLevel: 22, temp: true }); add.target = alive[i % alive.length]?.id ?? null; this.mobs.push(add); }
    }
  },
  raidExit() { const g = getMap('emberwaste').points.find((p) => p.role === 'raid'); return [g.x, g.y + 1.5]; },
  raidLoot(S) {
    const P = S.P, got = []; P.stats.raids = (P.stats.raids ?? 0) + 1;
    const gilt = this.rng.int(800, 1200); P.gilt += gilt; got.push(`${gilt}g`); const xp = R.gainXp(P, 2500); if (xp.length) this.toast(S, `* Level ${xp.at(-1)}!`, 'good');
    const gearId = this.rng.pick(['sun_blade', 'sun_maul', 'sun_rod', 'sun_aegis', 'hollow_blade', 'hollow_aegis']), t3 = Object.entries(GEAR_FX).filter(([, f]) => f.tier === 3 && f.slots.includes(ITEMS[gearId].slot)).map(([id]) => id);
    const g = R.addGear(P, { id: gearId, q: this.rng.range(0.78, 0.96), affix: this.rng.pick(AFFIXES).id, fx: t3.length ? [{ id: this.rng.pick(t3), k: 1.15 }] : [], cname: `Tyrant's ${ITEMS[gearId].n}` }); got.push(R.gearName(g));
    if (this.rng.chance(0.6)) { R.addItem(P, 'starmetal', 1); got.push('Starmetal Shard'); }
    const tm = eligibleTomes(P, TOMES).filter((id) => !R.count(P, `tome_${id}`)); if (tm.length) { const id = this.rng.pick(tm); R.addItem(P, `tome_${id}`, 1); got.push(ITEMS[`tome_${id}`].n); }
    if (!P.titles.includes('Tyrant-Slayer')) P.titles.push('Tyrant-Slayer');
    S.conn.send({ t: 'secret.done', name: 'The Ember Tyrant falls', msg: `Spoils: ${got.join(' · ')}` }); this.afterChange(S);
  },

  // ═══ bounty board ════════════════════════════════════════════════════════
  bountyDay() { return Math.floor(this.now() / DAY_MS); },
  // Bounties: the board offers a fresh set every day, but a bounty you ACCEPT is yours until you finish or abandon it — it never rotates away.
  ensureBounties(P) {
    const day = this.bountyDay(), cur = P.bounties;
    if (cur?.day === day && cur.list) return cur;
    const kept = (cur?.list ?? []).filter((e) => e.accepted && !e.claimed);                       // accepted ones survive the reset
    let nextId = Math.max(0, ...(cur?.list ?? []).map((e) => e.id), cur?.nextId ?? 0) + 1;
    const rng = new Rng(hashStr(P.id) ^ (day * 2654435761)), L = P.level, offers = [];
    const zones = Object.values(ZONES).filter((z) => z.enemies.length && !SECRET_ZONES.has(z.id) && z.lvl <= L + 2 && z.lvl >= Math.max(1, L - 9)), zs = zones.length ? zones : [ZONES.greenmeadow];
    const z = rng.pick(zs), e = rng.pick(z.enemies), n1 = rng.int(6, 12);
    offers.push({ type: 'kill', key: e, need: n1, text: `Slay ${n1} ${ENEMIES[e].name}`, gilt: Math.round((12 + L * 3) * n1), xp: Math.round((25 + L * 12) * n1 / 3) });
    const z2 = rng.pick(zs), pool2 = z2.enemies.filter((x) => x !== e), e2 = rng.pick(pool2.length ? pool2 : z2.enemies), n2 = rng.int(4, 9);
    offers.push({ type: 'kill', key: e2, need: n2, text: `Slay ${n2} ${ENEMIES[e2].name}`, gilt: Math.round((16 + L * 3.5) * n2), xp: Math.round((30 + L * 14) * n2 / 3) });
    const nodeTypes = Object.entries(NODE_TYPES).filter(([, d]) => (ITEMS[d.item]?.tier !== 'hollow')); const [, nd] = rng.pick(nodeTypes), n3 = rng.int(8, 16);
    offers.push({ type: 'gather', key: nd.item, need: n3, text: `Gather ${n3} ${ITEMS[nd.item].n}`, gilt: Math.round((8 + L * 2) * n3), xp: Math.round((12 + L * 5) * n3 / 2) });
    if (R.isCrafter(P)) { const n4 = rng.int(3, 6); offers.push({ type: 'craft', key: 'any', need: n4, text: `Craft ${n4} items at your station`, gilt: Math.round((40 + L * 8) * n4), xp: Math.round((40 + L * 10) * n4 / 2) }); }
    const have = new Set(kept.map((x) => `${x.type}:${x.key}`));
    const list = [...kept, ...offers.filter((o) => !have.has(`${o.type}:${o.key}`)).map((o) => ({ id: nextId++, got: 0, accepted: false, ...o }))];
    P.bounties = { day, list, nextId }; return P.bounties;
  },
  bountyEvent(S, type, key, n = 1) {
    const b = this.ensureBounties(S.P); let changed = false;
    for (const e of b.list) if (e.accepted && !e.claimed && e.got < e.need && e.type === type && (e.key === key || e.key === 'any')) { e.got = Math.min(e.need, e.got + n); changed = true; if (e.got >= e.need) this.toast(S, `* Bounty complete: ${e.text}. Claim it at the Bounty Board.`, 'secret'); }
    if (changed) this.touch(S);
  },
  on_bounty_open(S) { this.expirePromises(S.P); S.conn.send({ t: 'ui', panel: 'bounty', list: this.ensureBounties(S.P).list, promises: (S.P.promises ?? []).map((q) => ({ ...q, have: this.promiseStock(S.P, q).length > 0 })), resetIn: DAY_MS - (this.now() % DAY_MS) }); },
  on_bounty_accept(S, m) {
    const b = this.ensureBounties(S.P), e = b.list.find((x) => x.id === +m.id); if (!e || e.accepted || e.claimed) return;
    if (b.list.filter((x) => x.accepted && !x.claimed).length >= 6) return this.toast(S, 'You can carry at most 6 bounties. Finish or abandon one first.', 'bad');
    e.accepted = true; e.got = 0; this.toast(S, `Bounty accepted: ${e.text}. It will not expire.`, 'good'); this.touch(S); this.on_bounty_open(S);
  },
  on_bounty_abandon(S, m) { const b = this.ensureBounties(S.P), e = b.list.find((x) => x.id === +m.id); if (!e || !e.accepted || e.claimed) return; b.list = b.list.filter((x) => x !== e); this.touch(S); this.on_bounty_open(S); },
  // ── customer promises: tell a town customer "I'll bring it" and the order is yours for 3 days, even after they walk off ──
  expirePromises(P) { const now = this.now(); P.promises = (P.promises ?? []).filter((q) => q.until > now); },
  promiseStock(P, q) { const it = ITEMS[q.itemId]; if (!it) return []; return it.k === 'gear' ? P.gear.filter((g) => g.id === q.itemId && g.q >= q.minQ && !R.isEquipped(P, g.uid) && !R.gearLocked(P, g)).sort((a, b) => a.q - b.q) : (R.freeStack(P, q.itemId) > 0 ? [{}] : []); },
  on_cust_promise(S, m) {
    const c = this.customers.find((x) => x.id === m.id); if (!c || S.map !== 'town' || dist(S.x, S.y, c.x, c.y) > 3) return this.toast(S, 'They have already left.', 'bad');
    this.expirePromises(S.P); S.P.promises ??= []; if (S.P.promises.some((q) => q.cid === c.id)) return this.toast(S, 'You already promised that one.', 'bad');
    if (S.P.promises.length >= 4) return this.toast(S, 'You are already carrying four promised orders.', 'bad');
    const pay = Math.max(10, Math.round(valueOf(this.markets.main, c.itemId, Math.max(0.5, c.minQ ?? 0)) * 1.15));
    S.P.promises.push({ id: (S.P.promiseSeq = (S.P.promiseSeq ?? 0) + 1), cid: c.id, who: c.name, itemId: c.itemId, minQ: c.minQ ?? 0, pay, until: this.now() + 3 * DAY_MS }); this.touch(S);
    this.toast(S, `Promised: ${ITEMS[c.itemId].n} for ${c.name} — ${pay}g on delivery. It is kept at the Bounty Board for 3 days.`, 'good');
  },
  on_promise_deliver(S, m) {
    this.expirePromises(S.P); const q = (S.P.promises ?? []).find((x) => x.id === +m.id); if (!q) return; const stock = this.promiseStock(S.P, q);
    if (!stock.length) return this.toast(S, `You do not have ${ITEMS[q.itemId].n}${q.minQ ? ` of quality ${Math.round(q.minQ * 100)}%+` : ''} (crafters cannot hand over their own creations this way).`, 'bad');
    if (ITEMS[q.itemId].k === 'gear') S.P.gear.splice(S.P.gear.indexOf(stock[0]), 1); else R.removeItem(S.P, q.itemId, 1);
    S.P.gilt += q.pay; S.P.stats.profit = (S.P.stats.profit ?? 0) + q.pay; S.P.promises = S.P.promises.filter((x) => x !== q); this.toast(S, `Delivered to ${q.who}: +${q.pay}g.`, 'good'); this.afterChange(S); this.on_bounty_open(S);
  },
  on_promise_cancel(S, m) { S.P.promises = (S.P.promises ?? []).filter((x) => x.id !== +m.id); this.touch(S); this.on_bounty_open(S); },
  on_bounty_claim(S, m) {
    const e = this.ensureBounties(S.P).list.find((x) => x.id === +m.id); if (!e || e.claimed || e.got < e.need) return;
    e.claimed = true; S.P.gilt += e.gilt; const ups = R.gainXp(S.P, e.xp); this.toast(S, `* Bounty paid: +${e.gilt}g, +${e.xp} XP${ups.length ? ` — LEVEL ${ups.at(-1)}!` : ''}`, 'good'); S.P.stats.bounties = (S.P.stats.bounties ?? 0) + 1; this.guildXp(S, 20);
    this.afterChange(S); this.on_bounty_open(S);
  },

  // ═══ guilds ══════════════════════════════════════════════════════════════
  guildOf(P) { return P.guild ? this.guilds[P.guild.toLowerCase()] ?? null : null; },
  guildView(S) {
    const g = this.guildOf(S.P); if (!g) return null;
    return { name: g.name, motd: g.motd, leader: this.players.get(g.leader)?.name, founded: g.created, level: g.level ?? 1, xp: g.xp ?? 0, xpNeed: this.guildNeed(g), bank: g.bank ?? 0, perk: GUILD_PERK * (g.level ?? 1), raidIn: (g.raidAt ?? 0) > 0 ? Math.max(0, g.raidAt + GRAID_LOCK - this.now()) : 0, wins: g.warWins ?? 0, losses: g.warLosses ?? 0, ...this.warView(g, S), members: g.members.map((id) => { const p = this.players.get(id); return p ? { n: p.name, l: p.level, c: p.classId, on: this.sessions.has(id) } : null; }).filter(Boolean) };
  },
  pushGuild(g) { for (const id of g.members) { const s = this.sessions.get(id); if (s) s.conn.send({ t: 'guild', guild: this.guildView(s) }); } },
  on_guild_info(S) { S.conn.send({ t: 'guild', guild: this.guildView(S) }); },
  on_guild_create(S, m) {
    const name = String(m.name ?? '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 16);
    if (S.P.guild) return this.toast(S, 'Leave your guild first.', 'bad'); if (name.length < 3) return this.toast(S, 'Guild names need 3+ letters.', 'bad');
    if (this.guilds[name.toLowerCase()]) return this.toast(S, 'That name is taken.', 'bad'); if (S.P.gilt < GUILD_COST) return this.toast(S, `A charter costs ${GUILD_COST}g.`, 'bad');
    S.P.gilt -= GUILD_COST; this.guilds[name.toLowerCase()] = { name, leader: S.id, members: [S.id], created: Date.now(), motd: 'Welcome.', level: 1, xp: 0, bank: 0, raidAt: 0 }; S.P.guild = name;
    this.toast(S, `* The ${name} guild is founded.`, 'good'); this.systemChat(` ${S.P.name} founded the guild ${name}.`); this.touch(S); this.on_guild_info(S);
  },
  on_guild_invite(S, m) {
    const g = this.guildOf(S.P); if (!g || g.leader !== S.id) return this.toast(S, 'Only the guild leader can invite.', 'bad');
    const o = this.sessionByName(m.to); if (!o || o === S || dist(o.x, o.y, S.x, S.y) > 12 || o.map !== S.map) return this.toast(S, 'They must be nearby.', 'bad'); if (o.P.guild) return this.toast(S, 'They already belong to a guild.', 'bad');
    if (g.members.length >= 30) return this.toast(S, 'The guild is full.', 'bad');
    this.invites.set(`guild:${o.id}`, { from: S.id, at: this.now(), guild: g.name }); o.conn.send({ t: 'invite', kind: 'guild', from: S.P.name, guild: g.name }); this.toast(S, `Invitation sent to ${o.P.name}.`);
  },
  on_guild_accept(S) {
    const inv = this.invites.get(`guild:${S.id}`); if (!inv) return; this.invites.delete(`guild:${S.id}`);
    const g = this.guilds[inv.guild.toLowerCase()]; if (!g || S.P.guild) return; g.members.push(S.id); S.P.guild = g.name;
    this.systemChat(` ${S.P.name} joined ${g.name}.`); this.touch(S); this.pushGuild(g);
  },
  on_guild_leave(S) {
    const g = this.guildOf(S.P); if (!g) return; this.removeFromGuild(g, S.id); this.toast(S, `You left ${g.name}.`); this.touch(S); S.conn.send({ t: 'guild', guild: null });
  },
  on_guild_kick(S, m) {
    const g = this.guildOf(S.P); if (!g || g.leader !== S.id) return this.toast(S, 'Only the leader can remove members.', 'bad');
    const id = this.byName.get(String(m.name ?? '').toLowerCase()); if (!id || id === S.id || !g.members.includes(id)) return; this.removeFromGuild(g, id); this.sessions.get(id)?.conn.send({ t: 'toast', msg: `You were removed from ${g.name}.`, kind: 'bad' });
  },
  on_guild_motd(S, m) { const g = this.guildOf(S.P); if (!g || g.leader !== S.id) return; g.motd = String(m.text ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 120); this.pushGuild(g); },
  removeFromGuild(g, id) {
    g.members = g.members.filter((x) => x !== id); const P = this.players.get(id); if (P) P.guild = null;
    if (!g.members.length) { this.guildGone(g); delete this.guilds[g.name.toLowerCase()]; }
    else { if (g.leader === id) { g.leader = g.members[0]; this.systemChat(` ${this.players.get(g.leader).name} now leads ${g.name}.`); } this.pushGuild(g); }
    this.sessions.get(id)?.conn.send({ t: 'guild', guild: null });
  },

  guildNeed(g) { return Math.round(120 * Math.pow(g.level ?? 1, 1.7)); },
  guildXp(S, n) {
    const g = this.guildOf(S.P); if (!g || (g.level ?? 1) >= GUILD_MAX) return; g.xp = (g.xp ?? 0) + n;
    while ((g.level ?? 1) < GUILD_MAX && g.xp >= this.guildNeed(g)) { g.xp -= this.guildNeed(g); g.level = (g.level ?? 1) + 1; for (const id of g.members) this.sessions.get(id)?.conn.send({ t: 'announce', title: `${g.name} reaches level ${g.level}!`, text: `Every member now earns +${Math.round(GUILD_PERK * g.level * 100)}% XP.` }); this.pushGuild(g); }
  },
  guildXpBonus(P) { const g = this.guildOf(P); return g ? GUILD_PERK * (g.level ?? 1) : 0; },
  on_guild_deposit(S, m) { const g = this.guildOf(S.P), n = Math.floor(+m.gilt); if (!g || !(n > 0) || S.P.gilt < n) return this.toast(S, 'You cannot deposit that.', 'bad'); S.P.gilt -= n; g.bank = (g.bank ?? 0) + n; this.guildXp(S, Math.ceil(n / 50)); this.toast(S, `Deposited ${n}g into the guild bank.`, 'good'); this.touch(S); this.pushGuild(g); },
  on_guild_withdraw(S, m) { const g = this.guildOf(S.P), n = Math.floor(+m.gilt); if (!g || g.leader !== S.id) return this.toast(S, 'Only the leader can withdraw.', 'bad'); if (!(n > 0) || n > (g.bank ?? 0)) return this.toast(S, 'The bank does not hold that much.', 'bad'); g.bank -= n; S.P.gilt += n; this.touch(S); this.pushGuild(g); },

  // ═══ guild raid: the Obsidian Titan ═══════════════════════════════════════
  graidStatus(S) { const g = this.guildOf(S.P), r = this.graid; return { guild: g?.name ?? null, locked: g && (g.raidAt ?? 0) > 0 ? Math.max(0, g.raidAt + GRAID_LOCK - this.now()) : 0, busy: !!r && !r.over, by: r?.guildName ?? null, minLevel: RAID_MIN_LVL, need: this.sessions.size === 1 ? 1 : 3, members: g ? g.members.filter((id) => this.sessions.has(id)).length : 0 }; },
  on_graid_enter(S) {
    const gm = getMap(S.map).points.find((p) => p.role === 'graid'); if (S.dead || !gm || dist(S.x, S.y, gm.x, gm.y) > 5) return this.toast(S, 'Find Guildmaster Orren.', 'bad');
    const g = this.guildOf(S.P); if (!g) return this.toast(S, 'Only guilds may attempt the Crucible. Found or join one first.', 'bad');
    if ((g.raidAt ?? 0) > 0 && this.now() < g.raidAt + GRAID_LOCK) return this.toast(S, 'Your guild has already cleared the Crucible recently.', 'bad');
    if (this.graid && !this.graid.over) return this.toast(S, `The Crucible is occupied by ${this.graid.guildName}.`, 'bad');
    const need = this.sessions.size === 1 ? 1 : 3, crew = g.members.map((id) => this.sessions.get(id)).filter((o) => o && o.map === S.map && !o.dead && dist(o.x, o.y, S.x, S.y) < 12 && o.P.level >= RAID_MIN_LVL);
    if (crew.length < need) return this.toast(S, `Guild raids need ${need} guild members (level ${RAID_MIN_LVL}+) standing together. You have ${crew.length}.`, 'bad');
    const boss = this.mobs.find((m) => m.map === 'guild_raid' && m.boss); if (!boss) return;
    this.rollMob(boss, ZONES.guild_raid); boss.maxHp = boss.hp = Math.round(boss.maxHp * Math.min(3.5, 1 + 0.35 * (crew.length - 1))); this.mobs = this.mobs.filter((m) => !(m.map === 'guild_raid' && m.temp));
    this.graid = { guild: g.name.toLowerCase(), guildName: g.name, members: new Set(crew.map((o) => o.id)), start: this.now(), phase: 1, over: false, lastAdd: 0, lastMeteor: 0, pending: [] };
    const sp = getMap('guild_raid').spawn; for (const o of crew) { this.travel(o, 'guild_raid', sp.x + (Math.random() - 0.5) * 3, sp.y); this.toast(o, '* The Crucible seals. Only the Titan or you will leave.', 'secret'); }
  },
  tickGraid(nw) {
    const r = this.graid; if (!r) return;
    const boss = this.mobs.find((m) => m.map === 'guild_raid' && m.boss), crew = [...r.members].map((id) => this.sessions.get(id)).filter((o) => o && o.map === 'guild_raid');
    if (r.over) { if (nw > r.endAt) { this.graid = null; for (const o of crew) this.travel(o, 'town', 27.5, 24.5); } return; }
    const alive = crew.filter((o) => !o.dead), g = this.guilds[r.guild];
    if (!boss || boss.deadUntil) { r.over = true; r.endAt = nw + 90000; if (g) { g.raidAt = nw; g.bank = (g.bank ?? 0) + 3000; } for (const o of crew) this.graidLoot(o, g); this.announceAll('The Obsidian Titan has fallen!', `${r.guildName} cleared the Titan's Crucible.`); return; }
    if (!crew.length || (!alive.length && nw - r.start > 5000) || nw - r.start > RAID_LIFE) { this.graid = null; boss.hp = boss.maxHp; boss.target = null; this.mobs = this.mobs.filter((m) => !(m.map === 'guild_raid' && m.temp)); return; }
    const ratio = boss.hp / boss.maxHp, ph = ratio > 0.75 ? 1 : ratio > 0.5 ? 2 : ratio > 0.25 ? 3 : 4;
    if (ph !== r.phase) { r.phase = ph; const T = { 2: ['PHASE 2 — THE FORGE-SPAWN', 'Molten servants pour from the walls.'], 3: ['PHASE 3 — FALLING STARS', 'Meteors rain on those who stand still. Watch the red rings.'], 4: ['PHASE 4 — THE UNMAKING', 'Everything at once. End it.'] }[ph]; for (const o of crew) o.conn.send({ t: 'announce', title: T[0], text: T[1] }); if (ph === 4 && !boss.enraged) { boss.enraged = true; boss.speed *= 1.25; } }
    if (ph >= 2 && nw - r.lastAdd > (ph === 4 ? 9000 : 15000)) { r.lastAdd = nw; const live = this.mobs.filter((m) => m.map === 'guild_raid' && m.temp && !m.deadUntil).length; for (let i = 0; i < 3 && live + i < 9; i++) { const a = Math.random() * 6.28, add = this.newMob('guild_raid', ZONES.guild_raid, boss.x + Math.cos(a) * 3, boss.y + Math.sin(a) * 3, false, false, { forceKey: 'tyrant_spawn', forceLevel: 23, temp: true }); add.target = alive[i % alive.length]?.id ?? null; this.mobs.push(add); } }
    // meteors: a red warning ring appears where a raider stands; 1.5 s later it detonates
    if (ph >= 3 && nw - r.lastMeteor > (ph === 4 ? 3200 : 5500) && alive.length) { r.lastMeteor = nw; const tgt = alive[Math.floor(Math.random() * alive.length)]; r.pending.push({ at: nw + 1500, x: tgt.x, y: tgt.y }); this.emit('guild_raid', { t: 'aura', x: tgt.x, y: tgt.y, r: 2.2, c: 'rage' }); }
    r.pending = r.pending.filter((mt) => { if (nw < mt.at) return true; this.emit('guild_raid', { t: 'boom', x: mt.x, y: mt.y, r: 2.2, ty: 'blunt', who: 'm0', g: 'flame' }); for (const o of alive) if (!o.dead && dist(o.x, o.y, mt.x, mt.y) < 2.4) this.hurtPlayer(o, Math.round(o.rt.maxHp * 0.3), { noPhase: false }); return false; });
  },
  graidLoot(S, g) {
    const P = S.P, got = []; P.stats.graids = (P.stats.graids ?? 0) + 1;
    P.gilt += 1500; got.push('1500g'); R.gainXp(P, 4000); this.guildXp(S, 600);
    const t4 = Object.entries(GEAR_FX).filter(([, f]) => f.tier === 4).map(([id]) => id), gearId = this.rng.pick(['sun_blade', 'sun_maul', 'sun_rod', 'sun_aegis', 'hollow_blade', 'hollow_aegis']), slot = ITEMS[gearId].slot, ok = t4.filter((id) => GEAR_FX[id].slots.includes(slot));
    const gg = R.addGear(P, { id: gearId, q: this.rng.range(0.85, 0.99), affix: this.rng.pick(AFFIXES).id, fx: ok.length ? [{ id: this.rng.pick(ok), k: 1.2 }] : [], cname: `Titan-forged ${ITEMS[gearId].n}`, by: g?.name ? `the ${g.name} guild` : undefined }); got.push(R.gearName(gg));
    if (this.rng.chance(0.7)) { R.addItem(P, 'starmetal', 1); got.push('Starmetal Shard'); }
    const tm = eligibleTomes(P, TOMES).filter((id) => !R.count(P, `tome_${id}`)); if (tm.length) { const id = this.rng.pick(tm); R.addItem(P, `tome_${id}`, 1); got.push(ITEMS[`tome_${id}`].n); }
    if (!P.titles.includes('Titan-Breaker')) P.titles.push('Titan-Breaker');
    S.conn.send({ t: 'secret.done', name: 'The Obsidian Titan falls', msg: `Spoils: ${got.join(' · ')}. The guild bank received 3000g.` }); this.afterChange(S);
  },

  // ═══ leaderboards ════════════════════════════════════════════════════════
  // Combat power folds the stats that decide a fight into one number (gear and Ascension included).
  combatPower(P) { const r = rtStats(P); return Math.round(r.atk * 6 + r.def * 4 + r.maxHp / 4 + r.maxMp / 10 + (r.dmgMult - 1) * 100); },
  // Every coin a player owns: purse + gilt tied up in their own open orders.
  totalMoney(P) { let n = P.gilt ?? 0; for (const o of this.orders) if (o.by === P.id) n += o.escrow ?? 0; return Math.round(n); },
  // The single most valuable thing in a player's possession (market value; crafted effects add to gear).
  priciestItem(P) {
    const m = this.markets.main; let best = null;
    const consider = (v, name, id) => { if (!best || v > best.v) best = { v: Math.round(v), name, id }; };
    for (const g of P.gear ?? []) { const it = ITEMS[g.id]; if (it) consider(valueOf(m, g.id, g.q) * (1 + 0.12 * (g.fx?.length ?? 0) + 0.08 * (g.ench?.length ?? 0)), R.gearName(g), g.id); }
    for (const [id, n] of Object.entries(P.items ?? {})) if (n > 0 && ITEMS[id] && ITEMS[id].k !== 'gear') consider(valueOf(m, id), ITEMS[id].n, id);
    return best;
  },
  leaderboards() {
    const all = [...this.players.values()], boards = [];
    const rank = (rows, n = 10) => rows.filter((x) => x.v > 0).sort((a, b) => b.v - a.v || (b.t ?? 0) - (a.t ?? 0)).slice(0, n);
    const row = (p, v, x, t = 0) => ({ n: p.name, c: p.classId, v, x, t, on: this.byName.has(p.name.toLowerCase()) && this.sessions.has(p.id) });
    boards.push({ id: 'power', group: 'Overall', title: 'Combat power', unit: '', rows: rank(all.map((p) => row(p, this.combatPower(p), `Lv ${p.level} ${CLASSES[p.classId]?.name ?? ''}`))) });
    boards.push({ id: 'money', group: 'Overall', title: 'Total money', unit: 'g', rows: rank(all.map((p) => row(p, this.totalMoney(p)))) });
    boards.push({ id: 'item', group: 'Overall', title: 'Most valuable item', unit: 'g', rows: rank(all.map((p) => { const b = this.priciestItem(p); return b ? row(p, b.v, b.name) : row(p, 0); })) });
    // one board per main class — hidden and mythic classes are deliberately not ranked
    for (const c of BASE_CLASSES) boards.push({ id: `cls_${c}`, group: 'Classes', title: CLASSES[c].name, unit: 'Lv', cls: c, rows: rank(all.filter((p) => p.classId === c).map((p) => row(p, p.level, PATHS[p.asc?.path]?.name ?? 'No path yet', p.xp))) });
    const stat = (id, title, f) => boards.push({ id, group: 'Deeds', title, unit: '', rows: rank(all.map((p) => row(p, f(p)))) });
    stat('kills', 'Enemies felled', (p) => p.stats.kills); stat('pvp', 'PvP victories', (p) => p.stats.pvpKills ?? 0); stat('profit', 'Market takings', (p) => p.stats.profit); stat('crafted', 'Items crafted', (p) => p.stats.crafted); stat('raids', 'Raid clears', (p) => p.stats.raids ?? 0); stat('bounties', 'Bounties done', (p) => p.stats.bounties ?? 0);
    boards.push({ id: 'wars', group: 'Deeds', title: 'Guild war victories', unit: '', rows: rank(Object.values(this.guilds).map((g) => ({ n: g.name, c: null, v: g.warWins ?? 0, x: `${g.members.length} members`, t: g.level ?? 1 }))) });
    return boards;
  },
  on_leaderboard(S) { S.conn.send({ t: 'leaderboard', boards: this.leaderboards() }); },
};
