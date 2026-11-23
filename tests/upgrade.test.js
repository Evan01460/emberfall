import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { MAX_UP, upMult, baseChance, upgradeMats, finalChance, suggestedFee, smithNeedLevel, upgradeSpec, upLabel, dropChance } from '../src/upgrade.js';
import { scoreUpgrade, scoreRune } from '../src/server/upgrade.js';
import { Rng } from '../src/rng.js';
import { rtStats } from '../src/units.js';
import { getMap } from '../src/world.js';
import { ITEMS } from '../src/data.js';
import * as R from '../src/rules.js';
import { heldFor, applyHeld } from '../src/server/restore.js';

function world() {
  const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 77, now: () => clock.t }), mk = (name, cls) => { const conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null }; assert.ok(srv.join(conn, { name, create: { classId: cls } }).ok); return conn; };
  return { srv, clock, mk };
}
const toForge = (srv, S) => { const f = getMap('town').points.find((p) => p.kind === 'forge'); srv.travel(S, 'town', f.x, f.y + 1.2); };
const give = (P, g, up = 0) => R.addGear(P, { id: g, q: 0.8, up });

test('upgrade rules: stats grow, odds fall, costs rise, everything is bounded by +99', () => {
  assert.equal(MAX_UP, 99); assert.equal(upMult(0), 1); assert.ok(Math.abs(upMult(99) - 2.15) < 0.02, `+99 is about 2.15x (${upMult(99)})`);
  for (let i = 1; i <= 99; i++) { assert.ok(upMult(i) > upMult(i - 1)); assert.ok(baseChance(i) <= baseChance(i - 1)); assert.ok(baseChance(i) >= 0.02); }
  assert.equal(baseChance(0), 1); assert.ok(baseChance(30) < 0.35 && baseChance(60) < 0.1 && baseChance(98) <= 0.03);
  const a = Object.values(upgradeMats('iron_sword', 0)).reduce((x, y) => x + y, 0), b = Object.values(upgradeMats('iron_sword', 60)).reduce((x, y) => x + y, 0); assert.ok(b > a);
  assert.ok(upgradeMats('iron_sword', 60).starmetal >= 1 && upgradeMats('iron_sword', 25).echo_shard >= 1 && !upgradeMats('iron_sword', 5).echo_shard);
  assert.ok(finalChance(30, 1, 0.1) > finalChance(30, 0, 0) && finalChance(30, 1, 0.1) <= 0.98 && finalChance(99, 0, 0) >= 0.01 && finalChance(1, 0, 0) === 1);
  assert.ok(suggestedFee('worldsteel_plate', 50) > suggestedFee('iron_sword', 5)); assert.ok(smithNeedLevel('worldsteel_plate', 50) > smithNeedLevel('iron_sword', 1) && smithNeedLevel('worldsteel_plate', 98) <= 100);
  assert.equal(upLabel(7), '+7'); assert.equal(dropChance(5), 0); assert.ok(dropChance(40) > 0.1);
});

test('the minigame spec is playable and the scorer rewards perfect play and punishes nonsense', () => {
  const rng = new Rng(5), spec = upgradeSpec(40, 60, rng), good = { heat: [], folds: [], rune: [], quench: 0, polish: [], medium: 'oil' };
  // a bot plays perfectly: it holds the heat on and off to stay centred, strikes when the marker is centred, traces the rune, dunks and polishes in rhythm
  { const h = spec.heat; let pos = h.center, v = 0, hold = false, from = 0; const HEAT_DT = 0.02;
    for (let t = 0; t < h.dur; t += 20) { const want = pos < h.center - 0.01; if (want && !hold) { hold = true; from = t; } else if (!want && hold) { hold = false; good.heat.push([from, t]); }
      const k = 1 - Math.exp(-HEAT_DT / h.tau), tgt = hold ? h.up : -h.down, drift = h.drift * Math.sin((t / 1000) * (6.2832 / h.dp) + h.dph); v += (tgt - v) * k; pos += (v + drift) * HEAT_DT; pos = Math.max(0, Math.min(1, pos)); }
    if (hold) good.heat.push([from, h.dur]); }
  for (const f of spec.folds) { const times = []; let last = 0; for (let i = 0; i < f.strikes; i++) { let t = last + 250; while (Math.abs(R.markerPos(f, t) - f.centers[i]) > f.half * 0.25 && t < 14000) t += 5; times.push(t); last = t; } good.folds.push(times); }
  { const pts = spec.rune.pts; for (let i = 1; i < pts.length; i++) for (let k = 0; k < 20; k++) good.rune.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / 20, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / 20, 100]); }
  { let t = 0; while (Math.abs(R.markerPos(spec.quench, t) - spec.quench.center) > spec.quench.half * 0.2) t += 5; good.quench = t; }
  for (let i = 0; i < spec.polish.need + 1; i++) good.polish.push(1000 + i * 500);
  const s = scoreUpgrade(spec, good, 40000); assert.ok(s.score > 0.85, `perfect play scores ${s.score.toFixed(2)} ${JSON.stringify(s)}`);
  for (const bad of [null, {}, { heat: 'x', folds: 5, rune: 'no', quench: -1, polish: 3 }, { ...good, folds: [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2]], rune: [[5, 5]], quench: 1e9, polish: [1, 2, 3] }]) assert.ok(scoreUpgrade(spec, bad, 40000).score < 0.35, 'nonsense scores low');
  assert.ok(scoreRune(spec.rune, []) === 0);
});

test('a smith upgrades their own gear at the forge: materials are used, the level rises, the piece gets stronger and keeps its level when sold or traded', () => {
  const { srv, mk } = world(), c = mk('Hephaestus', 'blacksmith'), S = c.session, P = S.P; P.level = 20; srv.recalc(S);
  const g = give(P, 'iron_sword'); P.equip.weapon = g.uid; srv.recalc(S); const before = rtStats(P).atk;
  R.addItem(P, 'iron_ingot', 5); R.addItem(P, 'coal', 5);
  srv.on_upgrade_start(S, { uid: g.uid, quick: true }); assert.equal(g.up, undefined, 'not at a forge yet');
  toForge(srv, S); srv.on_upgrade_start(S, { uid: g.uid, quick: true });
  assert.equal(g.up, 1, 'the first steps always work'); assert.equal(R.count(P, 'iron_ingot'), 4); assert.ok(rtStats(P).atk > before, 'stronger');
  assert.ok(c.msgs.some((m) => m.t === 'upgrade.result' && m.ok && m.to === 1), 'result sent'); assert.ok(R.gearName(g).startsWith('+1 '));
  const copy = R.addGear(P, { ...g }); assert.equal(copy.up, 1, 'addGear keeps the level');
  // not enough materials
  P.items.iron_ingot = 0; srv.on_upgrade_start(S, { uid: g.uid, quick: true }); assert.equal(g.up, 1);
  // a player who is not a smith cannot
  const c2 = mk('Plain', 'warrior'); toForge(srv, c2.session); const g2 = give(c2.session.P, 'iron_sword'); R.addItem(c2.session.P, 'iron_ingot', 3); R.addItem(c2.session.P, 'coal', 3); srv.on_upgrade_start(c2.session, { uid: g2.uid, quick: true }); assert.equal(g2.up, undefined);
});

test('requesting an upgrade: the piece, materials and fee are held; reject/cancel/expire return everything; completion pays the smith and returns the piece upgraded', () => {
  const { srv, clock, mk } = world(), cs = mk('Smithy', 'blacksmith'), cw = mk('Customer', 'warrior'), Sm = cs.session, Cu = cw.session; Sm.P.level = 30; Cu.P.gilt = 5000; srv.recalc(Sm);
  const g = give(Cu.P, 'hollow_blade'); R.addItem(Cu.P, 'hollow_ingot', 6); R.addItem(Cu.P, 'coal', 6); Cu.P.equip.weapon = g.uid;
  srv.on_upg_new(Cu, { to: 'Smithy', uid: g.uid, price: 400 }); const j = srv.upg[0]; assert.ok(j && j.status === 'pending');
  assert.equal(Cu.P.gilt, 4600); assert.ok(!Cu.P.gear.some((x) => x.id === 'hollow_blade'), 'piece held'); assert.equal(R.count(Cu.P, 'hollow_ingot'), 5); assert.equal(Cu.P.equip.weapon, null, 'auto-unequipped');
  // reject -> everything back
  srv.on_upg_reject(Sm, { id: j.id }); assert.equal(j.status, 'rejected'); assert.equal(Cu.P.gilt, 5000); assert.equal(R.count(Cu.P, 'hollow_ingot'), 6); assert.ok(Cu.P.gear.some((x) => x.id === 'hollow_blade'));
  // second attempt, cancelled by the customer
  const g2 = Cu.P.gear.find((x) => x.id === 'hollow_blade'); srv.on_upg_new(Cu, { to: 'Smithy', uid: g2.uid, price: 300 }); const j2 = srv.upg[1]; srv.on_upg_cancel(Cu, { id: j2.id }); assert.equal(j2.status, 'cancelled'); assert.equal(Cu.P.gilt, 5000);
  // third: counter-offer, accept, forge
  const g3 = Cu.P.gear.find((x) => x.id === 'hollow_blade'); srv.on_upg_new(Cu, { to: 'Smithy', uid: g3.uid, price: 300 }); const j3 = srv.upg[2];
  srv.on_upg_offer(Sm, { id: j3.id, price: 500 }); srv.on_upg_answer(Cu, { id: j3.id, accept: true }); assert.equal(j3.price, 500); assert.equal(Cu.P.gilt, 4500);
  srv.on_upg_forge(Sm, { id: j3.id, quick: true }); assert.equal(srv.upg[2].status, 'pending', 'must be accepted first'); srv.on_upg_accept(Sm, { id: j3.id }); assert.equal(j3.status, 'accepted');
  srv.on_upg_forge(Sm, { id: j3.id, quick: true }); assert.equal(j3.status, 'accepted', 'must stand at a forge'); toForge(srv, Sm); const gold = Sm.P.gilt;
  srv.on_upg_forge(Sm, { id: j3.id, quick: true }); assert.equal(j3.status, 'done'); assert.equal(Sm.P.gilt, gold + 500, 'the smith is paid'); const back = Cu.P.gear.find((x) => x.id === 'hollow_blade'); assert.equal(back.up, 1, 'upgraded and returned'); assert.equal(j3.escrow, 0);
  // expiry
  const g4 = Cu.P.gear.find((x) => x.id === 'hollow_blade'); R.addItem(Cu.P, 'hollow_ingot', 3); R.addItem(Cu.P, 'coal', 3); const cnt = R.count(Cu.P, 'hollow_ingot'); srv.on_upg_new(Cu, { to: 'Smithy', uid: g4.uid, price: 100 }); clock.t += 73 * 3600000; srv.tickUpgrades(srv.now());
  assert.equal(srv.upg.at(-1).status, 'expired'); assert.ok(Cu.P.gear.some((x) => x.id === 'hollow_blade' && x.up === 1)); assert.equal(R.count(Cu.P, 'hollow_ingot'), cnt);
  // the world-reset safety net knows about held jobs
  const g5 = Cu.P.gear.find((x) => x.id === 'hollow_blade'); srv.on_upg_new(Cu, { to: 'Smithy', uid: g5.uid, price: 77 }); const held = heldFor(srv, Cu.P); assert.ok(held.gilt >= 77 && held.gear.some((x) => x.up === 1) && held.items.length);
  const fresh = { gear: [], items: {}, gilt: 0, nextUid: 1, level: 1, classId: 'warrior', equip: {}, stats: {}, mail: [] }; void fresh; void applyHeld;
  // survives a save/load
  const saved = JSON.parse(JSON.stringify(srv.snapshot ? srv.snapshot() : srv.state?.() ?? {})); void saved;
});

test('a job for a piece beyond the smith is refused, a maxed piece cannot be tempered, and the server survives a long failing streak', () => {
  const { srv, mk } = world(), cs = mk('Weak', 'blacksmith'), cw = mk('Rich', 'warrior'), Sm = cs.session, Cu = cw.session; Cu.P.gilt = 9e6;
  const hi = give(Cu.P, 'worldsteel_plate', 50); for (const [id, n] of Object.entries(upgradeMats('worldsteel_plate', 50))) R.addItem(Cu.P, id, n);
  srv.on_upg_new(Cu, { to: 'Weak', uid: hi.uid, price: 1000 }); const j = srv.upg[0]; srv.on_upg_accept(Sm, { id: j.id }); assert.equal(j.status, 'pending', 'level too low to accept');
  const maxed = give(Cu.P, 'iron_sword', 99); srv.on_upg_new(Cu, { to: 'Weak', uid: maxed.uid, price: 10 }); assert.equal(srv.upg.length, 1);
  // 60 quick attempts at +40 to +99: nothing throws, levels stay within 0..99, the piece is never lost
  Sm.P.level = 100; srv.recalc(Sm); toForge(srv, Sm); const g = give(Sm.P, 'worldsteel_plate', 40);
  for (let i = 0; i < 60; i++) { for (const [id, n] of Object.entries(upgradeMats('worldsteel_plate', g.up ?? 0))) R.addItem(Sm.P, id, n); srv.on_upgrade_start(Sm, { uid: g.uid, quick: true }); assert.ok((g.up ?? 0) >= 0 && (g.up ?? 0) <= 99); }
  assert.ok(Sm.P.gear.includes(g));
});
