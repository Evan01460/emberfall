import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { ITEMS, RECIPES, CLASSES, TIERS, ARCH, archOf, classGear, ALL_CLASSES } from '../src/data.js';
import { SLOTS, ARMOR_SLOTS, SLOT_NAMES } from '../src/gearsets.js';
import * as R from '../src/rules.js';
import { rtStats } from '../src/units.js';
import { lookOf, parseLook } from '../src/look.js';
import { RUNES, runeKey, runePoints } from '../src/runes.js';
import { upgradeSpec } from '../src/upgrade.js';
import { Rng } from '../src/rng.js';
import { strikeScore } from '../src/rules.js';

const join = (classId = 'warrior') => { const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 3, now: () => clock.t }), conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null }; srv.join(conn, { name: 'Gearer', create: { classId } }); return { srv, S: conn.session, clock, conn }; };

test('seven gear slots: weapon, helmet, chestplate, leggings, boots, ring, charm - every metal, every class', () => {
  assert.deepEqual(SLOTS, ['weapon', 'head', 'chest', 'legs', 'feet', 'ring', 'charm']); assert.equal(Object.keys(SLOT_NAMES).length, 7); assert.deepEqual(ARMOR_SLOTS, ['head', 'chest', 'legs', 'feet']);
  for (const a of Object.values(ARCH)) assert.ok(SLOTS.includes(a.slot), a.name);
  for (const slot of SLOTS) { const items = Object.entries(ITEMS).filter(([, it]) => it.k === 'gear' && it.slot === slot); assert.ok(items.length >= TIERS.length, `${slot}: a piece in every metal tier`); for (const [id] of items) assert.ok(RECIPES.some((r) => r.out === id), `${id} can be forged`); }
  assert.ok(!Object.values(ITEMS).some((it) => it.slot === 'armor'), 'no item is left in the old armor slot');
  for (const c of ALL_CLASSES) { const g = classGear(c); for (const slot of SLOTS) assert.ok(g[slot].length, `${c} has ${slot} gear made for it`); }
  // a full set is stronger than a chestplate alone, and no slot piece out-scales the metal's own weapon/chest budget
  const base = R.newPlayer({ id: 'x', name: 'Setter', classId: 'warrior' }); base.level = 40; const a = rtStats(base);
  const P = R.newPlayer({ id: 'y', name: 'Setter2', classId: 'warrior' }); P.level = 40; for (const id of ['steel_helm', 'steel_chausses', 'steel_warboots', 'steel_signet']) { const g = R.addGear(P, { id, q: 0.8 }); R.equip(P, g.uid); } const b = rtStats(P);
  assert.ok(b.def > a.def && b.maxHp > a.maxHp && b.atk > a.atk, 'helmet, leggings, boots and a ring all add to your stats');
  const chest = ITEMS.steel_plate, helm = ITEMS.steel_greathelm; assert.ok(helm.def < chest.def * 0.35, 'a helmet is a fraction of a chestplate');
});

test('equipping goes to the right slot; old saves are brought up to date', () => {
  const { srv, S } = join(); const P = S.P; assert.deepEqual(Object.keys(P.equip).sort(), [...SLOTS].sort());
  const h = R.addGear(P, { id: 'iron_helm', q: 0.5 }), r = R.addGear(P, { id: 'iron_signet', q: 0.5 }), f = R.addGear(P, { id: 'iron_boots', q: 0.5 });
  srv.on_inv_equip(S, { uid: h.uid }); srv.on_inv_equip(S, { uid: r.uid }); srv.on_inv_equip(S, { uid: f.uid }); assert.equal(P.equip.head, h.uid); assert.equal(P.equip.ring, r.uid); assert.equal(P.equip.feet, f.uid);
  srv.on_inv_unequip(S, { slot: 'head' }); assert.equal(P.equip.head, null);
  // "equip best" fills every slot that has something
  const g2 = R.addGear(P, { id: 'sun_greaves', q: 0.9 }), g3 = R.addGear(P, { id: 'sun_cap', q: 0.9 }); srv.on_inv_best(S); assert.equal(P.equip.legs, g2.uid); assert.equal(P.equip.head, g3.uid);
  // an old record: 'armor' becomes the chestplate, the new slots appear
  const old = { equip: { weapon: 1, armor: 2, charm: null }, gear: [{ uid: 1, id: 'iron_sword', q: 0.5 }, { uid: 2, id: 'leather_coat', q: 0.5 }] }; R.normalizeGear(old);
  assert.equal(old.equip.chest, 2); assert.ok(!('armor' in old.equip)); for (const k of SLOTS) assert.ok(k in old.equip);
  const bad = { equip: { weapon: 2 }, gear: [{ uid: 2, id: 'leather_coat', q: 0.5 }] }; R.normalizeGear(bad); assert.equal(bad.equip.weapon, null, 'a piece in the wrong slot goes back to the bag');
});

test('players look like what they wear: the look string round-trips and changes with the armour', () => {
  const P = R.newPlayer({ id: 'l', name: 'Looker', classId: 'warrior' }); assert.equal(lookOf(P).split('|').length, 4);
  const empty = lookOf(P); for (const id of ['aether_greathelm', 'iron_wraps', 'steel_boots']) R.equip(P, R.addGear(P, { id, q: 0.5 }).uid);
  const lk = lookOf(P); assert.notEqual(lk, empty); const o = parseLook(lk); assert.deepEqual(o.head, { s: 'plate', t: 'aether' }); assert.equal(o.legs.s, 'robe'); assert.equal(o.feet.s, 'coat'); assert.ok(o.chest, 'the starter coat shows');
  assert.deepEqual(parseLook(''), {}); assert.deepEqual(parseLook('||x|'), {});
  const { srv, S, conn } = join(); R.equip(S.P, R.addGear(S.P, { id: 'iron_helm', q: 0.5 }).uid); srv.recalc(S); srv.broadcastSnaps(); const snap = conn.msgs.filter((m) => m.t === 'snap').at(-1); assert.ok(snap.players.find((p) => p.id === S.id).lk.includes('m0'), 'the snapshot carries the look');
});

test('every kind of gear has its own rune; the start and the end are never the same place; the polish step is short', () => {
  const keys = new Set(); for (const id of Object.keys(ITEMS).filter((k) => ITEMS[k].k === 'gear')) { const key = runeKey(id); assert.ok(RUNES[key], `${id} -> ${key}`); keys.add(key); }
  for (const k of ['sword', 'spear', 'mace', 'hammer', 'staff', 'wand', 'bow', 'rapier', 'pistol', 'head', 'chest', 'legs', 'feet', 'ring', 'charm']) assert.ok(keys.has(k), `a ${k} rune is used`);
  assert.equal(new Set([...keys].map((k) => JSON.stringify(RUNES[k].pts))).size, keys.size, 'no two kinds share a drawing');
  for (const [k, r] of Object.entries(RUNES)) { const a = r.pts[0], b = r.pts.at(-1); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.25, `${k}: start and end are apart`); for (const p of r.pts) assert.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1); }
  const spec = upgradeSpec(50, 60, new Rng(1), 'iron_hammer'); assert.equal(spec.rune.key, 'hammer'); assert.equal(spec.rune.name, 'Rune of the Forge'); assert.ok(spec.polish.need <= 10 && spec.polish.hi - spec.polish.lo >= 450, 'polish: few taps, wide window');
  assert.notDeepEqual(upgradeSpec(10, 60, new Rng(1), 'iron_hammer').rune.pts, upgradeSpec(10, 60, new Rng(1), 'iron_helm').rune.pts);
  assert.ok(runePoints('iron_ring', null).pts.length > 8 || runePoints('iron_sword', null).pts.length >= 5);
});

test('the perfect zone is exactly what the bar shows: full marks inside 35% of the zone width, centred', () => {
  const half = 0.1, c = 0.5; assert.equal(strikeScore(c, c, half), 1); assert.equal(strikeScore(c + half * 0.35, c, half), 1); assert.ok(strikeScore(c + half * 0.36, c, half) < 1);
  assert.ok(strikeScore(c + half, c, half) > 0.5 && strikeScore(c + half, c, half) < 0.9, 'the edge of the zone is a decent hit, not a perfect one');
});

test('swinging while you run never takes over your legs; standing still you still step into the blow', () => {
  const { srv, S, clock } = join(); S.cds = {}; S.dashLock = 0;
  S.moving = true; const x0 = S.x, y0 = S.y; srv.on_atk(S, { a: 0, tx: S.x + 3, ty: S.y }); assert.equal(S.x, x0); assert.equal(S.y, y0); assert.equal(S.dashLock, 0, 'no lockout while moving');
  clock.t += 2000; S.cds = {}; S.moving = false; S.combo = null; srv.on_atk(S, { a: 0, tx: S.x + 3, ty: S.y }); assert.ok(S.x > x0 || S.dashLock > 0, 'a standing swing still lunges');
});
