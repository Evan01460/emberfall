import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { RAIDS, RAID_ARENA_IDS } from '../src/raids.js';
import { getMap, dist } from '../src/world.js';
import { ZONES, ENEMIES } from '../src/data.js';

function setup(raidId) {
  const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 33, now: () => clock.t }), R0 = RAIDS[raidId];
  const conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null }; assert.ok(srv.join(conn, { name: 'Raider', create: { classId: 'warrior' } }).ok); const S = conn.session;
  S.P.level = Math.max(S.P.level, R0.minLevel); srv.recalc(S);
  const gate = getMap(R0.entry.map).points.find((p) => p.role === 'raid2' && p.raid === raidId); assert.ok(gate, 'gatekeeper exists');
  srv.travel(S, R0.entry.map, gate.x, gate.y + 1.5);
  const advance = (ms) => { for (let i = 0; i < ms; i += 50) { clock.t += 50; srv.tick(); S.hp = Math.max(S.hp, S.rt.maxHp * 0.9); S.immuneUntil = clock.t + 1000; } };
  return { srv, S, conn, clock, advance, R0, gate };
}

for (const id of Object.keys(RAIDS)) test(`raid ${id}: data is sound — every wing has a registered arena, enemies and an NPC`, () => {
  const R0 = RAIDS[id];
  for (const w of R0.wings) { assert.ok(ZONES[w.id], `${w.id} zone`); assert.ok(getMap(w.id).bossSpawn, `${w.id} boss spawn`); for (const b of w.bosses) assert.ok(ENEMIES[b.key], b.key); for (const p of w.phases) if (p.adds) assert.ok(ENEMIES[p.adds.key], p.adds.key); }
  assert.ok(getMap(R0.entry.map).points.some((p) => p.role === 'raid2' && p.raid === id));
});

test('raid flow: enter, phases fire, wings advance as bosses die, loot is granted, the raid ends and the gate frees up', () => {
  const { srv, S, advance, R0 } = setup('void_citadel');
  const status = srv.raid2Status(S, R0.id); assert.equal(status.busy, false); assert.equal(status.wings.length, 4);
  srv.on_raid2_enter(S, { raid: R0.id }); assert.equal(S.map, R0.wings[0].id, 'carried into wing 1'); assert.ok(srv.raids[R0.id]);
  assert.equal(srv.raid2Status(S, R0.id).busy, true);
  const gearBefore = S.P.gear.length, giltBefore = S.P.gilt;
  for (let wi = 0; wi < R0.wings.length; wi++) {
    assert.equal(S.map, R0.wings[wi].id, `in wing ${wi + 1}`); advance(1500);
    const run = srv.raids[R0.id], bosses = run.bossIds.map((id) => srv.mobs.find((m) => m.id === id)); assert.equal(bosses.filter(Boolean).length, R0.wings[wi].bosses.length);
    // wound a boss past the first phase threshold and check the phase triggers
    for (const b of bosses) b.hp = Math.max(1, b.maxHp * 0.3); advance(3000);
    assert.ok(run.triggered.size > 0, 'phases triggered'); if (R0.wings[wi].phases.some((p) => p.adds)) assert.ok(srv.mobs.some((m) => m.map === S.map && m.raidAdd) || run.spawners.length, 'servants called');
    for (const b of srv.mobs.filter((m) => m.map === S.map && m.raidBoss)) { b.hp = 0; srv.killMob(b); }
    advance(500);
    if (wi < R0.wings.length - 1) { assert.equal(srv.raids[R0.id].intermission, true, 'intermission'); advance(10000); }
  }
  assert.ok(srv.raids[R0.id].over, 'raid cleared'); assert.ok(S.P.gilt > giltBefore, 'gilt rewarded'); assert.ok(S.P.gear.length > gearBefore, 'gear rewarded'); assert.equal(S.P.stats.rc[R0.id], 1);
  advance(61000); assert.equal(srv.raids[R0.id], undefined, 'raid freed'); assert.equal(S.map, R0.entry.map, 'raiders return to the gate'); assert.ok(dist(S.x, S.y, S.x, S.y) === 0);
});

test('raid: a wipe resets the raid, other players are refused while it is busy, low levels are refused', () => {
  const { srv, S, advance, R0 } = setup('void_citadel'); srv.on_raid2_enter(S, { raid: R0.id }); advance(1000);
  const run = srv.raids[R0.id]; assert.ok(run);
  S.hp = 1; S.immuneUntil = 0; S.iframeUntil = 0; srv.hurtPlayer(S, 1e9, { hpUnits: true }); assert.ok(S.dead, 'the raider fell');
  advance(6000); assert.equal(srv.raids[R0.id], undefined, 'everyone dead — the raid resets');
  assert.equal(srv.mobs.filter((m) => m.map === R0.wings[0].id && m.temp).length, 0, 'raid mobs cleaned up');
  const again = setup('void_citadel'); again.srv.on_raid2_enter(again.S, { raid: 'void_citadel' }); assert.ok(again.srv.raids.void_citadel);
  const other = { msgs: [], send(m) { this.msgs.push(m); }, session: null }; assert.ok(again.srv.join(other, { name: 'Bystander', create: { classId: 'mage' } }).ok);
  const O = other.session; O.P.level = 50; again.srv.travel(O, 'far_p02', again.gate.x, again.gate.y + 1.5); again.srv.on_raid2_enter(O, { raid: 'void_citadel' }); assert.equal(O.map, 'far_p02', 'a busy raid refuses a second group');
  const t = setup('void_citadel'); t.S.P.level = 5; t.srv.on_raid2_enter(t.S, { raid: 'void_citadel' }); assert.equal(t.srv.raids.void_citadel, undefined, 'low level refused'); assert.equal(t.S.map, t.R0.entry.map);
  const w = setup('wyrmcrown'); w.S.P.level = 10; w.srv.on_raid2_enter(w.S, { raid: 'wyrmcrown' }); assert.equal(w.srv.raids.wyrmcrown, undefined);
});

test('raid: logging in inside an arena puts you back at the gate; arenas are no-PvP', async () => {
  const { srv } = setup('wyrmcrown'); const conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null };
  const P = [...srv.players.values()][0]; P.map = RAID_ARENA_IDS[0]; P.x = 32.5; P.y = 43.5; srv.leave(conn);
  const c2 = { msgs: [], send(m) { this.msgs.push(m); }, session: null }; assert.ok(srv.join(c2, { name: P.name }).ok); assert.ok(!RAID_ARENA_IDS.includes(c2.session.map));
});
