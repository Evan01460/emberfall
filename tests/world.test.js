import test from 'node:test';
import assert from 'node:assert/strict';
import { getMap, MAP_IDS, reachableFrom, isBlockedTile, blockedAt, stepMove, portalAt, portalDest } from '../src/world.js';

test('every map builds deterministically', () => {
  for (const id of MAP_IDS) {
    const a = getMap(id);
    assert.equal(a.tiles.length, a.w * a.h);
    assert.ok(!isBlockedTile(a, Math.floor(a.spawn.x), Math.floor(a.spawn.y)), `${id} spawn blocked`);
  }
});

test('all stations, npcs, nodes, portals and mob homes are reachable from the map spawn', () => {
  for (const id of MAP_IDS) {
    const m = getMap(id), seen = reachableFrom(m, Math.floor(m.spawn.x), Math.floor(m.spawn.y));
    const ok = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy; return tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && seen[ty * m.w + tx];
    });
    for (const p of m.points) assert.ok(ok(p.x, p.y), `${id}: unreachable ${p.kind} ${p.id} @${p.x},${p.y}`);
    for (const p of m.portals) {
      let any = false; for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) if (ok(i, j)) any = true;
      assert.ok(any, `${id}: portal to ${p.to.map} unreachable`);
      const dest = getMap(p.to.map), dd = portalDest(p);
      assert.ok(!blockedAt(dest, dd.x, dd.y), `${id}: portal target in ${p.to.map} is blocked`);
    }
    for (const s of m.mobSpawns) assert.ok(ok(s.x, s.y), `${id}: mob home unreachable`);
    if (m.bossSpawn && !m.sealedBoss) assert.ok(ok(m.bossSpawn.x, m.bossSpawn.y), `${id}: boss spawn unreachable`);
  }
});

test('map counts: enough nodes and mobs to feel alive', () => {
  assert.ok(getMap('quarry').points.filter((p) => p.kind === 'node').length >= 12);
  assert.ok(getMap('quarry').mobSpawns.length >= 8);
  assert.ok(getMap('hollow_reach').mobSpawns.length >= 8);
  assert.ok(getMap('archive').bossSpawn && getMap('hollow_depths').bossSpawn);
});

test('collision: walls block, open ground does not; sliding along walls works', () => {
  const m = getMap('town');
  assert.ok(blockedAt(m, 5.5, 4.5));                        // inside smithy wall
  const r = stepMove(m, 26.5, 19.5, 0.3, 0);
  assert.ok(r.x > 26.5);
  const edge = stepMove(m, 1.5, 1.5, -5, 0); assert.ok(edge.x >= 0);
  assert.ok(portalAt(m, 51.5, 18.5));
});

test('props are SOLID: you cannot walk through the anvil, furnace, cauldron, counters or NPCs — but doors and hidden points stay open', () => {
  const m = getMap('town');
  const forge = m.points.find((p) => p.kind === 'forge'), cauldron = m.points.find((p) => p.kind === 'cauldron'), board = m.points.find((p) => p.kind === 'exchange');
  for (const p of [forge, cauldron, board]) assert.ok(blockedAt(m, p.x, p.y), `${p.kind} blocks`);
  let px = forge.x - 1.6; for (let i = 0; i < 40; i++) px = stepMove(m, px, forge.y, 0.1, 0).x; assert.ok(px < forge.x, `cannot walk through the anvil (stopped at ${px.toFixed(2)})`);
  const furnace = m.decor.find((d) => d.kind === 'furnace'); assert.ok(furnace.solid && blockedAt(m, furnace.x + 0.5, furnace.y + 0.5));
  const counter = m.decor.find((d) => d.kind === 'counter'); assert.ok(blockedAt(m, counter.x + 1.5, counter.y + 0.5), 'counters are solid');
  assert.ok(!blockedAt(m, 10.5, 10.5), 'the smithy door is walkable'); assert.ok(!blockedAt(m, 10.5, 9.5), 'and the room behind it');
  for (const p of m.points.filter((q) => q.hidden)) assert.ok(!blockedAt(m, p.x, p.y), 'hidden NPCs do not leave invisible walls');
  assert.ok(m.decor.filter((d) => d.kind === 'window').every((d) => !d.solid));
});

test('Lanternfall: every building is fully walled (no road eats a wall), the plaza has no dirt strips, and the north exit is reachable', async () => {
  const { getMap, T, reachableFrom, portalDest } = await import('../src/world.js');
  const m = getMap('town'), at = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? -1 : m.tiles[y * m.w + x]), OPEN = new Set([T.GRASS, T.PATH, T.COBBLE, T.SAND]);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(x, y) === T.FLOOR) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(!OPEN.has(at(x + dx, y + dy)), `floor at ${x},${y} leaks into ${at(x + dx, y + dy)} at ${x + dx},${y + dy}`);
  for (let y = 5; y <= 9; y++) assert.equal(at(15, y), T.WALL, `smithy east wall at y=${y}`);
  for (let y = 11; y <= 24; y++) for (let x = 17; x <= 35; x++) if (at(x, y) === T.PATH) assert.fail(`dirt path inside the plaza at ${x},${y}`);
  const north = m.portals.find((p) => p.to.map === 'greenmeadow'); assert.ok(north); const seen = reachableFrom(m, Math.floor(m.spawn.x), Math.floor(m.spawn.y));
  assert.ok(seen[Math.floor(north.y + 1) * m.w + Math.floor(north.x + 1)], 'the north exit is reachable from the plaza');
  const back = getMap('greenmeadow').portals.find((p) => p.to.map === 'town'), d = portalDest(back); assert.ok(seen[Math.floor(d.y) * m.w + Math.floor(d.x)], 'the arrival point from Greenmeadow is on walkable, connected ground');
});
