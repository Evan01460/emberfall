import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, ZONES, ITEMS, RECIPES, NODE_TYPES, TIERS, MAX_LEVEL } from '../src/data.js';
import { EXP_ZONES, EXP_ENEMIES, EXP_TIERS, SPIRE_ZONES, SPIRE_FLOORS, EXP_POTIONS } from '../src/expansion.js';
import { MAP_IDS, getMap, portalDest, isBlockedTile } from '../src/world.js';
import { enemyStats, xpForLevel } from '../src/units.js';
import { GameServer } from '../src/server/gameserver.js';

test('the Far Reaches: every region, dungeon, enemy, ore and gear piece exists and is wired together', () => {
  assert.equal(MAX_LEVEL, 100); assert.ok(EXP_ZONES.filter((z) => z.kind).length >= 48, 'at least 48 new regions'); assert.equal(SPIRE_ZONES.length, SPIRE_FLOORS);
  for (const z of [...EXP_ZONES, ...SPIRE_ZONES]) {
    assert.ok(ZONES[z.id] && MAP_IDS.includes(z.id), `zone ${z.id}`);
    for (const e of ZONES[z.id].enemies) { assert.ok(ENEMIES[e], `${z.id}: enemy ${e}`); for (const [item] of ENEMIES[e].drops) assert.ok(ITEMS[item], `${e} drops ${item}`); for (const m of ENEMIES[e].moves) assert.ok(m, `${e} move`); }
    if (ZONES[z.id].boss) assert.ok(ENEMIES[ZONES[z.id].boss]?.boss, `${z.id} boss`); if (ZONES[z.id].elite) assert.ok(ENEMIES[ZONES[z.id].elite], `${z.id} elite`);
  }
  for (const t of EXP_TIERS) { assert.ok(ITEMS[t.ore] && ITEMS[t.ing] && NODE_TYPES[t.id], t.id); assert.ok(RECIPES.some((r) => r.out === t.ing), `${t.id} smelting`); assert.ok(TIERS.some((x) => x.id === t.id)); assert.ok(ITEMS[`${t.id}_sword`] && ITEMS[`${t.id}_plate`] && ITEMS[`${t.id}_locket`], `${t.id} gear`); }
  for (const z of EXP_ZONES.filter((z) => z.kind)) for (const type of Object.keys(z.nodes)) assert.ok(NODE_TYPES[type], `${z.id} node ${type}`);
  for (const p of EXP_POTIONS) { assert.ok(ITEMS[p.id] && RECIPES.some((r) => r.out === p.id)); for (const id of Object.keys(p.in)) assert.ok(ITEMS[id], `${p.id} needs ${id}`); }
});

test('the world is one connected graph: from Lanternfall you can walk to every new region, dungeon floor and Spire floor', () => {
  const seen = new Set(['town']), q = ['town'];
  while (q.length) { const id = q.pop(); for (const p of getMap(id).portals) { const d = portalDest(p); assert.ok(MAP_IDS.includes(p.to.map), `${id} -> ${p.to.map}`); const dm = getMap(p.to.map); assert.ok(!isBlockedTile(dm, Math.floor(d.x), Math.floor(d.y)), `${id} -> ${p.to.map} arrives inside a wall at ${d.x},${d.y}`); if (!seen.has(p.to.map)) { seen.add(p.to.map); q.push(p.to.map); } } }
  for (const z of [...EXP_ZONES, ...SPIRE_ZONES]) assert.ok(seen.has(z.id), `${z.id} is unreachable`);
});

test('enemy strength curve: health grows steadily and never explodes; levels 34-100 are playable', () => {
  let last = 0; for (const L of [1, 10, 20, 33, 34, 50, 75, 100]) { const e = { hp: 14 * Math.min(L, 33 + (L - 33) * 0.35 > 33 ? 33 + (L - 33) * 0.35 : L) }; const st = enemyStats(Object.keys(EXP_ENEMIES).find((k) => k.endsWith('_m0')), L); assert.ok(st.maxHp > 0 && st.maxHp < 2e5, `L${L} hp ${st.maxHp}`); assert.ok(st.maxHp >= last * 0.5); last = st.maxHp; void e; }
  assert.ok(xpForLevel(31) > xpForLevel(30) && xpForLevel(100) > xpForLevel(60) * 2, 'levelling past 30 takes longer and longer');
  for (const z of SPIRE_ZONES) assert.ok(z.lvl >= 4 && z.lvl <= 120);
  assert.ok(ZONES.spire_1.lvl <= 6 && ZONES.spire_100.lvl >= 90, 'the Spire is climbable from the start and reaches level 90+');
});

test('server: players can enter far regions and the Spire, mobs exist there, and nothing throws while they fight', () => {
  const clock = { t: 1_000_000 }; const srv = new GameServer({ seed: 21, now: () => clock.t });
  const conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null }; assert.ok(srv.join(conn, { name: 'Wanderer', create: { classId: 'warrior' } }).ok); const S = conn.session;
  for (const id of ['far_p00', 'far_p07', 'far_s03', 'far_d01_2', 'spire_1', 'spire_10', 'spire_120']) {
    const m = getMap(id); srv.travel(S, id, m.spawn.x, m.spawn.y); S.immuneUntil = 0; S.hp = S.rt.maxHp;
    assert.ok(srv.mobs.some((x) => x.map === id), `${id} has monsters`);
    for (let i = 0; i < 60; i++) { clock.t += 50; srv.tick(); } assert.equal(S.map, id);
  }
  assert.ok(srv.mobs.length > 5000, 'a big world');
});

test('gear balance: late-game flat bonuses scale with the metal, old tiers do not change, and defence keeps mattering at high levels', async () => {
  const { flatScale, scaledText } = await import('../src/gearscale.js'); const { mobHit } = await import('../src/units.js'); const { calcDamage, gearBonuses } = await import('../src/units.js');
  assert.equal(flatScale('iron_sword'), 1); assert.equal(flatScale('aether_plate'), 1); assert.ok(flatScale('voidglass_plate') > 1 && flatScale('worldsteel_plate') > flatScale('celestine_plate'));
  assert.equal(scaledText('+160 max HP', 'iron_sword'), '+160 max HP'); assert.ok(/\+\d+ max HP/.test(scaledText('+160 max HP', 'worldsteel_plate')) && parseInt(scaledText('+160 max HP', 'worldsteel_plate').slice(1)) > 500);
  const old = gearBonuses([{ id: 'sun_aegis', q: 1, affix: 'lively' }]), expH = 110 * 1.5 + 15; assert.ok(Math.abs(old.hp - expH) < 1, 'old tier: affix unscaled');
  const nw = gearBonuses([{ id: 'worldsteel_plate', q: 1, affix: 'lively' }]); assert.ok(Math.abs(nw.hp - (1069 * 1.5 + 15 * flatScale('worldsteel_plate'))) < 1 && flatScale('worldsteel_plate') > 4, 'late tier: affix scales');
  for (const [p, a, d] of [[10, 6, 3], [10, 40, 10], [20, 68, 100], [5, 70, 0]]) assert.equal(mobHit(p, a, d), calcDamage(p, a, d), 'identical to the original formula up to attack 70');
  assert.ok(mobHit(30, 230, 300) > calcDamage(30, 230, 300) * 0.99 - 1 && mobHit(30, 230, 150) < calcDamage(30, 230, 150), 'late game: gentler slope');
  assert.ok(mobHit(30, 230, 600) >= Math.round(30 * 0.55) - 1, 'the damage floor rises to 55% against late-game monsters');
});
