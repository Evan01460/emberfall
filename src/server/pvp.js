// ─────────────────────────────────────────────────────────────────────────────
// PLAYER vs PLAYER — the optional PvP flag, kill credit, and GUILD WARS.
//   · PvP flag:  two flagged players (outside safe zones, close in level, not partied or guild-mates) can hurt each other.
//   · Guild war: two guilds fight for 30 minutes (or first to 25 kills). Enemy members can be hurt anywhere outside safe
//                zones whether flagged or not. The winner takes 10% of the loser's guild bank. Mixed into GameServer.
// ─────────────────────────────────────────────────────────────────────────────
import { getMap, inSafeZone } from '../world.js';
import { RAID_ARENA_IDS } from '../raids.js';

export const PVP = { minLevel: 5, levelGap: 10, unflagMs: 15000, farmMs: 120000, noMaps: new Set(['raid_bastion', 'guild_raid', ...RAID_ARENA_IDS]) };
export const WAR = { dur: 30 * 60000, goal: 25, prize: 0.10, askMs: 5 * 60000, cooldown: 60 * 60000, minMembers: 2 };
const gkey = (n) => String(n ?? '').toLowerCase();
const pairKey = (a, b) => [a, b].sort().join('|');

export const pvpMethods = {
  initPvp(state) { this.wars = state?.wars ?? { active: [], hist: {}, next: 1 }; this.wars.active ??= []; this.wars.hist ??= {}; this.wars.next ??= 1; },

  // ── who may hurt whom ─────────────────────────────────────────────────────
  warBetween(ka, kb) { return ka && kb && ka !== kb ? this.wars.active.find((w) => (w.a === ka && w.b === kb) || (w.a === kb && w.b === ka)) ?? null : null; },
  warOfKey(k) { return k ? this.wars.active.find((w) => w.a === k || w.b === k) ?? null : null; },
  atWar(P, Q) { return !!this.warBetween(gkey(P.guild), gkey(Q.guild)); },
  // 'duel' | 'war' | 'flag' | null — may S hurt F right now?
  pvpRelation(S, F) {
    if (!S || !F || S === F || S.dead || F.dead || S.map !== F.map) return null;
    if (S.duel === F.id) return 'duel';
    if (S.duel || F.duel || PVP.noMaps.has(S.map)) return null;
    const map = getMap(S.map); if (inSafeZone(map, S.x, S.y) || inSafeZone(map, F.x, F.y)) return null;
    if (this.atWar(S.P, F.P)) return 'war';
    if (!S.pvp || !F.pvp) return null;
    if (S.partyId != null && S.partyId === F.partyId) return null;
    if (S.P.guild && gkey(S.P.guild) === gkey(F.P.guild)) return null;
    if (Math.abs(S.P.level - F.P.level) > PVP.levelGap) return null;
    return 'flag';
  },
  // players S can currently strike (used by targetsFor)
  pvpTargets(S) {
    if (!S.pvp && !this.warOfKey(gkey(S.P.guild)) && !S.duel) return [];
    const out = []; for (const F of this.sessions.values()) if (this.pvpRelation(S, F)) out.push({ isPlayer: true, s: F, x: F.x, y: F.y, radius: 0.35 });
    return out;
  },

  // ── the flag ──────────────────────────────────────────────────────────────
  on_pvp_toggle(S) {
    const now = this.now();
    if (S.pvp) {
      if (this.warOfKey(gkey(S.P.guild))) return this.toast(S, 'Your guild is at war — you cannot stand down.', 'bad');
      if (now - (S.pvpTag ?? 0) < PVP.unflagMs) return this.toast(S, `You were just in a fight. Wait ${Math.ceil((PVP.unflagMs - (now - S.pvpTag)) / 1000)}s.`, 'bad');
      S.pvp = false; this.toast(S, 'PvP off. You can no longer be attacked by other players.', 'good');
    } else {
      if (S.P.level < PVP.minLevel) return this.toast(S, `PvP is for level ${PVP.minLevel}+.`, 'bad'); if (S.dead) return;
      S.pvp = true; S.pvpTag = now; this.toast(S, `PvP ON. Other flagged players within ${PVP.levelGap} levels can fight you. Safe zones still protect you.`, 'secret');
    }
    S.conn.send({ t: 'pvp', on: S.pvp });
  },

  // ── kill credit ───────────────────────────────────────────────────────────
  pvpTouch(S, F) { const n = this.now(); S.pvpTag = n; F.pvpTag = n; },
  pvpKill(K, V, rel) {
    const now = this.now(); K.pvpRecent ??= new Map(); const last = K.pvpRecent.get(V.id) ?? -1e12; K.pvpRecent.set(V.id, now);
    V.P.stats.pvpDeaths = (V.P.stats.pvpDeaths ?? 0) + 1;
    if (now - last < PVP.farmMs) { this.toast(K, 'No credit: you just killed them.', 'bad'); this.afterChange(V); return; }
    K.P.stats.pvpKills = (K.P.stats.pvpKills ?? 0) + 1; this.toast(K, `* You defeated ${V.P.name}.`, 'good'); this.toast(V, `${K.P.name} defeated you.`, 'bad');
    if (rel === 'war') { const w = this.warBetween(gkey(K.P.guild), gkey(V.P.guild)); if (w) { w[w.a === gkey(K.P.guild) ? 'sa' : 'sb']++; this.pushWar(w); if (w.sa >= WAR.goal || w.sb >= WAR.goal) this.endWar(w, w.sa >= WAR.goal ? w.a : w.b, 'goal'); } }
    this.afterChange(K); this.afterChange(V);
  },

  // ── guild wars ────────────────────────────────────────────────────────────
  on_war_declare(S, m) {
    const g = this.guildOf(S.P); if (!g || g.leader !== S.id) return this.toast(S, 'Only a guild leader can declare war.', 'bad');
    const tk = gkey(m.guild), t = this.guilds[tk], k = gkey(g.name);
    if (!t || tk === k) return this.toast(S, 'No such guild.', 'bad');
    if (g.members.length < WAR.minMembers || t.members.length < WAR.minMembers) return this.toast(S, `Both guilds need ${WAR.minMembers}+ members to fight a war.`, 'bad');
    if (this.warOfKey(k)) return this.toast(S, 'Your guild is already at war.', 'bad'); if (this.warOfKey(tk)) return this.toast(S, `${t.name} is already at war.`, 'bad');
    const last = this.wars.hist[pairKey(k, tk)], cd = last == null ? 0 : last + WAR.cooldown - this.now(); if (cd > 0) return this.toast(S, `These guilds fought recently. Wait ${Math.ceil(cd / 60000)} min.`, 'bad');
    const L = this.sessions.get(t.leader); if (!L) return this.toast(S, `${t.name}'s leader must be online to answer.`, 'bad');
    this.invites.set(`war:${L.id}`, { from: S.id, at: this.now(), a: k, b: tk });
    L.conn.send({ t: 'invite', kind: 'war', from: S.P.name, guild: g.name }); this.toast(S, `War declared on ${t.name}. They have ${WAR.askMs / 60000} minutes to accept.`, 'secret');
  },
  on_war_accept(S) {
    const inv = this.invites.get(`war:${S.id}`); if (!inv) return; this.invites.delete(`war:${S.id}`);
    if (this.now() - inv.at > WAR.askMs) return this.toast(S, 'The challenge has expired.', 'bad');
    const A = this.guilds[inv.a], B = this.guilds[inv.b]; if (!A || !B || B.leader !== S.id) return;
    if (this.warOfKey(inv.a) || this.warOfKey(inv.b)) return this.toast(S, 'One of the guilds is already at war.', 'bad');
    const now = this.now(), w = { id: this.wars.next++, a: inv.a, b: inv.b, an: A.name, bn: B.name, start: now, end: now + WAR.dur, sa: 0, sb: 0 };
    this.wars.active.push(w);
    for (const g of [A, B]) for (const id of g.members) { const o = this.sessions.get(id); if (o) { o.pvp = true; o.pvpTag = now; o.conn.send({ t: 'pvp', on: true }); } }
    this.announceAll(`${A.name} vs ${B.name}`, `WAR! First to ${WAR.goal} kills or the most in ${WAR.dur / 60000} minutes wins — and takes ${Math.round(WAR.prize * 100)}% of the other guild's bank. Enemy members can be fought anywhere outside safe zones.`);
    this.pushWar(w);
  },
  on_war_decline(S) { const inv = this.invites.get(`war:${S.id}`); if (!inv) return; this.invites.delete(`war:${S.id}`); this.sessions.get(inv.from)?.conn.send({ t: 'toast', msg: `${this.guilds[inv.b]?.name ?? 'They'} declined your war.`, kind: 'bad' }); },
  on_war_surrender(S) {
    const g = this.guildOf(S.P); if (!g || g.leader !== S.id) return this.toast(S, 'Only the leader can surrender.', 'bad');
    const w = this.warOfKey(gkey(g.name)); if (!w) return; this.endWar(w, w.a === gkey(g.name) ? w.b : w.a, 'surrender');
  },
  pushWar(w) { for (const k of [w.a, w.b]) { const g = this.guilds[k]; if (g) this.pushGuild(g); } },
  warView(g, S) {
    const k = gkey(g.name), w = this.warOfKey(k); const out = { others: Object.values(this.guilds).filter((x) => gkey(x.name) !== k).slice(0, 40).map((x) => ({ name: x.name, level: x.level ?? 1, n: x.members.length, atWar: !!this.warOfKey(gkey(x.name)) })) };
    if (w) { const mine = w.a === k, fk = mine ? w.b : w.a, f = this.guilds[fk]; out.war = { foe: f?.name ?? (mine ? w.bn : w.an), mine: mine ? w.sa : w.sb, theirs: mine ? w.sb : w.sa, goal: WAR.goal, left: Math.max(0, w.end - this.now()), prize: Math.floor((f?.bank ?? 0) * WAR.prize), risk: Math.floor((g.bank ?? 0) * WAR.prize) }; }
    return out;
  },
  // winner === a guild key (a decisive result) or null (a draw)
  endWar(w, winner, why) {
    this.wars.active = this.wars.active.filter((x) => x !== w); this.wars.hist[pairKey(w.a, w.b)] = this.now();
    const A = this.guilds[w.a], B = this.guilds[w.b]; let text;
    if (winner && A && B) {
      const W = winner === w.a ? A : B, Lg = winner === w.a ? B : A, take = Math.floor((Lg.bank ?? 0) * WAR.prize);
      Lg.bank = (Lg.bank ?? 0) - take; W.bank = (W.bank ?? 0) + take; W.xp = (W.xp ?? 0) + 150; W.warWins = (W.warWins ?? 0) + 1; Lg.warLosses = (Lg.warLosses ?? 0) + 1;
      text = `${W.name} wins the war against ${Lg.name} (${winner === w.a ? w.sa : w.sb}–${winner === w.a ? w.sb : w.sa})${why === 'surrender' ? ' — surrender' : ''} and takes ${take}g, ${Math.round(WAR.prize * 100)}% of ${Lg.name}'s bank.`;
    } else if (!A || !B) text = `The war between ${w.an} and ${w.bn} ends: a guild is gone.`;
    else text = `The war between ${A.name} and ${B.name} ends in a draw (${w.sa}–${w.sb}). Nothing changes hands.`;
    this.announceAll('The war is over', text);
    for (const g of [A, B]) if (g) { this.pushGuild(g); for (const id of g.members) { const o = this.sessions.get(id); if (o) { o.pvpTag = this.now(); } } }
  },
  guildGone(g) { const w = this.warOfKey(gkey(g.name)); if (w) this.endWar(w, w.a === gkey(g.name) ? w.b : w.a, 'forfeit'); },
  tickWars(nw) { for (const w of [...this.wars.active]) if (nw >= w.end) this.endWar(w, w.sa === w.sb ? null : w.sa > w.sb ? w.a : w.b, 'time'); },
};
