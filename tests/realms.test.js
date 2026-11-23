import test from 'node:test';
import assert from 'node:assert/strict';
import { EXP_ZONES, EXP_ENEMIES, REALMS, REALM_POS, REALM_EDGES, FAR_POS } from '../src/expansion.js';
import { ENEMIES, ZONES } from '../src/data.js';
import { WORLD_POS, getMap, worldGraph, routeTo } from '../src/world.js';
import { MON2 } from '../src/client/sprites2.js';

const OLD_SHAPES = new Set(['hound', 'imp', 'brute', 'stag', 'wisp', 'wraith', 'worm', 'warden', 'husk', 'witch', 'boar', 'scorpion', 'skeleton', 'golem', 'spider', 'bandit', 'unwritten']);

test('five new realms: 45 regions on free grid cells, each joined to the existing world', () => {
  assert.equal(REALMS.length, 5); assert.equal(Object.keys(REALM_POS).length, 45); assert.equal(REALM_EDGES.length, 45);
  const taken = new Map(); for (const [id, [x, y]] of Object.entries({ ...WORLD_POS })) { const k = `${x},${y}`; assert.ok(!taken.has(k), `grid cell ${k} used by both ${taken.get(k)} and ${id}`); taken.set(k, id); }
  assert.ok(Object.keys(REALM_POS).every((id) => WORLD_POS[id]), 'every realm region is on the world map');
  for (const id of Object.keys(REALM_POS)) { assert.ok(getMap(id), id); assert.ok(getMap(id).portals.length >= 1); assert.ok(ZONES[id].lvl >= 40 && ZONES[id].lvl <= 100, `${id} level`); }
  const g = worldGraph(); for (const id of Object.keys(REALM_POS)) assert.ok(routeTo('town', id) || routeTo('greenmeadow', id), `a route from the start reaches ${id}`);
  void g; void FAR_POS;
});

test('new realms use brand-new creature art: no old shape, no shape shared between realms', () => {
  const seen = new Map();
  for (const R of REALMS) {
    for (const [, shape] of [...R.kit, R.elite]) { assert.ok(MON2[shape], `${R.key}: sprite ${shape} exists`); assert.ok(!OLD_SHAPES.has(shape), `${shape} is not an old shape`); }
    assert.ok(MON2[R.bossShape] && !OLD_SHAPES.has(R.bossShape), `${R.key} boss sprite`);
    for (const [, shape] of R.kit) { assert.ok(!seen.has(shape) || seen.get(shape) === R.key, `${shape} appears in two realms`); seen.set(shape, R.key); }
    assert.equal(new Set(R.kit.map((k) => k[1])).size, R.kit.length, `${R.key}: four different creatures`);
  }
  for (const z of EXP_ZONES.filter((z) => z.realm)) { for (const e of z.enemies) assert.ok(ENEMIES[e], e); assert.ok(ENEMIES[z.boss] && ENEMIES[z.elite]); assert.ok(MON2[ENEMIES[z.boss].shape], `${z.id} boss`); }
  assert.ok(Object.keys(MON2).length >= 26, 'at least 26 new creatures');
});

test('realm regions have a village or a dungeon, a lair, a waystone and levels that rise along the road', () => {
  for (const R of REALMS) {
    const zs = EXP_ZONES.filter((z) => z.realm === R.key), byId = new Map(zs.map((z) => [z.id, z]));
    assert.equal(zs.length, 9); assert.ok(zs.some((z) => z.village), `${R.key} has a village`); assert.ok(zs.filter((z) => z.dungeon).length >= 3, `${R.key} has dungeons`);
    for (const z of zs) { assert.ok(z.landmarks.some((l) => l.t === 'lair')); assert.equal(z.waystones, 1); const par = byId.get(z.parent) ?? EXP_ZONES.find((p) => p.id === z.parent); assert.ok(par, `${z.id} parent`); assert.ok(z.lvl >= par.lvl, `${z.id} is not easier than the region before it`); }
    for (const z of zs.filter((z) => z.dungeon)) { assert.ok(ZONES[`${z.dungeon}_1`] && ZONES[`${z.dungeon}_2`], `${z.id} dungeon floors`); assert.ok(EXP_ENEMIES[`${z.dungeon}_b`]); }
  }
});
