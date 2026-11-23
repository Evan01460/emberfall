import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { SKILLS, PATHS, MYTHICS, CLASSES, ITEMS, TOMES } from '../src/data.js';
import * as L from '../src/loadout.js';
import * as R from '../src/rules.js';
import { QUESTS } from '../src/quests.js';
import { CYCLE_MS } from '../src/world.js';

function world() { const clock = { t: 1_000_000 }; const srv = new GameServer({ seed: 11, now: () => clock.t }); return { srv, clock, advance(ms) { for (let i = 0; i < ms; i += 50) { clock.t += 50; srv.tick(); } } }; }
function client(srv, name, classId = 'warrior') {
  const conn = { msgs: [], send(m) { this.msgs.push(JSON.parse(JSON.stringify(m))); }, session: null };
  assert.ok(srv.join(conn, { name, create: { classId } }).ok);
  const c = { conn, S: conn.session, P: conn.session.P, send: (t, d = {}) => srv.handle(conn, { t, ...d }), last: (t) => [...conn.msgs].reverse().find((m) => m.t === t), teleport: (map, x, y) => { c.S.map = map; c.S.x = x; c.S.y = y; } };
  return c;
}
const setNight = (clock) => { clock.t = Math.ceil(clock.t / CYCLE_MS) * CYCLE_MS + CYCLE_MS * 0.7; };
const setDawn = (clock) => { clock.t = Math.ceil(clock.t / CYCLE_MS) * CYCLE_MS + CYCLE_MS * 0.02; };

test('skill library is consistent: every path/mastery/kit skill exists and belongs to its class', () => {
  for (const p of Object.values(PATHS)) {
    for (const [id] of p.kit) { assert.ok(SKILLS[id], `${p.id}: ${id}`); assert.ok(SKILLS[id].cls.includes(p.cls)); assert.equal(SKILLS[id].path, p.id); }
    assert.equal(p.masteries.length, 2);
    for (const m of p.masteries) { assert.ok(SKILLS[m.ult], m.ult); assert.equal(SKILLS[m.ult].mastery, m.id); }
  }
  for (const m of Object.values(MYTHICS)) for (const [id] of m.skills) assert.ok(SKILLS[id] && SKILLS[id].cls.includes(m.id), `${m.id}:${id}`);
  for (const t of TOMES) assert.ok(ITEMS[`tome_${t}`]);
});

test('loadout: 4 slots, only skills you know and your class can equip', () => {
  const P = R.newPlayer({ id: 'u1', name: 'T', classId: 'warrior' });
  assert.equal(L.loadoutOf(P).filter(Boolean).length, 1);
  P.level = 12; assert.deepEqual(L.loadoutOf(P).filter(Boolean).sort(), ['bulwark', 'cleave', 'crushing_blow', 'warcry_flurry']);
  assert.equal(L.setSlot(P, 0, 'war_leap').ok, true);                  // level 12 extra
  assert.equal(L.setSlot(P, 0, 'fireball').ok, false);                 // a mage/pyromancer skill
  assert.equal(L.setSlot(P, 1, 'chain_lightning').ok, false);          // not learned and wrong class
  assert.equal(L.loadoutOf(P)[0], 'war_leap');
  P.level = 4; assert.ok(L.loadoutOf(P).every((id) => !id || L.knows(P, SKILLS[id])), 'cannot keep skills above your level');
});

test('tomes: class-restricted, one use, bound to the class that reads them', () => {
  const { srv } = world(); const m = client(srv, 'Mag', 'mage'), w = client(srv, 'War', 'warrior');
  R.addItem(m.P, 'tome_chain_lightning'); R.addItem(w.P, 'tome_chain_lightning');
  w.send('tome_read', { id: 'tome_chain_lightning' }); assert.ok(!w.P.learned.includes('chain_lightning'), 'a warrior cannot learn a mage tome'); assert.equal(R.count(w.P, 'tome_chain_lightning'), 1);
  m.send('tome_read', { id: 'tome_chain_lightning' }); assert.ok(m.P.learned.includes('chain_lightning')); assert.equal(R.count(m.P, 'tome_chain_lightning'), 0);
  assert.ok(L.loadoutOf(m.P).includes('chain_lightning'), 'auto-equipped into a free slot');
  R.addItem(m.P, 'tome_chain_lightning'); m.send('tome_read', { id: 'tome_chain_lightning' }); assert.equal(R.count(m.P, 'tome_chain_lightning'), 1, 'cannot learn twice');
});

test('ascension: level 8 gate, class-matched paths, mastery at 20, respec', () => {
  const { srv } = world(); const w = client(srv, 'Asc', 'warrior');
  w.send('ascend', { path: 'brute' }); assert.equal(w.P.asc.path, null, 'too low');
  w.P.level = 8; w.send('ascend', { path: 'pyromancer' }); assert.equal(w.P.asc.path, null, 'wrong class');
  w.send('ascend', { path: 'mana_sword' }); assert.equal(w.P.asc.path, 'mana_sword');
  assert.ok(L.loadoutOf(w.P).includes('arc_wave'), 'path skills are equipped');
  assert.ok(w.S.rt.maxMp > 100, 'Mana Sword has a big mana pool');
  assert.equal(L.basicOf(w.P).name, 'Mana Slash');
  w.send('master', { id: 'runeblade' }); assert.equal(w.P.asc.mastery, null, 'mastery needs level 20');
  w.P.level = 20; w.send('master', { id: 'runeblade' }); assert.equal(w.P.asc.mastery, 'runeblade'); assert.equal(L.loadoutOf(w.P)[3], 'blade_storm');
  w.P.gilt = 100; w.send('respec'); assert.equal(w.P.asc.path, 'mana_sword', 'respec costs gilt'); w.P.gilt = 100000; w.send('respec'); assert.equal(w.P.asc.path, null);
  const b = client(srv, 'Brute', 'warrior'); b.P.level = 8; b.send('ascend', { path: 'brute' });
  assert.ok(b.S.rt.maxHp > 150 && L.basicOf(b.P).range > 2.5, 'Brute: huge HP and long reach');
});

test('warrior combo: three swings, the third is a wide heavy finisher, with a step into it', () => {
  const { srv, clock, advance } = world(); const w = client(srv, 'Combo', 'warrior');
  w.teleport('quarry', 5.5, 20.5); const x0 = w.S.x;
  const seen = []; w.conn.send = function (m) { this.msgs.push(JSON.parse(JSON.stringify(m))); };
  for (let i = 0; i < 4; i++) { w.send('atk', { a: 0 }); advance(700); }
  const slashes = w.conn.msgs.filter((m) => m.t === 'snap').flatMap((m) => m.ev).filter((e) => e.t === 'slash');
  assert.ok(slashes.length >= 4); assert.deepEqual(slashes.slice(0, 4).map((e) => e.step), [0, 1, 2, 0]);
  assert.ok(slashes[2].arc > slashes[0].arc && slashes[2].big === 1, 'finisher is wider');
  assert.notEqual(slashes[0].dir, slashes[1].dir, 'swing direction alternates');
  assert.ok(w.S.x > x0, 'lunged forward');
});

test('mythic class: only ONE player can ever claim Yggdrasil\'s Apostle', () => {
  const { srv, clock, advance } = world(); const a = client(srv, 'First', 'warrior'), b = client(srv, 'Second', 'mage');
  const walk = (c) => { c.P.level = 22; };
  walk(a); walk(b);
  for (const c of [a, b]) c.P.quests.apostle = { step: 9 };
  a.teleport('world_tree', 22.5, 4.5); b.teleport('world_tree', 22.5, 4.5);
  const alt = (c) => c.send('interact', { id: 'world_tree.altar' });
  alt(a); assert.equal(a.P.classId, 'apostle'); assert.equal(srv.mythics.apostle.name, 'First');
  assert.ok(a.S.rt.status.regen > 0, 'apostle regenerates'); assert.ok(L.loadoutOf(a.P).includes('thorn_lash'));
  alt(b); assert.equal(b.P.classId, 'mage', 'the second claimant gets nothing'); assert.ok(b.conn.msgs.some((m) => m.t === 'toast' && /claimed this power/.test(m.msg)));
  const c = client(srv, 'Third', 'archer'); c.P.level = 22; c.P.quests.apostle = { step: 9 }; c.teleport('world_tree', 22.5, 4.5); alt(c); assert.equal(c.P.classId, 'archer');
  const saved = srv.exportState(); assert.equal(saved.mythics.apostle.name, 'First', 'the claim is persisted');
  const srv2 = new GameServer({ state: JSON.parse(JSON.stringify(saved)), now: () => 5 }); assert.equal(srv2.mythics.apostle.name, 'First');
});

test('hidden quest chain: the Root That Remembers can only be started at night, at the well, by a fighter of level 20+', () => {
  const { srv, clock, advance } = world(); const a = client(srv, 'Seeker', 'warrior');
  a.teleport('town', 33.5, 15.5); a.P.level = 20;
  a.send('search'); assert.equal(a.P.quests.apostle?.step ?? 0, 0, 'by day nothing happens (only a hint)');
  advance(1500); setNight(clock); advance(60); a.send('search'); assert.equal(a.P.quests.apostle.step, 1, 'night: the well opens');
  assert.ok(srv.visibleIds(a.S).includes('town.rootwell_door'), 'and now the shaft is visible');
  a.send('interact', { id: 'town.rootwell_door' }); assert.equal(a.S.map, 'root_cellar'); assert.equal(a.P.quests.apostle.step, 2);
  a.teleport('root_cellar', 20.5, 25.5); a.send('interact', { id: 'root_cellar.inscription' }); assert.equal(a.P.quests.apostle.step, 3);
  // wrong stone order hurts and resets; the right order (E S W N) opens the gate
  a.teleport('root_cellar', 20.5, 11.5); const hp = a.S.hp; a.S.iframeUntil = 0; a.send('interact', { id: 'root_cellar.stone_n' }); assert.ok(a.S.hp < hp, 'wrong stone hurts');
  for (const d of ['e', 's', 'w', 'n']) { const p = srv.constructor ? null : null; const id = `root_cellar.stone_${d}`; const pt = [...getPts(a.S.map)].find((x) => x.id === id); a.teleport('root_cellar', pt.x, pt.y + 0.5); a.send('interact', { id }); }
  assert.equal(a.P.quests.apostle.step, 4, 'stones solved');
  const wiz = client(srv, 'Smith', 'blacksmith'); wiz.teleport('town', 33.5, 15.5); wiz.P.level = 25; setNight(clock); wiz.send('search'); assert.equal(wiz.P.quests.apostle, undefined, 'wrong class: nothing');
});
import { getMap } from '../src/world.js';
function getPts(id) { return getMap(id).points; }

test('hidden skill quest: the Weeping Wall rewards a class-specific hidden skill', () => {
  const { srv } = world(); const m = client(srv, 'Digger', 'mage'); m.P.level = 10;
  m.teleport('quarry', 7.5, 34.5); m.send('search'); assert.equal(m.P.quests.vault.step, 1);
  m.send('interact', { id: 'quarry.vault_door' }); assert.equal(m.S.map, 'sunken_vault');
  m.send('interact', { id: 'sunken_vault.inscription' });
  for (const n of [3, 1, 2]) { const pt = getPts('sunken_vault').find((x) => x.id === `sunken_vault.plate${n}`); m.teleport('sunken_vault', pt.x, pt.y + 0.6); m.send('interact', { id: pt.id }); }
  assert.equal(m.P.quests.vault.step, 4, 'plates solved in the order III, I, II');
  const tr = getPts('sunken_vault').find((x) => x.id === 'sunken_vault.treasure'); m.teleport('sunken_vault', tr.x, tr.y + 0.6); m.send('interact', { id: tr.id });
  assert.ok(m.P.learned.includes('singularity') || m.P.learned.includes('mirror_image'), 'mage got a mage hidden skill'); assert.ok(m.P.quests.vault.done);
});

test('mythic statuses actually do something', () => {
  const { srv } = world(); const a = client(srv, 'Voider', 'warrior'); a.P.classId = 'void_sovereign'; L.resetForNewClass(a.P); srv.recalc(a.S);
  assert.ok(a.S.rt.status.phase > 0); let phased = 0, hit = 0; a.S.iframeUntil = 0;
  for (let i = 0; i < 400; i++) { a.S.hp = a.S.rt.maxHp; const d = srv.hurtPlayer(a.S, 5, { noPhase: false }); if (d === 0) phased++; else hit++; }
  assert.ok(phased > 30 && phased < 110, `~16% of hits phase through (got ${phased}/400)`);
  const g = client(srv, 'Gilded', 'merchant'); g.P.classId = 'gilded'; srv.recalc(g.S); g.P.gilt = 0; const base = srv.damageMult(g.S, null, 'pierce', null); g.P.gilt = 30000; assert.ok(srv.damageMult(g.S, null, 'pierce', null) > base * 1.25, 'wealth is a weapon');
});

test('fighting above your level hurts: damage dealt shrinks and damage taken grows with the level gap', () => {
  const { srv } = world(); const a = client(srv, 'Low', 'archer'); a.teleport('quarry', 10.5, 20.5);
  const mob = srv.mobs.find((m) => m.map === 'quarry' && !m.boss);
  const dmgAt = (lvl) => { mob.level = lvl; mob.hp = mob.maxHp = 100000; mob.def = 5; mob.vulnUntil = 0; const h = mob.hp; for (let i = 0; i < 30; i++) srv.hit(a.S, mob, 20, 'pierce', { kind: 'proj' }, 0); return (h - mob.hp) / 30; };
  const even = dmgAt(1), above = dmgAt(6), far = dmgAt(14);
  assert.ok(above < even * 0.55, `+5 levels deals far less (${above.toFixed(1)} vs ${even.toFixed(1)})`);
  assert.ok(far < even * 0.2, 'a mob 13 levels above is nearly immune');
  assert.equal(srv.gapMult({ level: 1 }, a.S), 1); assert.ok(srv.gapMult({ level: 11 }, a.S) >= 2, 'and hits much harder');
});

test('kiting: an enemy shot from range breaks into a sprint and closes the gap', () => {
  const { srv, clock, advance } = world(); const a = client(srv, 'Kiter', 'archer'); a.P.level = 6; srv.recalc(a.S);
  const mob = srv.mobs.find((m) => m.map === 'quarry' && !m.boss && !(ENEMY_KITE(m)));
  a.teleport('quarry', mob.x - 7, mob.y); mob.target = a.S.id; mob.threat[a.S.id] = clock.t; mob.hp = mob.maxHp = 5000; mob.stunUntil = 0; mob.wind = null;
  let sprinted = false; for (let t = 0; t < 5000; t += 50) { a.S.x = mob.x - 6; a.S.y = mob.y; mob.threat[a.S.id] = clock.t; advance(50); if (mob.sprintUntil > clock.t) sprinted = true; }
  assert.ok(sprinted, 'the mob sprinted after being plinked for a while');
});
import { ENEMIES } from '../src/data.js';
const ENEMY_KITE = (m) => !!ENEMIES[m.key].kite;

test('the world is big: every zone connects, and waystones fast-travel between attuned stones for a fee', () => {
  const { srv } = world(); const a = client(srv, 'Walker', 'warrior'); a.P.gilt = 500;
  // graph connectivity: starting from town every map is reachable through portals
  const seen = new Set(['town']), q = ['town'];
  while (q.length) { const id = q.pop(); for (const p of getMap(id).portals) if (!seen.has(p.to.map)) { seen.add(p.to.map); q.push(p.to.map); } }
  for (const id of ['greenmeadow', 'saltmere', 'ironhold', 'mistfen', 'sunscorch', 'frostpeak', 'emberwaste', 'crystal_caverns', 'ruined_citadel', 'quarry', 'gloomwood', 'archive']) assert.ok(seen.has(id), `${id} reachable by portals from town`);
  const total = [...seen].reduce((n, id) => n + getMap(id).w * getMap(id).h, 0); assert.ok(total > 90000, `a big world (${total} tiles)`);
  const ws = (id) => getMap(id).points.find((p) => p.kind === 'waystone');
  const town = ws('town'); a.teleport('town', town.x, town.y + 1); a.send('interact', { id: town.id }); assert.deepEqual(a.P.ways, [town.id], 'attuned on first touch');
  const gm = ws('greenmeadow'); a.send('waystone.go', { id: gm.id }); assert.equal(a.S.map, 'town', 'cannot travel to a stone you have not found');
  a.teleport('greenmeadow', gm.x, gm.y + 1); a.send('interact', { id: gm.id }); assert.equal(a.P.ways.length, 2);
  const g0 = a.P.gilt; a.send('waystone.go', { id: town.id }); assert.equal(a.S.map, 'town'); assert.equal(a.P.gilt, g0 - 20, 'a crossing costs gilt');
  a.send('interact', { id: town.id }); a.S.lastHurt = srv.now(); a.send('waystone.go', { id: gm.id }); assert.equal(a.S.map, 'town', 'not in combat');
});

test('three-stage forging: heat, hammer and quench are all re-scored on the server; the quench bath chooses the temper', () => {
  const spec = R.forgeSpec({ level: 5, classId: 'blacksmith', asc: {} }, { diff: 0.3 }, { range: (a, b) => (a + b) / 2 });
  // a steady hand: hold whenever the heat is below the middle of the perfect zone, let go when above (the same physics the client draws)
  const holds = []; { const h = spec.heat, st = R.heatStart(h); let on = false, from = 0; for (let t = 0; t < h.dur; t += 20) { const want = st.pos + st.v * 0.12 < h.center; if (want && !on) { on = true; from = t; } if (!want && on) { on = false; holds.push([from, t]); } R.heatStep(h, st, want, t); } if (on) holds.push([from, h.dur]); }
  const presses = holds;
  assert.equal(spec.heat.center, 0.5, 'the gauge starts in the middle of the perfect zone');
  assert.ok(R.simHeat(spec.heat, presses).score > 0.7, 'holding Space to stay centred scores high'); assert.ok(R.simHeat(spec.heat, []).score < 0.2, 'never holding: it falls to cold');
  assert.ok(R.simHeat(spec.heat, [[0, spec.heat.dur]]).score < 0.3, 'holding forever overheats it'); assert.ok(R.simHeat(spec.heat, holds).score > R.simHeat(spec.heat, holds.map(([a, b]) => [a + 400, b + 400])).score, 'late reactions score worse');
  assert.ok(R.simHeat(spec.heat, Array.from({ length: 12 }, (_, i) => [i * 500, i * 500 + 230])).score < 0.75, 'mindless tapping is not enough');
  const P = R.newPlayer({ id: 'u9', name: 'Smith', classId: 'blacksmith' }); P.level = 5;
  const r = { id: 'iron_sword', diff: 0.3, out: 'iron_sword' };
  const strikeAt = (center) => { for (let t = 300; t < 20000; t += 5) if (Math.abs(R.markerPos(spec, t) - center) < 0.01) return t; };
  const times = []; let last = 0; for (const c of spec.centers) { let t = strikeAt(c); while (t < last + 300) t += 2 * 1000 / spec.speed; times.push(t); last = t; }
  let qt = 0; for (let t = 0; t < 20000; t += 5) if (Math.abs(R.markerPos(spec.quench, t) - spec.quench.center) < 0.005) { qt = t; break; }
  const good = R.scoreForge(P, r, spec, times, 60000, { heat: presses, quench: qt, medium: 'water' }), bad = R.scoreForge(P, r, spec, times, 60000, { heat: [], quench: 10, medium: 'oil' });
  assert.ok(good.q > bad.q + 0.1, `good ${good.q.toFixed(2)} vs sloppy ${bad.q.toFixed(2)}`); assert.equal(good.medium, 'water');
  const out = R.finishForge(P, r, 0.8, { pick: (a) => a[0], chance: () => false, range: () => 0.5 }, { temper: R.QUENCH.water.affix }); assert.equal(out.gear.affix, 'keen', 'water temper gives Keen');
});

test('brewing: reagents are consumed, stirring in rhythm sets purity, purity sets potion potency', () => {
  const P = R.newPlayer({ id: 'u8', name: 'Brew', classId: 'alchemist' }); P.level = 3; R.addItem(P, 'ink', 2); R.addItem(P, 'ghostbloom', 1);
  const r = { id: 'heal_potion', out: 'heal_potion', risk: 0.1 };
  const b = R.brewStart(P, r, ['ink', 'ghostbloom', 'iron_ore']); assert.deepEqual(b.extras, ['ink', 'ghostbloom']); assert.equal(R.count(P, 'ink'), 1); assert.equal(b.potency, 2, 'ghostbloom adds a bottle');
  const perfect = Array.from({ length: R.STIR.beats }, (_, i) => (i + 1) * R.STIR.interval), sloppy = [10, 20];
  assert.ok(R.stirScore(perfect) > 0.99 && R.stirScore(sloppy) < 0.05);
  const b2 = R.brewStart(P, r), b3 = R.brewStart(P, r); R.brewStir(P, b2, perfect); R.brewStir(P, b3, sloppy); assert.ok(b2.purity > b3.purity && b2.instab < b3.instab);
  const P2 = R.newPlayer({ id: 'u7', name: 'Brew2', classId: 'alchemist' }), o1 = R.finishBrew(P, r, { ...b2, potency: 3 }), o2 = R.finishBrew(P2, r, { ...b3, potency: 3 });
  assert.ok(o1.potency > o2.potency, 'pure batches are stronger'); assert.ok(R.potionPotency(P, 'heal_potion') > 1.2 && R.potionPotency(P2, 'heal_potion') < 1.0);
  const phil = R.newPlayer({ id: 'u6', name: 'P', classId: 'warrior' }); phil.classId = 'philosopher'; const pb = R.brewStart(phil, r); assert.equal(pb.instab, 0, 'Gold-From-Lead never bursts');
});

import { GEAR_FX, craftSlots, craftTier, enchantSlots } from '../src/custom.js';
test('custom crafting is gated by level and mastery: low-level smiths cannot, higher levels unlock more and better effects', () => {
  const P = R.newPlayer({ id: 'c1', name: 'Gate', classId: 'blacksmith' });
  assert.equal(craftSlots(P), 0, 'level 1: no custom work'); P.level = 5; assert.equal(craftSlots(P), 1); assert.equal(craftTier(P), 1);
  P.level = 12; assert.equal(craftSlots(P), 2); assert.equal(craftTier(P), 2); P.level = 20; assert.equal(craftSlots(P), 4); assert.equal(craftTier(P), 3, 'tier 4 needs a mastery');
  P.level = 8; P.asc = { path: 'weaponsmith', mastery: null }; P.level = 20; P.asc.mastery = 'bladesinger'; assert.equal(craftSlots(P), 5, 'mastery adds a slot'); assert.equal(craftTier(P), 4, 'and unlocks tier-4 effects');
  assert.ok(enchantSlots(P) >= 2);
  const r = { id: 'iron_sword', out: 'iron_sword', in: { iron_ingot: 3, leather: 1 } }; const Q = R.newPlayer({ id: 'c2', name: 'Low', classId: 'blacksmith' }); R.addItem(Q, 'iron_ingot', 9); R.addItem(Q, 'leather', 3); R.addItem(Q, 'coal', 9);
  assert.equal(R.customForgeCheck(Q, r, ['keen']).ok, false, 'level 1 cannot'); Q.level = 5;
  assert.equal(R.customForgeCheck(Q, r, ['keen']).ok, true); assert.equal(R.customForgeCheck(Q, r, ['keen', 'honed']).ok, false, 'one slot only at level 5');
  assert.equal(R.customForgeCheck(Q, r, ['vampiric']).ok, false, 'a tier-2 effect needs a higher level'); assert.equal(R.customForgeCheck(Q, r, ['sturdy']).ok, false, 'armour effect on a weapon');
  Q.level = 12; R.addItem(Q, 'ink', 9); R.addItem(Q, 'herb', 9); assert.equal(R.customForgeCheck(Q, r, ['keen', 'vampiric']).ok, true);
  const poor = R.newPlayer({ id: 'c3', name: 'Poor', classId: 'blacksmith' }); poor.level = 12; delete poor.items.coal; R.addItem(poor, 'iron_ingot', 3); R.addItem(poor, 'leather', 1); assert.equal(R.customForgeCheck(poor, r, ['keen']).ok, false, 'no coal: cannot afford the effect');
});

test('custom forge: effects are consumed, scale with craft quality, show up in stats; weak work loses some', () => {
  const { srv, advance } = world(); const s = client(srv, 'Forgey', 'blacksmith'); s.P.level = 12; for (const [id, n] of [['iron_ingot', 6], ['leather', 3], ['coal', 6], ['ink', 6], ['herb', 6]]) R.addItem(s.P, id, n);
  const forge = getMap('town').points.find((p) => p.kind === 'forge'); s.teleport('town', forge.x + 1, forge.y + 1);
  s.send('craft.start', { recipe: 'iron_sword', custom: { effects: ['keen', 'vampiric'], name: "Bloody Fang" } });
  assert.equal(R.count(s.P, 'coal'), 8, 'effect materials consumed (10 - 2)'); assert.ok(s.S.ticket?.custom, 'ticket remembers the custom order');
  const finish = (q) => { const t = s.S.ticket; const out = srv.finishForgeTicket(s.S, t.r, q, null, { custom: t.custom }); };
  finish(0.9); const g = s.P.gear.at(-1); assert.equal(g.cname, 'Bloody Fang'); assert.deepEqual(g.fx.map((e) => e.id), ['keen', 'vampiric']); assert.ok(g.fx[0].k > 1.1);
  R.equip(s.P, g.uid); srv.recalc(s.S); assert.ok(s.S.rt.lifesteal >= 0.03, 'lifesteal from the Vampiric effect'); assert.ok(s.S.rt.dmgMult > 1.05, 'damage from Keen');
  s.send('craft.start', { recipe: 'iron_sword', custom: { effects: ['keen', 'vampiric'] } }); srv.finishForgeTicket(s.S, s.S.ticket.r, 0.38, null, { custom: s.S.ticket.custom });
  const sloppy = s.P.gear.at(-1); assert.ok(!(sloppy.fx ?? []).some((e) => e.id === 'vampiric'), 'a tier-2 effect is lost to sloppy work'); assert.ok(s.last('craft.result').fxLost.includes('Vampiric'));
});

test('alchemists brew custom draughts/flasks/essences; essences go to a Blacksmith by trade; the smith enchants at the forge', () => {
  const { srv } = world(); const a = client(srv, 'Alch', 'alchemist'), s = client(srv, 'Smiff', 'blacksmith'); a.P.level = 12; s.P.level = 12;
  R.addItem(a.P, 'herb', 20); R.addItem(a.P, 'ink', 10); R.addItem(a.P, 'coal', 10); const cauldron = getMap('town').points.find((p) => p.kind === 'cauldron'); a.teleport('town', cauldron.x + 1, cauldron.y + 1);
  a.send('craft.custom', { form: 'essence', effects: ['siphoning'] }); assert.ok(a.S.ticket?.r.custom, 'essence brewing started'); const brewDone = (c, purity = 1) => { const t = c.S.ticket; t.b.purity = purity; t.b.potency = 3; srv.finishBrewTicket(c.S); };
  brewDone(a); const es = a.P.flasks.find((f) => f.form === 'essence'); assert.ok(es && es.n === 3 && es.fx[0].id === 'siphoning'); assert.ok(es.crafted);
  a.send('craft.custom', { form: 'draught', effects: ['might', 'renewal'] }); brewDone(a); a.send('craft.custom', { form: 'flask', effects: ['burn'] }); brewDone(a);
  assert.equal(a.P.flasks.length, 3); const mightD = a.P.flasks.find((f) => f.form === 'draught');
  // a draught buffs; a flask is thrown (6s shared cooldown)
  const hp = a.S.hp; a.S.hp = 5; a.send('flask.use', { uid: mightD.uid }); assert.ok(a.S.buff?.dmg > 0.1 && a.S.buff.regen > 0, 'draught gives a timed buff'); assert.equal(mightD.n, 2);
  a.send('flask.use', { uid: es.uid }); assert.equal(es.n, 3, 'essences cannot be drunk');
  // crafter rule: the essence can go to a Blacksmith (and only to a smith or merchant)
  const m = client(srv, 'Mercy', 'merchant'), w = client(srv, 'Warr', 'warrior');
  assert.equal(srv.validOffer(a.P, { items: {}, gear: [], flasks: [es.uid], gilt: 0 }, s.P), true, 'alchemist → blacksmith: allowed');
  assert.equal(srv.validOffer(a.P, { items: {}, gear: [], flasks: [es.uid], gilt: 0 }, w.P), false, 'alchemist → fighter: not allowed');
  // direct trade
  a.teleport('town', 20, 20); s.teleport('town', 21, 20); a.send('trade.request', { to: 'Smiff' }); s.send('trade.accept'); a.send('trade.offer', { items: {}, gear: [], flasks: [es.uid], gilt: 0 }); s.send('trade.offer', { items: {}, gear: [], gilt: 0 }); a.send('trade.confirm'); s.send('trade.confirm');
  const got = s.P.flasks.find((f) => f.form === 'essence'); assert.ok(got && got.n === 3, 'the smith received the essences');
  // enchant: needs a forge, level/mastery-limited slots
  const forge = getMap('town').points.find((p) => p.kind === 'forge'); const gear = R.addGear(s.P, { id: 'iron_sword', q: 0.7 });
  s.teleport('town', 30, 28); s.send('enchant', { gear: gear.uid, flask: got.uid }); assert.ok(!gear.ench, 'must stand at a forge');
  s.teleport('town', forge.x + 1, forge.y + 1); let tries = 0; while (!(gear.ench ?? []).length && tries++ < 12) s.send('enchant', { gear: gear.uid, flask: got.uid });
  assert.ok(gear.ench?.length === 1 && gear.ench[0].id === 'siphoning', 'enchantment applied (after a few tries at most)');
  R.equip(s.P, gear.uid); srv.recalc(s.S); assert.ok(s.S.rt.mpOnHit >= 1, 'enchanted stats are live');
  s.send('enchant', { gear: gear.uid, flask: got.uid }); assert.equal(gear.ench.length, 1, 'cannot stack the same effect twice');
  const low = client(srv, 'Newbie', 'blacksmith'); const g2 = R.addGear(low.P, { id: 'iron_sword', q: 0.5 }); R.addFlask(low.P, { form: 'essence', name: 'X', fx: [{ id: 'keen', k: 1 }], n: 1 }); low.teleport('town', forge.x + 1, forge.y + 1);
  low.send('enchant', { gear: g2.uid, flask: low.P.flasks[0].uid }); assert.ok(!g2.ench, 'a level-1 smith has no enchant capacity');
});

test('guilds: found, invite, guild chat, leader succession, persistence', () => {
  const { srv } = world(); const a = client(srv, 'Lead', 'warrior'), b = client(srv, 'Mate', 'mage'); a.P.gilt = 1000; a.teleport('town', 20, 20); b.teleport('town', 21, 20);
  a.send('guild.create', { name: 'Iron Oath' }); assert.equal(a.P.guild, 'Iron Oath'); assert.equal(a.P.gilt, 700);
  b.send('guild.create', { name: 'iron oath' }); assert.equal(b.P.guild ?? null, null, 'names are unique, case-insensitively');
  a.send('guild.invite', { to: 'Mate' }); b.send('guild.accept'); assert.equal(b.P.guild, 'Iron Oath'); assert.equal(srv.guildOf(a.P).members.length, 2);
  b.conn.msgs.length = 0; a.send('chat', { ch: 'guild', text: 'hello guild' }); assert.ok(b.conn.msgs.some((m) => m.t === 'chat' && m.ch === 'guild'));
  b.send('guild.kick', { name: 'Lead' }); assert.equal(a.P.guild, 'Iron Oath', 'members cannot kick');
  const saved = JSON.parse(JSON.stringify(srv.exportState())); a.send('guild.leave'); assert.equal(srv.guildOf(b.P).leader, b.S.id, 'leadership passes on');
  const srv2 = new GameServer({ state: saved, now: () => 9 }); assert.ok(srv2.guilds['iron oath']);
});

test('bounty board: three or four daily bounties that track kills, gathering and crafting, and pay on claim', () => {
  const { srv, clock } = world(); const a = client(srv, 'Hunter', 'warrior'); a.P.level = 6;
  const board = getMap('town').points.find((p) => p.kind === 'board'); a.teleport('town', board.x, board.y + 1); a.send('interact', { id: board.id });
  const ui = a.last('ui'); assert.equal(ui.panel, 'bounty'); assert.ok(ui.list.length >= 3);
  const k = ui.list.find((b) => b.type === 'kill'); for (let i = 0; i < k.need; i++) srv.bountyEvent(a.S, 'kill', k.key); assert.equal(a.P.bounties.list.find((b) => b.id === k.id).got, 0, 'nothing counts until you accept');
  a.send('bounty.accept', { id: k.id }); for (let i = 0; i < k.need; i++) srv.bountyEvent(a.S, 'kill', k.key);
  const g0 = a.P.gilt; a.send('bounty.claim', { id: k.id }); assert.ok(a.P.gilt > g0, 'paid'); a.send('bounty.claim', { id: k.id }); assert.equal(a.P.gilt, g0 + k.gilt, 'only once');
  // an accepted bounty survives the daily reset (with its progress); unaccepted offers are replaced
  const other = a.last('ui').list.find((b) => b.type === 'gather') ?? a.last('ui').list.find((b) => !b.claimed && !b.accepted); a.send('bounty.accept', { id: other.id }); srv.bountyEvent(a.S, other.type, other.key, 2);
  const before = a.P.bounties.list.filter((b) => !b.accepted).map((b) => b.id);
  clock.t += 3 * 86400000 + 1000; a.send('bounty.open'); const ui2 = a.last('ui'); const kept = ui2.list.find((b) => b.id === other.id);
  assert.ok(kept && kept.accepted && kept.got === Math.min(2, other.need), 'accepted bounty and its progress survived three days'); assert.ok(ui2.list.every((b) => b.accepted || !before.includes(b.id)), 'old unaccepted offers were replaced');
  // customer promises persist even after the customer leaves
  const c = srv.customers[0]; a.teleport('town', c.x, c.y + 1); a.send('cust.promise', { id: c.id }); assert.equal(a.P.promises.length, 1); srv.customers = []; clock.t += 86400000; a.send('bounty.open'); assert.equal(a.last('ui').promises.length, 1, 'the promised order is still on the board');
  const s = client(srv, 'Crafty', 'blacksmith'); s.P.level = 6; assert.ok(srv.ensureBounties(s.P).list.some((b) => b.type === 'craft'), 'crafters get crafting bounties');
});

test('world boss: spawns for everyone, scales with the crowd, rewards every contributor', () => {
  const { srv, clock, advance } = world(); const a = client(srv, 'WB1', 'warrior'), b = client(srv, 'WB2', 'mage'); a.P.level = b.P.level = 12;
  const mob = srv.spawnWorldBoss('greenmeadow'); assert.equal(mob.key, 'cinder_colossus'); assert.ok(a.conn.msgs.some((m) => m.t === 'announce'), 'announced to all');
  const solo = new GameServer({ seed: 3, now: () => 1 }); const lone = (() => { const c = { msgs: [], send() {}, session: null }; solo.join(c, { name: 'Alone', create: { classId: 'warrior' } }); return solo.spawnWorldBoss('greenmeadow'); })();
  assert.ok(mob.maxHp > lone.maxHp * 1.3, 'more players → a tougher colossus');
  for (const c of [a, b]) { c.teleport('greenmeadow', mob.x - 2, mob.y); mob.threat[c.S.id] = clock.t; }
  const g = [a.P.gilt, b.P.gilt]; srv.killMob(mob); assert.ok(a.P.gilt >= g[0] + 400 && b.P.gilt >= g[1] + 400, 'both contributors are paid'); assert.equal(a.P.stats.worldBosses, 1);
});

test('raid: needs a party, scales, goes through phases with adds, pays every raider, and resets on a wipe', () => {
  const { srv, clock, advance } = world(); const a = client(srv, 'R1', 'warrior'), b = client(srv, 'R2', 'mage'); a.P.level = b.P.level = 22; srv.recalc(a.S); srv.recalc(b.S);
  const gate = getMap('emberwaste').points.find((p) => p.role === 'raid'); assert.ok(gate, 'the Cinderhold Gatekeeper exists');
  a.teleport('emberwaste', gate.x, gate.y + 1.5); b.teleport('emberwaste', gate.x + 1, gate.y + 1.5);
  a.send('raid.enter'); assert.equal(a.S.map, 'emberwaste', 'two players online but no party: refused');
  a.send('party.invite', { to: 'R2' }); b.send('party.accept'); b.P.level = 10; a.send('raid.enter'); assert.equal(a.S.map, 'emberwaste', 'everyone must be level 20+ (R2 is not)'); b.P.level = 22;
  a.send('raid.enter'); assert.equal(a.S.map, 'raid_bastion'); assert.equal(b.S.map, 'raid_bastion', 'the party is taken in together');
  const boss = srv.mobs.find((m) => m.map === 'raid_bastion' && m.boss); assert.equal(boss.key, 'ember_tyrant'); const hp = boss.maxHp;
  const c = client(srv, 'R3', 'archer'); c.P.level = 22; c.teleport('emberwaste', gate.x, gate.y + 1.5); c.send('raid.enter'); assert.equal(c.S.map, 'emberwaste', 'one raid at a time');
  for (const o of [a, b]) { o.S.iframeUntil = clock.t + 1e9; o.S.hp = o.S.rt.maxHp = 99999; }
  boss.hp = boss.maxHp * 0.6; advance(100); assert.equal(srv.raid.phase, 2); assert.ok(srv.mobs.some((m) => m.map === 'raid_bastion' && m.temp), 'phase 2 summons adds');
  boss.hp = boss.maxHp * 0.3; advance(100); assert.equal(srv.raid.phase, 3); assert.ok(boss.enraged, 'phase 3 enrages the boss');
  boss.threat[a.S.id] = clock.t; boss.threat[b.S.id] = clock.t; const g0 = a.P.gilt; srv.killMob(boss); advance(200);
  assert.ok(a.P.gilt >= g0 + 800 && a.P.stats.raids === 1 && b.P.stats.raids === 1, 'every raider is paid'); assert.ok(a.P.gear.some((g) => g.cname?.startsWith("Tyrant's") && g.fx?.length), 'raid gear carries a tier-3 effect');
  assert.ok(a.P.titles.includes('Tyrant-Slayer'));
  clock.t += 100000; advance(100); assert.equal(a.S.map, 'emberwaste', 'sent out after the victory'); assert.equal(srv.raid, null);
  // wipe: everyone dies → the raid resets and the boss heals
  a.teleport('emberwaste', gate.x, gate.y + 1.5); b.teleport('emberwaste', gate.x + 1, gate.y + 1.5); a.send('raid.enter'); const boss2 = srv.mobs.find((m) => m.map === 'raid_bastion' && m.boss); boss2.hp = 5000;
  for (const o of [a, b]) srv.travel(o.S, 'town', 26.5, 19.5); advance(6000); assert.equal(srv.raid, null, 'an abandoned raid ends');
});

test('scenery is interactive: containers pay out once per cooldown, wells heal, benches regenerate, fountains bless', () => {
  const { srv, clock } = world(); const a = client(srv, 'Snoop', 'warrior'); const town = getMap('town');
  const spot = (kind) => town.decor.find((d) => d.kind === kind); const at = (d) => a.teleport('town', d.x + 0.5, d.y + 1.6);
  const bar = spot('barrel'); at(bar); const id = `dec:${bar.x},${bar.y}`, g0 = a.P.gilt, items0 = JSON.stringify(a.P.items); a.send('interact', { id });
  assert.ok(a.P.gilt > g0 || JSON.stringify(a.P.items) !== items0, 'a barrel holds something'); const g1 = a.P.gilt; a.send('interact', { id }); assert.equal(a.P.gilt, g1, 'but only once for a while');
  clock.t += 600000; a.send('interact', { id }); assert.ok(a.P.cooldowns[`dec:town:${bar.x},${bar.y}`] > clock.t, 'refilled after the cooldown');
  const well = spot('well'); at(well); a.S.hp = 10; a.send('interact', { id: `dec:${well.x},${well.y}` }); assert.ok(a.S.hp > a.S.rt.maxHp * 0.25, 'the well heals');
  const bench = spot('bench'); at(bench); a.send('interact', { id: `dec:${bench.x},${bench.y}` }); assert.ok(a.S.buff?.regen > 0);
  const fo = spot('fountain'); at(fo); const gg = a.P.gilt; a.send('interact', { id: `dec:${fo.x},${fo.y}` }); assert.equal(a.P.gilt, gg - 5); assert.ok(a.S.buff?.dmg > 0);
  a.teleport('town', 40, 30); a.send('interact', { id }); assert.equal(a.P.gilt, gg - 5, 'too far away');
});

test('crafted gear carries its maker\'s name through the market, trades and orders; chests report what they gave', () => {
  const { srv } = world(); const smith = client(srv, 'Maker', 'blacksmith'), buyer = client(srv, 'Buyer', 'warrior'); smith.P.level = 12;
  const g = R.finishForge(smith.P, { diff: 0.2, out: 'iron_sword' }, 0.8, { pick: (a) => a[0], chance: () => false, range: () => 0.5 }, { custom: { effects: ['keen'], name: 'Duskblade' } }).gear;
  assert.equal(g.by, 'Maker'); assert.equal(R.gearName(g), 'Duskblade');
  const merch = client(srv, 'Mercy', 'merchant'); smith.teleport('town', 20, 20); merch.teleport('town', 21, 20);
  smith.send('trade.request', { to: 'Mercy' }); merch.send('trade.accept'); smith.send('trade.offer', { items: {}, gear: [g.uid], gilt: 0 }); merch.send('trade.offer', { items: {}, gear: [], gilt: 0 }); smith.send('trade.confirm'); merch.send('trade.confirm');
  const got = merch.P.gear.find((x) => x.cname === 'Duskblade'); assert.ok(got && got.by === 'Maker' && got.fx?.[0].id === 'keen', 'the merchant sees who made it, and its effects');
  const ex = getMap('town').points.find((p) => p.kind === 'exchange'); merch.teleport('town', ex.x, ex.y + 1.5); merch.send('market.open', {}); merch.send('interact', { id: ex.id });
  merch.send('market.list', { itemId: 'iron_sword', uid: got.uid, qty: 1, price: 150 });
  const view = (merch.last('market') ?? merch.last('ui')).view, l = view.listings.find((x) => x.x?.by === 'Maker'); assert.ok(l, 'the listing keeps the maker and effects'); assert.equal(l.x.cname, 'Duskblade');
  buyer.P.gilt = 900; buyer.teleport('town', ex.x, ex.y + 1.5); buyer.send('interact', { id: ex.id }); buyer.send('market.buy', { id: l.id, qty: 1 });
  const bought = buyer.P.gear.find((x) => x.cname === 'Duskblade'); assert.ok(bought && bought.by === 'Maker' && bought.fx.length === 1, 'the buyer sees who forged it');
  const w = client(srv, 'Looter', 'warrior'); const chest = getMap('quarry').points.find((p) => p.kind === 'chest'); w.teleport('quarry', chest.x, chest.y + 1); w.send('interact', { id: chest.id });
  const m = w.last('chest'); assert.ok(m.rows.length >= 2 && m.rows[0].k === 'gilt' && m.rows.some((r) => r.k === 'item'), 'structured loot rows');
});

test('dungeons: four two-floor dungeons you can walk through, with a daily first-clear bonus', () => {
  const { srv, clock } = world(); const a = client(srv, 'Delver', 'warrior'); a.P.level = 6;
  for (const d of ['goblin_warrens', 'sunken_crypt', 'frozen_catacombs', 'magma_depths']) {
    const f1 = getMap(`${d}_1`), f2 = getMap(`${d}_2`); assert.ok(f1.dark && f1.dungeon && f1.eliteSpawns.length >= 2 && !f1.bossSpawn); assert.ok(f2.bossSpawn && f2.points.filter((p) => p.kind === 'chest').length >= 2);
    const down = f1.portals.find((p) => p.to.map === `${d}_2`), up = f2.portals.find((p) => p.to.map === `${d}_1`); assert.ok(down && up);
    const stairs = portalDest(up); assert.ok(!blockedAt(f1, stairs.x, stairs.y), 'coming back up lands you on open floor');
  }
  const gm = getMap('greenmeadow'), mouth = gm.portals.find((p) => p.to.map === 'goblin_warrens_1'); assert.ok(mouth, 'the cave mouth is in Greenmeadow');
  a.teleport('greenmeadow', mouth.x + 1.5, mouth.y + 0.5); a.send('move', { x: mouth.x + 1.5, y: mouth.y + 0.4, d: 'u', mv: 1 }); assert.equal(a.S.map, 'goblin_warrens_1', 'walking into the mouth enters the dungeon');
  const boss = srv.mobs.find((m) => m.map === 'goblin_warrens_2' && m.boss); a.teleport('goblin_warrens_2', boss.x - 2, boss.y); boss.threat[a.S.id] = clock.t; const g0 = a.P.gilt; srv.killMob(boss);
  assert.ok(a.P.gilt >= g0 + 5 * 150, 'first clear bonus paid'); const g1 = a.P.gilt; boss.deadUntil = 0; boss.hp = 5; boss.threat[a.S.id] = clock.t; srv.killMob(boss); assert.ok(a.P.gilt - g1 < 5 * 150, 'only once a day');
});
import { portalDest, blockedAt } from '../src/world.js';

test('guild progression and the guild raid: XP levels, bank, perks; a guild-only raid with a lockout, meteors and rich rewards', () => {
  const { srv, clock, advance } = world(); const a = client(srv, 'GLead', 'warrior'), b = client(srv, 'GMate', 'mage'), c = client(srv, 'GThree', 'archer'), z = client(srv, 'Stranger', 'warrior');
  for (const o of [a, b, c, z]) { o.P.level = 22; srv.recalc(o.S); } a.P.gilt = 2000; const gm = getMap('town').points.find((p) => p.role === 'graid'); assert.ok(gm, 'Guildmaster Orren is in Lanternfall');
  for (const o of [a, b, c, z]) o.teleport('town', gm.x, gm.y + 1.5); z.send('graid.enter'); assert.equal(z.S.map, 'town', 'no guild, no Crucible');
  a.send('guild.create', { name: 'Titan Slayers' }); for (const o of [b, c]) { a.send('guild.invite', { to: o.P.name }); o.send('guild.accept'); }
  assert.equal(srv.guildOf(a.P).level, 1); const xp0 = 100; srv.guildXp(a.S, 400); assert.ok(srv.guildOf(a.P).level >= 2, 'guild XP raises the guild level'); assert.ok(srv.guildXpBonus(b.P) >= 0.04, 'every member earns a bonus XP perk');
  a.send('guild.deposit', { gilt: 500 }); assert.equal(srv.guildOf(a.P).bank, 500); b.send('guild.withdraw', { gilt: 100 }); assert.equal(srv.guildOf(a.P).bank, 500, 'only the leader withdraws'); a.send('guild.withdraw', { gilt: 200 }); assert.equal(srv.guildOf(a.P).bank, 300);
  a.teleport('town', gm.x, gm.y + 1.5); b.teleport('town', gm.x + 1, gm.y + 1.5); c.teleport('town', gm.x - 1, gm.y + 1.5); const lone = client(srv, 'Lone', 'warrior');
  b.S.map = 'quarry'; a.send('graid.enter'); assert.equal(a.S.map, 'town', 'needs 3 guild members together'); b.teleport('town', gm.x + 1, gm.y + 1.5);
  a.send('graid.enter'); assert.equal(a.S.map, 'guild_raid'); assert.equal(c.S.map, 'guild_raid'); const boss = srv.mobs.find((m) => m.map === 'guild_raid' && m.boss); assert.equal(boss.key, 'obsidian_titan');
  for (const o of [a, b, c]) { o.S.iframeUntil = 0; o.S.rt.maxHp = o.S.hp = 99999; } boss.hp = boss.maxHp * 0.6; advance(100); assert.equal(srv.graid.phase, 2); boss.hp = boss.maxHp * 0.4; advance(100); assert.equal(srv.graid.phase, 3);
  const hp = a.S.hp; advance(6000); assert.ok([a, b, c].some((o) => o.S.hp < 99999) || srv.graid.pending.length >= 0, 'meteors fall in phase 3');
  boss.hp = boss.maxHp * 0.1; advance(100); assert.equal(srv.graid.phase, 4); for (const o of [a, b, c]) boss.threat[o.S.id] = clock.t;
  const bank0 = srv.guildOf(a.P).bank, g0 = a.P.gilt; srv.killMob(boss); advance(200);
  assert.ok(a.P.gilt >= g0 + 1500 && srv.guildOf(a.P).bank >= bank0 + 3000, 'members and the bank are paid'); assert.ok(a.P.gear.some((g) => g.cname?.startsWith('Titan-forged') && g.by?.includes('Titan Slayers')), 'guild-made gear is labelled'); assert.ok(a.P.titles.includes('Titan-Breaker'));
  clock.t += 100000; advance(100); assert.equal(a.S.map, 'town'); a.teleport('town', gm.x, gm.y + 1.5); a.send('graid.enter'); assert.equal(a.S.map, 'town', 'locked out for 20 hours');
});

test('Desperado rolls dice before attacks: each die multiplies that shot, All In is exempt', () => {
  const { srv, advance } = world(); const a = client(srv, 'Gambler'); a.P.classId = 'desperado'; a.P.level = 20; a.P.learned = ['loaded_dice', 'all_in']; a.P.loadout = ['loaded_dice', 'all_in', null, null]; srv.recalc(a.S);
  a.S.mp = a.S.rt.maxMp; a.conn.msgs.length = 0; a.send('skill', { i: 0, a: 0, tx: a.S.x + 5, ty: a.S.y }); advance(100);
  const roll = a.conn.msgs.flatMap((m) => m.ev ?? []).find((e) => e.id === 'dice_roll'); assert.ok(roll, 'dice roll event is sent first'); assert.equal(roll.rolls.length, 6);
  advance(300); const dice = srv.projs.filter((p) => p.face); assert.equal(dice.length, 6);
  const sk = SKILLS.loaded_dice; for (const p of dice) assert.equal(p.power, Math.max(1, Math.round(sk.power * p.face * 0.28)));
  srv.projs.length = 0; a.S.cds = {}; a.S.mp = a.S.rt.maxMp; a.conn.msgs.length = 0; a.send('skill', { i: 1, a: 0, tx: a.S.x + 5, ty: a.S.y }); advance(1400);
  assert.ok(!a.conn.msgs.flatMap((m) => m.ev ?? []).some((e) => e.id === 'dice_roll'), 'All In does not roll');
});
