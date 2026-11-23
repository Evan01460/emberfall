import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { getMap, blockedAt, inSafeZone } from '../src/world.js';
import { WAR, PVP } from '../src/server/pvp.js';

function world() { const clock = { t: 1_000_000 }; const srv = new GameServer({ seed: 11, now: () => clock.t }); return { srv, clock, advance(ms) { for (let i = 0; i < ms; i += 50) { clock.t += 50; srv.tick(); } } }; }
function client(srv, name, classId = 'warrior') {
  const conn = { msgs: [], send(m) { this.msgs.push(JSON.parse(JSON.stringify(m))); }, session: null };
  assert.ok(srv.join(conn, { name, create: { classId } }).ok);
  const c = { conn, S: conn.session, P: conn.session.P, send: (t, d = {}) => srv.handle(conn, { t, ...d }), last: (t) => [...conn.msgs].reverse().find((m) => m.t === t), teleport: (map, x, y) => { c.S.map = map; c.S.x = x; c.S.y = y; } };
  return c;
}
// an open patch of ground that is not a safe zone
function openGround() { const m = getMap('greenmeadow'); for (let y = 20; y < m.h - 20; y++) for (let x = 20; x < m.w - 20; x++) { let ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (blockedAt(m, x + dx + 0.5, y + dy + 0.5, 0.4) || inSafeZone(m, x + dx, y + dy)) { ok = false; break; } if (ok) return { x: x + 0.5, y: y + 0.5 }; } throw new Error('no open ground'); }
const hurt = (a, b, n = 1) => { for (let i = 0; i < n; i++) { a.S.iframeUntil = 0; b.S.iframeUntil = 0; b.S.hp = Math.max(b.S.hp, 1); srv0.hitPlayerPvp(a.S, b.S, 60, 'slash', null); } };
let srv0;

function arena(n = 2) {
  const w = world(); srv0 = w.srv; const g = openGround(), cs = [];
  for (let i = 0; i < n; i++) { const c = client(w.srv, `P${i}`, 'warrior'); c.P.level = 10; w.srv.recalc(c.S); c.teleport('greenmeadow', g.x + i * 0.6, g.y); cs.push(c); }
  return { ...w, g, cs };
}

test('PvP flag: only two flagged players in the open can hurt each other; safe zones, parties, guild-mates and big level gaps are protected', () => {
  const { srv, cs: [a, b], g } = arena(); const hp = () => b.S.hp;
  hurt(a, b); assert.equal(hp(), b.S.rt.maxHp, 'nobody is flagged: no damage');
  a.send('pvp.toggle'); hurt(a, b); assert.equal(hp(), b.S.rt.maxHp, 'only the attacker is flagged: still no damage');
  b.send('pvp.toggle'); assert.equal(a.S.pvp && b.S.pvp, true); hurt(a, b); assert.ok(hp() < b.S.rt.maxHp, 'both flagged: damage lands');
  b.S.hp = b.S.rt.maxHp; const town = getMap('town').spawn; a.teleport('town', town.x, town.y); b.teleport('town', town.x + 0.5, town.y); hurt(a, b); assert.equal(hp(), b.S.rt.maxHp, 'safe zones protect flagged players');
  a.teleport('greenmeadow', g.x, g.y); b.teleport('greenmeadow', g.x + 0.5, g.y);
  srv.parties.set(77, { id: 77, leader: a.S.id, members: [a.S.id, b.S.id] }); a.S.partyId = b.S.partyId = 77; hurt(a, b); assert.equal(hp(), b.S.rt.maxHp, 'party-mates are safe'); a.S.partyId = b.S.partyId = null;
  b.P.level = 10 + PVP.levelGap + 1; hurt(a, b); assert.equal(hp(), b.S.rt.maxHp, 'a huge level gap is protected'); b.P.level = 10;
  hurt(a, b); assert.ok(hp() < b.S.rt.maxHp, 'back to normal');
  assert.ok(srv.targetsFor(a.S).some((t) => t.isPlayer && t.s === b.S), 'attacks (melee, projectiles) see flagged players as targets');
});

test('PvP flag: low levels cannot flag, you cannot unflag mid-fight, and a PvP death costs no gilt but counts a kill (with anti-farming)', () => {
  const { srv, clock, advance, cs: [a, b] } = arena(); const lvl1 = client(srv, 'Newbie'); lvl1.send('pvp.toggle'); assert.equal(!!lvl1.S.pvp, false, 'level gate');
  a.send('pvp.toggle'); b.send('pvp.toggle'); hurt(a, b); a.send('pvp.toggle'); assert.equal(a.S.pvp, true, 'cannot stand down right after a fight'); advance(PVP.unflagMs + 500);
  const gilt = b.P.gilt = 1000; b.S.iframeUntil = 0; b.S.hp = 5; hurt(a, b); assert.equal(b.S.dead, true); assert.equal(b.P.gilt, gilt, 'no gilt lost to another player'); assert.equal(a.P.stats.pvpKills, 1); assert.equal(b.P.stats.pvpDeaths, 1);
  srv.respawn(b.S); b.teleport('greenmeadow', a.S.x + 0.5, a.S.y); b.S.iframeUntil = 0; b.S.hp = 5; hurt(a, b); assert.equal(a.P.stats.pvpKills, 1, 'killing the same player again straight away earns nothing');
  a.send('pvp.toggle'); assert.equal(a.S.pvp, true, 'still tagged'); advance(PVP.unflagMs + 500); a.send('pvp.toggle'); assert.equal(a.S.pvp, false, 'stood down after the cooldown');
});

function twoGuilds() {
  const w = arena(4); const [a1, a2, b1, b2] = w.cs; a1.P.gilt = b1.P.gilt = 2000; const { srv } = w;
  a1.send('guild.create', { name: 'Red Fang' }); b1.send('guild.create', { name: 'Blue Tide' });
  a1.send('guild.invite', { to: a2.P.name }); a2.send('guild.accept'); b1.send('guild.invite', { to: b2.P.name }); b2.send('guild.accept');
  srv.guildOf(a1.P).bank = 5000; srv.guildOf(b1.P).bank = 4000;
  return { ...w, a1, a2, b1, b2 };
}

test('guild war: the leader declares, the other leader accepts, enemy members become fair game (flagged or not), allies stay safe', () => {
  const { srv, a1, a2, b1, b2 } = twoGuilds();
  a2.send('war.declare', { guild: 'Blue Tide' }); assert.equal(srv.wars.active.length, 0, 'only a leader can declare');
  a1.send('war.declare', { guild: 'Red Fang' }); a1.send('war.declare', { guild: 'Nobody' }); assert.equal(b1.conn.msgs.some((m) => m.t === 'invite' && m.kind === 'war'), false);
  hurt(a1, b1); assert.equal(b1.S.hp, b1.S.rt.maxHp, 'no war yet');
  a1.send('war.declare', { guild: 'Blue Tide' }); const inv = b1.conn.msgs.find((m) => m.t === 'invite' && m.kind === 'war'); assert.ok(inv && inv.guild === 'Red Fang');
  b2.send('war.accept'); assert.equal(srv.wars.active.length, 0, 'only the challenged leader can accept'); b1.send('war.accept'); assert.equal(srv.wars.active.length, 1);
  a1.S.pvp = b1.S.pvp = false; hurt(a1, b1); assert.ok(b1.S.hp < b1.S.rt.maxHp, 'war overrides the flag'); hurt(a1, a2); assert.equal(a2.S.hp, a2.S.rt.maxHp, 'guild-mates are never targets');
  a1.send('war.declare', { guild: 'Blue Tide' }); assert.ok(a1.conn.msgs.some((m) => m.t === 'toast' && /already at war/.test(m.msg)));
  assert.equal(srv.guildView(a1.S).war.foe, 'Blue Tide'); assert.equal(srv.guildView(a1.S).war.prize, 400, '10% of the enemy bank is the prize'); assert.equal(srv.guildView(a1.S).war.risk, 500);
  const town = getMap('town').spawn; b2.teleport('town', town.x, town.y); a2.teleport('town', town.x + 0.4, town.y); hurt(a2, b2); assert.equal(b2.S.hp, b2.S.rt.maxHp, 'safe zones still protect during a war');
});

test('guild war: kills score for your guild; the winner takes 10% of the loser\'s bank; ties and surrender are handled; a rematch needs a cooldown', () => {
  const { srv, clock, advance, a1, a2, b1, b2 } = twoGuilds(); a1.send('war.declare', { guild: 'Blue Tide' }); b1.send('war.accept');
  const kill = (k, v) => { k.S.dead = false; v.S.dead = false; v.S.hp = 1; k.S.pvpRecent?.clear(); hurt(k, v); };
  kill(a1, b1); kill(a2, b2); assert.deepEqual([srv.wars.active[0].sa, srv.wars.active[0].sb], [2, 0]); kill(b1, a1); assert.equal(srv.wars.active[0].sb, 1);
  assert.equal(a1.P.stats.pvpKills ?? 0, 1); const A = srv.guildOf(a1.P), B = srv.guildOf(b1.P);
  advance(WAR.dur + 1000); assert.equal(srv.wars.active.length, 0, 'the clock ran out'); assert.equal(A.bank, 5400, 'winner banked 10% of 4000'); assert.equal(B.bank, 3600); assert.equal(A.warWins, 1); assert.equal(B.warLosses, 1);
  b1.send('war.declare', { guild: 'Red Fang' }); assert.ok(b1.conn.msgs.some((m) => m.t === 'toast' && /fought recently/.test(m.msg)), 'rematch cooldown');
  clock.t += WAR.cooldown + 1000; b1.send('war.declare', { guild: 'Red Fang' }); a1.send('war.accept'); assert.equal(srv.wars.active.length, 1);
  b1.send('war.surrender'); assert.equal(srv.wars.active.length, 0); assert.equal(A.bank, 5400 + Math.floor(3600 * 0.1), 'surrender hands the winner the prize'); assert.equal(B.bank, 3600 - 360);
  clock.t += WAR.cooldown + 1000; a1.send('war.declare', { guild: 'Blue Tide' }); b1.send('war.accept'); advance(WAR.dur + 1000); assert.equal(A.bank + B.bank, 5760 + 3240, 'a draw moves nothing'); assert.equal(A.bank, 5760);
});

test('guild war: first to the kill goal wins at once, persistence keeps the war, and a disbanded guild forfeits', () => {
  const { srv, a1, a2, b1, b2 } = twoGuilds(); a1.send('war.declare', { guild: 'Blue Tide' }); b1.send('war.accept'); const w = srv.wars.active[0]; w.sa = WAR.goal - 1;
  b1.S.dead = false; b1.S.hp = 1; hurt(a1, b1); assert.equal(srv.wars.active.length, 0, 'goal reached'); assert.equal(srv.guildOf(a1.P).bank, 5400);
  const { srv: s2, a1: x1, b1: y1, b2: y2 } = twoGuilds(); x1.send('war.declare', { guild: 'Blue Tide' }); y1.send('war.accept'); const saved = JSON.parse(JSON.stringify(s2.exportState())); assert.equal(saved.wars.active.length, 1);
  const s3 = new GameServer({ state: saved, now: () => 9 }); assert.equal(s3.wars.active.length, 1, 'the war survives a restart');
  y2.send('guild.leave'); y1.send('guild.leave'); assert.equal(s2.wars.active.length, 0, 'the last member leaving ends the war');
});

test('leaderboards: one per main class (no hidden or mythic classes), plus combat power, total money and the most valuable item', () => {
  const { srv } = world(); const a = client(srv, 'Alpha', 'warrior'), b = client(srv, 'Beta', 'warrior'), c = client(srv, 'Gamma', 'mage'), d = client(srv, 'Delta', 'merchant');
  a.P.level = 12; b.P.level = 15; c.P.level = 9; d.P.level = 4; srv.recalc(b.S); srv.recalc(a.S);
  d.P.classId = 'archivist'; // a hidden class must not appear on any class board
  a.P.gilt = 50000; c.P.gilt = 100; srv.orders.push({ id: 9001, by: c.S.id, kind: 'wholesale', itemId: 'iron_ingot', qty: 5, left: 5, price: 10, escrow: 20000, created: srv.now(), expires: Infinity });
  const g = R_addGear(a.P, 'sun_blade', 0.95), g2 = R_addGear(b.P, 'iron_sword', 0.5); g.fx = [{ id: 'keen', k: 1 }];
  const boards = srv.leaderboards(), by = Object.fromEntries(boards.map((x) => [x.id, x]));
  assert.deepEqual(boards.filter((x) => x.group === 'Classes').map((x) => x.cls), ['warrior', 'mage', 'archer', 'blacksmith', 'alchemist', 'merchant'], 'exactly the six main classes');
  assert.deepEqual(by.cls_warrior.rows.map((r) => r.n), ['Beta', 'Alpha'], 'ranked by level'); assert.deepEqual(by.cls_mage.rows.map((r) => r.n), ['Gamma']); assert.equal(by.cls_merchant.rows.length, 0, 'the hidden-class player is not ranked');
  for (const x of boards.filter((x) => x.group === 'Classes')) for (const r of x.rows) assert.ok(['warrior', 'mage', 'archer', 'blacksmith', 'alchemist', 'merchant'].includes(r.c));
  assert.equal(by.money.rows[0].n, 'Alpha'); assert.equal(by.money.rows[1].n, 'Gamma', 'gilt tied up in orders counts as owned money'); assert.equal(by.money.rows[1].v, 20100);
  assert.equal(by.item.rows[0].n, 'Alpha'); assert.match(by.item.rows[0].x, /Sunsteel Blade/); assert.ok(by.item.rows[0].v > by.item.rows[1].v);
  assert.equal(by.power.rows[0].n, 'Beta', 'higher level and gear: more combat power'); assert.ok(by.power.rows.every((r, i, arr) => !i || arr[i - 1].v >= r.v));
  a.send('leaderboard'); assert.ok(a.last('leaderboard').boards.length >= 9);
});
import * as R from '../src/rules.js';
function R_addGear(P, id, q) { return R.addGear(P, { id, q }); }
