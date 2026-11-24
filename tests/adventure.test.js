import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { adventureGoals } from '../src/adventure.js';
import { WORLD_POS, regionOf, getMap } from '../src/world.js';
import { ZONES } from '../src/data.js';
import * as R from '../src/rules.js';

function world() {
  const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 31, now: () => clock.t }), conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null };
  assert.ok(srv.join(conn, { name: 'Explorer', create: { classId: 'warrior' } }).ok);
  return { srv, clock, conn, S: conn.session, advance(ms) { for (let i = 0; i < ms; i += 50) { clock.t += 50; srv.tick(); } } };
}

test('adventure goals: every overland region has sensible goals and rewards that grow with level', () => {
  let last = 0;
  for (const id of Object.keys(WORLD_POS).filter((i) => i !== 'town').sort((a, b) => ZONES[a].lvl - ZONES[b].lvl)) {
    const A = adventureGoals(id); assert.ok(A && A.goals.length >= 3, id); assert.ok(A.goals.some((g) => g.id === 'cull') && A.goals.some((g) => g.id === 'discover') && A.goals.some((g) => g.id === 'gather'));
    if (ZONES[id].boss) assert.ok(A.goals.some((g) => g.id === 'boss')); for (const g of A.goals) assert.ok(g.need >= 1 && g.gilt > 0 && g.xp >= 0);
    assert.ok(A.mastery.gilt > A.goals[0].gilt); assert.ok(A.mastery.gilt >= last * 0.9, 'mastery pay rises with level'); last = A.mastery.gilt;
  }
  assert.equal(adventureGoals('town'), null); assert.equal(adventureGoals('spire_3'), null);
  assert.equal(regionOf('far_p03'), 'far_p03'); assert.equal(regionOf('goblin_warrens_2'), 'greenmeadow'); assert.equal(regionOf('spire_5'), 'greenmeadow');
});

test('adventures: kills, gathering, discoveries and the dungeon complete goals, pay out, and mastering a region pays more', () => {
  const { srv, S, conn, advance } = world(); const region = 'greenmeadow', A = adventureGoals(region), m = getMap(region); S.P.level = 6; srv.recalc(S);
  srv.travel(S, region, m.spawn.x, m.spawn.y); const g0 = S.P.gilt;
  const boss = srv.mobs.find((x) => x.map === region && x.boss), elite = srv.mobs.find((x) => x.map === region && x.elite), grunt = srv.mobs.find((x) => x.map === region && !x.boss && !x.elite);
  assert.ok(boss && grunt);
  for (let i = 0; i < A.goals.find((g) => g.id === 'cull').need; i++) srv.advKill(S, grunt); assert.ok(S.P.gilt > g0, 'the first goal paid');
  srv.advKill(S, boss); assert.equal(S.P.adv.claimed[region].boss, 1); if (elite) { srv.advKill(S, elite); assert.equal(S.P.adv.claimed[region].elite, 1); }
  srv.advGather(S, A.goals.find((g) => g.id === 'gather').need);
  // discoveries: walk next to chests/signs/waystones
  const pois = m.points.filter((p) => ['chest', 'sign', 'waystone'].includes(p.kind) && !p.hidden); assert.ok(pois.length >= A.goals.find((g) => g.id === 'discover').need);
  for (const p of pois.slice(0, A.goals.find((g) => g.id === 'discover').need + 1)) { S.x = p.x + 0.5; S.y = p.y + 0.5; S.advAt = 0; advance(500); }
  assert.ok((S.P.adv.disc[region] ?? []).length >= 5, 'places found while walking'); assert.equal(S.P.adv.claimed[region].discover, 1);
  const before = S.P.gilt; for (const g of A.goals) if (!S.P.adv.claimed[region][g.id]) { const dm = srv.mobs.find((x) => ZONES[x.map]?.dungeon && x.boss); if (g.id === 'dungeon') srv.advKill(S, dm ?? { map: 'goblin_warrens_2', boss: true, key: 'x' }); }
  assert.ok(S.P.adv.mastered[region], 'every goal done = mastered'); assert.ok(S.P.gilt >= before + A.mastery.gilt, 'mastery reward paid'); assert.ok(conn.msgs.some((m2) => m2.t === 'adv.cur'), 'the tracker was updated');
  srv.on_adv_open(S); assert.ok(conn.msgs.some((m2) => m2.t === 'adv' && m2.list.some((r) => r.id === region && r.mastered)));
  const gilt = S.P.gilt; srv.advKill(S, grunt); assert.equal(S.P.gilt, gilt, 'no double pay');
});

test('recall: five seconds standing still, interrupted by moving or damage, with a cooldown', () => {
  const { srv, S, conn, advance } = world(); const m = getMap('greenmeadow'); srv.travel(S, 'greenmeadow', m.spawn.x, m.spawn.y); S.iframeUntil = 0;
  srv.on_recall(S); assert.ok(S.recall); advance(2000); S.x += 3; advance(200); assert.equal(S.recall, null, 'moving cancels'); assert.equal(S.map, 'greenmeadow');
  srv.on_recall(S); advance(5300); assert.equal(S.map, 'town', 'home after 5 s'); assert.ok(conn.msgs.some((x) => x.t === 'recall' && x.state === 'done'));
  srv.travel(S, 'greenmeadow', m.spawn.x, m.spawn.y); srv.on_recall(S); assert.equal(S.recall, null, 'cooling down');
});

test('equip best picks the strongest piece for every slot', () => {
  const { srv, S } = world(); const P = S.P; P.level = 30; srv.recalc(S);
  const a = R.addGear(P, { id: 'iron_sword', q: 0.5 }), b = R.addGear(P, { id: 'sun_blade', q: 0.8 }), c = R.addGear(P, { id: 'moon_sword', q: 0.8, up: 5 }); R.equip(P, a.uid);
  srv.on_inv_best(S); assert.equal(P.equip.weapon, c.uid, 'the best weapon is worn'); void b;
  const arm = R.addGear(P, { id: 'iron_mail', q: 0.5 }), plate = R.addGear(P, { id: 'steel_plate', q: 0.9 }); void arm; srv.on_inv_best(S); assert.equal(P.equip.chest, plate.uid);
});
